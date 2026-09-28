import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'
import {
  getMarketplaceConfig,
  normalizeMarketplaceRow,
  resolveMarketplaceColumns,
  detectSheetPeriod,
  cleanText,
} from '@/lib/marketplaceConfig'
import { computeMarketplaceFlags, persistMarketplaceFlags } from '@/lib/marketplaceFlags'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const accountCode = (formData.get('account') as string || 'othoba').toLowerCase().trim()
    const requestedSheet = (formData.get('sheetName') as string || '').trim()
    const customPeriodLabel = (formData.get('periodLabel') as string || '').trim()
    const customReportDate = (formData.get('reportDate') as string || '').trim()
    const isPreview = req.nextUrl.searchParams.get('preview') === 'true' || formData.get('preview') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No Excel file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const sheetNames = workbook.SheetNames
    if (sheetNames.length === 0) {
      return NextResponse.json({ error: 'Excel file has no sheets.' }, { status: 400 })
    }

    // Determine target sheet
    let targetSheetName = requestedSheet
    if (!targetSheetName || !sheetNames.includes(targetSheetName)) {
      // Find the most relevant sheet: e.g. includes "Sales & Stock" or latest month, or default to first
      const salesAndStock = sheetNames.find(s => /sales\s*(&|and)\s*stock/i.test(s))
      const salesReport = sheetNames.find(s => /sales\s*report/i.test(s))
      targetSheetName = salesAndStock || salesReport || sheetNames[0]
    }

    const sheet = workbook.Sheets[targetSheetName]
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet)

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: `Selected sheet "${targetSheetName}" contains no data rows.` },
        { status: 400 }
      )
    }

    const config = getMarketplaceConfig(accountCode)
    const sampleRow = rawRows[0] || {}
    const columnMap = resolveMarketplaceColumns(sampleRow, config)

    // Check if key columns could be mapped
    const hasIdentifier = columnMap.productId != null || columnMap.sku != null
    const hasName = columnMap.name != null
    const hasStockOrSales = columnMap.currentStock != null || columnMap.soldQty != null

    if (!hasName && !hasIdentifier) {
      return NextResponse.json(
        {
          error: `Could not identify product columns in sheet "${targetSheetName}". Found headers: ${Object.keys(sampleRow).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const detectedPeriod = detectSheetPeriod(targetSheetName, file.name)
    const periodLabel = customPeriodLabel || detectedPeriod.periodLabel
    const reportDate = customReportDate || detectedPeriod.asOfDate

    // If PREVIEW MODE: return metadata and sample rows without touching database
    if (isPreview) {
      const previewRows = rawRows.slice(0, 10).map(r => normalizeMarketplaceRow(r, columnMap, config.defaultVendorName)).filter(Boolean)
      return NextResponse.json({
        preview: true,
        sheetNames,
        targetSheetName,
        totalRows: rawRows.length,
        periodLabel,
        reportDate,
        columnMap,
        sampleRows: previewRows,
      })
    }

    // COMMIT MODE: Ingest into Supabase
    const supabase = getAdminClient()

    // 1. Resolve Account ID
    const { data: accountRow, error: accErr } = await supabase
      .from('accounts')
      .select('id,name')
      .eq('code', accountCode)
      .maybeSingle()

    if (accErr || !accountRow) {
      return NextResponse.json(
        { error: `Account "${accountCode}" not found in accounts table.` },
        { status: 404 }
      )
    }
    const accountId = accountRow.id

    // 2. Normalize all data rows
    const normalizedItems: any[] = []
    for (const r of rawRows) {
      const norm = normalizeMarketplaceRow(r, columnMap, config.defaultVendorName)
      if (norm) {
        normalizedItems.push(norm)
      }
    }

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid product rows could be extracted from sheet.' },
        { status: 400 }
      )
    }

    // 3. Query existing marketplace_items to preserve manual tags
    const { data: existingItems, error: existErr } = await supabase
      .from('marketplace_items')
      .select('id,source_product_id,sku,name,basepack_id,match_status')
      .eq('account_id', accountId)

    if (existErr) {
      return NextResponse.json(
        {
          error: `Database query failed. Have you run migration 012_marketplace_reports.sql? (${existErr.message})`,
        },
        { status: 500 }
      )
    }

    const existingBySourceId = new Map<string, any>((existingItems || []).map(r => [String(r.source_product_id), r]))
    const existingBySku = new Map<string, any>()
    for (const it of existingItems || []) {
      if (it.sku) existingBySku.set(cleanText(it.sku), it)
    }

    // 4. Fetch Basepacks and Account Products for automatic matching
    const [{ data: basepacks }, { data: accountProducts }] = await Promise.all([
      supabase.from('basepacks').select('id,name'),
      supabase.from('account_products').select('account_sku,basepack_id').eq('account_id', accountId),
    ])

    const bpByName = new Map<string, string>(
      (basepacks || []).map(b => [cleanText(b.name).toLowerCase(), b.id])
    )
    const apBySku = new Map<string, string>()
    for (const ap of accountProducts || []) {
      if (ap.account_sku && ap.basepack_id) {
        apBySku.set(cleanText(ap.account_sku), ap.basepack_id)
      }
    }

    // 5. Upsert marketplace_items (preserve existing IDs and manual match_status)
    const itemsToInsert: any[] = []
    const itemDbMap = new Map<string, string>() // source_product_id -> item_uuid
    let autoMatchedCount = 0
    let newItemsCount = 0
    const nowIso = new Date().toISOString()

    // Deduplicate within the file itself
    const seenInFile = new Set<string>()

    for (const item of normalizedItems) {
      const srcId = String(item.source_product_id)
      if (seenInFile.has(srcId)) continue
      seenInFile.add(srcId)

      const existing = existingBySourceId.get(srcId) || (item.sku ? existingBySku.get(cleanText(item.sku)) : null)

      if (existing) {
        itemDbMap.set(srcId, existing.id)
      } else {
        // Auto-match logic
        let matchedBpId: string | null = null
        if (item.sku && apBySku.has(cleanText(item.sku))) {
          matchedBpId = apBySku.get(cleanText(item.sku))!
        } else if (apBySku.has(srcId)) {
          matchedBpId = apBySku.get(srcId)!
        } else if (bpByName.has(cleanText(item.name).toLowerCase())) {
          matchedBpId = bpByName.get(cleanText(item.name).toLowerCase())!
        }

        const matchStatus = matchedBpId ? 'matched' : 'unmatched'
        if (matchedBpId) autoMatchedCount++
        newItemsCount++

        itemsToInsert.push({
          account_id: accountId,
          source_product_id: srcId,
          sku: item.sku,
          name: item.name,
          vendor_name: item.vendor_name,
          basepack_id: matchedBpId,
          match_status: matchStatus,
          matched_at: matchedBpId ? nowIso : null,
          created_at: nowIso,
          updated_at: nowIso,
        })
      }
    }

    // Batch insert new items
    if (itemsToInsert.length > 0) {
      for (const chunk of chunkArray(itemsToInsert, 200)) {
        const { data: inserted, error: insErr } = await supabase
          .from('marketplace_items')
          .insert(chunk)
          .select('id,source_product_id')

        if (insErr) throw insErr
        for (const ins of inserted || []) {
          itemDbMap.set(String(ins.source_product_id), ins.id)
        }
      }
    }

    // 6. Create report upload record
    const { data: uploadRecord, error: upErr } = await supabase
      .from('marketplace_report_uploads')
      .insert({
        account_id: accountId,
        period_label: periodLabel,
        report_date: reportDate,
        file_name: file.name,
        sheet_name: targetSheetName,
        row_count: normalizedItems.length,
        uploaded_at: nowIso,
        uploaded_by: 'web_uploader',
      })
      .select('id')
      .single()

    if (upErr) throw upErr
    const uploadId = uploadRecord.id

    // 7. Prepare stock snapshots & sales periods
    const stockSnapshots: any[] = []
    const salesPeriods: any[] = []

    for (const item of normalizedItems) {
      const srcId = String(item.source_product_id)
      const itemId = itemDbMap.get(srcId)
      if (!itemId) continue

      stockSnapshots.push({
        account_id: accountId,
        item_id: itemId,
        upload_id: uploadId,
        snapshot_date: reportDate,
        current_stock: item.current_stock,
        mrp: item.mrp,
        tp: item.tp,
        stock_value: item.stock_value,
        created_at: nowIso,
      })

      salesPeriods.push({
        account_id: accountId,
        item_id: itemId,
        upload_id: uploadId,
        period_start: null,
        period_end: reportDate,
        sold_qty: item.sold_qty,
        run_rate: item.run_rate,
        total_amount: item.total_amount,
        total_product_cost: item.total_product_cost,
        sub_order_refs: item.sub_order_refs,
        created_at: nowIso,
      })
    }

    // 8. Batch insert stock snapshots & sales periods
    for (const chunk of chunkArray(stockSnapshots, 200)) {
      const { error: stockErr } = await supabase
        .from('marketplace_stock_snapshots')
        .insert(chunk)
      if (stockErr) throw stockErr
    }

    for (const chunk of chunkArray(salesPeriods, 200)) {
      const { error: salesErr } = await supabase
        .from('marketplace_sales_periods')
        .insert(chunk)
      if (salesErr) throw salesErr
    }

    // 9. Run automated flags computation and persistence
    let flagsGenerated = 0
    try {
      const flags = await computeMarketplaceFlags(accountId, uploadId)
      flagsGenerated = await persistMarketplaceFlags(accountId, flags)
    } catch (flagErr) {
      console.warn('Flag generation warning during import:', flagErr)
    }

    return NextResponse.json({
      success: true,
      upload_id: uploadId,
      account: accountCode,
      targetSheetName,
      period_label: periodLabel,
      report_date: reportDate,
      total_rows_parsed: normalizedItems.length,
      total_catalog_items: itemDbMap.size,
      new_items_added: newItemsCount,
      auto_matched_new: autoMatchedCount,
      stock_records_inserted: stockSnapshots.length,
      sales_records_inserted: salesPeriods.length,
      flags_generated: flagsGenerated,
    })
  } catch (error: any) {
    console.error('Marketplace import error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during import' },
      { status: 500 }
    )
  }
}
