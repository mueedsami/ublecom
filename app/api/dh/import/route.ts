import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { computeDhFlags, persistDhFlags } from '@/lib/dhFlags'
import {
  getInScopePandamartSkus,
  computeDhDumpCoverage,
  checkDhScopeSchemaInstalled,
} from '@/lib/dhScope'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow longer processing for large Excel files

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

function parseDateCell(v: any): string {
  if (v == null) return ''
  if (v instanceof Date) {
    const adjusted = new Date(v.getTime() + 12 * 3600 * 1000)
    return adjusted.toISOString().slice(0, 10)
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
  }
  const clean = cleanText(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10)
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(clean)) {
    const parts = clean.split(/[\/\s]/)[0].split('/')
    let y = parts[2]
    if (y.length === 2) y = '20' + y
    return `${y}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  }
  return clean.slice(0, 10)
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

    // 1. Identify sales columns
    const firstSale = rawSales[0] || {}
    const saleSkuCol = Object.keys(firstSale).find(k => ['item_id', 'sku', 'item id'].includes(k.toLowerCase())) || 'Item_Id'
    const saleNameCol = Object.keys(firstSale).find(k => ['item_name', 'name', 'item name', 'sku_name'].includes(k.toLowerCase())) || 'Item_Name'
    const saleDateCol = Object.keys(firstSale).find(k => k.toLowerCase() === 'date') || 'Date'
    const saleGfvCol = Object.keys(firstSale).find(k => k.toLowerCase().includes('gfv')) || 'gfv_local'
    const saleQtyCol = Object.keys(firstSale).find(k => k.toLowerCase().includes('sold') || k.toLowerCase().includes('qty')) || 'sold_qty'

    // Identify stock columns
    const firstStock = rawStock[0] || {}
    const stockSkuCol = Object.keys(firstStock).find(k => ['sku', 'item_id', 'item id'].includes(k.toLowerCase())) || 'sku'
    const stockNameCol = Object.keys(firstStock).find(k => ['sku_name', 'item_name', 'name'].includes(k.toLowerCase())) || 'sku_name'
    const stockDateCol = Object.keys(firstStock).find(k => k.toLowerCase() === 'date') || 'date'

    const metaStockCols = new Set([stockSkuCol, stockNameCol, stockDateCol])
    const storeCols = Object.keys(firstStock).filter(k => !metaStockCols.has(k))

    // Collect all unique SKUs & names from dump
    const itemsCatalog = new Map<string, string>() // sku -> name
    const skuDumpStats = new Map<string, { sold_qty_30d: number; total_stock: number; last_sale_date: string }>()

    let latestDumpDate = ''

    // Parse sales rows for catalog & stats
    for (const r of rawSales) {
      const sku = cleanText(r[saleSkuCol])
      const name = cleanText(r[saleNameCol])
      if (!sku || sku === 'nan') continue

      if (!itemsCatalog.has(sku) || (name && name.length > (itemsCatalog.get(sku) || '').length)) {
        itemsCatalog.set(sku, name)
      }

      const sDate = parseDateCell(r[saleDateCol])
      if (sDate && (!latestDumpDate || sDate > latestDumpDate)) {
        latestDumpDate = sDate
      }

      const qty = r[saleQtyCol] != null && !isNaN(parseInt(r[saleQtyCol], 10)) ? parseInt(r[saleQtyCol], 10) : 0
      let cur = skuDumpStats.get(sku)
      if (!cur) {
        cur = { sold_qty_30d: 0, total_stock: 0, last_sale_date: sDate }
        skuDumpStats.set(sku, cur)
      }
      cur.sold_qty_30d += qty
      if (sDate && (!cur.last_sale_date || sDate > cur.last_sale_date)) {
        cur.last_sale_date = sDate
      }
    }

    // Parse stock rows for catalog & stats
    for (const r of rawStock) {
      const sku = cleanText(r[stockSkuCol])
      const name = cleanText(r[stockNameCol])
      if (!sku || sku === 'nan') continue

      if (!itemsCatalog.has(sku) || (name && name.length > (itemsCatalog.get(sku) || '').length)) {
        itemsCatalog.set(sku, name)
      }

      const sDate = parseDateCell(r[stockDateCol])
      if (sDate && (!latestDumpDate || sDate > latestDumpDate)) {
        latestDumpDate = sDate
      }

      let cur = skuDumpStats.get(sku)
      if (!cur) {
        cur = { sold_qty_30d: 0, total_stock: 0, last_sale_date: '' }
        skuDumpStats.set(sku, cur)
      }

      for (const stCol of storeCols) {
        const rawQty = r[stCol]
        const q = rawQty != null && !isNaN(parseInt(rawQty, 10)) ? parseInt(rawQty, 10) : 0
        cur.total_stock += q
      }
    }

    if (!latestDumpDate) {
      latestDumpDate = new Date().toISOString().slice(0, 10)
    }

    // 2. Load the canonical Pandamart legacy SKU scope from account_products
    const scope = await getInScopePandamartSkus(supabase)
    const dumpSkus = new Set(itemsCatalog.keys())
    const coverage = computeDhDumpCoverage(dumpSkus, scope.skuMap)

    // 3. Safety Guard: warn if far fewer than legacy list SKUs are found in the dump
    if (scope.skuMap.size > 0 && coverage.list_skus_found < 30) {
      return NextResponse.json(
        {
          error:
            `Safety Guard Triggered: Found only ${coverage.list_skus_found} of ${coverage.list_skus_total} Pandamart legacy SKUs in this dump. ` +
            `Expected ~200+ matching SKUs. Import aborted to prevent corrupting analytics with an unexpected file format or mismatched account.`,
        },
        { status: 400 }
      )
    }

    // Check if migration 014 columns (last_seen_date, skip_stats) are available in DB
    const is014Installed = await checkDhScopeSchemaInstalled(supabase)

    // 4. Query existing dh_items in DB
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
    const nowIso = new Date().toISOString()

    // Promote or update existing items
    const itemsToUpdate: any[] = []
    for (const [sku, item] of existingBySku.entries()) {
      const inScope = scope.skuMap.get(sku)
      const isDumpPresent = dumpSkus.has(sku)
      const stats = skuDumpStats.get(sku)

      if (inScope) {
        // On legacy list -> must be 'matched' with correct basepack_id
        if (item.match_status !== 'matched' || item.basepack_id !== inScope.basepack_id) {
          const patch: any = {
            id: item.id,
            match_status: 'matched',
            basepack_id: inScope.basepack_id,
            matched_at: nowIso,
            updated_at: nowIso,
          }
          if (is014Installed && isDumpPresent) {
            patch.last_seen_date = latestDumpDate
          }
          itemsToUpdate.push(patch)
        } else if (is014Installed && isDumpPresent) {
          itemsToUpdate.push({
            id: item.id,
            last_seen_date: latestDumpDate,
            updated_at: nowIso,
          })
        }
      } else {
        // Off-list
        if (item.match_status !== 'ignored') {
          const patch: any = {
            id: item.id,
            match_status: 'ignored',
            updated_at: nowIso,
          }
          if (is014Installed) {
            if (isDumpPresent) {
              patch.last_seen_date = latestDumpDate
              patch.skip_stats = stats || {}
            }
          }
          itemsToUpdate.push(patch)
        } else if (is014Installed && isDumpPresent) {
          itemsToUpdate.push({
            id: item.id,
            last_seen_date: latestDumpDate,
            skip_stats: stats || {},
            updated_at: nowIso,
          })
        }
      }
    }

    if (itemsToUpdate.length > 0) {
      for (const batch of chunkArray(itemsToUpdate, 100)) {
        for (const item of batch) {
          const { id, ...patch } = item
          await supabase.from('dh_items').update(patch).eq('id', id)
        }
      }
    }

    // Insert new items from dump
    const newItemsPayload: any[] = []
    let autoMatchedCount = 0

    for (const [sku, name] of itemsCatalog.entries()) {
      if (existingBySku.has(sku)) continue

      const inScope = scope.skuMap.get(sku)
      const stats = skuDumpStats.get(sku)

      if (inScope) {
        autoMatchedCount++
        const itemObj: any = {
          dh_sku: sku,
          dh_name: name,
          basepack_id: inScope.basepack_id,
          match_status: 'matched',
          matched_at: nowIso,
        }
        if (is014Installed) {
          itemObj.last_seen_date = latestDumpDate
        }
        newItemsPayload.push(itemObj)
      } else {
        const itemObj: any = {
          dh_sku: sku,
          dh_name: name,
          basepack_id: null,
          match_status: 'ignored',
          matched_at: null,
        }
        if (is014Installed) {
          itemObj.last_seen_date = latestDumpDate
          itemObj.skip_stats = stats || {}
          itemObj.dismissed = false
        }
        newItemsPayload.push(itemObj)
      }
    }

    if (newItemsPayload.length > 0) {
      for (const batch of chunkArray(newItemsPayload, 100)) {
        const { error: insErr } = await supabase.from('dh_items').insert(batch)
        if (insErr) {
          if (insErr.code === '42501' || insErr.message?.toLowerCase().includes('row-level security')) {
            throw new Error(
              `Row-level security policy violation for table "dh_items". ` +
              `Make sure SUPABASE_SERVICE_ROLE_KEY is set in dashboard/.env.local (and in your Vercel/deployment settings), ` +
              `or apply migration supabase/013_fix_rls_policies.sql in your Supabase SQL editor.`
            )
          }
          throw insErr
        }
      }
    }

    // Refresh all dh_items to get IDs and match_status
    const { data: allItems } = await supabase.from('dh_items').select('id,dh_sku,match_status')
    const itemIdBySku = new Map<string, string>((allItems || []).map(r => [r.dh_sku, r.id]))
    const matchedItemIdSet = new Set<string>(
      (allItems || []).filter(r => r.match_status === 'matched').map(r => r.id)
    )

    // 5. Upsert stores if missing
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

    // 6. Batch upsert sales daily — SKIP ANY ITEM THAT IS NOT 'MATCHED'
    const salesMap = new Map<string, any>() // key: sale_date|item_id
    for (const r of rawSales) {
      const sku = cleanText(r[saleSkuCol])
      const itemId = itemIdBySku.get(sku)
      if (!itemId) continue

      // Only write sales records for matched items on the legacy SKU list
      if (!matchedItemIdSet.has(itemId)) continue

      const saleDate = parseDateCell(r[saleDateCol])
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

    // 7. Batch upsert stock daily — SKIP ANY ITEM THAT IS NOT 'MATCHED'
    const stockMap = new Map<string, any>() // key: stock_date|item_id|store_id
    for (const r of rawStock) {
      const sku = cleanText(r[stockSkuCol])
      const itemId = itemIdBySku.get(sku)
      if (!itemId) continue

      // Only write stock records for matched items on the legacy SKU list
      if (!matchedItemIdSet.has(itemId)) continue

      const stockDate = parseDateCell(r[stockDateCol])
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

    // 8. Automated DH flagging pass (strictly on matched items)
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
        in_scope_items_tracked: matchedItemIdSet.size,
        new_items_added: newItemsPayload.length,
        auto_matched_new: autoMatchedCount,
        sales_records_upserted: salesUpserted,
        stock_records_upserted: stockUpserted,
        active_stores_count: storeCols.length,
        coverage: {
          list_skus_total: coverage.list_skus_total,
          list_skus_found: coverage.list_skus_found,
          list_skus_missing: coverage.list_skus_missing,
          dump_skus_total: coverage.dump_skus_total,
          dump_skus_skipped: coverage.dump_skus_skipped,
          missing_skus_sample: coverage.missing_from_dump.slice(0, 10),
        },
        flags: flagsSummary,
      },
    })
  } catch (err: any) {
    console.error('DH import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
