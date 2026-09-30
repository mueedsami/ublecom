import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function chunkArray<T>(items: T[], size = 200): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function cleanText(v: any): string {
  if (v == null) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

function cleanNumeric(v: any): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v).replace(/,/g, '').replace(/৳/g, '').replace(/\$/g, '').trim()
  if (s.startsWith('=') || s.startsWith('#')) return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function cleanBarcode(val: any): string {
  if (val == null) return ''
  if (typeof val === 'number') {
    return BigInt(Math.round(val)).toString()
  }
  const s = String(val).trim()
  return s
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, may_: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

function extractDateFromFileName(fileName: string): string {
  const name = fileName.replace(/\.xlsx?$/i, '')
  // ISO date: YYYY-MM-DD
  const iso = name.match(/(\d{4})[-_](\d{1,2})[-_](\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }
  // Month name + Day: e.g. Sep29 or Sep 29 or September 29
  const mDay = name.match(/([A-Za-z]{3,9})\s*(\d{1,2})(?:st|nd|rd|th)?/i)
  if (mDay) {
    const monthStr = mDay[1].toLowerCase()
    const monthNum = MONTH_NAMES[monthStr]
    const day = parseInt(mDay[2], 10)
    if (monthNum && day >= 1 && day <= 31) {
      const year = 2026 // Current working calendar year for dataset
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  // Day + Month: e.g. 29Sep or 29 September
  const dayM = name.match(/(\d{1,2})\s*([A-Za-z]{3,9})/i)
  if (dayM) {
    const day = parseInt(dayM[1], 10)
    const monthStr = dayM[2].toLowerCase()
    const monthNum = MONTH_NAMES[monthStr]
    if (monthNum && day >= 1 && day <= 31) {
      const year = 2026
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return new Date().toISOString().slice(0, 10)
}

function computeAsOfDate(fileDateStr: string, basis: 'same_day' | 'previous_day'): string {
  const parts = fileDateStr.split('-').map(Number)
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (basis === 'previous_day') {
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

function isBundleProduct(name: string): boolean {
  if (!name) return false
  const trimmed = name.trim()
  if (trimmed.startsWith('[B1G1]') || trimmed.startsWith('[Combo]')) return true
  if (/buy\s*one/i.test(trimmed) && /get\s*one/i.test(trimmed)) return true
  if (/& get one/i.test(trimmed) || /buy 2/i.test(trimmed)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const requestedFileDate = (formData.get('fileDate') as string || '').trim()
    const requestedStockBasis = ((formData.get('stockBasis') as string || 'previous_day').trim()) as 'same_day' | 'previous_day'
    const isPreview = req.nextUrl.searchParams.get('preview') === 'true' || formData.get('preview') === 'true'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No Excel file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: true })

    const sheetNames = workbook.SheetNames
    if (sheetNames.length === 0) {
      return NextResponse.json({ success: false, error: 'Excel file has no sheets' }, { status: 400 })
    }

    const targetSheetName = sheetNames[0]
    const sheet = workbook.Sheets[targetSheetName]
    if (!sheet) {
      return NextResponse.json({ success: false, error: `Sheet "${targetSheetName}" not found.` }, { status: 400 })
    }

    // Convert sheet to JSON array of objects, keeping raw cell values for barcodes
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { raw: true, defval: null })
    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: `Sheet "${targetSheetName}" has no data rows.` }, { status: 400 })
    }

    // Identify the first 9 useful columns by matching headers
    const firstRow = rawRows[0] || {}
    const colKeys = Object.keys(firstRow)

    const barcodesKey = colKeys.find(k => /^barcodes?$/i.test(k.trim()))
    const skuKey = colKeys.find(k => /^sku$/i.test(k.trim()))
    const nameKey = colKeys.find(k => /^product\s*name$/i.test(k.trim())) || colKeys.find(k => /^name$/i.test(k.trim()))
    const categoryKey = colKeys.find(k => /^category$/i.test(k.trim()))
    const tpKey = colKeys.find(k => /^tp$/i.test(k.trim()))
    const mrpKey = colKeys.find(k => /^mrp$/i.test(k.trim()))
    const sellingPriceKey = colKeys.find(k => /^selling\s*price$/i.test(k.trim()))
    const sales30dKey = colKeys.find(k => /30\s*day\s*sale/i.test(k.trim()))
    const totalStockKey = colKeys.find(k => /total\s*stock/i.test(k.trim())) || colKeys.find(k => /^stock$/i.test(k.trim()))

    if (!skuKey || !totalStockKey) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns (SKU or Total Stock). Found headers: ${colKeys.join(', ')}`,
      }, { status: 400 })
    }

    // Determine Dates & Basis
    const fileDate = requestedFileDate || extractDateFromFileName(file.name)
    const stockBasis = requestedStockBasis === 'same_day' ? 'same_day' : 'previous_day'
    const asOfDate = computeAsOfDate(fileDate, stockBasis)

    // Mistake Catcher 4: Future date block (Bangladesh UTC+6)
    const nowDhaka = new Date(Date.now() + 6 * 3600 * 1000)
    const todayDhakaStr = nowDhaka.toISOString().slice(0, 10)
    if (asOfDate > todayDhakaStr) {
      return NextResponse.json({
        success: false,
        error: `Future date block: Stock as-of date (${asOfDate}) cannot be in the future (today is ${todayDhakaStr}).`,
      }, { status: 400 })
    }

    // 30-day sales window ending on asOfDate
    const asOfUtc = new Date(asOfDate + 'T00:00:00Z')
    const startUtc = new Date(asOfUtc)
    startUtc.setUTCDate(startUtc.getUTCDate() - 29)
    const salesPeriodStart = startUtc.toISOString().slice(0, 10)
    const salesPeriodEnd = asOfDate

    // Parse and validate rows
    const seenSkus = new Set<string>()
    const duplicatesDropped: string[] = []
    let negativeStockCount = 0

    interface ParsedFoodiRow {
      sku: string
      name: string
      category: string
      barcodes: string[]
      barcodeRaw: string
      tp: number
      mrp: number
      sellingPrice: number
      sales30d: number
      stock: number
      clampedStock: number
      isBundle: boolean
    }

    const parsedRows: ParsedFoodiRow[] = []

    for (const r of rawRows) {
      const rawSku = r[skuKey]
      if (rawSku == null || rawSku === '') continue
      const sku = cleanText(rawSku)
      if (!sku) continue

      if (seenSkus.has(sku)) {
        duplicatesDropped.push(sku)
        continue // De-duplicate: keep first occurrence
      }
      seenSkus.add(sku)

      const name = cleanText(nameKey ? r[nameKey] : sku)
      const category = cleanText(categoryKey ? r[categoryKey] : 'Uncategorized')
      const barcodeRaw = cleanBarcode(barcodesKey ? r[barcodesKey] : '')
      const barcodes = barcodeRaw
        ? barcodeRaw.split('>>').map(b => b.trim()).filter(Boolean)
        : []

      const tp = cleanNumeric(tpKey ? r[tpKey] : 0)
      const mrp = cleanNumeric(mrpKey ? r[mrpKey] : 0)
      const sellingPrice = cleanNumeric(sellingPriceKey ? r[sellingPriceKey] : 0)
      const sales30d = cleanNumeric(sales30dKey ? r[sales30dKey] : 0)
      const rawStock = cleanNumeric(r[totalStockKey])

      if (rawStock < 0) {
        negativeStockCount++
      }
      const clampedStock = Math.max(0, rawStock)
      const isBundle = isBundleProduct(name)

      parsedRows.push({
        sku,
        name,
        category,
        barcodes,
        barcodeRaw,
        tp,
        mrp,
        sellingPrice,
        sales30d,
        stock: rawStock,
        clampedStock,
        isBundle,
      })
    }

    // Compute preview statistics
    const totalSkus = parsedRows.length
    const availableSkus = parsedRows.filter(r => r.clampedStock > 0).length
    const oosSkus = parsedRows.filter(r => r.clampedStock <= 0).length
    const lowStockSkus = parsedRows.filter(r => r.clampedStock >= 1 && r.clampedStock <= 9).length
    const bundlesCount = parsedRows.filter(r => r.isBundle).length
    const doubleBarcodesCount = parsedRows.filter(r => r.barcodes.length > 1).length
    const oosWithSalesCount = parsedRows.filter(r => r.clampedStock <= 0 && r.sales30d > 0).length
    const skusWithSalesCount = parsedRows.filter(r => r.sales30d > 0).length
    const olaPercentage = totalSkus > 0 ? Number(((availableSkus / totalSkus) * 100).toFixed(1)) : 0

    const categoriesBreakdown: Record<string, { total: number; available: number; oos: number; lowStock: number; ola: number }> = {}
    for (const r of parsedRows) {
      const cat = r.category || 'Uncategorized'
      if (!categoriesBreakdown[cat]) {
        categoriesBreakdown[cat] = { total: 0, available: 0, oos: 0, lowStock: 0, ola: 0 }
      }
      categoriesBreakdown[cat].total++
      if (r.clampedStock > 0) categoriesBreakdown[cat].available++
      else categoriesBreakdown[cat].oos++
      if (r.clampedStock >= 1 && r.clampedStock <= 9) categoriesBreakdown[cat].lowStock++
    }
    for (const cat of Object.keys(categoriesBreakdown)) {
      const c = categoriesBreakdown[cat]
      c.ola = c.total > 0 ? Number(((c.available / c.total) * 100).toFixed(1)) : 0
    }

    // Query Supabase for Account & Mistake Catchers
    const supabase = getAdminClient()

    // 1. Foodi Account
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('code', 'foodi')
      .limit(1)

    if (accErr || !accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: 'Foodi account not found in database.' }, { status: 500 })
    }
    const foodiId = accounts[0].id

    // 2. Fetch Latest Prior Upload for warnings
    const { data: priorUploads } = await supabase
      .from('marketplace_report_uploads')
      .select('id, report_date, stock_basis, stock_as_of, file_name, row_count, uploaded_at')
      .eq('account_id', foodiId)
      .order('report_date', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(5)

    const latestPriorUpload = priorUploads?.[0] || null

    // Mistake Catcher 1: Collision Warning
    const collisionUpload = priorUploads?.find(
      u => (u.stock_as_of === asOfDate) || (!u.stock_as_of && u.report_date === asOfDate)
    )
    const collisionWarning = collisionUpload
      ? {
          detected: true,
          collisionFile: collisionUpload.file_name,
          collisionUploadId: collisionUpload.id,
          asOfDate,
          message: `Another upload (${collisionUpload.file_name}) is already recorded for as-of date ${asOfDate}. Saving will replace that snapshot.`,
        }
      : null

    // Mistake Catcher 2: Basis Change Warning
    const basisChangeWarning =
      latestPriorUpload && latestPriorUpload.stock_basis && latestPriorUpload.stock_basis !== stockBasis
        ? {
            detected: true,
            previousBasis: latestPriorUpload.stock_basis,
            currentBasis: stockBasis,
            message: `Stock basis changed from ${
              latestPriorUpload.stock_basis === 'same_day' ? 'Same day' : 'Previous day (T-1)'
            } (used in previous upload) to ${
              stockBasis === 'same_day' ? 'Same day' : 'Previous day (T-1)'
            }.`,
          }
        : null

    // Mistake Catcher 3: Identical Stock Warning
    let identicalStockWarning: { detected: boolean; identicalPct: number; message: string } | null = null
    if (latestPriorUpload) {
      const { data: priorStockRows } = await supabase
        .from('marketplace_stock_snapshots')
        .select('current_stock, marketplace_items(sku)')
        .eq('upload_id', latestPriorUpload.id)

      if (priorStockRows && priorStockRows.length > 0) {
        const priorStockMap = new Map<string, number>()
        for (const ps of priorStockRows as any[]) {
          const sSku = ps.marketplace_items?.sku
          if (sSku) priorStockMap.set(sSku, Number(ps.current_stock || 0))
        }

        let matchingCount = 0
        let evaluatedCount = 0
        for (const row of parsedRows) {
          if (priorStockMap.has(row.sku)) {
            evaluatedCount++
            if (priorStockMap.get(row.sku) === row.clampedStock) {
              matchingCount++
            }
          }
        }

        if (evaluatedCount > 50) {
          const matchRatio = matchingCount / evaluatedCount
          if (matchRatio >= 0.99) {
            identicalStockWarning = {
              detected: true,
              identicalPct: Number((matchRatio * 100).toFixed(1)),
              message: `${(matchRatio * 100).toFixed(1)}% of SKUs have identical stock to the previous snapshot (${latestPriorUpload.file_name}). Please ensure you did not re-upload an old file by mistake.`,
            }
          }
        }
      }
    }

    // PREVIEW MODE RESPONSE
    if (isPreview) {
      return NextResponse.json({
        success: true,
        preview: true,
        fileDate,
        stockBasis,
        asOfDate,
        salesPeriod: {
          start: salesPeriodStart,
          end: salesPeriodEnd,
        },
        warnings: {
          collision: collisionWarning,
          basisChange: basisChangeWarning,
          identicalStock: identicalStockWarning,
        },
        stats: {
          totalRows: rawRows.length,
          uniqueSkus: totalSkus,
          availableSkus,
          oosSkus,
          lowStockSkus,
          bundlesCount,
          doubleBarcodesCount,
          oosWithSalesCount,
          skusWithSalesCount,
          negativeStockClamped: negativeStockCount,
          duplicatesDroppedCount: duplicatesDropped.length,
          olaPercentage,
          categories: categoriesBreakdown,
        },
        sampleRows: parsedRows.slice(0, 10).map((r, i) => ({
          index: i + 1,
          sku: r.sku,
          name: r.name,
          category: r.category,
          barcodes: r.barcodes,
          stock: r.clampedStock,
          sales30d: r.sales30d,
          tp: r.tp,
          mrp: r.mrp,
          sellingPrice: r.sellingPrice,
          isBundle: r.isBundle,
        })),
      })
    }

    // =========================================================================
    // COMMIT MODE: Ingest into Supabase
    // =========================================================================

    // 1. Check which columns exist on marketplace_items, marketplace_stock_snapshots, marketplace_report_uploads
    let supportsBarcodes = false
    let supportsCategory = false
    let supportsBundle = false
    let supportsSellingPrice = false
    let supportsStockBasis = false

    try {
      const { error: e1 } = await supabase.from('marketplace_items').select('barcodes').limit(1)
      if (!e1) supportsBarcodes = true
    } catch {}

    try {
      const { error: e2 } = await supabase.from('marketplace_items').select('category').limit(1)
      if (!e2) supportsCategory = true
    } catch {}

    try {
      const { error: e3 } = await supabase.from('marketplace_items').select('is_bundle').limit(1)
      if (!e3) supportsBundle = true
    } catch {}

    try {
      const { error: e4 } = await supabase.from('marketplace_stock_snapshots').select('selling_price').limit(1)
      if (!e4) supportsSellingPrice = true
    } catch {}

    try {
      const { error: e5 } = await supabase.from('marketplace_report_uploads').select('stock_basis').limit(1)
      if (!e5) supportsStockBasis = true
    } catch {}

    // 2. Fetch existing marketplace_items for Foodi
    const { data: existingItems } = await supabase
      .from('marketplace_items')
      .select('id, source_product_id, sku, name')
      .eq('account_id', foodiId)

    const existingBySku = new Map<string, any>()
    for (const item of existingItems || []) {
      if (item.sku) existingBySku.set(String(item.sku).trim(), item)
      if (item.source_product_id) existingBySku.set(String(item.source_product_id).trim(), item)
    }

    // 3. Upsert items: refresh name, category, barcodes, is_bundle on every upload
    const itemIdMap = new Map<string, string>() // sku -> marketplace_items.id
    const newItemsToInsert: any[] = []
    const itemsToUpdate: any[] = []

    for (const r of parsedRows) {
      const existing = existingBySku.get(r.sku)
      if (existing) {
        itemIdMap.set(r.sku, existing.id)
        // Update item details if supported
        const updatePayload: any = {
          name: r.name,
          vendor_name: r.category || 'Foodi',
          web_status: r.barcodeRaw || null,
          updated_at: new Date().toISOString(),
        }
        if (supportsBarcodes && r.barcodes.length > 0) updatePayload.barcodes = r.barcodes
        if (supportsCategory) updatePayload.category = r.category
        if (supportsBundle) updatePayload.is_bundle = r.isBundle
        itemsToUpdate.push({ id: existing.id, ...updatePayload })
      } else {
        const itemRecord: any = {
          account_id: foodiId,
          source_product_id: r.sku,
          sku: r.sku,
          name: r.name,
          vendor_name: r.category || 'Foodi',
          web_status: r.barcodeRaw || null,
          match_status: 'unmatched',
          basepack_id: null,
        }
        if (supportsBarcodes && r.barcodes.length > 0) itemRecord.barcodes = r.barcodes
        if (supportsCategory) itemRecord.category = r.category
        if (supportsBundle) itemRecord.is_bundle = r.isBundle
        newItemsToInsert.push(itemRecord)
      }
    }

    // Insert new items
    if (newItemsToInsert.length > 0) {
      for (const chunk of chunkArray(newItemsToInsert, 150)) {
        const { data: inserted, error: insErr } = await supabase
          .from('marketplace_items')
          .insert(chunk)
          .select('id, sku, source_product_id')

        if (insErr) {
          console.error('marketplace_items insert error, retrying without extended columns:', insErr)
          // Fallback without new columns if schema migration not applied yet
          const fallbackChunk = chunk.map(({ barcodes, category, is_bundle, ...rest }: any) => rest)
          const { data: fbIns } = await supabase
            .from('marketplace_items')
            .insert(fallbackChunk)
            .select('id, sku, source_product_id')

          for (const item of fbIns || []) {
            if (item.sku) itemIdMap.set(item.sku, item.id)
            if (item.source_product_id) itemIdMap.set(item.source_product_id, item.id)
          }
        } else {
          for (const item of inserted || []) {
            if (item.sku) itemIdMap.set(item.sku, item.id)
            if (item.source_product_id) itemIdMap.set(item.source_product_id, item.id)
          }
        }
      }
    }

    // Update existing items in batches (fire-and-forget or small chunks)
    for (const updateItem of itemsToUpdate.slice(0, 100)) {
      const { id, ...fields } = updateItem
      await supabase.from('marketplace_items').update(fields).eq('id', id)
    }

    // Refresh item IDs if any were missing
    if (itemIdMap.size < parsedRows.length) {
      const { data: allFoodiItems } = await supabase
        .from('marketplace_items')
        .select('id, sku, source_product_id')
        .eq('account_id', foodiId)

      for (const it of allFoodiItems || []) {
        if (it.sku) itemIdMap.set(it.sku, it.id)
        if (it.source_product_id) itemIdMap.set(it.source_product_id, it.id)
      }
    }

    // 4. Idempotency: Replace previous upload for the same asOfDate or fileDate
    const { data: matchingSnapshots } = await supabase
      .from('marketplace_stock_snapshots')
      .select('upload_id')
      .eq('account_id', foodiId)
      .eq('snapshot_date', asOfDate)

    const { data: matchingUploads } = await supabase
      .from('marketplace_report_uploads')
      .select('id')
      .eq('account_id', foodiId)
      .or(`report_date.eq.${fileDate},report_date.eq.${asOfDate}`)

    const uploadIdsToDelete = new Set<string>()
    for (const s of matchingSnapshots || []) {
      if (s.upload_id) uploadIdsToDelete.add(s.upload_id)
    }
    for (const u of matchingUploads || []) {
      if (u.id) uploadIdsToDelete.add(u.id)
    }

    for (const oldUpId of uploadIdsToDelete) {
      await supabase.from('marketplace_stock_snapshots').delete().eq('upload_id', oldUpId)
      await supabase.from('marketplace_sales_periods').delete().eq('upload_id', oldUpId)
      await supabase.from('marketplace_report_uploads').delete().eq('id', oldUpId)
    }

    // 5. Create Marketplace Upload record
    const periodLabel = `Stock as of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(asOfDate + 'T00:00:00Z'))}`
    const uploadPayload: any = {
      account_id: foodiId,
      period_label: periodLabel,
      report_date: fileDate, // File date preserved for upload log
      file_name: file.name,
      sheet_name: targetSheetName,
      row_count: parsedRows.length,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'foodi_importer',
    }

    if (supportsStockBasis) {
      uploadPayload.stock_basis = stockBasis
      uploadPayload.stock_as_of = asOfDate
    }

    // Also populate standard marketplace audit stats
    uploadPayload.core_count = parsedRows.length
    uploadPayload.extras_count = 0
    uploadPayload.duplicates_count = duplicatesDropped.length
    uploadPayload.ola_percentage = olaPercentage
    uploadPayload.basepacks_available = availableSkus
    uploadPayload.basepacks_total = totalSkus

    let uploadId: string
    const { data: newUpload, error: upErr } = await supabase
      .from('marketplace_report_uploads')
      .insert(uploadPayload)
      .select('id')
      .single()

    if (upErr) {
      // Fallback with base columns only
      const basicPayload = {
        account_id: foodiId,
        period_label: periodLabel,
        report_date: fileDate,
        file_name: file.name,
        sheet_name: targetSheetName,
        row_count: parsedRows.length,
        uploaded_at: new Date().toISOString(),
        uploaded_by: 'foodi_importer',
      }
      const { data: fallbackUp, error: fbErr } = await supabase
        .from('marketplace_report_uploads')
        .insert(basicPayload)
        .select('id')
        .single()
      if (fbErr) throw fbErr
      uploadId = fallbackUp.id
    } else {
      uploadId = newUpload.id
    }

    // 6. Insert Stock Snapshots & Sales Periods
    const nowIso = new Date().toISOString()
    const stockSnapshots: any[] = []
    const salesPeriods: any[] = []

    for (const r of parsedRows) {
      const itemId = itemIdMap.get(r.sku)
      if (!itemId) continue

      const stockVal = r.clampedStock * (r.sellingPrice || r.tp || r.mrp || 0)
      const stockRow: any = {
        account_id: foodiId,
        item_id: itemId,
        upload_id: uploadId,
        snapshot_date: asOfDate,
        current_stock: r.clampedStock,
        mrp: r.mrp || null,
        tp: r.tp || null,
        stock_value: stockVal || null,
        created_at: nowIso,
      }
      if (supportsSellingPrice) {
        stockRow.selling_price = r.sellingPrice || null
      }
      stockSnapshots.push(stockRow)

      const dailyRunRate = Number((r.sales30d / 30.0).toFixed(4))
      const totalAmount = r.sales30d * (r.sellingPrice || r.tp || r.mrp || 0)

      salesPeriods.push({
        account_id: foodiId,
        item_id: itemId,
        upload_id: uploadId,
        period_start: salesPeriodStart,
        period_end: salesPeriodEnd,
        sold_qty: r.sales30d,
        run_rate: dailyRunRate,
        total_amount: totalAmount || null,
        created_at: nowIso,
      })
    }

    for (const chunk of chunkArray(stockSnapshots, 250)) {
      const { error: sErr } = await supabase.from('marketplace_stock_snapshots').insert(chunk)
      if (sErr && sErr.message.includes('selling_price')) {
        const fbChunk = chunk.map(({ selling_price, ...rest }: any) => rest)
        await supabase.from('marketplace_stock_snapshots').insert(fbChunk)
      }
    }

    for (const chunk of chunkArray(salesPeriods, 250)) {
      await supabase.from('marketplace_sales_periods').insert(chunk)
    }

    // 7. Track Missing SKUs: Foodi items seen previously but absent from this upload
    let missingSkusCount = 0
    if (existingItems && existingItems.length > 0) {
      const currentSkusSet = new Set(parsedRows.map(r => r.sku))
      missingSkusCount = existingItems.filter(it => it.sku && !currentSkusSet.has(it.sku)).length
    }

    return NextResponse.json({
      success: true,
      uploadId,
      fileDate,
      stockBasis,
      asOfDate,
      salesPeriod: {
        start: salesPeriodStart,
        end: salesPeriodEnd,
      },
      stats: {
        totalRows: rawRows.length,
        uniqueSkus: totalSkus,
        availableSkus,
        oosSkus,
        lowStockSkus,
        bundlesCount,
        doubleBarcodesCount,
        oosWithSalesCount,
        skusWithSalesCount,
        missingSkusCount,
        negativeStockClamped: negativeStockCount,
        duplicatesDroppedCount: duplicatesDropped.length,
        olaPercentage,
        categories: categoriesBreakdown,
      },
      warnings: {
        collision: collisionWarning,
        basisChange: basisChangeWarning,
        identicalStock: identicalStockWarning,
      },
      message: `Successfully processed Foodi report for as-of date ${asOfDate} (${stockBasis === 'same_day' ? 'same day' : 'previous day T-1'}). SKU-level OLA: ${olaPercentage}%.`,
    })
  } catch (err: any) {
    console.error('Foodi report upload error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error while processing Foodi report.',
    }, { status: 500 })
  }
}
