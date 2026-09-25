import { demoMode, supabase } from './supabase'

export type DhStore = {
  id: string
  store_code: string
  display_name: string
  location_id: string | null
  is_dc: boolean
  active: boolean
}

export type DhItem = {
  id: string
  dh_sku: string
  dh_name: string
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
  } | null
  sold_qty_30d?: number
  gfv_30d?: number
  total_stock?: number
}

export type DhSummaryStats = {
  total_skus: number
  matched_skus: number
  unmatched_skus: number
  ignored_skus: number
  total_sold_30d: number
  total_gfv_30d: number
  total_stock: number
  dc_stock: number
  branch_stock: number
  active_stores: number
  is_schema_installed: boolean
}

export type DhSalesTrendPoint = {
  date: string
  sold_qty: number
  gfv_local: number
}

export type DhStockMatrixRow = {
  dh_item_id: string
  dh_sku: string
  dh_name: string
  basepack_name: string
  match_status: string
  total_qty: number
  dc_qty: number
  branch_qty: number
  store_qtys: Record<string, number>
}

// -------------------------------------------------------------
// Database Queries
// -------------------------------------------------------------

export async function checkDhSchemaInstalled(): Promise<boolean> {
  if (demoMode || !supabase) return false
  try {
    const { error } = await supabase.from('dh_stores').select('id', { head: true, count: 'exact' })
    if (error && error.code === 'PGRST205') return false // Table not found
    return !error
  } catch {
    return false
  }
}

export async function listDhStores(): Promise<DhStore[]> {
  if (demoMode || !supabase) return getDemoStores()
  const { data, error } = await supabase
    .from('dh_stores')
    .select('id,store_code,display_name,location_id,is_dc,active')
    .order('is_dc', { ascending: false })
    .order('display_name', { ascending: true })

  if (error) {
    if (error.code === 'PGRST205') return getDemoStores()
    throw error
  }
  return data || []
}

export async function getDhSummaryStats(): Promise<DhSummaryStats> {
  const isInstalled = await checkDhSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoSummaryStats(isInstalled)
  }

  try {
    // 1. Catalog counts
    const { data: items, error: itemsErr } = await supabase
      .from('dh_items')
      .select('id,match_status')

    if (itemsErr) throw itemsErr

    const total_skus = (items || []).length
    let matched_skus = 0
    let unmatched_skus = 0
    let ignored_skus = 0

    for (const it of items || []) {
      if (it.match_status === 'matched') matched_skus++
      else if (it.match_status === 'ignored') ignored_skus++
      else unmatched_skus++
    }

    // 2. Sales last 30d sum
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: sales, error: salesErr } = await supabase
      .from('dh_sales_daily')
      .select('sold_qty,gfv_local')
      .gte('sale_date', thirtyDaysAgo)

    if (salesErr) throw salesErr

    let total_sold_30d = 0
    let total_gfv_30d = 0
    for (const s of sales || []) {
      total_sold_30d += s.sold_qty || 0
      total_gfv_30d += Number(s.gfv_local || 0)
    }

    // 3. Stock sum latest
    const { data: latestStockDateRow } = await supabase
      .from('dh_stock_daily')
      .select('stock_date')
      .order('stock_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let total_stock = 0
    let dc_stock = 0
    let branch_stock = 0

    if (latestStockDateRow?.stock_date) {
      const { data: stockRows } = await supabase
        .from('dh_stock_daily')
        .select('qty,dh_store_id,dh_stores(is_dc)')
        .eq('stock_date', latestStockDateRow.stock_date)

      for (const st of stockRows || []) {
        const q = st.qty || 0
        total_stock += q
        const isDc = (st.dh_stores as any)?.is_dc
        if (isDc) dc_stock += q
        else branch_stock += q
      }
    }

    // 4. Stores count
    const { count: active_stores } = await supabase
      .from('dh_stores')
      .select('id', { head: true, count: 'exact' })

    return {
      total_skus,
      matched_skus,
      unmatched_skus,
      ignored_skus,
      total_sold_30d,
      total_gfv_30d,
      total_stock,
      dc_stock,
      branch_stock,
      active_stores: active_stores || 17,
      is_schema_installed: true,
    }
  } catch (err) {
    console.warn('Failed to load live DH stats, falling back to preview:', err)
    return getDemoSummaryStats(false)
  }
}

export async function getDhSalesTrend(filter?: { dhItemId?: string; days?: number }): Promise<DhSalesTrendPoint[]> {
  const isInstalled = await checkDhSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoSalesTrend()
  }

  const days = filter?.days || 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let query = supabase
    .from('dh_sales_daily')
    .select('sale_date,sold_qty,gfv_local')
    .gte('sale_date', startDate)
    .order('sale_date', { ascending: true })

  if (filter?.dhItemId) {
    query = query.eq('dh_item_id', filter.dhItemId)
  }

  const { data, error } = await query
  if (error) {
    console.warn('Sales trend error:', error)
    return getDemoSalesTrend()
  }

  const grouped = new Map<string, { date: string; sold_qty: number; gfv_local: number }>()
  for (const r of data || []) {
    const cur = grouped.get(r.sale_date) || { date: r.sale_date, sold_qty: 0, gfv_local: 0 }
    cur.sold_qty += r.sold_qty || 0
    cur.gfv_local += Number(r.gfv_local || 0)
    grouped.set(r.sale_date, cur)
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function listDhCatalog(filter?: {
  status?: string
  search?: string
  limit?: number
}): Promise<DhItem[]> {
  const isInstalled = await checkDhSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoCatalog(filter?.status, filter?.search)
  }

  let query = supabase
    .from('dh_items')
    .select(`
      id,
      dh_sku,
      dh_name,
      basepack_id,
      match_status,
      matched_at,
      created_at,
      basepacks(id,name,brand,category)
    `)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('match_status', filter.status)
  }

  if (filter?.limit) {
    query = query.limit(filter.limit)
  }

  const { data, error } = await query
  if (error) {
    console.warn('Catalog query error:', error)
    return getDemoCatalog(filter?.status, filter?.search)
  }

  let items: DhItem[] = (data || []).map((r: any) => ({
    id: r.id,
    dh_sku: r.dh_sku,
    dh_name: r.dh_name,
    basepack_id: r.basepack_id,
    match_status: r.match_status,
    matched_at: r.matched_at,
    created_at: r.created_at,
    basepacks: r.basepacks,
  }))

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim()
    items = items.filter(
      it =>
        it.dh_sku.toLowerCase().includes(q) ||
        it.dh_name.toLowerCase().includes(q) ||
        it.basepacks?.name.toLowerCase().includes(q) ||
        it.basepacks?.brand?.toLowerCase().includes(q)
    )
  }

  return items
}

export async function listUnmatchedItems(): Promise<DhItem[]> {
  const isInstalled = await checkDhSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoCatalog('unmatched')
  }

  // Use view v_dh_unmatched_items if available, fallback to dh_items
  try {
    const { data, error } = await supabase
      .from('v_dh_unmatched_items')
      .select('dh_item_id,dh_sku,dh_name,sold_qty_30d,gfv_30d')
      .order('sold_qty_30d', { ascending: false })

    if (!error && data) {
      return data.map((r: any) => ({
        id: r.dh_item_id,
        dh_sku: r.dh_sku,
        dh_name: r.dh_name,
        basepack_id: null,
        match_status: 'unmatched',
        matched_at: null,
        sold_qty_30d: r.sold_qty_30d,
        gfv_30d: r.gfv_30d,
      }))
    }
  } catch {}

  return listDhCatalog({ status: 'unmatched' })
}

export async function tagDhItem(
  dhItemId: string,
  basepackId: string | null,
  matchStatus: 'matched' | 'unmatched' | 'ignored'
): Promise<void> {
  if (demoMode || !supabase) {
    console.log('Demo mode: tagged item', dhItemId, basepackId, matchStatus)
    return
  }

  const { error } = await supabase
    .from('dh_items')
    .update({
      basepack_id: basepackId,
      match_status: matchStatus,
      matched_at: matchStatus === 'matched' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dhItemId)

  if (error) throw error
}

export async function searchBasepacks(searchTerm: string): Promise<Array<{ id: string; name: string; brand: string | null; category: string | null }>> {
  if (demoMode || !supabase) {
    return getDemoBasepacks(searchTerm)
  }

  let query = supabase
    .from('basepacks')
    .select('id,name,brand,category')
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(25)

  if (searchTerm.trim()) {
    query = query.ilike('name', `%${searchTerm.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getDhStockMatrix(): Promise<{
  stores: DhStore[]
  rows: DhStockMatrixRow[]
}> {
  const isInstalled = await checkDhSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoStockMatrix()
  }

  const stores = await listDhStores()
  const storeMap = new Map<string, DhStore>(stores.map(s => [s.id, s]))

  const { data: latestDateRow } = await supabase
    .from('dh_stock_daily')
    .select('stock_date')
    .order('stock_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestDateRow?.stock_date) {
    return { stores, rows: [] }
  }

  const { data: stockRecords, error } = await supabase
    .from('dh_stock_daily')
    .select(`
      dh_item_id,
      dh_store_id,
      qty,
      dh_items(dh_sku,dh_name,match_status,basepacks(name))
    `)
    .eq('stock_date', latestDateRow.stock_date)

  if (error) {
    console.warn('Stock matrix query error:', error)
    return getDemoStockMatrix()
  }

  const rowMap = new Map<string, DhStockMatrixRow>()

  for (const r of stockRecords || []) {
    const item = r.dh_items as any
    const store = storeMap.get(r.dh_store_id)
    if (!item || !store) continue

    const itemId = r.dh_item_id
    if (!rowMap.has(itemId)) {
      rowMap.set(itemId, {
        dh_item_id: itemId,
        dh_sku: item.dh_sku || '',
        dh_name: item.dh_name || '',
        basepack_name: item.basepacks?.name || 'Unmatched',
        match_status: item.match_status || 'unmatched',
        total_qty: 0,
        dc_qty: 0,
        branch_qty: 0,
        store_qtys: {},
      })
    }

    const row = rowMap.get(itemId)!
    const q = r.qty || 0
    row.total_qty += q
    row.store_qtys[store.store_code] = q

    if (store.is_dc) {
      row.dc_qty += q
    } else {
      row.branch_qty += q
    }
  }

  return {
    stores,
    rows: Array.from(rowMap.values()).sort((a, b) => b.total_qty - a.total_qty),
  }
}

// -------------------------------------------------------------
// Realistic Preview Fallbacks (Pre-populated from DH_file_base)
// -------------------------------------------------------------

function getDemoStores(): DhStore[] {
  return [
    { id: '1', store_code: 'DC', display_name: 'Distribution Center', location_id: null, is_dc: true, active: true },
    { id: '2', store_code: 'Gulshan_1', display_name: 'Gulshan-Banani', location_id: 'loc1', is_dc: false, active: true },
    { id: '3', store_code: 'Gulshan_2', display_name: 'Gulshan-Niketon', location_id: 'loc2', is_dc: false, active: true },
    { id: '4', store_code: 'Dhanmondi', display_name: 'Dhanmondi', location_id: 'loc3', is_dc: false, active: true },
    { id: '5', store_code: 'Uttara', display_name: 'Uttara', location_id: 'loc4', is_dc: false, active: true },
    { id: '6', store_code: 'Bashundhara', display_name: 'Bashundhara', location_id: 'loc5', is_dc: false, active: true },
    { id: '7', store_code: 'Mohammadpur', display_name: 'Mohammadpur', location_id: 'loc6', is_dc: false, active: true },
    { id: '8', store_code: 'Mirpur_02', display_name: 'Mirpur 02', location_id: 'loc7', is_dc: false, active: true },
    { id: '9', store_code: 'Mirpur_03', display_name: 'Mirpur 03', location_id: 'loc8', is_dc: false, active: true },
    { id: '10', store_code: 'Mogbazar', display_name: 'Mogbazar', location_id: 'loc9', is_dc: false, active: true },
    { id: '11', store_code: 'Rampura', display_name: 'Rampura', location_id: 'loc10', is_dc: false, active: true },
    { id: '12', store_code: 'Wari', display_name: 'Wari', location_id: 'loc11', is_dc: false, active: true },
    { id: '13', store_code: 'Chittagong_1', display_name: 'Chittagong', location_id: null, is_dc: false, active: true },
    { id: '14', store_code: 'Sylhet_2', display_name: 'Sylhet', location_id: null, is_dc: false, active: true },
    { id: '15', store_code: 'Khulna', display_name: 'Khulna', location_id: null, is_dc: false, active: true },
    { id: '16', store_code: 'Rajshahi', display_name: 'Rajshahi', location_id: null, is_dc: false, active: true },
    { id: '17', store_code: 'Lalbagh', display_name: 'Lalbagh', location_id: null, is_dc: false, active: true },
  ]
}

function getDemoSummaryStats(isSchemaInstalled: boolean): DhSummaryStats {
  return {
    total_skus: 280,
    matched_skus: 218,
    unmatched_skus: 58,
    ignored_skus: 4,
    total_sold_30d: 48920,
    total_gfv_30d: 5912400,
    total_stock: 74210,
    dc_stock: 46200,
    branch_stock: 28010,
    active_stores: 17,
    is_schema_installed: isSchemaInstalled,
  }
}

function getDemoSalesTrend(): DhSalesTrendPoint[] {
  const points: DhSalesTrendPoint[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const baseSold = 1400 + Math.sin(i / 3) * 350 + (i % 7 === 0 ? 500 : 0)
    const gfv = Math.round(baseSold * 125)
    points.push({
      date: dateStr,
      sold_qty: Math.round(baseSold),
      gfv_local: gfv,
    })
  }
  return points
}

function getDemoCatalog(status?: string, search?: string): DhItem[] {
  const sampleItems: DhItem[] = [
    {
      id: 'demo-1',
      dh_sku: '01H1Q5',
      dh_name: 'Dove Conditioner Intense Repair 170ml',
      basepack_id: 'bp-1',
      match_status: 'matched',
      matched_at: '2026-09-24T10:00:00Z',
      basepacks: { id: 'bp-1', name: 'DOVE HAIR RINSE OUT CONDTNR IRP LC 170ML', brand: 'Dove', category: 'Hair Care' },
      sold_qty_30d: 345,
      gfv_30d: 86250,
      total_stock: 358,
    },
    {
      id: 'demo-2',
      dh_sku: '06Y8MD',
      dh_name: 'Ponds Super Light Gel Moisturiser 50ml',
      basepack_id: 'bp-2',
      match_status: 'matched',
      matched_at: '2026-09-24T10:00:00Z',
      basepacks: { id: 'bp-2', name: 'PONDS FMCR OIL CNT SUPR LGT GEL LC 50ML', brand: "Pond's", category: 'Skin Care' },
      sold_qty_30d: 512,
      gfv_30d: 153600,
      total_stock: 133,
    },
    {
      id: 'demo-3',
      dh_sku: '07GLAG',
      dh_name: 'Lux Body Wash Freesia Scent & Aloe Vera 245ml',
      basepack_id: 'bp-3',
      match_status: 'matched',
      matched_at: '2026-09-24T10:00:00Z',
      basepacks: { id: 'bp-3', name: 'LUX SHW BW FREEASIA SCNT&ALOE VERA 245ML', brand: 'Lux', category: 'Skin Cleansing' },
      sold_qty_30d: 182,
      gfv_30d: 54600,
      total_stock: 1823,
    },
    {
      id: 'demo-4',
      dh_sku: '005NTS',
      dh_name: 'Horlicks Health & Nutrition Drink Classic Malt 500g Bib',
      basepack_id: null,
      match_status: 'unmatched',
      matched_at: null,
      basepacks: null,
      sold_qty_30d: 890,
      gfv_30d: 311500,
      total_stock: 12,
    },
    {
      id: 'demo-5',
      dh_sku: '0CX4T8',
      dh_name: 'Pepsodent Toothpaste Sensitive Expert Professional 70g',
      basepack_id: 'bp-5',
      match_status: 'matched',
      matched_at: '2026-09-24T10:00:00Z',
      basepacks: { id: 'bp-5', name: 'PEPSODENT TP ADV SNSTV EXPRT PRFSSNL 80G', brand: 'Pepsodent', category: 'Oral Care' },
      sold_qty_30d: 260,
      gfv_30d: 46800,
      total_stock: 137,
    },
    {
      id: 'demo-6',
      dh_sku: '0LR6AD',
      dh_name: 'Dove Shampoo Intense Repair 450ml',
      basepack_id: 'bp-6',
      match_status: 'matched',
      matched_at: '2026-09-24T10:00:00Z',
      basepacks: { id: 'bp-6', name: 'DOVE SHAMPOO IRP 480ML', brand: 'Dove', category: 'Hair Care' },
      sold_qty_30d: 610,
      gfv_30d: 274500,
      total_stock: 420,
    },
    {
      id: 'demo-7',
      dh_sku: 'A64ZN4',
      dh_name: 'Lifebuoy Handwash Total 10 Refill 170ml',
      basepack_id: null,
      match_status: 'unmatched',
      matched_at: null,
      basepacks: null,
      sold_qty_30d: 430,
      gfv_30d: 32250,
      total_stock: 95,
    },
    {
      id: 'demo-8',
      dh_sku: 'TEST_99',
      dh_name: 'Non Unilever Vendor Trial Item',
      basepack_id: null,
      match_status: 'ignored',
      matched_at: null,
      basepacks: null,
      sold_qty_30d: 0,
      gfv_30d: 0,
      total_stock: 0,
    },
  ]

  let res = sampleItems
  if (status && status !== 'all') {
    res = res.filter(x => x.match_status === status)
  }
  if (search) {
    const q = search.toLowerCase()
    res = res.filter(x => x.dh_sku.toLowerCase().includes(q) || x.dh_name.toLowerCase().includes(q))
  }
  return res
}

function getDemoStockMatrix(): { stores: DhStore[]; rows: DhStockMatrixRow[] } {
  const stores = getDemoStores()
  const rows: DhStockMatrixRow[] = [
    {
      dh_item_id: 'demo-3',
      dh_sku: '07GLAG',
      dh_name: 'Lux Body Wash Freesia Scent 245ml',
      basepack_name: 'LUX SHW BW FREEASIA SCNT&ALOE VERA 245ML',
      match_status: 'matched',
      total_qty: 1823,
      dc_qty: 1800,
      branch_qty: 23,
      store_qtys: { DC: 1800, Gulshan_1: 4, Gulshan_2: 3, Dhanmondi: 5, Uttara: 6, Lalbagh: 5 },
    },
    {
      dh_item_id: 'demo-1',
      dh_sku: '01H1Q5',
      dh_name: 'Dove Conditioner Intense Repair 170ml',
      basepack_name: 'DOVE HAIR RINSE OUT CONDTNR IRP LC 170ML',
      match_status: 'matched',
      total_qty: 358,
      dc_qty: 336,
      branch_qty: 22,
      store_qtys: { DC: 336, Gulshan_1: 4, Dhanmondi: 6, Uttara: 5, Lalbagh: 7 },
    },
    {
      dh_item_id: 'demo-6',
      dh_sku: '0LR6AD',
      dh_name: 'Dove Shampoo Intense Repair 450ml',
      basepack_name: 'DOVE SHAMPOO IRP 480ML',
      match_status: 'matched',
      total_qty: 420,
      dc_qty: 380,
      branch_qty: 40,
      store_qtys: { DC: 380, Gulshan_1: 8, Dhanmondi: 12, Uttara: 10, Mirpur_02: 10 },
    },
    {
      dh_item_id: 'demo-2',
      dh_sku: '06Y8MD',
      dh_name: 'Ponds Super Light Gel Moisturiser 50ml',
      basepack_name: 'PONDS FMCR OIL CNT SUPR LGT GEL LC 50ML',
      match_status: 'matched',
      total_qty: 133,
      dc_qty: 125,
      branch_qty: 8,
      store_qtys: { DC: 125, Gulshan_1: 2, Dhanmondi: 2, Uttara: 2, Lalbagh: 2 },
    },
  ]
  return { stores, rows }
}

function getDemoBasepacks(search: string) {
  const all = [
    { id: 'bp-1', name: 'DOVE HAIR RINSE OUT CONDTNR IRP LC 170ML', brand: 'Dove', category: 'Hair Care' },
    { id: 'bp-2', name: 'PONDS FMCR OIL CNT SUPR LGT GEL LC 50ML', brand: "Pond's", category: 'Skin Care' },
    { id: 'bp-3', name: 'LUX SHW BW FREEASIA SCNT&ALOE VERA 245ML', brand: 'Lux', category: 'Skin Cleansing' },
    { id: 'bp-4', name: 'HORLICKS HEALTH & NUTRITION DRINK MALT 500G BIB', brand: 'Horlicks', category: 'Nutrition' },
    { id: 'bp-5', name: 'PEPSODENT TP ADV SNSTV EXPRT PRFSSNL 80G', brand: 'Pepsodent', category: 'Oral Care' },
    { id: 'bp-6', name: 'DOVE SHAMPOO IRP 480ML', brand: 'Dove', category: 'Hair Care' },
    { id: 'bp-7', name: 'LIFEBUOY HW TOTAL 10 REFILL 170ML', brand: 'Lifebuoy', category: 'Skin Cleansing' },
  ]
  if (!search) return all
  const q = search.toLowerCase()
  return all.filter(b => b.name.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q))
}
