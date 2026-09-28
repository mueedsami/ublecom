import { demoMode, supabase } from './supabase'

export type MarketplaceItem = {
  id: string
  account_id: string
  source_product_id: string
  sku: string | null
  name: string
  vendor_name: string | null
  basepack_id: string | null
  match_status: 'matched' | 'unmatched' | 'ignored'
  matched_at: string | null
  created_at?: string
  updated_at?: string
  basepacks?: {
    id: string
    name: string
    brand: string | null
    category: string | null
    tp?: number | null
    mrp?: number | null
  } | null
  current_stock?: number
  sold_qty?: number
  run_rate?: number
  mrp?: number
  tp?: number
  stock_value?: number
  total_amount?: number
  period_label?: string
  report_date?: string
  days_of_cover?: number | null
}

export type MarketplaceSummaryStats = {
  total_skus: number
  matched_skus: number
  unmatched_skus: number
  ignored_skus: number
  total_sold_units: number
  total_revenue_gfv: number
  total_stock_units: number
  total_stock_value: number
  dead_stock_value: number
  stockout_risk_count: number
  period_label: string
  report_date: string
  last_upload_time: string | null
  is_schema_installed: boolean
}

export type MarketplaceSalesTrendPoint = {
  period_label: string
  report_date: string
  sold_qty: number
  total_amount: number
  stock_units: number
}

export type MarketplaceUploadRecord = {
  id: string
  period_label: string
  report_date: string
  file_name: string
  sheet_name: string | null
  row_count: number
  uploaded_at: string
  uploaded_by: string | null
}

// -------------------------------------------------------------
// Database Queries
// -------------------------------------------------------------

export async function checkMarketplaceSchemaInstalled(): Promise<boolean> {
  if (demoMode || !supabase) return false
  try {
    const { error } = await supabase
      .from('marketplace_report_uploads')
      .select('id', { head: true, count: 'exact' })
    if (error && (error.code === 'PGRST205' || error.message.includes('relation "public.marketplace_report_uploads" does not exist'))) {
      return false
    }
    return !error
  } catch {
    return false
  }
}

export async function getAccountIdByCode(accountCode: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', accountCode.toLowerCase())
    .maybeSingle()
  return data?.id || null
}

async function fetchAllPages<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: any; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = []
  let from = 0
  while (true) {
    const res = await queryFn(from, from + pageSize - 1)
    if (res.error) {
      console.warn('Marketplace pagination query error:', res.error)
      break
    }
    const data = res.data as T[] | null
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return allRows
}

export async function getMarketplaceSummaryStats(
  accountCode: string
): Promise<MarketplaceSummaryStats> {
  const isInstalled = await checkMarketplaceSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoMarketplaceStats(accountCode, isInstalled)
  }

  try {
    const accountId = await getAccountIdByCode(accountCode)
    if (!accountId) {
      return getDemoMarketplaceStats(accountCode, false)
    }

    // 1. Fetch latest upload record
    const { data: latestUpload } = await supabase
      .from('marketplace_report_uploads')
      .select('id,period_label,report_date,uploaded_at')
      .eq('account_id', accountId)
      .order('report_date', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestUpload) {
      return getDemoMarketplaceStats(accountCode, true)
    }

    // 2. Fetch catalog items for this account
    const { data: items, error: itemsErr } = await supabase
      .from('marketplace_items')
      .select('id,match_status')
      .eq('account_id', accountId)

    if (itemsErr) throw itemsErr

    let total_skus = (items || []).length
    let matched_skus = 0
    let unmatched_skus = 0
    let ignored_skus = 0

    for (const it of items || []) {
      if (it.match_status === 'matched') matched_skus++
      else if (it.match_status === 'ignored') ignored_skus++
      else unmatched_skus++
    }

    // 3. Fetch latest stock snapshots
    const stockRows = await fetchAllPages<{ current_stock: number; stock_value: number }>(
      (from, to) =>
        supabase!
          .from('marketplace_stock_snapshots')
          .select('current_stock,stock_value')
          .eq('upload_id', latestUpload.id)
          .range(from, to)
    )

    let total_stock_units = 0
    let total_stock_value = 0
    for (const st of stockRows) {
      total_stock_units += Number(st.current_stock || 0)
      total_stock_value += Number(st.stock_value || 0)
    }

    // 4. Fetch latest sales periods
    const salesRows = await fetchAllPages<{ sold_qty: number; total_amount: number; run_rate: number; item_id: string }>(
      (from, to) =>
        supabase!
          .from('marketplace_sales_periods')
          .select('sold_qty,total_amount,run_rate,item_id')
          .eq('upload_id', latestUpload.id)
          .range(from, to)
    )

    let total_sold_units = 0
    let total_revenue_gfv = 0
    for (const sp of salesRows) {
      total_sold_units += Number(sp.sold_qty || 0)
      total_revenue_gfv += Number(sp.total_amount || 0)
    }

    // 5. Calculate dead stock value (stock > 0 and sold_qty == 0)
    const salesByItem = new Map<string, number>(salesRows.map(s => [s.item_id, s.sold_qty || 0]))
    const fullStockWithItem = await fetchAllPages<{ item_id: string; current_stock: number; stock_value: number }>(
      (from, to) =>
        supabase!
          .from('marketplace_stock_snapshots')
          .select('item_id,current_stock,stock_value')
          .eq('upload_id', latestUpload.id)
          .range(from, to)
    )

    let dead_stock_value = 0
    let stockout_risk_count = 0
    for (const st of fullStockWithItem) {
      const sold = salesByItem.get(st.item_id) || 0
      const stock = Number(st.current_stock || 0)
      if (stock > 0 && sold === 0) {
        dead_stock_value += Number(st.stock_value || 0)
      }
      if (sold > 0 && stock <= 5) {
        stockout_risk_count++
      }
    }

    return {
      total_skus,
      matched_skus,
      unmatched_skus,
      ignored_skus,
      total_sold_units,
      total_revenue_gfv,
      total_stock_units,
      total_stock_value,
      dead_stock_value,
      stockout_risk_count,
      period_label: latestUpload.period_label || 'Current Period',
      report_date: latestUpload.report_date || new Date().toISOString().slice(0, 10),
      last_upload_time: latestUpload.uploaded_at,
      is_schema_installed: true,
    }
  } catch (err) {
    console.warn('Failed to load live marketplace stats, falling back to demo:', err)
    return getDemoMarketplaceStats(accountCode, false)
  }
}

export async function listMarketplaceCatalog(
  accountCode: string,
  options?: { status?: string; search?: string }
): Promise<MarketplaceItem[]> {
  const isInstalled = await checkMarketplaceSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoMarketplaceCatalog(accountCode, options)
  }

  try {
    const accountId = await getAccountIdByCode(accountCode)
    if (!accountId) return getDemoMarketplaceCatalog(accountCode, options)

    // Query v_marketplace_current if view exists, else query marketplace_items directly
    let query = supabase
      .from('v_marketplace_current')
      .select('*')
      .eq('account_id', accountId)

    if (options?.status && options.status !== 'all') {
      query = query.eq('match_status', options.status)
    }

    if (options?.search) {
      const s = options.search.trim()
      query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,source_product_id.ilike.%${s}%,basepack_name.ilike.%${s}%`)
    }

    const { data, error } = await query.order('sold_qty', { ascending: false }).limit(500)

    if (error) {
      // Fallback direct query on marketplace_items
      let fallbackQuery = supabase
        .from('marketplace_items')
        .select('id,account_id,source_product_id,sku,name,vendor_name,basepack_id,match_status,matched_at,basepacks(id,name,brand,category)')
        .eq('account_id', accountId)

      if (options?.status && options.status !== 'all') {
        fallbackQuery = fallbackQuery.eq('match_status', options.status)
      }
      const { data: fbData } = await fallbackQuery.limit(500)
      return (fbData || []).map((r: any) => ({
        ...r,
        current_stock: 0,
        sold_qty: 0,
      }))
    }

    return (data || []).map((r: any) => ({
      id: r.item_id,
      account_id: r.account_id,
      source_product_id: r.source_product_id,
      sku: r.sku,
      name: r.item_name,
      vendor_name: r.vendor_name,
      basepack_id: r.basepack_id,
      match_status: r.match_status,
      matched_at: r.matched_at,
      basepacks: r.basepack_id
        ? {
            id: r.basepack_id,
            name: r.basepack_name,
            brand: r.basepack_brand,
            category: r.basepack_category,
          }
        : null,
      current_stock: Number(r.current_stock || 0),
      sold_qty: Number(r.sold_qty || 0),
      run_rate: r.run_rate ? Number(r.run_rate) : undefined,
      mrp: r.mrp ? Number(r.mrp) : undefined,
      tp: r.tp ? Number(r.tp) : undefined,
      stock_value: r.stock_value ? Number(r.stock_value) : undefined,
      total_amount: r.total_amount ? Number(r.total_amount) : undefined,
      period_label: r.period_label,
      report_date: r.report_date,
      days_of_cover:
        r.run_rate && Number(r.run_rate) > 0
          ? Math.round(Number(r.current_stock || 0) / Number(r.run_rate))
          : null,
    }))
  } catch (err) {
    console.warn('Failed to load marketplace catalog, falling back to demo:', err)
    return getDemoMarketplaceCatalog(accountCode, options)
  }
}

export async function getMarketplaceSalesTrend(
  accountCode: string,
  filter?: { itemId?: string }
): Promise<MarketplaceSalesTrendPoint[]> {
  const isInstalled = await checkMarketplaceSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoMarketplaceSalesTrend()
  }

  try {
    const accountId = await getAccountIdByCode(accountCode)
    if (!accountId) return getDemoMarketplaceSalesTrend()

    // Fetch uploads history
    const { data: uploads } = await supabase
      .from('marketplace_report_uploads')
      .select('id,period_label,report_date,uploaded_at')
      .eq('account_id', accountId)
      .order('report_date', { ascending: true })
      .limit(12)

    if (!uploads || uploads.length === 0) {
      return getDemoMarketplaceSalesTrend()
    }

    const points: MarketplaceSalesTrendPoint[] = []

    for (const up of uploads) {
      let salesQuery = supabase
        .from('marketplace_sales_periods')
        .select('sold_qty,total_amount')
        .eq('upload_id', up.id)

      let stockQuery = supabase
        .from('marketplace_stock_snapshots')
        .select('current_stock')
        .eq('upload_id', up.id)

      if (filter?.itemId) {
        salesQuery = salesQuery.eq('item_id', filter.itemId)
        stockQuery = stockQuery.eq('item_id', filter.itemId)
      }

      const [{ data: sRows }, { data: stRows }] = await Promise.all([salesQuery, stockQuery])

      const totalSold = (sRows || []).reduce((acc, r) => acc + Number(r.sold_qty || 0), 0)
      const totalAmount = (sRows || []).reduce((acc, r) => acc + Number(r.total_amount || 0), 0)
      const totalStock = (stRows || []).reduce((acc, r) => acc + Number(r.current_stock || 0), 0)

      points.push({
        period_label: up.period_label,
        report_date: up.report_date,
        sold_qty: totalSold,
        total_amount: totalAmount,
        stock_units: totalStock,
      })
    }

    return points.length > 0 ? points : getDemoMarketplaceSalesTrend()
  } catch (err) {
    console.warn('Failed to load marketplace sales trend, falling back to demo:', err)
    return getDemoMarketplaceSalesTrend()
  }
}

export async function listMarketplaceUploads(
  accountCode: string
): Promise<MarketplaceUploadRecord[]> {
  if (!supabase) return []
  try {
    const accountId = await getAccountIdByCode(accountCode)
    if (!accountId) return []
    const { data } = await supabase
      .from('marketplace_report_uploads')
      .select('id,period_label,report_date,file_name,sheet_name,row_count,uploaded_at,uploaded_by')
      .eq('account_id', accountId)
      .order('report_date', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(30)
    return data || []
  } catch {
    return []
  }
}

export async function tagMarketplaceItem(
  itemId: string,
  basepackId: string | null,
  status: 'matched' | 'unmatched' | 'ignored'
): Promise<void> {
  if (!supabase) {
    console.log('[Demo] Tagged marketplace item:', { itemId, basepackId, status })
    return
  }

  const { error } = await supabase
    .from('marketplace_items')
    .update({
      basepack_id: basepackId,
      match_status: status,
      matched_at: status === 'matched' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  if (error) throw error
}

export async function searchBasepacks(
  query: string
): Promise<Array<{ id: string; name: string; brand: string | null; category: string | null; tp?: number | null; mrp?: number | null }>> {
  if (!supabase) {
    return getDemoBasepackSearchResults(query)
  }

  try {
    let q = supabase
      .from('basepacks')
      .select('id,name,brand,category,tp,mrp')
      .order('name', { ascending: true })
      .limit(20)

    if (query.trim()) {
      q = q.ilike('name', `%${query.trim()}%`)
    }

    const { data, error } = await q
    if (error) return getDemoBasepackSearchResults(query)
    return data || []
  } catch {
    return getDemoBasepackSearchResults(query)
  }
}

// -------------------------------------------------------------
// Demo Fallback Data (Real Othoba Products & Realistic Values)
// -------------------------------------------------------------

function getDemoMarketplaceStats(accountCode: string, isInstalled: boolean): MarketplaceSummaryStats {
  return {
    total_skus: 451,
    matched_skus: 382,
    unmatched_skus: 48,
    ignored_skus: 21,
    total_sold_units: 3240,
    total_revenue_gfv: 1428500,
    total_stock_units: 18450,
    total_stock_value: 6284200,
    dead_stock_value: 485000,
    stockout_risk_count: 14,
    period_label: 'September 2026',
    report_date: '2026-09-21',
    last_upload_time: new Date().toISOString(),
    is_schema_installed: isInstalled,
  }
}

export function getDemoMarketplaceSalesTrend(): MarketplaceSalesTrendPoint[] {
  return [
    { period_label: 'April 2026', report_date: '2026-04-30', sold_qty: 2150, total_amount: 980000, stock_units: 19500 },
    { period_label: 'May 2026', report_date: '2026-05-31', sold_qty: 2420, total_amount: 1120000, stock_units: 18200 },
    { period_label: 'June 2026', report_date: '2026-06-30', sold_qty: 2890, total_amount: 1290000, stock_units: 20100 },
    { period_label: 'July 2026', report_date: '2026-07-31', sold_qty: 3120, total_amount: 1380000, stock_units: 17800 },
    { period_label: 'August 2026', report_date: '2026-08-31', sold_qty: 3450, total_amount: 1540000, stock_units: 16900 },
    { period_label: 'September 2026', report_date: '2026-09-21', sold_qty: 3240, total_amount: 1428500, stock_units: 18450 },
  ]
}

export function getDemoMarketplaceCatalog(
  accountCode: string,
  options?: { status?: string; search?: string }
): MarketplaceItem[] {
  const items: MarketplaceItem[] = [
    {
      id: 'demo-1',
      account_id: 'othoba',
      source_product_id: '1074410',
      sku: 'UNFS1074410',
      name: "Pond's Face Wash Hydra Miracle Gentle Gel 100g",
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-1',
      match_status: 'matched',
      matched_at: '2026-09-01T10:00:00Z',
      basepacks: { id: 'bp-1', name: "Pond's Face Wash Hydra Miracle 100g", brand: "Pond's", category: 'Skin Cleansing' },
      current_stock: 65,
      sold_qty: 120,
      run_rate: 4.0,
      mrp: 250,
      tp: 185,
      stock_value: 12025,
      total_amount: 22200,
      period_label: 'September 2026',
      days_of_cover: 16,
    },
    {
      id: 'demo-2',
      account_id: 'othoba',
      source_product_id: '1073628',
      sku: 'UNFS1073628',
      name: 'Buy 2 Surf Excel Liquid Top Load 1L Get Clothing Organizer Bag Free',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-2',
      match_status: 'matched',
      matched_at: '2026-09-01T10:00:00Z',
      basepacks: { id: 'bp-2', name: 'Surf Excel Liquid Top Load 1L Combo', brand: 'Surf Excel', category: 'Fabric Cleaning' },
      current_stock: 243,
      sold_qty: 145,
      run_rate: 4.83,
      mrp: 800,
      tp: 696,
      stock_value: 169128,
      total_amount: 100920,
      period_label: 'September 2026',
      days_of_cover: 50,
    },
    {
      id: 'demo-3',
      account_id: 'othoba',
      source_product_id: '1070020',
      sku: 'UNFS1070020',
      name: 'Pepsodent Sensitive Expert Gum Expert 140g',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-3',
      match_status: 'matched',
      matched_at: '2026-09-02T11:00:00Z',
      basepacks: { id: 'bp-3', name: 'Pepsodent Sensitive Expert Gum Expert 140g', brand: 'Pepsodent', category: 'Oral Care' },
      current_stock: 372,
      sold_qty: 12,
      run_rate: 0.4,
      mrp: 250,
      tp: 208,
      stock_value: 77376,
      total_amount: 2496,
      period_label: 'September 2026',
      days_of_cover: 930,
    },
    {
      id: 'demo-4',
      account_id: 'othoba',
      source_product_id: '1011851',
      sku: 'UNFS1011851',
      name: 'Vim Dishwashing Liquid 950ml (Wooden Spoon Free)',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-4',
      match_status: 'matched',
      matched_at: '2026-09-01T10:00:00Z',
      basepacks: { id: 'bp-4', name: 'Vim Dishwashing Liquid 950ml', brand: 'Vim', category: 'Dishwashing' },
      current_stock: 12,
      sold_qty: 210,
      run_rate: 7.0,
      mrp: 260,
      tp: 227,
      stock_value: 2724,
      total_amount: 47670,
      period_label: 'September 2026',
      days_of_cover: 2,
    },
    {
      id: 'demo-5',
      account_id: 'othoba',
      source_product_id: '1057092',
      sku: 'UNFS1057092',
      name: 'Sunsilk Shampoo Silky Smooth 340ml',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: null,
      match_status: 'unmatched',
      matched_at: null,
      basepacks: null,
      current_stock: 4,
      sold_qty: 180,
      run_rate: 6.0,
      mrp: 350,
      tp: 307.28,
      stock_value: 1229,
      total_amount: 55310,
      period_label: 'September 2026',
      days_of_cover: 1,
    },
    {
      id: 'demo-6',
      account_id: 'othoba',
      source_product_id: '1057091',
      sku: 'UNFS1057091',
      name: 'Sunsilk Shampoo Silky Smooth 170ml',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: null,
      match_status: 'unmatched',
      matched_at: null,
      basepacks: null,
      current_stock: 0,
      sold_qty: 95,
      run_rate: 3.16,
      mrp: 180,
      tp: 158.17,
      stock_value: 0,
      total_amount: 15026,
      period_label: 'September 2026',
      days_of_cover: 0,
    },
    {
      id: 'demo-7',
      account_id: 'othoba',
      source_product_id: '1069473',
      sku: 'UNFS1069473',
      name: 'Buy 2 Surf Excel Liquid Detergent Top Load 500ml Free Clothing Organizer',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: null,
      match_status: 'unmatched',
      matched_at: null,
      basepacks: null,
      current_stock: 140,
      sold_qty: 0,
      run_rate: 0,
      mrp: 420,
      tp: 365.22,
      stock_value: 51130,
      total_amount: 0,
      period_label: 'September 2026',
      days_of_cover: null,
    },
    {
      id: 'demo-8',
      account_id: 'othoba',
      source_product_id: '1011391',
      sku: 'UNFS1011391',
      name: 'Vim Dishwashing Bar 115g',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-8',
      match_status: 'matched',
      matched_at: '2026-09-01T10:00:00Z',
      basepacks: { id: 'bp-8', name: 'Vim Dishwashing Bar 115g', brand: 'Vim', category: 'Dishwashing' },
      current_stock: 450,
      sold_qty: 620,
      run_rate: 20.6,
      mrp: 15,
      tp: 14,
      stock_value: 6300,
      total_amount: 8680,
      period_label: 'September 2026',
      days_of_cover: 22,
    },
    {
      id: 'demo-9',
      account_id: 'othoba',
      source_product_id: '1048820',
      sku: 'UNFS1048820',
      name: 'Tresemme Shampoo Keratin Smooth 580ml',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: 'bp-9',
      match_status: 'matched',
      matched_at: '2026-09-01T10:00:00Z',
      basepacks: { id: 'bp-9', name: 'Tresemme Shampoo Keratin Smooth 580ml', brand: 'Tresemme', category: 'Hair Care' },
      current_stock: 15,
      sold_qty: 110,
      run_rate: 3.66,
      mrp: 850,
      tp: 680,
      stock_value: 10200,
      total_amount: 74800,
      period_label: 'September 2026',
      days_of_cover: 4,
    },
    {
      id: 'demo-10',
      account_id: 'othoba',
      source_product_id: '1099882',
      sku: 'UNFS1099882',
      name: 'Old Discontinued Summer Promo Gift Pack',
      vendor_name: 'Unilever Flagship Store',
      basepack_id: null,
      match_status: 'ignored',
      matched_at: '2026-09-05T09:00:00Z',
      basepacks: null,
      current_stock: 0,
      sold_qty: 0,
      run_rate: 0,
      mrp: 500,
      tp: 400,
      stock_value: 0,
      total_amount: 0,
      period_label: 'September 2026',
      days_of_cover: null,
    },
  ]

  let filtered = [...items]
  if (options?.status && options.status !== 'all') {
    filtered = filtered.filter(i => i.match_status === options.status)
  }
  if (options?.search) {
    const s = options.search.toLowerCase()
    filtered = filtered.filter(
      i =>
        i.name.toLowerCase().includes(s) ||
        (i.sku && i.sku.toLowerCase().includes(s)) ||
        i.source_product_id.includes(s) ||
        (i.basepacks && i.basepacks.name.toLowerCase().includes(s))
    )
  }
  return filtered
}

function getDemoBasepackSearchResults(query: string) {
  const master = [
    { id: 'bp-1', name: "Pond's Face Wash Hydra Miracle 100g", brand: "Pond's", category: 'Skin Cleansing', tp: 185, mrp: 250 },
    { id: 'bp-2', name: 'Surf Excel Liquid Top Load 1L Combo', brand: 'Surf Excel', category: 'Fabric Cleaning', tp: 696, mrp: 800 },
    { id: 'bp-3', name: 'Pepsodent Sensitive Expert Gum Expert 140g', brand: 'Pepsodent', category: 'Oral Care', tp: 208, mrp: 250 },
    { id: 'bp-4', name: 'Vim Dishwashing Liquid 950ml', brand: 'Vim', category: 'Dishwashing', tp: 227, mrp: 260 },
    { id: 'bp-5', name: 'Sunsilk Shampoo Silky Smooth 340ml', brand: 'Sunsilk', category: 'Hair Care', tp: 307, mrp: 350 },
    { id: 'bp-6', name: 'Sunsilk Shampoo Silky Smooth 170ml', brand: 'Sunsilk', category: 'Hair Care', tp: 158, mrp: 180 },
    { id: 'bp-7', name: 'Surf Excel Liquid Detergent Top Load 500ml', brand: 'Surf Excel', category: 'Fabric Cleaning', tp: 365, mrp: 420 },
    { id: 'bp-8', name: 'Vim Dishwashing Bar 115g', brand: 'Vim', category: 'Dishwashing', tp: 14, mrp: 15 },
    { id: 'bp-9', name: 'Tresemme Shampoo Keratin Smooth 580ml', brand: 'Tresemme', category: 'Hair Care', tp: 680, mrp: 850 },
    { id: 'bp-10', name: 'Lux Body Wash French Rose & Almond 245ml', brand: 'Lux', category: 'Skin Cleansing', tp: 145, mrp: 200 },
    { id: 'bp-11', name: 'Dove Beauty Moisture Facial Cleanser 100g', brand: 'Dove', category: 'Skin Cleansing', tp: 295, mrp: 375 },
    { id: 'bp-12', name: 'Lifebuoy Total Soap Bar 100g', brand: 'Lifebuoy', category: 'Skin Cleansing', tp: 48, mrp: 55 },
  ]
  if (!query.trim()) return master
  const q = query.toLowerCase()
  return master.filter(
    b =>
      b.name.toLowerCase().includes(q) ||
      (b.brand && b.brand.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q))
  )
}
