import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const REQUIRED_COLUMNS = [
  'daraz_sku',
  'sku_status_details',
  'sku_status',
  'Total - Stock',
  'product_name',
  'MRP',
  'Sale Price',
]

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

function parseSnapshotDate(filename: string): string | null {
  const name = filename.replace(/\.[^/.]+$/, '')
  const mIso = name.match(/(\d{4})[-_](\d{2})[-_](\d{2})/)
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`

  const mCompact = name.match(/(\d{4})(\d{2})(\d{2})/)
  if (mCompact) return `${mCompact[1]}-${mCompact[2]}-${mCompact[3]}`

  const mText = name.match(/(\d{1,2})(?:st|nd|rd|th)?[-_\s]+([A-Za-z]{3,9})/i)
  if (mText) {
    const day = parseInt(mText[1], 10)
    const month = MONTH_MAP[mText[2].toLowerCase()]
    if (month && day >= 1 && day <= 31) {
      const today = new Date()
      let year = today.getFullYear()
      const d = new Date(year, month - 1, day)
      if (d > today) year -= 1
      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      return `${year}-${mm}-${dd}`
    }
  }
  return null
}

function chunkArray<T>(items: T[], size = 300): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const customDate = formData.get('date') as string | null
    const dryRun = formData.get('dry_run') === 'true'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No Excel file provided.' }, { status: 400 })
    }

    const filename = file.name || 'daraz_dod.xlsx'
    const snapshotDate = customDate || parseSnapshotDate(filename) || new Date().toISOString().slice(0, 10)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const sheetName = workbook.SheetNames.includes('Sheet2') ? 'Sheet2' : workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      return NextResponse.json({ success: false, error: `Sheet '${sheetName}' not found in workbook.` }, { status: 400 })
    }

    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null })
    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Sheet contains no rows.' }, { status: 400 })
    }

    // Validate columns
    const firstRow = rawRows[0] || {}
    const cols = Object.keys(firstRow).map((k) => k.trim())
    const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c))
    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns: ${missing.join(', ')}`,
      }, { status: 400 })
    }

    // Check duplicates
    const skuMap = new Map<string, number>()
    for (const r of rawRows) {
      const sku = String(r['daraz_sku'] || '').trim()
      skuMap.set(sku, (skuMap.get(sku) || 0) + 1)
    }
    const duplicates = Array.from(skuMap.entries()).filter(([_, count]) => count > 1).map(([sku]) => sku)
    if (duplicates.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Duplicate daraz_sku found in file (${duplicates.length}): ${duplicates.slice(0, 5).join(', ')}`,
      }, { status: 400 })
    }

    // Filter Normal SKUs
    const normalRows = rawRows.filter((r) => String(r['sku_status_details'] || '').trim() === 'Normal')
    const rowsTotal = rawRows.length
    const rowsNormal = normalRows.length

    // Connect to database
    const supabase = getAdminClient()

    // Fetch Daraz account
    const { data: accData, error: accErr } = await supabase
      .from('accounts')
      .select('id,code,name')
      .eq('code', 'daraz')
      .single()
    if (accErr || !accData) {
      return NextResponse.json({ success: false, error: 'Daraz account not found in database.' }, { status: 500 })
    }
    const darazId = accData.id

    // Fetch active Daraz products
    const { data: products } = await supabase
      .from('account_products')
      .select('id,basepack_id,account_sku,active')
      .eq('account_id', darazId)
      .eq('active', true)

    const masterMap = new Map<string, any>()
    for (const p of products || []) {
      if (p.account_sku) masterMap.set(p.account_sku.trim().toLowerCase(), p)
    }

    // Fetch active Daraz scopes
    const { data: scopes } = await supabase
      .from('basepack_scopes')
      .select('id,basepack_id,expected_listed,ola_enabled,active')
      .eq('account_id', darazId)
      .eq('active', true)
      .eq('ola_enabled', true)
      .eq('expected_listed', true)

    const darazScopedBpIds = new Set((scopes || []).map((s) => s.basepack_id))

    // Classify rows
    const mappedRows: any[] = []
    const unmappedRows: any[] = []
    const bpStocks = new Map<string, number[]>()

    let mappedZero = 0
    let mappedLow = 0
    let unmappedZero = 0
    let unmappedLow = 0

    for (const r of normalRows) {
      const skuStr = String(r['daraz_sku'] || '').trim()
      const skuLower = skuStr.toLowerCase()
      const prodName = String(r['product_name'] || '').trim()
      const stockRaw = parseFloat(r['Total - Stock'])
      const stock = isNaN(stockRaw) || stockRaw < 0 ? 0 : Math.floor(stockRaw)
      const mrp = parseFloat(r['MRP']) || null
      const salePrice = parseFloat(r['Sale Price']) || null
      const available = stock > 0
      const lowStock = stock >= 1 && stock <= 9

      const prod = masterMap.get(skuLower)
      if (prod) {
        if (stock === 0) mappedZero++
        if (lowStock) mappedLow++

        mappedRows.push({
          daraz_sku: skuStr,
          product_name: prodName,
          stock_qty: stock,
          mrp,
          sale_price: salePrice,
          available,
          low_stock: lowStock,
          account_product_id: prod.id,
          basepack_id: prod.basepack_id,
          match_status: 'mapped',
        })

        if (!bpStocks.has(prod.basepack_id)) {
          bpStocks.set(prod.basepack_id, [])
        }
        bpStocks.get(prod.basepack_id)!.push(stock)
      } else {
        if (stock === 0) unmappedZero++
        if (lowStock) unmappedLow++

        unmappedRows.push({
          daraz_sku: skuStr,
          product_name: prodName,
          stock_qty: stock,
          mrp,
          sale_price: salePrice,
          available,
          low_stock: lowStock,
          account_product_id: null,
          basepack_id: null,
          match_status: 'unmapped',
        })
      }
    }

    const rowsMapped = mappedRows.length
    const rowsUnmapped = unmappedRows.length

    // Basepack scoped metrics
    const scopedWithNormal = Array.from(darazScopedBpIds).filter((bpId) => bpStocks.has(bpId))
    const scopedNoNormal = Array.from(darazScopedBpIds).filter((bpId) => !bpStocks.has(bpId))

    const basepacksScoped = scopedWithNormal.length
    const basepacksNoNormal = scopedNoNormal.length

    const availableBps = scopedWithNormal.filter((bpId) => {
      const arr = bpStocks.get(bpId) || []
      return arr.some((st) => st > 0)
    })
    const nolaBps = scopedWithNormal.filter((bpId) => {
      const arr = bpStocks.get(bpId) || []
      return arr.every((st) => st === 0)
    })

    const availableCount = availableBps.length
    const nolaCount = nolaBps.length
    const darazOlaPct = basepacksScoped > 0 ? Math.round((availableCount / basepacksScoped) * 1000) / 10 : 0
    const availableLowStockCount = availableBps.filter((bpId) => {
      const arr = bpStocks.get(bpId) || []
      return arr.reduce((a, b) => a + b, 0) < 10
    }).length

    const summary = {
      file_name: filename,
      snapshot_date: snapshotDate,
      rows_total: rowsTotal,
      rows_normal: rowsNormal,
      rows_mapped: rowsMapped,
      rows_unmapped: rowsUnmapped,
      unmapped_zero_stock: unmappedZero,
      unmapped_low_stock: unmappedLow,
      master_basepacks: darazScopedBpIds.size,
      basepacks_scoped: basepacksScoped,
      basepacks_no_normal: basepacksNoNormal,
      basepacks_available: availableCount,
      basepacks_nola: nolaCount,
      daraz_ola_pct: darazOlaPct,
      mapped_zero_stock: mappedZero,
      mapped_low_stock: mappedLow,
      available_basepacks_low_stock: availableLowStockCount,
      status: 'completed',
      dry_run: dryRun,
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        summary,
        message: `Validated ${filename} for ${snapshotDate}. Result: ${darazOlaPct}% Daraz OLA.`,
      })
    }

    // Write to Supabase
    // 1. Delete previous DOD observations for this date
    try {
      await supabase
        .from('product_observations')
        .delete()
        .eq('account_id', darazId)
        .eq('observed_date', snapshotDate)
        .eq('source', 'dod')
    } catch {}
    try {
      await supabase
        .from('product_observations')
        .delete()
        .eq('account_id', darazId)
        .eq('observed_date', snapshotDate)
        .filter('evidence->>source', 'eq', 'dod')
    } catch {}

    // 2. Insert observations
    const obsPayload = mappedRows.map((r) => ({
      observed_at: `${snapshotDate}T09:00:00+06:00`,
      observed_date: snapshotDate,
      account_id: darazId,
      location_id: null,
      basepack_id: r.basepack_id,
      account_product_id: r.account_product_id,
      account_sku: r.daraz_sku,
      product_name: r.product_name,
      in_stock: r.available,
      price: r.sale_price,
      original_price: r.mrp,
      promo_price: r.sale_price,
      status: 'Normal',
      source: 'dod',
      stock_qty: r.stock_qty,
      evidence: {
        source: 'dod',
        stock_qty: r.stock_qty,
        mrp: r.mrp,
        sale_price: r.sale_price,
        daraz_sku: r.daraz_sku,
      },
    }))

    for (const batch of chunkArray(obsPayload, 300)) {
      try {
        await supabase.from('product_observations').insert(batch)
      } catch {
        const fallback = batch.map(({ source, stock_qty, ...rest }) => rest)
        await supabase.from('product_observations').insert(fallback)
      }
    }

    // 3. Insert audit record in daraz_dod_uploads
    let uploadId: string | null = null
    try {
      await supabase.from('daraz_dod_uploads').delete().eq('snapshot_date', snapshotDate)
      const { data: upData } = await supabase.from('daraz_dod_uploads').insert({
        snapshot_date: snapshotDate,
        file_name: filename,
        rows_total: rowsTotal,
        rows_normal: rowsNormal,
        rows_mapped: rowsMapped,
        rows_unmapped: rowsUnmapped,
        basepacks_scoped: basepacksScoped,
        basepacks_no_normal: basepacksNoNormal,
        status: 'completed',
        uploaded_at: new Date().toISOString(),
        uploaded_by: 'dashboard_ui',
      }).select('id').single()
      if (upData) uploadId = upData.id
    } catch {}

    // 4. Insert daraz_dod_daily
    try {
      await supabase.from('daraz_dod_daily').delete().eq('snapshot_date', snapshotDate)
      const allDaily = [...mappedRows, ...unmappedRows].map((r) => ({
        snapshot_date: snapshotDate,
        upload_id: uploadId,
        daraz_sku: r.daraz_sku,
        product_name: r.product_name,
        stock_qty: r.stock_qty,
        mrp: r.mrp,
        sale_price: r.sale_price,
        account_product_id: r.account_product_id,
        basepack_id: r.basepack_id,
        match_status: r.match_status,
        low_stock: r.low_stock,
      }))
      for (const batch of chunkArray(allDaily, 300)) {
        await supabase.from('daraz_dod_daily').insert(batch)
      }
    } catch {}

    // 5. Compute availability_snapshots
    await supabase
      .from('availability_snapshots')
      .delete()
      .eq('account_id', darazId)
      .eq('snapshot_date', snapshotDate)

    const snapPayload: any[] = []
    for (const bpId of scopedWithNormal) {
      const stocks = bpStocks.get(bpId) || []
      const available = stocks.some((s) => s > 0)
      const combined = stocks.reduce((a, b) => a + b, 0)
      snapPayload.push({
        snapshot_date: snapshotDate,
        account_id: darazId,
        location_id: null,
        basepack_id: bpId,
        available,
        sku_expected: stocks.length,
        sku_observed: stocks.length,
        sku_available: stocks.filter((s) => s > 0).length,
        reason: available ? 'available' : 'all_observed_skus_unavailable',
        evidence: {
          source: 'dod',
          total_stock: combined,
          low_stock: available && combined < 10,
        },
      })
    }

    for (const batch of chunkArray(snapPayload, 300)) {
      await supabase.from('availability_snapshots').insert(batch)
    }

    return NextResponse.json({
      success: true,
      dry_run: false,
      summary,
      message: `Successfully imported ${filename} for ${snapshotDate}. Daraz OLA: ${darazOlaPct}%.`,
    })
  } catch (err: any) {
    console.error('Daraz DOD upload error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error while processing DOD file.',
    }, { status: 500 })
  }
}
