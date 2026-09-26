import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { computeDhFlags, persistDhFlags } from '@/lib/dhFlags'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow longer processing for large Excel files

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) {
    throw new Error('Supabase URL or Key not configured.')
  }
  return createClient(url, key)
}

function cleanText(v: any): string {
  if (v == null) return ''
  return String(v).trim().replace(/\s+/g, ' ')
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const sheetNames = workbook.SheetNames
    const salesSheetName = sheetNames.find(s => s.toLowerCase().includes('sales'))
    const stockSheetName = sheetNames.find(s => s.toLowerCase().includes('stock'))

    if (!salesSheetName || !stockSheetName) {
      return NextResponse.json(
        { error: `Excel file must have both sales and stock sheets. Found: ${sheetNames.join(', ')}` },
        { status: 400 }
      )
    }

    const salesSheet = workbook.Sheets[salesSheetName]
    const stockSheet = workbook.Sheets[stockSheetName]

    const rawSales: any[] = XLSX.utils.sheet_to_json(salesSheet)
    const rawStock: any[] = XLSX.utils.sheet_to_json(stockSheet)

    if (rawSales.length === 0 || rawStock.length === 0) {
      return NextResponse.json({ error: 'One or more sheets in the file are empty.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Collect all DH items
    const itemsCatalog = new Map<string, string>() // sku -> name

    // Identify sales columns
    const firstSale = rawSales[0] || {}
    const saleSkuCol = Object.keys(firstSale).find(k => ['item_id', 'sku', 'item id'].includes(k.toLowerCase())) || 'Item_Id'
    const saleNameCol = Object.keys(firstSale).find(k => ['item_name', 'name', 'item name', 'sku_name'].includes(k.toLowerCase())) || 'Item_Name'
    const saleDateCol = Object.keys(firstSale).find(k => k.toLowerCase() === 'date') || 'Date'
    const saleGfvCol = Object.keys(firstSale).find(k => k.toLowerCase().includes('gfv')) || 'gfv_local'
    const saleQtyCol = Object.keys(firstSale).find(k => k.toLowerCase().includes('sold') || k.toLowerCase().includes('qty')) || 'sold_qty'

    for (const r of rawSales) {
      const sku = cleanText(r[saleSkuCol])
      const name = cleanText(r[saleNameCol])
      if (sku && sku !== 'nan') itemsCatalog.set(sku, name)
    }

    // Identify stock columns
    const firstStock = rawStock[0] || {}
    const stockSkuCol = Object.keys(firstStock).find(k => ['sku', 'item_id', 'item id'].includes(k.toLowerCase())) || 'sku'
    const stockNameCol = Object.keys(firstStock).find(k => ['sku_name', 'item_name', 'name'].includes(k.toLowerCase())) || 'sku_name'
    const stockDateCol = Object.keys(firstStock).find(k => k.toLowerCase() === 'date') || 'date'

    const metaStockCols = new Set([stockSkuCol, stockNameCol, stockDateCol])
    const storeCols = Object.keys(firstStock).filter(k => !metaStockCols.has(k))

    for (const r of rawStock) {
      const sku = cleanText(r[stockSkuCol])
      const name = cleanText(r[stockNameCol])
      if (sku && sku !== 'nan') {
        if (!itemsCatalog.has(sku) || (name && name.length > (itemsCatalog.get(sku) || '').length)) {
          itemsCatalog.set(sku, name)
        }
      }
    }

    // 2. Query existing dh_items in DB to preserve manual tagging
    const { data: existingItems, error: existingErr } = await supabase
      .from('dh_items')
      .select('id,dh_sku,dh_name,basepack_id,match_status')

    if (existingErr) {
      return NextResponse.json(
        {
          error: `Database query failed. Have you run migration 009_dh_integration.sql? (${existingErr.message})`,
        },
        { status: 500 }
      )
    }

    const existingBySku = new Map<string, any>((existingItems || []).map(r => [r.dh_sku, r]))

    // Fetch Basepacks and Pandamart Account Products for auto-matching
    const [{ data: basepacks }, { data: pandamartAcc }] = await Promise.all([
      supabase.from('basepacks').select('id,name'),
      supabase.from('accounts').select('id').eq('code', 'pandamart').maybeSingle(),
    ])

    const bpByName = new Map<string, string>(
      (basepacks || []).map(b => [cleanText(b.name).toLowerCase(), b.id])
    )

    const apBySku = new Map<string, string>()
    if (pandamartAcc?.id) {
      const { data: aps } = await supabase
        .from('account_products')
        .select('account_sku,basepack_id')
        .eq('account_id', pandamartAcc.id)
      for (const ap of aps || []) {
        if (ap.account_sku && ap.basepack_id) {
          apBySku.set(cleanText(ap.account_sku), ap.basepack_id)
        }
      }
    }

    // Insert new DH items
    const newItemsPayload: any[] = []
    let autoMatchedCount = 0
    const nowIso = new Date().toISOString()

    for (const [sku, name] of itemsCatalog.entries()) {
      if (existingBySku.has(sku)) continue

      let matchedBpId: string | null = null
      if (apBySku.has(sku)) {
        matchedBpId = apBySku.get(sku)!
      } else if (bpByName.has(cleanText(name).toLowerCase())) {
        matchedBpId = bpByName.get(cleanText(name).toLowerCase())!
      }

      if (matchedBpId) autoMatchedCount++

      newItemsPayload.push({
        dh_sku: sku,
        dh_name: name,
        basepack_id: matchedBpId,
        match_status: matchedBpId ? 'matched' : 'unmatched',
        matched_at: matchedBpId ? nowIso : null,
      })
    }

    if (newItemsPayload.length > 0) {
      for (const batch of chunkArray(newItemsPayload, 100)) {
        const { error: insErr } = await supabase.from('dh_items').insert(batch)
        if (insErr) throw insErr
      }
    }

    // Refresh all dh_items
    const { data: allItems } = await supabase.from('dh_items').select('id,dh_sku')
    const itemIdBySku = new Map<string, string>((allItems || []).map(r => [r.dh_sku, r.id]))

    // 3. Upsert stores if missing
    const { data: existingStores } = await supabase.from('dh_stores').select('id,store_code')
    const storeIdByCode = new Map<string, string>((existingStores || []).map(r => [r.store_code, r.id]))

    const missingStores = storeCols.filter(s => !storeIdByCode.has(s))
    if (missingStores.length > 0) {
      const newStoresPayload = missingStores.map(s => ({
        store_code: s,
        display_name: s,
        is_dc: s.toLowerCase() === 'dc',
      }))
      await supabase.from('dh_stores').upsert(newStoresPayload, { onConflict: 'store_code' })
      const { data: refreshedStores } = await supabase.from('dh_stores').select('id,store_code')
      for (const r of refreshedStores || []) {
        storeIdByCode.set(r.store_code, r.id)
      }
    }

    // 4. Batch upsert sales daily
    const salesMap = new Map<string, any>() // key: sale_date|item_id
    for (const r of rawSales) {
      const sku = cleanText(r[saleSkuCol])
      const itemId = itemIdBySku.get(sku)
      if (!itemId) continue

      let saleDate = ''
      if (r[saleDateCol] instanceof Date) {
        // Add 12 hours to safely absorb timezone/leap-second offset and avoid date shifting
        const adjusted = new Date(r[saleDateCol].getTime() + 12 * 3600 * 1000)
        saleDate = adjusted.toISOString().slice(0, 10)
      } else if (typeof r[saleDateCol] === 'string') {
        const clean = cleanText(r[saleDateCol])
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
          saleDate = clean.slice(0, 10)
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(clean)) {
          const parts = clean.split(/[\/\s]/)[0].split('/')
          if (parts[2].length === 2) parts[2] = '20' + parts[2]
          saleDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
        } else {
          saleDate = clean.slice(0, 10)
        }
      }
      if (!saleDate) continue

      const gfv = r[saleGfvCol] != null && !isNaN(Number(r[saleGfvCol])) ? Number(r[saleGfvCol]) : 0
      const qty = r[saleQtyCol] != null && !isNaN(parseInt(r[saleQtyCol], 10)) ? parseInt(r[saleQtyCol], 10) : 0

      const key = `${saleDate}|${itemId}`
      salesMap.set(key, {
        sale_date: saleDate,
        dh_item_id: itemId,
        gfv_local: gfv,
        sold_qty: qty,
      })
    }

    const salesPayload = Array.from(salesMap.values())
    let salesUpserted = 0
    for (const batch of chunkArray(salesPayload, 200)) {
      const { error: saleErr } = await supabase
        .from('dh_sales_daily')
        .upsert(batch, { onConflict: 'sale_date,dh_item_id' })
      if (saleErr) throw saleErr
      salesUpserted += batch.length
    }

    // 5. Batch upsert stock daily
    const stockMap = new Map<string, any>() // key: stock_date|item_id|store_id
    for (const r of rawStock) {
      const sku = cleanText(r[stockSkuCol])
      const itemId = itemIdBySku.get(sku)
      if (!itemId) continue

      let stockDate = ''
      if (r[stockDateCol] instanceof Date) {
        const adjusted = new Date(r[stockDateCol].getTime() + 12 * 3600 * 1000)
        stockDate = adjusted.toISOString().slice(0, 10)
      } else if (typeof r[stockDateCol] === 'string') {
        const clean = cleanText(r[stockDateCol])
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
          stockDate = clean.slice(0, 10)
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(clean)) {
          const parts = clean.split(/[\/\s]/)[0].split('/')
          if (parts[2].length === 2) parts[2] = '20' + parts[2]
          stockDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
        } else {
          stockDate = clean.slice(0, 10)
        }
      }
      if (!stockDate) continue

      for (const storeCode of storeCols) {
        const storeId = storeIdByCode.get(storeCode)
        if (!storeId) continue

        const rawVal = r[storeCode]
        const qty = rawVal != null && !isNaN(parseInt(rawVal, 10)) ? parseInt(rawVal, 10) : 0

        const key = `${stockDate}|${itemId}|${storeId}`
        stockMap.set(key, {
          stock_date: stockDate,
          dh_item_id: itemId,
          dh_store_id: storeId,
          qty,
        })
      }
    }

    const stockPayload = Array.from(stockMap.values())
    let stockUpserted = 0
    for (const batch of chunkArray(stockPayload, 200)) {
      const { error: stockErr } = await supabase
        .from('dh_stock_daily')
        .upsert(batch, { onConflict: 'stock_date,dh_item_id,dh_store_id' })
      if (stockErr) throw stockErr
      stockUpserted += batch.length
    }

    // 6. Automated DH flagging pass
    let flagsSummary: any = null
    try {
      const computed = await computeDhFlags(supabase)
      const persistRes = await persistDhFlags(supabase, computed.flags)
      flagsSummary = {
        total_flags: computed.flags.length,
        critical_count: computed.summary.critical_count,
        warning_count: computed.summary.warning_count,
        upserted_count: persistRes.upsertedCount,
        resolved_count: persistRes.resolvedCount,
        mirrored_alerts: persistRes.mirroredAlertsCount,
      }
    } catch (flagErr) {
      console.warn('Flag generation pass error after import:', flagErr)
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_catalog_items: itemIdBySku.size,
        new_items_added: newItemsPayload.length,
        auto_matched_new: autoMatchedCount,
        sales_records_upserted: salesUpserted,
        stock_records_upserted: stockUpserted,
        active_stores_count: storeCols.length,
        flags: flagsSummary,
      },
    })
  } catch (err: any) {
    console.error('DH import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
