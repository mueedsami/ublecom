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

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, may_: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

interface ParsedSalesHeader {
  startDate: string
  endDate: string
  asOfDate: string
  label: string
}

function parseSalesHeader(headerStr: string): ParsedSalesHeader | null {
  // Example: "September 1-28th ,2026" or "Sep 1 - 30, 2026"
  const m = headerStr.match(/([A-Za-z]+)\s*(\d{1,2})\s*[-–to]+\s*(\d{1,2})(?:st|nd|rd|th)?\s*[,_\s]*(\d{4})/i)
  if (m) {
    const monthName = m[1].toLowerCase()
    const monthNum = MONTH_NAMES[monthName]
    const startDay = parseInt(m[2], 10)
    const endDay = parseInt(m[3], 10)
    const year = parseInt(m[4], 10)

    if (monthNum && startDay >= 1 && endDay <= 31) {
      const sMm = String(monthNum).padStart(2, '0')
      const sDd = String(startDay).padStart(2, '0')
      const eDd = String(endDay).padStart(2, '0')
      const startDate = `${year}-${sMm}-${sDd}`
      const endDate = `${year}-${sMm}-${eDd}`

      // As-of date = end date + 1 day
      const endObj = new Date(year, monthNum - 1, endDay)
      endObj.setDate(endObj.getDate() + 1)
      const asOfDate = endObj.toISOString().slice(0, 10)

      return {
        startDate,
        endDate,
        asOfDate,
        label: headerStr.trim(),
      }
    }
  }

  // Fallback: check if header itself is month name e.g. "September, 26"
  const mMonth = headerStr.match(/([A-Za-z]+)[,\s]+(\d{2,4})/i)
  if (mMonth) {
    const monthName = mMonth[1].toLowerCase()
    const monthNum = MONTH_NAMES[monthName]
    let year = parseInt(mMonth[2], 10)
    if (year < 100) year += 2000
    if (monthNum) {
      const sMm = String(monthNum).padStart(2, '0')
      const lastDay = new Date(year, monthNum, 0).getDate()
      const startDate = `${year}-${sMm}-01`
      const endDate = `${year}-${sMm}-${String(lastDay).padStart(2, '0')}`
      const nextDay = new Date(year, monthNum - 1, lastDay + 1).toISOString().slice(0, 10)
      return {
        startDate,
        endDate,
        asOfDate: nextDay,
        label: headerStr.trim(),
      }
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const requestedSheet = (formData.get('sheetName') as string || '').trim()
    const customStartDate = (formData.get('startDate') as string || '').trim()
    const customEndDate = (formData.get('endDate') as string || '').trim()
    const customAsOfDate = (formData.get('asOfDate') as string || '').trim()
    const customPeriodLabel = (formData.get('periodLabel') as string || '').trim()
    const isPreview = req.nextUrl.searchParams.get('preview') === 'true' || formData.get('preview') === 'true'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No Excel file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const sheetNames = workbook.SheetNames
    if (sheetNames.length === 0) {
      return NextResponse.json({ success: false, error: 'Excel file has no sheets' }, { status: 400 })
    }

    // Determine target sheet: default to latest "Stock dump" sheet
    let targetSheetName = requestedSheet
    if (!targetSheetName || !sheetNames.includes(targetSheetName)) {
      // Find latest stock dump sheet
      const dumpSheets = sheetNames.filter(s => /stock\s*dump/i.test(s))
      targetSheetName = dumpSheets[0] || sheetNames[0]
    }

    const sheet = workbook.Sheets[targetSheetName]
    if (!sheet) {
      return NextResponse.json({ success: false, error: `Sheet "${targetSheetName}" not found.` }, { status: 400 })
    }

    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null })
    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: `Sheet "${targetSheetName}" has no data rows.` }, { status: 400 })
    }

    // Detect columns
    const firstRow = rawRows[0] || {}
    const colKeys = Object.keys(firstRow)

    const skuKey = colKeys.find(k => /^sku$/i.test(k.trim())) || colKeys.find(k => /sku/i.test(k))
    const nameKey = colKeys.find(k => /^name$/i.test(k.trim())) || colKeys.find(k => /product.?name/i.test(k))
    const brandKey = colKeys.find(k => /^brand$/i.test(k.trim()))
    const categoryKey = colKeys.find(k => /^category$/i.test(k.trim()))
    const vendorKey = colKeys.find(k => /^vendor$/i.test(k.trim()))
    const tpKey = colKeys.find(k => /^tp$/i.test(k.trim())) || colKeys.find(k => /unit.?selling/i.test(k))
    const mrpKey = colKeys.find(k => /^mrp$/i.test(k.trim())) || colKeys.find(k => /unit.?price/i.test(k))
    const stockQtyKey = colKeys.find(k => /total.?stock.?qty/i.test(k.trim())) || colKeys.find(k => /^stock$/i.test(k.trim()))
    const stockAmtKey = colKeys.find(k => /total.?stock.?amt/i.test(k.trim()))
    const totalSoldKey = colKeys.find(k => /^total.?sold$/i.test(k.trim()))

    if (!skuKey || !stockQtyKey) {
      return NextResponse.json({
        success: false,
        error: `Missing essential columns in sheet "${targetSheetName}". Found headers: ${colKeys.join(', ')}`,
      }, { status: 400 })
    }

    // Identify sales column: usually between stockQtyKey and stockAmtKey or date-labelled
    const stockIdx = colKeys.indexOf(stockQtyKey)
    const stockAmtIdx = stockAmtKey ? colKeys.indexOf(stockAmtKey) : -1
    let salesColKey: string | null = null

    if (stockIdx !== -1 && stockAmtIdx !== -1 && stockAmtIdx === stockIdx + 2) {
      salesColKey = colKeys[stockIdx + 1]
    } else {
      // Find column containing month name or "sold"
      salesColKey = colKeys.find(k => Object.keys(MONTH_NAMES).some(m => k.toLowerCase().includes(m)) && k !== targetSheetName) || null
    }

    // Parse sales window & as-of date
    const parsedHeader = salesColKey ? parseSalesHeader(salesColKey) : parseSalesHeader(targetSheetName)
    const startDate = customStartDate || parsedHeader?.startDate || new Date().toISOString().slice(0, 8) + '01'
    const endDate = customEndDate || parsedHeader?.endDate || new Date().toISOString().slice(0, 10)

    // Calculate default as-of date: day after window ends
    let defaultAsOf = parsedHeader?.asOfDate
    if (!defaultAsOf && endDate) {
      const eD = new Date(endDate)
      eD.setDate(eD.getDate() + 1)
      defaultAsOf = eD.toISOString().slice(0, 10)
    }
    const asOfDate = customAsOfDate || defaultAsOf || new Date().toISOString().slice(0, 10)
    const periodLabel = customPeriodLabel || parsedHeader?.label || targetSheetName

    // If PREVIEW MODE: return sample rows and detected stats
    if (isPreview) {
      const sample = rawRows.slice(0, 10).map((r, i) => ({
        index: i + 1,
        sku: cleanText(r[skuKey]),
        name: cleanText(nameKey ? r[nameKey] : ''),
        brand: cleanText(brandKey ? r[brandKey] : ''),
        category: cleanText(categoryKey ? r[categoryKey] : ''),
        tp: cleanNumeric(tpKey ? r[tpKey] : 0),
        mrp: cleanNumeric(mrpKey ? r[mrpKey] : 0),
        stock: cleanNumeric(r[stockQtyKey]),
        sales: salesColKey ? cleanNumeric(r[salesColKey]) : 0,
      }))

      return NextResponse.json({
        success: true,
        preview: true,
        sheetNames,
        targetSheetName,
        totalRows: rawRows.length,
        detectedColumns: {
          sku: skuKey,
          name: nameKey,
          brand: brandKey,
          category: categoryKey,
          tp: tpKey,
          mrp: mrpKey,
          stockQty: stockQtyKey,
          salesQty: salesColKey,
          stockAmt: stockAmtKey,
          totalSold: totalSoldKey,
        },
        dates: {
          startDate,
          endDate,
          asOfDate,
          periodLabel,
        },
        sampleRows: sample,
      })
    }

    // COMMIT MODE: Ingest into Supabase
    const supabase = getAdminClient()

    // 1. Resolve Shajgoj Account
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id,code,name')
      .eq('code', 'shajgoj')
      .limit(1)

    if (accErr || !accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: 'Shajgoj account not found in database.' }, { status: 500 })
    }
    const shajgojId = accounts[0].id

    // 2. Fetch active Shajgoj account_products & basepack_scopes
    const [{ data: accountProducts }, { data: scopes }, { data: existingMktItems }] = await Promise.all([
      supabase.from('account_products').select('id, account_sku, basepack_id, product_name, active, metadata').eq('account_id', shajgojId),
      supabase.from('basepack_scopes').select('id, basepack_id, ola_enabled, active').eq('account_id', shajgojId).eq('active', true).eq('ola_enabled', true),
      supabase.from('marketplace_items').select('id, source_product_id, sku, tier, basepack_id, match_status, web_status, dismissed').eq('account_id', shajgojId),
    ])

    const coreSkuMap = new Map<string, any>()
    for (const ap of accountProducts || []) {
      if (ap.account_sku) coreSkuMap.set(ap.account_sku.trim(), ap)
    }

    const scopedBpIds = new Set((scopes || []).map((s: any) => s.basepack_id))
    const existingMktBySrc = new Map<string, any>((existingMktItems || []).map((m: any) => [String(m.source_product_id), m]))
    const existingMktBySku = new Map<string, any>()
    for (const m of existingMktItems || []) {
      if (m.sku) existingMktBySku.set(String(m.sku).trim(), m)
    }

    // 3. De-duplicate input rows by SKU
    const seenSkus = new Set<string>()
    const duplicatesDropped: string[] = []
    const parsedRows: Array<{
      sku: string
      name: string
      brand: string
      category: string
      vendor: string
      tp: number
      mrp: number
      stock: number
      sales: number
      stockVal: number
      totalAmt: number
    }> = []

    for (const r of rawRows) {
      const rawSkuVal = r[skuKey]
      if (rawSkuVal == null || rawSkuVal === '') continue
      const sku = cleanText(typeof rawSkuVal === 'number' ? Math.floor(rawSkuVal) : rawSkuVal)
      if (!sku) continue

      if (seenSkus.has(sku)) {
        duplicatesDropped.push(sku)
        continue // Drop duplicate, keep first occurrence, do not sum
      }
      seenSkus.add(sku)

      const name = cleanText(nameKey ? r[nameKey] : sku)
      const brand = cleanText(brandKey ? r[brandKey] : '')
      const category = cleanText(categoryKey ? r[categoryKey] : '')
      const vendor = cleanText(vendorKey ? r[vendorKey] : 'Shajgoj')
      const tp = cleanNumeric(tpKey ? r[tpKey] : 0)
      const mrp = cleanNumeric(mrpKey ? r[mrpKey] : 0)
      const stock = cleanNumeric(r[stockQtyKey])
      const sales = salesColKey ? cleanNumeric(r[salesColKey]) : 0
      const stockVal = stockAmtKey ? cleanNumeric(r[stockAmtKey]) : stock * (tp || mrp)
      const totalAmt = totalSoldKey ? cleanNumeric(r[totalSoldKey]) : sales * (tp || mrp)

      parsedRows.push({
        sku,
        name,
        brand,
        category,
        vendor,
        tp,
        mrp,
        stock,
        sales,
        stockVal,
        totalAmt,
      })
    }

    // 4. Classify rows into Core vs Extras
    const itemsToUpsert: any[] = []
    const itemIdMap = new Map<string, string>() // sku -> marketplace_items.id
    let coreMatchedCount = 0
    let extrasCount = 0
    const nowIso = new Date().toISOString()

    // Test tier column support
    let supportsTier = false
    try {
      const { error: tErr } = await supabase.from('marketplace_items').select('tier').limit(1)
      if (!tErr) supportsTier = true
    } catch {}

    for (const row of parsedRows) {
      const existing = existingMktBySrc.get(row.sku) || existingMktBySku.get(row.sku)
      const ap = coreSkuMap.get(row.sku)
      const isCore = Boolean(ap) || (existing && existing.tier === 'core')

      if (isCore) {
        coreMatchedCount++
        const bpId = ap?.basepack_id || existing?.basepack_id || null
        const webStatus = existing?.web_status || ap?.metadata?.web_status || 'In Stock'

        if (existing) {
          itemIdMap.set(row.sku, existing.id)
        } else {
          const newCoreItem: any = {
            account_id: shajgojId,
            source_product_id: row.sku,
            sku: row.sku,
            name: row.name,
            vendor_name: row.vendor,
            basepack_id: bpId,
            match_status: 'matched',
            matched_at: nowIso,
          }
          if (supportsTier) {
            newCoreItem.tier = 'core'
            newCoreItem.dismissed = false
            newCoreItem.web_status = webStatus
          }
          itemsToUpsert.push(newCoreItem)
        }
      } else {
        extrasCount++
        if (existing) {
          itemIdMap.set(row.sku, existing.id)
        } else {
          const newExtraItem: any = {
            account_id: shajgojId,
            source_product_id: row.sku,
            sku: row.sku,
            name: row.name,
            vendor_name: row.vendor,
            basepack_id: null,
            match_status: 'unmatched',
          }
          if (supportsTier) {
            newExtraItem.tier = 'extra'
            newExtraItem.dismissed = false
          }
          itemsToUpsert.push(newExtraItem)
        }
      }
    }

    // Insert newly found items
    if (itemsToUpsert.length > 0) {
      for (const chunk of chunkArray(itemsToUpsert, 150)) {
        const { data: ins, error: insErr } = await supabase
          .from('marketplace_items')
          .insert(chunk)
          .select('id, source_product_id, sku')

        if (insErr) {
          // If tier column failed, retry without tier
          if (insErr.message.includes('tier')) {
            const fallbackChunk = chunk.map(({ tier, dismissed, web_status, ...rest }: any) => rest)
            const { data: fbIns } = await supabase.from('marketplace_items').insert(fallbackChunk).select('id, source_product_id, sku')
            for (const item of fbIns || []) {
              itemIdMap.set(String(item.source_product_id), item.id)
              if (item.sku) itemIdMap.set(String(item.sku).trim(), item.id)
            }
          } else {
            console.error('marketplace_items insert error:', insErr)
          }
        } else {
          for (const item of ins || []) {
            itemIdMap.set(String(item.source_product_id), item.id)
            if (item.sku) itemIdMap.set(String(item.sku).trim(), item.id)
          }
        }
      }
    }

    // Refresh existing item IDs if needed
    if (itemIdMap.size < parsedRows.length) {
      const { data: allShajgojItems } = await supabase
        .from('marketplace_items')
        .select('id, source_product_id, sku')
        .eq('account_id', shajgojId)

      for (const it of allShajgojItems || []) {
        itemIdMap.set(String(it.source_product_id), it.id)
        if (it.sku) itemIdMap.set(String(it.sku).trim(), it.id)
      }
    }

    // 5. Compute OLA at basepack level
    const bpStockMap = new Map<string, number>()
    let lowStockCount = 0
    let skuInStockCount = 0
    let unresolvedWithStock = 0

    for (const r of parsedRows) {
      const ap = coreSkuMap.get(r.sku)
      if (ap) {
        if (r.stock > 0) skuInStockCount++
        if (r.stock >= 1 && r.stock <= 9) lowStockCount++
        if (ap.basepack_id) {
          bpStockMap.set(ap.basepack_id, (bpStockMap.get(ap.basepack_id) || 0) + r.stock)
        }
        if (ap.metadata?.web_status === 'Not found' && r.stock > 0) {
          unresolvedWithStock++
        }
      }
    }

    let basepacksAvailable = 0
    for (const bpId of scopedBpIds) {
      if ((bpStockMap.get(bpId) || 0) > 0) {
        basepacksAvailable++
      }
    }

    const totalScopedBasepacks = scopedBpIds.size || 142
    const olaPercentage = totalScopedBasepacks > 0
      ? Number(((basepacksAvailable / totalScopedBasepacks) * 100).toFixed(1))
      : 0

    // 6. Delete previous upload records and children for this as-of date (Idempotency)
    const { data: priorUploads } = await supabase
      .from('marketplace_report_uploads')
      .select('id')
      .eq('account_id', shajgojId)
      .eq('report_date', asOfDate)

    for (const oldUp of priorUploads || []) {
      await supabase.from('marketplace_stock_snapshots').delete().eq('upload_id', oldUp.id)
      await supabase.from('marketplace_sales_periods').delete().eq('upload_id', oldUp.id)
      await supabase.from('marketplace_report_uploads').delete().eq('id', oldUp.id)
    }

    // 7. Insert upload record in marketplace_report_uploads
    const uploadPayload: any = {
      account_id: shajgojId,
      period_label: periodLabel,
      report_date: asOfDate,
      file_name: file.name,
      sheet_name: targetSheetName,
      row_count: parsedRows.length,
      uploaded_at: nowIso,
      uploaded_by: 'dashboard_ui',
    }

    // Extended columns if supported
    try {
      uploadPayload.sales_period_start = startDate
      uploadPayload.sales_period_end = endDate
      uploadPayload.core_count = coreMatchedCount
      uploadPayload.extras_count = extrasCount
      uploadPayload.duplicates_count = duplicatesDropped.length
      uploadPayload.ola_percentage = olaPercentage
      uploadPayload.basepacks_available = basepacksAvailable
      uploadPayload.basepacks_total = totalScopedBasepacks
    } catch {}

    let uploadId: string
    const { data: newUpload, error: upErr } = await supabase
      .from('marketplace_report_uploads')
      .insert(uploadPayload)
      .select('id')
      .single()

    if (upErr) {
      // Fallback without extended columns
      const basicPayload = {
        account_id: shajgojId,
        period_label: periodLabel,
        report_date: asOfDate,
        file_name: file.name,
        sheet_name: targetSheetName,
        row_count: parsedRows.length,
        uploaded_at: nowIso,
        uploaded_by: 'dashboard_ui',
      }
      const { data: fallbackUpload, error: fbErr } = await supabase
        .from('marketplace_report_uploads')
        .insert(basicPayload)
        .select('id')
        .single()
      if (fbErr) throw fbErr
      uploadId = fallbackUpload.id
    } else {
      uploadId = newUpload.id
    }

    // 8. Insert Stock Snapshots & Sales Periods
    const stockSnapshots: any[] = []
    const salesPeriods: any[] = []
    const daysInPeriod = Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)

    for (const r of parsedRows) {
      const itemId = itemIdMap.get(r.sku)
      if (!itemId) continue

      stockSnapshots.push({
        account_id: shajgojId,
        item_id: itemId,
        upload_id: uploadId,
        snapshot_date: asOfDate,
        current_stock: r.stock,
        mrp: r.mrp || null,
        tp: r.tp || null,
        stock_value: r.stockVal || null,
        created_at: nowIso,
      })

      salesPeriods.push({
        account_id: shajgojId,
        item_id: itemId,
        upload_id: uploadId,
        period_start: startDate,
        period_end: endDate,
        sold_qty: r.sales,
        run_rate: daysInPeriod > 0 ? Number((r.sales / daysInPeriod).toFixed(4)) : null,
        total_amount: r.totalAmt || null,
        created_at: nowIso,
      })
    }

    for (const chunk of chunkArray(stockSnapshots, 250)) {
      await supabase.from('marketplace_stock_snapshots').insert(chunk)
    }
    for (const chunk of chunkArray(salesPeriods, 250)) {
      await supabase.from('marketplace_sales_periods').insert(chunk)
    }

    // 9. Insert SKU-level product_observations (source = 'dump')
    // Delete existing dump observations for this asOfDate
    await supabase
      .from('product_observations')
      .delete()
      .eq('account_id', shajgojId)
      .eq('observed_date', asOfDate)
      .eq('source', 'dump')

    const obsPayload: any[] = []
    for (const r of parsedRows) {
      const ap = coreSkuMap.get(r.sku)
      if (!ap || !ap.basepack_id) continue

      obsPayload.push({
        observed_at: `${asOfDate}T09:00:00+06:00`,
        observed_date: asOfDate,
        account_id: shajgojId,
        location_id: null,
        basepack_id: ap.basepack_id,
        account_product_id: ap.id,
        account_sku: r.sku,
        product_name: r.name || ap.product_name,
        in_stock: r.stock > 0,
        price: r.tp || null,
        original_price: r.mrp || null,
        promo_price: r.tp || null,
        status: r.stock > 0 ? 'In Stock' : 'Out of Stock',
        source: 'dump',
        stock_qty: r.stock,
        evidence: {
          source: 'dump',
          stock_qty: r.stock,
          sold_qty: r.sales,
          mrp: r.mrp,
          tp: r.tp,
          tier: 'core',
        },
      })
    }

    for (const chunk of chunkArray(obsPayload, 250)) {
      await supabase.from('product_observations').insert(chunk)
    }

    // 10. Insert Basepack-level availability_snapshots
    await supabase
      .from('availability_snapshots')
      .delete()
      .eq('account_id', shajgojId)
      .eq('snapshot_date', asOfDate)

    const snapPayload: any[] = []
    for (const bpId of scopedBpIds) {
      const stock = bpStockMap.get(bpId) || 0
      const isAvailable = stock > 0
      const skusForBp = parsedRows.filter(r => coreSkuMap.get(r.sku)?.basepack_id === bpId)
      const inStockCount = skusForBp.filter(r => r.stock > 0).length

      snapPayload.push({
        snapshot_date: asOfDate,
        account_id: shajgojId,
        location_id: null,
        basepack_id: bpId,
        available: isAvailable,
        sku_expected: skusForBp.length,
        sku_observed: skusForBp.length,
        sku_available: inStockCount,
        reason: 'dump',
        evidence: {
          source: 'dump',
          total_stock: stock,
          low_stock: isAvailable && stock < 10,
        },
      })
    }

    for (const chunk of chunkArray(snapPayload, 250)) {
      await supabase.from('availability_snapshots').insert(chunk)
    }

    // 11. Derive Sales between uploads (Section 4b)
    let salesBetweenUploads: number | null = null
    const { data: priorPeriodUploads } = await supabase
      .from('marketplace_report_uploads')
      .select('id, report_date')
      .eq('account_id', shajgojId)
      .lt('report_date', asOfDate)
      .order('report_date', { ascending: false })
      .limit(1)

    if (priorPeriodUploads && priorPeriodUploads.length > 0) {
      const priorId = priorPeriodUploads[0].id
      const { data: priorSales } = await supabase
        .from('marketplace_sales_periods')
        .select('sold_qty')
        .eq('upload_id', priorId)
      const priorTotal = (priorSales || []).reduce((acc: number, curr: any) => acc + Number(curr.sold_qty || 0), 0)
      const currentTotal = parsedRows.reduce((acc, curr) => acc + curr.sales, 0)
      salesBetweenUploads = Math.max(0, currentTotal - priorTotal)
    }

    return NextResponse.json({
      success: true,
      asOfDate,
      salesWindow: {
        startDate,
        endDate,
      },
      periodLabel,
      rowsRead: rawRows.length,
      uniqueRows: parsedRows.length,
      coreMatched: coreMatchedCount,
      extrasCount: extrasCount,
      duplicatesDropped,
      basepacksScoped: totalScopedBasepacks,
      basepacksAvailable,
      olaPercentage,
      lowStockCount,
      skuInStockCount,
      unresolvedWithStock,
      salesBetweenUploads,
      message: `Successfully processed ${parsedRows.length} SKUs for as-of date ${asOfDate}. Shajgoj OLA: ${olaPercentage}%.`,
    })
  } catch (err: any) {
    console.error('Shajgoj stock dump upload error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error while processing Shajgoj dump file.',
    }, { status: 500 })
  }
}
