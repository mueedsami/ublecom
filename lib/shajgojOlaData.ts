import { supabase, demoMode } from './supabase'

export interface ShajgojSummary {
  asOfDate: string
  periodLabel: string
  daysOld: number
  totalCoreSkus: number
  totalCoreBasepacks: number
  availableBasepacks: number
  olaPercentage: number
  skuInStockCount: number
  lowStockSkusCount: number
  unresolvedSkusCount: number
  unresolvedWithStockCount: number
  totalExtrasCount: number
  extrasInStockCount: number
  extrasWithSalesCount: number
  uploadId?: string
  fileName?: string
}

export interface ShajgojCoreBasepack {
  basepackId: string
  basepackName: string
  brand: string
  category: string
  businessUnit: string
  format?: string
  totalStock: number
  available: boolean
  skuCount: number
  inStockSkuCount: number
  hasUnresolvedOnly: boolean
  skus: ShajgojCoreSkuItem[]
}

export interface ShajgojCoreSkuItem {
  id: string
  sku: string
  name: string
  basepackId: string
  basepackName: string
  brand: string
  category: string
  currentStock: number
  soldQty: number
  mrp: number | null
  tp: number | null
  webStatus: string
  isUnresolved: boolean
  productUrl?: string
  slug?: string
}

export interface ShajgojLowStockItem {
  id: string
  sku: string
  name: string
  basepackId: string
  basepackName: string
  brand: string
  category: string
  currentStock: number
  soldQty: number
  mrp: number | null
  tp: number | null
  basepackTotalStock: number
  basepackCoreSkuCount: number
  basepackLowStock: boolean
}

export interface ShajgojUnresolvedItem {
  id: string
  sku: string
  name: string
  basepackId: string
  basepackName: string
  brand: string
  category: string
  currentStock: number
  soldQty: number
  mrp: number | null
  tp: number | null
  webStatus: string
  available: boolean
}

export interface ShajgojExtraItem {
  id: string
  sku: string
  sourceProductId: string
  name: string
  vendorName?: string
  brand?: string
  category?: string
  currentStock: number
  soldQty: number
  mrp: number | null
  tp: number | null
  stockValue: number | null
  totalAmount: number | null
  dismissed: boolean
  inStock: boolean
}

export interface ShajgojUploadRecord {
  id: string
  reportDate: string
  periodLabel: string
  fileName: string
  sheetName: string
  rowCount: number
  coreCount: number
  extrasCount: number
  duplicatesCount: number
  olaPercentage: number | null
  basepacksAvailable: number
  basepacksTotal: number
  uploadedAt: string
  uploadedBy: string
}

export interface ShajgojTrendPoint {
  date: string
  olaPercentage: number
  basepacksAvailable: number
  basepacksTotal: number
  periodLabel?: string
}

// Check if migration 016 view exists
export async function checkShajgojSchemaInstalled(): Promise<boolean> {
  if (demoMode || !supabase) return false
  try {
    const { error } = await supabase
      .from('v_shajgoj_unresolved')
      .select('item_id', { head: true, count: 'exact' })
    if (error && (error.code === 'PGRST205' || error.message.includes('v_shajgoj_unresolved'))) {
      return false
    }
    return !error
  } catch {
    return false
  }
}

/**
 * Fetch Shajgoj OLA Summary
 */
export async function getShajgojSummary(): Promise<ShajgojSummary | null> {
  if (!supabase) return null

  // 1. Fetch latest upload for Shajgoj
  const { data: accounts } = await supabase.from('accounts').select('id').eq('code', 'shajgoj').limit(1)
  if (!accounts || accounts.length === 0) return null
  const accountId = accounts[0].id

  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('*')
    .eq('account_id', accountId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(1)

  const latestUpload = uploads?.[0]
  const asOfDate = latestUpload?.report_date || '2026-09-29'
  const periodLabel = latestUpload?.periodLabel || latestUpload?.period_label || 'September 1-28th ,2026'

  // Calculate days old
  const diffDays = Math.max(0, Math.floor((new Date().getTime() - new Date(asOfDate).getTime()) / (1000 * 60 * 60 * 24)))

  // Query core items
  const { data: items } = await supabase
    .from('marketplace_items')
    .select(`
      id,
      sku,
      name,
      basepack_id,
      match_status,
      vendor_name,
      basepacks (id, name, brand, category, business_unit, format)
    `)
    .eq('account_id', accountId)

  // Query snapshots for latest upload if upload exists
  let stockMap = new Map<string, number>()
  let salesMap = new Map<string, number>()

  if (latestUpload) {
    const { data: stockData } = await supabase
      .from('marketplace_stock_snapshots')
      .select('item_id, current_stock')
      .eq('upload_id', latestUpload.id)

    for (const s of stockData || []) {
      stockMap.set(s.item_id, Number(s.current_stock || 0))
    }

    const { data: salesData } = await supabase
      .from('marketplace_sales_periods')
      .select('item_id, sold_qty')
      .eq('upload_id', latestUpload.id)

    for (const sp of salesData || []) {
      salesMap.set(sp.item_id, Number(sp.sold_qty || 0))
    }
  }

  // Fetch account_products metadata for web_status
  const { data: accountProducts } = await supabase
    .from('account_products')
    .select('account_sku, metadata, product_url, slug')
    .eq('account_id', accountId)

  const apMetaMap = new Map<string, any>()
  for (const ap of accountProducts || []) {
    if (ap.account_sku) {
      apMetaMap.set(ap.account_sku.trim(), ap)
    }
  }

  // In-scope scopes
  const { data: scopes } = await supabase
    .from('basepack_scopes')
    .select('basepack_id')
    .eq('account_id', accountId)
    .eq('active', true)
    .eq('ola_enabled', true)

  const scopedBpIds = new Set((scopes || []).map((s: any) => s.basepack_id))

  // Categorize items
  const coreItems = (items || []).filter((i: any) => (i.tier ? i.tier === 'core' : i.match_status === 'matched'))
  const extraItems = (items || []).filter((i: any) => (i.tier ? i.tier === 'extra' : i.match_status !== 'matched'))

  let skuInStock = 0
  let lowStockCount = 0
  let unresolvedCount = 0
  let unresolvedWithStock = 0

  const bpStockMap = new Map<string, number>()

  for (const item of coreItems) {
    const stock = stockMap.get(item.id) || 0
    if (stock > 0) skuInStock++
    if (stock >= 1 && stock <= 9) lowStockCount++

    if (item.basepack_id) {
      bpStockMap.set(item.basepack_id, (bpStockMap.get(item.basepack_id) || 0) + stock)
    }

    const ap = apMetaMap.get(item.sku?.trim() || '')
    const webStatus = item.web_status || ap?.metadata?.web_status || 'In Stock'
    const isUnres = webStatus === 'Not found' || webStatus.includes('not found') || webStatus === 'unresolved'
    if (isUnres) {
      unresolvedCount++
      if (stock > 0) unresolvedWithStock++
    }
  }

  let availableBasepacks = 0
  for (const bpId of scopedBpIds) {
    if ((bpStockMap.get(bpId) || 0) > 0) {
      availableBasepacks++
    }
  }

  const totalBasepacks = scopedBpIds.size || 142
  const olaPercentage = totalBasepacks > 0 ? Number(((availableBasepacks / totalBasepacks) * 100).toFixed(1)) : 0

  let extraInStock = 0
  let extraWithSales = 0
  for (const ex of extraItems) {
    const st = stockMap.get(ex.id) || 0
    const sl = salesMap.get(ex.id) || 0
    if (st > 0) extraInStock++
    if (sl > 0) extraWithSales++
  }

  return {
    asOfDate,
    periodLabel,
    daysOld: diffDays,
    totalCoreSkus: coreItems.length || 227,
    totalCoreBasepacks: totalBasepacks,
    availableBasepacks,
    olaPercentage,
    skuInStockCount: skuInStock,
    lowStockSkusCount: lowStockCount,
    unresolvedSkusCount: unresolvedCount,
    unresolvedWithStockCount: unresolvedWithStock,
    totalExtrasCount: extraItems.length,
    extrasInStockCount: extraInStock,
    extrasWithSalesCount: extraWithSales,
    uploadId: latestUpload?.id,
    fileName: latestUpload?.file_name,
  }
}

/**
 * Fetch All Core Basepacks with Nested SKUs for Explorer
 */
export async function getShajgojCoreBasepacks(): Promise<ShajgojCoreBasepack[]> {
  if (!supabase) return []

  const { data: accounts } = await supabase.from('accounts').select('id').eq('code', 'shajgoj').limit(1)
  if (!accounts || accounts.length === 0) return []
  const accountId = accounts[0].id

  // Latest upload
  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id')
    .eq('account_id', accountId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(1)

  const uploadId = uploads?.[0]?.id

  let stockMap = new Map<string, any>()
  let salesMap = new Map<string, any>()

  if (uploadId) {
    const { data: stockData } = await supabase
      .from('marketplace_stock_snapshots')
      .select('item_id, current_stock, mrp, tp')
      .eq('upload_id', uploadId)
    for (const s of stockData || []) {
      stockMap.set(s.item_id, s)
    }

    const { data: salesData } = await supabase
      .from('marketplace_sales_periods')
      .select('item_id, sold_qty')
      .eq('upload_id', uploadId)
    for (const sp of salesData || []) {
      salesMap.set(sp.item_id, Number(sp.sold_qty || 0))
    }
  }

  // Scoped basepacks
  const { data: scopes } = await supabase
    .from('basepack_scopes')
    .select(`
      basepack_id,
      basepacks (id, name, brand, category, business_unit, format)
    `)
    .eq('account_id', accountId)
    .eq('active', true)
    .eq('ola_enabled', true)

  // Core items
  const { data: items } = await supabase
    .from('marketplace_items')
    .select('id, sku, name, basepack_id, match_status')
    .eq('account_id', accountId)

  // AP metadata
  const { data: accountProducts } = await supabase
    .from('account_products')
    .select('account_sku, metadata, product_url, slug')
    .eq('account_id', accountId)
  const apMap = new Map<string, any>()
  for (const ap of accountProducts || []) {
    if (ap.account_sku) apMap.set(ap.account_sku.trim(), ap)
  }

  // Group SKUs by basepack
  const skusByBp = new Map<string, ShajgojCoreSkuItem[]>()
  for (const it of items || []) {
    if (!it.basepack_id) continue
    const st = stockMap.get(it.id)
    const sl = salesMap.get(it.id) || 0
    const ap = apMap.get(it.sku?.trim() || '')
    const webStatus = (it as any).web_status || ap?.metadata?.web_status || 'In Stock'
    const isUnres = webStatus === 'Not found' || webStatus.includes('not found') || webStatus === 'unresolved'

    const skuItem: ShajgojCoreSkuItem = {
      id: it.id,
      sku: it.sku || '',
      name: it.name,
      basepackId: it.basepack_id,
      basepackName: '',
      brand: ap?.metadata?.brand || '',
      category: '',
      currentStock: Number(st?.current_stock || 0),
      soldQty: sl,
      mrp: st?.mrp ? Number(st.mrp) : null,
      tp: st?.tp ? Number(st.tp) : null,
      webStatus,
      isUnresolved: isUnres,
      productUrl: ap?.product_url,
      slug: ap?.slug,
    }

    const list = skusByBp.get(it.basepack_id) || []
    list.push(skuItem)
    skusByBp.set(it.basepack_id, list)
  }

  const results: ShajgojCoreBasepack[] = []
  for (const sc of scopes || []) {
    const bp = sc.basepacks as any
    if (!bp) continue
    const skus = skusByBp.get(bp.id) || []
    // enrich sku with bp details
    for (const s of skus) {
      s.basepackName = bp.name
      if (!s.brand) s.brand = bp.brand
      s.category = bp.category
    }

    const totalStock = skus.reduce((sum, s) => sum + s.currentStock, 0)
    const inStockSkus = skus.filter(s => s.currentStock > 0).length
    const hasUnresolvedOnly = skus.length > 0 && skus.every(s => s.isUnresolved)

    results.push({
      basepackId: bp.id,
      basepackName: bp.name,
      brand: bp.brand || 'Unilever',
      category: bp.category || 'General',
      businessUnit: bp.business_unit || 'Beauty & Wellbeing',
      format: bp.format || '',
      totalStock,
      available: totalStock > 0,
      skuCount: skus.length,
      inStockSkuCount: inStockSkus,
      hasUnresolvedOnly,
      skus,
    })
  }

  // Sort: unavailable first, then by brand and name
  results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? 1 : -1
    return a.basepackName.localeCompare(b.basepackName)
  })

  return results
}

/**
 * Fetch 44 Unresolved SKUs
 */
export async function getShajgojUnresolvedSkus(): Promise<ShajgojUnresolvedItem[]> {
  if (!supabase) return []

  // Check if view exists
  const hasSchema = await checkShajgojSchemaInstalled()
  if (hasSchema) {
    const { data, error } = await supabase
      .from('v_shajgoj_unresolved')
      .select('*')
      .order('sold_qty', { ascending: false })
      .order('current_stock', { ascending: false })

    if (!error && data) {
      return data.map((d: any) => ({
        id: d.item_id,
        sku: d.sku || d.source_product_id,
        name: d.item_name,
        basepackId: d.basepack_id,
        basepackName: d.basepack_name || '',
        brand: d.basepack_brand || '',
        category: d.basepack_category || '',
        currentStock: Number(d.current_stock || 0),
        soldQty: Number(d.sold_qty || 0),
        mrp: d.mrp ? Number(d.mrp) : null,
        tp: d.tp ? Number(d.tp) : null,
        webStatus: d.web_status || 'Not found',
        available: Boolean(d.available),
      }))
    }
  }

  // Direct table query fallback
  const basepacks = await getShajgojCoreBasepacks()
  const unresolved: ShajgojUnresolvedItem[] = []
  for (const bp of basepacks) {
    for (const s of bp.skus) {
      if (s.isUnresolved) {
        unresolved.push({
          id: s.id,
          sku: s.sku,
          name: s.name,
          basepackId: s.basepackId,
          basepackName: bp.basepackName,
          brand: bp.brand,
          category: bp.category,
          currentStock: s.currentStock,
          soldQty: s.soldQty,
          mrp: s.mrp,
          tp: s.tp,
          webStatus: s.webStatus,
          available: s.currentStock > 0,
        })
      }
    }
  }
  return unresolved.sort((a, b) => b.soldQty - a.soldQty || b.currentStock - a.currentStock)
}

/**
 * Fetch Low Stock SKUs (1-9 units)
 */
export async function getShajgojLowStockSkus(): Promise<ShajgojLowStockItem[]> {
  if (!supabase) return []

  const hasSchema = await checkShajgojSchemaInstalled()
  if (hasSchema) {
    const { data, error } = await supabase
      .from('v_shajgoj_low_stock')
      .select('*')
      .order('current_stock', { ascending: true })

    if (!error && data) {
      return data.map((d: any) => ({
        id: d.item_id,
        sku: d.sku || d.source_product_id,
        name: d.item_name,
        basepackId: d.basepack_id,
        basepackName: d.basepack_name || '',
        brand: d.basepack_brand || '',
        category: d.basepack_category || '',
        currentStock: Number(d.current_stock || 0),
        soldQty: Number(d.sold_qty || 0),
        mrp: d.mrp ? Number(d.mrp) : null,
        tp: d.tp ? Number(d.tp) : null,
        basepackTotalStock: Number(d.basepack_total_stock || 0),
        basepackCoreSkuCount: Number(d.basepack_core_sku_count || 1),
        basepackLowStock: Boolean(d.basepack_low_stock),
      }))
    }
  }

  // Fallback
  const basepacks = await getShajgojCoreBasepacks()
  const lowList: ShajgojLowStockItem[] = []
  for (const bp of basepacks) {
    for (const s of bp.skus) {
      if (s.currentStock >= 1 && s.currentStock <= 9) {
        lowList.push({
          id: s.id,
          sku: s.sku,
          name: s.name,
          basepackId: s.basepackId,
          basepackName: bp.basepackName,
          brand: bp.brand,
          category: bp.category,
          currentStock: s.currentStock,
          soldQty: s.soldQty,
          mrp: s.mrp,
          tp: s.tp,
          basepackTotalStock: bp.totalStock,
          basepackCoreSkuCount: bp.skuCount,
          basepackLowStock: bp.totalStock < 10,
        })
      }
    }
  }
  return lowList.sort((a, b) => a.currentStock - b.currentStock)
}

/**
 * Fetch Out of Stock Basepacks
 */
export async function getShajgojOosBasepacks(): Promise<ShajgojCoreBasepack[]> {
  const basepacks = await getShajgojCoreBasepacks()
  return basepacks.filter(b => !b.available)
}

/**
 * Fetch Extras Tier SKUs (123 dump-only SKUs on separate floor)
 */
export async function getShajgojExtras(): Promise<ShajgojExtraItem[]> {
  if (!supabase) return []

  const hasSchema = await checkShajgojSchemaInstalled()
  if (hasSchema) {
    const { data, error } = await supabase
      .from('v_shajgoj_extras')
      .select('*')
      .order('sold_qty', { ascending: false })
      .order('current_stock', { ascending: false })

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.item_id,
        sku: d.sku || d.source_product_id,
        sourceProductId: d.source_product_id,
        name: d.item_name,
        vendorName: d.vendor_name,
        brand: d.basepack_brand || 'Shajgoj Dump',
        category: d.basepack_category || 'Extras',
        currentStock: Number(d.current_stock || 0),
        soldQty: Number(d.sold_qty || 0),
        mrp: d.mrp ? Number(d.mrp) : null,
        tp: d.tp ? Number(d.tp) : null,
        stockValue: d.stock_value ? Number(d.stock_value) : null,
        totalAmount: d.total_amount ? Number(d.total_amount) : null,
        dismissed: Boolean(d.dismissed),
        inStock: Boolean(d.in_stock),
      }))
    }
  }

  // Fallback via marketplace_items
  const { data: accounts } = await supabase.from('accounts').select('id').eq('code', 'shajgoj').limit(1)
  if (!accounts || accounts.length === 0) return []
  const accountId = accounts[0].id

  const { data: uploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id')
    .eq('account_id', accountId)
    .order('report_date', { ascending: false })
    .limit(1)
  const uploadId = uploads?.[0]?.id

  let stockMap = new Map<string, any>()
  let salesMap = new Map<string, any>()
  if (uploadId) {
    const { data: stockData } = await supabase
      .from('marketplace_stock_snapshots')
      .select('item_id, current_stock, mrp, tp, stock_value')
      .eq('upload_id', uploadId)
    for (const s of stockData || []) stockMap.set(s.item_id, s)

    const { data: salesData } = await supabase
      .from('marketplace_sales_periods')
      .select('item_id, sold_qty, total_amount')
      .eq('upload_id', uploadId)
    for (const sp of salesData || []) salesMap.set(sp.item_id, sp)
  }

  const { data: items } = await supabase
    .from('marketplace_items')
    .select('id, sku, source_product_id, name, vendor_name, tier, dismissed, match_status')
    .eq('account_id', accountId)

  const extras = (items || []).filter((i: any) => (i.tier ? i.tier === 'extra' : i.match_status === 'unmatched'))

  return extras
    .map((e: any) => {
      const st = stockMap.get(e.id)
      const sp = salesMap.get(e.id)
      const stock = Number(st?.current_stock || 0)
      const sales = Number(sp?.sold_qty || 0)
      return {
        id: e.id,
        sku: e.sku || e.source_product_id,
        sourceProductId: e.source_product_id,
        name: e.name,
        vendorName: e.vendor_name,
        brand: 'Shajgoj Dump',
        category: 'Extras',
        currentStock: stock,
        soldQty: sales,
        mrp: st?.mrp ? Number(st.mrp) : null,
        tp: st?.tp ? Number(st.tp) : null,
        stockValue: st?.stock_value ? Number(st.stock_value) : null,
        totalAmount: sp?.total_amount ? Number(sp.total_amount) : null,
        dismissed: Boolean(e.dismissed),
        inStock: stock > 0,
      }
    })
    .sort((a, b) => b.soldQty - a.soldQty || b.currentStock - a.currentStock)
}

/**
 * Toggle Dismiss/Restore for an Extra SKU
 */
export async function dismissShajgojExtra(itemId: string, dismissed: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('marketplace_items')
    .update({ dismissed })
    .eq('id', itemId)
  return !error
}

/**
 * Promote an Extra SKU to Core by Mapping to a Basepack
 */
export async function promoteExtraToCore(itemId: string, basepackId: string): Promise<boolean> {
  if (!supabase) return false

  const { data: item } = await supabase
    .from('marketplace_items')
    .select('id, account_id, sku, source_product_id, name')
    .eq('id', itemId)
    .single()

  if (!item) return false

  // 1. Update marketplace_items
  const { error: mktErr } = await supabase
    .from('marketplace_items')
    .update({
      tier: 'core',
      basepack_id: basepackId,
      match_status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  if (mktErr) return false

  // 2. Ensure basepack is in basepack_scopes
  await supabase.from('basepack_scopes').upsert(
    [
      {
        account_id: item.account_id,
        basepack_id: basepackId,
        location_id: null,
        ola_enabled: true,
        active: true,
        expected_listed: true,
      },
    ],
    { onConflict: 'account_id,basepack_id,location_id' }
  )

  // 3. Create or update account_products
  const sku = item.sku || item.source_product_id
  await supabase.from('account_products').upsert(
    [
      {
        account_id: item.account_id,
        basepack_id: basepackId,
        location_id: null,
        account_sku: sku,
        product_name: item.name,
        active: true,
      },
    ],
    { onConflict: 'account_id,account_sku,location_id' }
  )

  return true
}

/**
 * Fetch Upload Audit History
 */
export async function getShajgojUploadHistory(): Promise<ShajgojUploadRecord[]> {
  if (!supabase) return []
  const { data: accounts } = await supabase.from('accounts').select('id').eq('code', 'shajgoj').limit(1)
  if (!accounts || accounts.length === 0) return []
  const accountId = accounts[0].id

  const { data, error } = await supabase
    .from('marketplace_report_uploads')
    .select('*')
    .eq('account_id', accountId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })

  if (error || !data) return []

  return data.map((d: any) => ({
    id: d.id,
    reportDate: d.report_date,
    periodLabel: d.period_label || d.periodLabel || '',
    fileName: d.file_name,
    sheetName: d.sheet_name || '',
    rowCount: d.row_count,
    coreCount: d.core_count || 0,
    extrasCount: d.extras_count || 0,
    duplicatesCount: d.duplicates_count || 0,
    olaPercentage: d.ola_percentage ? Number(d.ola_percentage) : null,
    basepacksAvailable: d.basepacks_available || 0,
    basepacksTotal: d.basepacks_total || 0,
    uploadedAt: d.uploaded_at,
    uploadedBy: d.uploaded_by || 'system',
  }))
}

/**
 * Fetch Historical OLA Daily Trend for Shajgoj
 */
export async function getShajgojDailyTrend(): Promise<ShajgojTrendPoint[]> {
  if (!supabase) return []
  const { data: accounts } = await supabase.from('accounts').select('id').eq('code', 'shajgoj').limit(1)
  if (!accounts || accounts.length === 0) return []
  const accountId = accounts[0].id

  // 1. Check availability_snapshots
  const { data: snaps } = await supabase
    .from('availability_snapshots')
    .select('snapshot_date, available')
    .eq('account_id', accountId)
    .order('snapshot_date', { ascending: true })

  if (snaps && snaps.length > 0) {
    const byDate = new Map<string, { total: number; avail: number }>()
    for (const s of snaps) {
      const entry = byDate.get(s.snapshot_date) || { total: 0, avail: 0 }
      entry.total++
      if (s.available) entry.avail++
      byDate.set(s.snapshot_date, entry)
    }

    const points: ShajgojTrendPoint[] = []
    for (const [date, counts] of byDate.entries()) {
      points.push({
        date,
        basepacksTotal: counts.total,
        basepacksAvailable: counts.avail,
        olaPercentage: counts.total > 0 ? Number(((counts.avail / counts.total) * 100).toFixed(1)) : 0,
      })
    }
    return points
  }

  // Fallback to upload records
  const uploads = await getShajgojUploadHistory()
  return uploads
    .filter(u => u.olaPercentage != null)
    .map(u => ({
      date: u.reportDate,
      olaPercentage: u.olaPercentage!,
      basepacksAvailable: u.basepacksAvailable,
      basepacksTotal: u.basepacksTotal,
      periodLabel: u.periodLabel,
    }))
    .reverse()
}
