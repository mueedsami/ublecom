import { supabase } from './supabase'

export interface FoodiSummary {
  asOfDate: string
  fileDate: string
  stockBasis: 'same_day' | 'previous_day'
  daysOld: number
  periodLabel: string
  totalSkus: number
  availableSkus: number
  outOfStockSkus: number
  lowStockSkus: number
  olaPercentage: number
  bundlesCount: number
  categoriesCount: number
  oosWithSalesCount: number
  missingSkusCount: number
  uploadId?: string
  fileName?: string
}

export interface FoodiSkuItem {
  id: string
  sku: string
  name: string
  category: string
  barcodes: string[]
  isBundle: boolean
  currentStock: number
  mrp: number | null
  tp: number | null
  sellingPrice: number | null
  stockValue: number | null
  soldQty: number
  runRate: number
  daysOfCover: number | null
  status: 'available' | 'low_stock' | 'out_of_stock'
  available: boolean
}

export interface FoodiCategoryItem {
  category: string
  totalSkus: number
  availableSkus: number
  outOfStockSkus: number
  lowStockSkus: number
  olaPercentage: number
  totalStock: number
  totalSales30d: number
}

export interface FoodiExceptionItem {
  id: string
  sku: string
  name: string
  category: string
  currentStock: number
  soldQty: number
  mrp: number | null
  tp: number | null
  sellingPrice: number | null
  status: string
  exceptionType: 'out_of_stock_sold_recently' | 'out_of_stock' | 'low_stock' | 'missing_from_report'
  severity: 'critical' | 'warning' | 'info'
  priority: number
}

export interface FoodiTrendPoint {
  date: string
  fileDate: string
  stockBasis: string
  olaPercentage: number
  availableSkus: number
  totalSkus: number
}

export interface FoodiUploadRecord {
  id: string
  reportDate: string
  stockBasis: 'same_day' | 'previous_day'
  stockAsOf: string
  fileName: string
  sheetName: string
  rowCount: number
  olaPercentage: number | null
  uploadedAt: string
  uploadedBy: string
}

async function getFoodiAccountId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('accounts').select('id').eq('code', 'foodi').maybeSingle()
  return data?.id || null
}

export async function getFoodiSummary(): Promise<FoodiSummary | null> {
  if (!supabase) return null
  const foodiId = await getFoodiAccountId()
  if (!foodiId) return null

  // 1. Query latest upload from marketplace_report_uploads
  const { data: uploads, error: upErr } = await supabase
    .from('marketplace_report_uploads')
    .select('*')
    .eq('account_id', foodiId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (upErr || !uploads || uploads.length === 0) {
    return null
  }

  const latestUpload = uploads[0]
  const uploadId = latestUpload.id
  const asOfDate = latestUpload.stock_as_of || latestUpload.report_date
  const fileDate = latestUpload.report_date
  const stockBasis = (latestUpload.stock_basis as 'same_day' | 'previous_day') || 'previous_day'

  // Calculate days old
  const asOfDateObj = new Date(asOfDate)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - asOfDateObj.getTime())
  const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // 2. Fetch stock and sales snapshots for this upload
  const [{ data: stockRows }, { data: salesRows }, { data: items }] = await Promise.all([
    supabase
      .from('marketplace_stock_snapshots')
      .select('item_id, current_stock, mrp, tp, selling_price, stock_value')
      .eq('upload_id', uploadId),
    supabase
      .from('marketplace_sales_periods')
      .select('item_id, sold_qty, run_rate')
      .eq('upload_id', uploadId),
    supabase
      .from('marketplace_items')
      .select('id, sku, name, category, is_bundle, barcodes, vendor_name, web_status')
      .eq('account_id', foodiId),
  ])

  const stockMap = new Map<string, any>()
  for (const s of stockRows || []) {
    stockMap.set(s.item_id, s)
  }

  const salesMap = new Map<string, any>()
  for (const sp of salesRows || []) {
    salesMap.set(sp.item_id, sp)
  }

  let totalSkus = 0
  let availableSkus = 0
  let outOfStockSkus = 0
  let lowStockSkus = 0
  let bundlesCount = 0
  let oosWithSalesCount = 0
  const categories = new Set<string>()

  const currentUploadItemIds = new Set<string>()

  for (const item of items || []) {
    const s = stockMap.get(item.id)
    if (!s) continue // Not in this snapshot

    currentUploadItemIds.add(item.id)
    totalSkus++

    const stock = Number(s.current_stock || 0)
    const sp = salesMap.get(item.id)
    const sold = Number(sp?.sold_qty || 0)

    if (stock > 0) availableSkus++
    else outOfStockSkus++

    if (stock >= 1 && stock <= 9) lowStockSkus++
    if (stock <= 0 && sold > 0) oosWithSalesCount++

    const isBundle = item.is_bundle != null ? Boolean(item.is_bundle) : (/\[B1G1\]|\[Combo\]|buy\s*one/i.test(item.name || ''))
    if (isBundle) bundlesCount++
    const cat = item.category || (item.vendor_name && item.vendor_name !== 'Foodi' ? item.vendor_name : null) || 'Uncategorized'
    if (cat) categories.add(cat)
  }

  const missingSkusCount = (items || []).filter(i => !currentUploadItemIds.has(i.id)).length
  const olaPercentage = totalSkus > 0 ? Number(((availableSkus / totalSkus) * 100).toFixed(1)) : 0

  return {
    asOfDate,
    fileDate,
    stockBasis,
    daysOld,
    periodLabel: latestUpload.period_label || `Stock as of ${asOfDate}`,
    totalSkus,
    availableSkus,
    outOfStockSkus,
    lowStockSkus,
    olaPercentage,
    bundlesCount,
    categoriesCount: categories.size,
    oosWithSalesCount,
    missingSkusCount,
    uploadId,
    fileName: latestUpload.file_name,
  }
}

export async function getFoodiSkuList(): Promise<FoodiSkuItem[]> {
  if (!supabase) return []

  // First try view v_foodi_sku_current
  const { data: viewData, error: viewErr } = await supabase
    .from('v_foodi_sku_current')
    .select('*')

  if (!viewErr && viewData && viewData.length > 0) {
    return viewData.map((r: any) => ({
      id: r.item_id,
      sku: r.sku,
      name: r.item_name || r.name,
      category: r.category || 'Uncategorized',
      barcodes: Array.isArray(r.barcodes) ? r.barcodes : (r.barcodes ? [r.barcodes] : []),
      isBundle: Boolean(r.is_bundle),
      currentStock: Number(r.current_stock || 0),
      mrp: r.mrp != null ? Number(r.mrp) : null,
      tp: r.tp != null ? Number(r.tp) : null,
      sellingPrice: r.selling_price != null ? Number(r.selling_price) : null,
      stockValue: r.stock_value != null ? Number(r.stock_value) : null,
      soldQty: Number(r.sold_qty || 0),
      runRate: Number(r.run_rate || 0),
      daysOfCover: r.days_of_cover != null ? Number(r.days_of_cover) : null,
      status: r.status as any,
      available: Boolean(r.available),
    }))
  }

  // Fallback direct query
  const foodiId = await getFoodiAccountId()
  if (!foodiId) return []

  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id')
    .eq('account_id', foodiId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (!uploads || uploads.length === 0) return []
  const uploadId = uploads[0].id

  const [{ data: items }, { data: stockRows }, { data: salesRows }] = await Promise.all([
    supabase.from('marketplace_items').select('id, sku, name, category, is_bundle, barcodes, vendor_name, web_status, source_product_id').eq('account_id', foodiId),
    supabase.from('marketplace_stock_snapshots').select('*').eq('upload_id', uploadId),
    supabase.from('marketplace_sales_periods').select('*').eq('upload_id', uploadId),
  ])

  const stockMap = new Map<string, any>((stockRows || []).map(s => [s.item_id, s]))
  const salesMap = new Map<string, any>((salesRows || []).map(sp => [sp.item_id, sp]))

  const list: FoodiSkuItem[] = []
  for (const item of items || []) {
    const s = stockMap.get(item.id)
    if (!s) continue

    const sp = salesMap.get(item.id)
    const stock = Number(s.current_stock || 0)
    const sold = Number(sp?.sold_qty || 0)
    const runRate = sp?.run_rate ? Number(sp.run_rate) : Number((sold / 30).toFixed(4))
    const daysOfCover = runRate > 0 ? Number((stock / runRate).toFixed(1)) : null

    let status: 'available' | 'low_stock' | 'out_of_stock' = 'available'
    if (stock <= 0) status = 'out_of_stock'
    else if (stock >= 1 && stock <= 9) status = 'low_stock'

    const cat = item.category || (item.vendor_name && item.vendor_name !== 'Foodi' ? item.vendor_name : null) || 'Uncategorized'
    const bcs = Array.isArray(item.barcodes) && item.barcodes.length > 0
      ? item.barcodes
      : (item.web_status ? item.web_status.split('>>').map((b: string) => b.trim()).filter(Boolean) : [])
    const bundleFlag = item.is_bundle != null ? Boolean(item.is_bundle) : (/\[B1G1\]|\[Combo\]|buy\s*one/i.test(item.name || ''))
    const sellingPrice = s.selling_price != null
      ? Number(s.selling_price)
      : (s.current_stock > 0 && s.stock_value ? Number((s.stock_value / s.current_stock).toFixed(2)) : s.tp)

    list.push({
      id: item.id,
      sku: item.sku || item.source_product_id,
      name: item.name,
      category: cat,
      barcodes: bcs,
      isBundle: bundleFlag,
      currentStock: stock,
      mrp: s.mrp != null ? Number(s.mrp) : null,
      tp: s.tp != null ? Number(s.tp) : null,
      sellingPrice: sellingPrice != null ? Number(sellingPrice) : null,
      stockValue: s.stock_value != null ? Number(s.stock_value) : null,
      soldQty: sold,
      runRate,
      daysOfCover,
      status,
      available: stock > 0,
    })
  }

  return list.sort((a, b) => b.soldQty - a.soldQty || b.currentStock - a.currentStock)
}

export async function getFoodiCategoryOla(): Promise<FoodiCategoryItem[]> {
  if (!supabase) return []

  // First try view v_foodi_ola_by_category
  const { data: viewData, error: viewErr } = await supabase
    .from('v_foodi_ola_by_category')
    .select('*')

  if (!viewErr && viewData && viewData.length > 0) {
    return viewData.map((r: any) => ({
      category: r.category,
      totalSkus: Number(r.total_skus || 0),
      availableSkus: Number(r.available_skus || 0),
      outOfStockSkus: Number(r.out_of_stock_skus || 0),
      lowStockSkus: Number(r.low_stock_skus || 0),
      olaPercentage: Number(r.ola_percentage || 0),
      totalStock: Number(r.total_stock || 0),
      totalSales30d: Number(r.total_sales_30d || 0),
    }))
  }

  // Fallback calculation from SKU list
  const skus = await getFoodiSkuList()
  const catMap = new Map<string, { total: number; available: number; oos: number; low: number; stock: number; sales: number }>()

  for (const s of skus) {
    const c = s.category || 'Uncategorized'
    if (!catMap.has(c)) {
      catMap.set(c, { total: 0, available: 0, oos: 0, low: 0, stock: 0, sales: 0 })
    }
    const rec = catMap.get(c)!
    rec.total++
    rec.stock += s.currentStock
    rec.sales += s.soldQty
    if (s.currentStock > 0) rec.available++
    else rec.oos++
    if (s.currentStock >= 1 && s.currentStock <= 9) rec.low++
  }

  const result: FoodiCategoryItem[] = []
  for (const [category, rec] of catMap.entries()) {
    result.push({
      category,
      totalSkus: rec.total,
      availableSkus: rec.available,
      outOfStockSkus: rec.oos,
      lowStockSkus: rec.low,
      olaPercentage: rec.total > 0 ? Number(((rec.available / rec.total) * 100).toFixed(1)) : 0,
      totalStock: rec.stock,
      totalSales30d: rec.sales,
    })
  }

  return result.sort((a, b) => b.totalSkus - a.totalSkus)
}

export async function getFoodiExceptions(): Promise<FoodiExceptionItem[]> {
  if (!supabase) return []

  // First try view v_foodi_exceptions
  const { data: viewData, error: viewErr } = await supabase
    .from('v_foodi_exceptions')
    .select('*')

  if (!viewErr && viewData && viewData.length > 0) {
    return viewData.map((r: any) => ({
      id: r.item_id,
      sku: r.sku,
      name: r.item_name || r.name,
      category: r.category || 'Uncategorized',
      currentStock: Number(r.current_stock || 0),
      soldQty: Number(r.sold_qty || 0),
      mrp: r.mrp != null ? Number(r.mrp) : null,
      tp: r.tp != null ? Number(r.tp) : null,
      sellingPrice: r.selling_price != null ? Number(r.selling_price) : null,
      status: r.status || (r.currentStock <= 0 ? 'out_of_stock' : 'low_stock'),
      exceptionType: r.exception_type,
      severity: r.severity || 'warning',
      priority: Number(r.priority || 99),
    }))
  }

  // Fallback calculation from full SKU list & catalog
  const skus = await getFoodiSkuList()
  const exceptions: FoodiExceptionItem[] = []

  for (const s of skus) {
    if (s.currentStock <= 0 && s.soldQty > 0) {
      exceptions.push({
        id: s.id,
        sku: s.sku,
        name: s.name,
        category: s.category,
        currentStock: s.currentStock,
        soldQty: s.soldQty,
        mrp: s.mrp,
        tp: s.tp,
        sellingPrice: s.sellingPrice,
        status: 'out_of_stock',
        exceptionType: 'out_of_stock_sold_recently',
        severity: 'critical',
        priority: 1,
      })
    } else if (s.currentStock <= 0) {
      exceptions.push({
        id: s.id,
        sku: s.sku,
        name: s.name,
        category: s.category,
        currentStock: s.currentStock,
        soldQty: s.soldQty,
        mrp: s.mrp,
        tp: s.tp,
        sellingPrice: s.sellingPrice,
        status: 'out_of_stock',
        exceptionType: 'out_of_stock',
        severity: 'warning',
        priority: 2,
      })
    } else if (s.currentStock >= 1 && s.currentStock <= 9) {
      exceptions.push({
        id: s.id,
        sku: s.sku,
        name: s.name,
        category: s.category,
        currentStock: s.currentStock,
        soldQty: s.soldQty,
        mrp: s.mrp,
        tp: s.tp,
        sellingPrice: s.sellingPrice,
        status: 'low_stock',
        exceptionType: 'low_stock',
        severity: 'warning',
        priority: 3,
      })
    }
  }

  // Check missing SKUs from database items not present in latest upload
  const foodiId = await getFoodiAccountId()
  if (foodiId) {
    const { data: allItems } = await supabase
      .from('marketplace_items')
      .select('id, sku, name, category, vendor_name')
      .eq('account_id', foodiId)

    const presentIds = new Set(skus.map(s => s.id))
    for (const it of allItems || []) {
      if (!presentIds.has(it.id)) {
        exceptions.push({
          id: it.id,
          sku: it.sku,
          name: it.name,
          category: it.category || (it.vendor_name && it.vendor_name !== 'Foodi' ? it.vendor_name : null) || 'Uncategorized',
          currentStock: 0,
          soldQty: 0,
          mrp: null,
          tp: null,
          sellingPrice: null,
          status: 'missing',
          exceptionType: 'missing_from_report',
          severity: 'info',
          priority: 4,
        })
      }
    }
  }

  return exceptions.sort((a, b) => a.priority - b.priority || b.soldQty - a.soldQty)
}

export async function getFoodiDailyTrend(): Promise<FoodiTrendPoint[]> {
  if (!supabase) return []

  // First try view v_foodi_ola_daily
  const { data: viewData, error: viewErr } = await supabase
    .from('v_foodi_ola_daily')
    .select('*')
    .order('snapshot_date', { ascending: true })

  if (!viewErr && viewData && viewData.length > 0) {
    return viewData.map((r: any) => ({
      date: r.snapshot_date,
      fileDate: r.file_date,
      stockBasis: r.stock_basis || 'previous_day',
      olaPercentage: Number(r.ola_percentage || 0),
      availableSkus: Number(r.available_skus || 0),
      totalSkus: Number(r.total_skus || 0),
    }))
  }

  // Fallback querying marketplace_report_uploads
  const foodiId = await getFoodiAccountId()
  if (!foodiId) return []

  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id, report_date, stock_as_of, stock_basis, row_count, ola_percentage, basepacks_available, basepacks_total')
    .eq('account_id', foodiId)
    .order('report_date', { ascending: true })

  return (uploads || []).map((u: any) => ({
    date: u.stock_as_of || u.report_date,
    fileDate: u.report_date,
    stockBasis: u.stock_basis || 'previous_day',
    olaPercentage: Number(u.ola_percentage || 0),
    availableSkus: Number(u.basepacks_available || 0),
    totalSkus: Number(u.basepacks_total || u.row_count || 0),
  }))
}

export async function getFoodiUploadHistory(): Promise<FoodiUploadRecord[]> {
  if (!supabase) return []
  const foodiId = await getFoodiAccountId()
  if (!foodiId) return []

  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id, report_date, stock_basis, stock_as_of, file_name, sheet_name, row_count, ola_percentage, uploaded_at, uploaded_by')
    .eq('account_id', foodiId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })

  return (uploads || []).map((u: any) => ({
    id: u.id,
    reportDate: u.report_date,
    stockBasis: (u.stock_basis as any) || 'previous_day',
    stockAsOf: u.stock_as_of || u.report_date,
    fileName: u.file_name,
    sheetName: u.sheet_name || 'Sheet1',
    rowCount: Number(u.row_count || 0),
    olaPercentage: u.ola_percentage != null ? Number(u.ola_percentage) : null,
    uploadedAt: u.uploaded_at,
    uploadedBy: u.uploaded_by || 'foodi_importer',
  }))
}

export async function editFoodiUploadBasis(
  uploadId: string,
  newBasis: 'same_day' | 'previous_day'
): Promise<{ success: boolean; newAsOfDate?: string; error?: string }> {
  const res = await fetch('/api/foodi/edit-basis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, newBasis }),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to update stock basis')
  }
  return json
}
