import { demoMode, supabase } from './supabase'

export type CheckerProduct = {
  id: string
  account_id: string
  account_code: string
  account_name: string
  location_id: string | null
  location_name: string | null
  basepack_id: string
  basepack_name: string
  brand: string | null
  category: string | null
  format: string | null
  business_unit: string | null
  account_sku: string
  product_name: string
  available: boolean // true = in stock / available, false = out of stock / unlisted
  price: number | null
  original_price: number | null
  status: string | null
  product_url: string | null
  observed_at: string
  observed_date: string
}

export type AccountBasepackStatus = {
  account_id: string
  account_code: string
  account_name: string
  location_id: string | null
  location_name: string | null
  label: string
  available: boolean
  sku_expected: number
  sku_observed: number
  sku_available: number
  reason: string | null
  products: CheckerProduct[]
}

export type CheckerBasepack = {
  id: string
  name: string
  brand: string | null
  category: string | null
  format: string | null
  business_unit: string | null
  overall_status: 'available' | 'unavailable' | 'mixed'
  accounts_count: number
  available_accounts_count: number
  products_count: number
  available_products_count: number
  unavailable_products_count: number
  accounts: AccountBasepackStatus[]
}

export type CheckerKPIs = {
  total_basepacks: number
  available_basepacks: number
  unavailable_basepacks: number
  mixed_basepacks: number
  basepack_ola_pct: number
  total_products: number
  available_products: number
  unavailable_products: number
  product_ola_pct: number
}

export type CheckerAccountOption = {
  id: string
  code: string
  name: string
}

export type CheckerLocationOption = {
  id: string
  account_id: string
  name: string
  code: string
}

export type CheckerDataResult = {
  date: string
  available_dates: string[]
  kpis: CheckerKPIs
  basepacks: CheckerBasepack[]
  products: CheckerProduct[]
  accounts: CheckerAccountOption[]
  locations: CheckerLocationOption[]
  brands: string[]
  categories: string[]
}

function relationItem(rel: any): any {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] : rel
}

// Fallback demo data when running in demoMode or offline
const DEMO_ACCOUNTS: CheckerAccountOption[] = [
  { id: 'acc-1', code: 'shajgoj', name: 'Shajgoj' },
  { id: 'acc-2', code: 'arogga', name: 'Arogga' },
  { id: 'acc-3', code: 'pandamart', name: 'Pandamart' },
  { id: 'acc-4', code: 'daraz', name: 'dMart / Daraz' },
  { id: 'acc-5', code: 'othoba', name: 'Othoba' },
  { id: 'acc-6', code: 'shwapno', name: 'Shwapno' },
  { id: 'acc-7', code: 'foodi', name: 'Foodi' },
]

const DEMO_LOCATIONS: CheckerLocationOption[] = [
  { id: 'loc-1', account_id: 'acc-3', code: 'gulshan', name: 'Gulshan' },
  { id: 'loc-2', account_id: 'acc-3', code: 'dhanmondi', name: 'Dhanmondi' },
  { id: 'loc-3', account_id: 'acc-3', code: 'uttara', name: 'Uttara' },
]

function generateDemoData(date: string): CheckerDataResult {
  const sampleProducts: CheckerProduct[] = [
    {
      id: 'p-1',
      account_id: 'acc-1',
      account_code: 'shajgoj',
      account_name: 'Shajgoj',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-1',
      basepack_name: 'SUNSILK SHAMPOO THICK & LONG 375ML',
      brand: 'SUNSILK',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      account_sku: '38192',
      product_name: 'Sunsilk Thick & Long Shampoo 375ml',
      available: true,
      price: 430,
      original_price: 450,
      status: 'In Stock',
      product_url: 'https://shop.shajgoj.com/product/sunsilk-thick-long-375ml',
      observed_at: `${date}T10:00:00Z`,
      observed_date: date,
    },
    {
      id: 'p-2',
      account_id: 'acc-2',
      account_code: 'arogga',
      account_name: 'Arogga',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-1',
      basepack_name: 'SUNSILK SHAMPOO THICK & LONG 375ML',
      brand: 'SUNSILK',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      account_sku: '42290',
      product_name: 'Sunsilk Shampoo Thick & Long 375ml',
      available: true,
      price: 418,
      original_price: null,
      status: 'In Stock',
      product_url: 'https://www.arogga.com/product/42290',
      observed_at: `${date}T10:15:00Z`,
      observed_date: date,
    },
    {
      id: 'p-3',
      account_id: 'acc-3',
      account_code: 'pandamart',
      account_name: 'Pandamart',
      location_id: 'loc-1',
      location_name: 'Gulshan',
      basepack_id: 'bp-1',
      basepack_name: 'SUNSILK SHAMPOO THICK & LONG 375ML',
      brand: 'SUNSILK',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      account_sku: 'PM-9921',
      product_name: 'Sunsilk Thick & Long 375ml',
      available: false,
      price: 430,
      original_price: null,
      status: 'Out of Stock',
      product_url: null,
      observed_at: `${date}T09:30:00Z`,
      observed_date: date,
    },
    {
      id: 'p-4',
      account_id: 'acc-1',
      account_code: 'shajgoj',
      account_name: 'Shajgoj',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-2',
      basepack_name: 'SURF EXCEL MATC STD LQD TOP LOAD 500ML',
      brand: 'SURF EXCEL',
      category: 'FABRIC CLEANING',
      format: 'Liquid Detergent',
      business_unit: 'HOME CARE',
      account_sku: '92829',
      product_name: 'Surf Excel Liquid 500ml & Surf Excel White Powder 450g Combo',
      available: false,
      price: 315,
      original_price: null,
      status: 'Out of Stock',
      product_url: 'https://shop.shajgoj.com/product/surf-excel-combo',
      observed_at: `${date}T10:00:00Z`,
      observed_date: date,
    },
    {
      id: 'p-5',
      account_id: 'acc-2',
      account_code: 'arogga',
      account_name: 'Arogga',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-2',
      basepack_name: 'SURF EXCEL MATC STD LQD TOP LOAD 500ML',
      brand: 'SURF EXCEL',
      category: 'FABRIC CLEANING',
      format: 'Liquid Detergent',
      business_unit: 'HOME CARE',
      account_sku: '69558',
      product_name: 'Surf Excel Matic Liquid Detergent Top Load 500ml',
      available: true,
      price: 147,
      original_price: 165,
      status: 'In Stock',
      product_url: 'https://www.arogga.com/product/69558',
      observed_at: `${date}T10:15:00Z`,
      observed_date: date,
    },
    {
      id: 'p-6',
      account_id: 'acc-1',
      account_code: 'shajgoj',
      account_name: 'Shajgoj',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-3',
      basepack_name: 'CLEAR MALE SHAMPOO CSM 450ML',
      brand: 'CLEAR',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      account_sku: '23239',
      product_name: 'Clear Men Shampoo Cool Sport Menthol Anti Dandruff 450ml',
      available: false,
      price: 600,
      original_price: null,
      status: 'Out of Stock',
      product_url: 'https://shop.shajgoj.com/product/clear-men-csm',
      observed_at: `${date}T10:00:00Z`,
      observed_date: date,
    },
    {
      id: 'p-7',
      account_id: 'acc-2',
      account_code: 'arogga',
      account_name: 'Arogga',
      location_id: null,
      location_name: null,
      basepack_id: 'bp-3',
      basepack_name: 'CLEAR MALE SHAMPOO CSM 450ML',
      brand: 'CLEAR',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      account_sku: '44820',
      product_name: 'Clear Men Cool Sport Menthol 450ml',
      available: false,
      price: 585,
      original_price: 600,
      status: 'Out of Stock',
      product_url: 'https://www.arogga.com/product/44820',
      observed_at: `${date}T10:15:00Z`,
      observed_date: date,
    },
  ]

  const basepacks: CheckerBasepack[] = [
    {
      id: 'bp-1',
      name: 'SUNSILK SHAMPOO THICK & LONG 375ML',
      brand: 'SUNSILK',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      overall_status: 'mixed',
      accounts_count: 3,
      available_accounts_count: 2,
      products_count: 3,
      available_products_count: 2,
      unavailable_products_count: 1,
      accounts: [
        {
          account_id: 'acc-1',
          account_code: 'shajgoj',
          account_name: 'Shajgoj',
          location_id: null,
          location_name: null,
          label: 'Shajgoj',
          available: true,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 1,
          reason: 'available',
          products: [sampleProducts[0]],
        },
        {
          account_id: 'acc-2',
          account_code: 'arogga',
          account_name: 'Arogga',
          location_id: null,
          location_name: null,
          label: 'Arogga',
          available: true,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 1,
          reason: 'available',
          products: [sampleProducts[1]],
        },
        {
          account_id: 'acc-3',
          account_code: 'pandamart',
          account_name: 'Pandamart',
          location_id: 'loc-1',
          location_name: 'Gulshan',
          label: 'Pandamart · Gulshan',
          available: false,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 0,
          reason: 'all_observed_skus_unavailable',
          products: [sampleProducts[2]],
        },
      ],
    },
    {
      id: 'bp-2',
      name: 'SURF EXCEL MATC STD LQD TOP LOAD 500ML',
      brand: 'SURF EXCEL',
      category: 'FABRIC CLEANING',
      format: 'Liquid Detergent',
      business_unit: 'HOME CARE',
      overall_status: 'mixed',
      accounts_count: 2,
      available_accounts_count: 1,
      products_count: 2,
      available_products_count: 1,
      unavailable_products_count: 1,
      accounts: [
        {
          account_id: 'acc-1',
          account_code: 'shajgoj',
          account_name: 'Shajgoj',
          location_id: null,
          location_name: null,
          label: 'Shajgoj',
          available: false,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 0,
          reason: 'all_observed_skus_unavailable',
          products: [sampleProducts[3]],
        },
        {
          account_id: 'acc-2',
          account_code: 'arogga',
          account_name: 'Arogga',
          location_id: null,
          location_name: null,
          label: 'Arogga',
          available: true,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 1,
          reason: 'available',
          products: [sampleProducts[4]],
        },
      ],
    },
    {
      id: 'bp-3',
      name: 'CLEAR MALE SHAMPOO CSM 450ML',
      brand: 'CLEAR',
      category: 'HAIR CARE',
      format: 'Shampoo',
      business_unit: 'BEAUTY & WELLBEING',
      overall_status: 'unavailable',
      accounts_count: 2,
      available_accounts_count: 0,
      products_count: 2,
      available_products_count: 0,
      unavailable_products_count: 2,
      accounts: [
        {
          account_id: 'acc-1',
          account_code: 'shajgoj',
          account_name: 'Shajgoj',
          location_id: null,
          location_name: null,
          label: 'Shajgoj',
          available: false,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 0,
          reason: 'all_observed_skus_unavailable',
          products: [sampleProducts[5]],
        },
        {
          account_id: 'acc-2',
          account_code: 'arogga',
          account_name: 'Arogga',
          location_id: null,
          location_name: null,
          label: 'Arogga',
          available: false,
          sku_expected: 1,
          sku_observed: 1,
          sku_available: 0,
          reason: 'all_observed_skus_unavailable',
          products: [sampleProducts[6]],
        },
      ],
    },
  ]

  const totalBasepacks = basepacks.length
  const availableBasepacks = basepacks.filter((b) => b.overall_status === 'available').length
  const mixedBasepacks = basepacks.filter((b) => b.overall_status === 'mixed').length
  const unavailableBasepacks = basepacks.filter((b) => b.overall_status === 'unavailable').length

  const totalProducts = sampleProducts.length
  const availableProducts = sampleProducts.filter((p) => p.available).length
  const unavailableProducts = sampleProducts.filter((p) => !p.available).length

  return {
    date,
    available_dates: [date, '2026-09-22', '2026-09-21'],
    kpis: {
      total_basepacks: totalBasepacks,
      available_basepacks: availableBasepacks + mixedBasepacks,
      unavailable_basepacks: unavailableBasepacks,
      mixed_basepacks: mixedBasepacks,
      basepack_ola_pct: Math.round(((availableBasepacks + mixedBasepacks) / totalBasepacks) * 100),
      total_products: totalProducts,
      available_products: availableProducts,
      unavailable_products: unavailableProducts,
      product_ola_pct: Math.round((availableProducts / totalProducts) * 100),
    },
    basepacks,
    products: sampleProducts,
    accounts: DEMO_ACCOUNTS,
    locations: DEMO_LOCATIONS,
    brands: ['SUNSILK', 'SURF EXCEL', 'CLEAR'],
    categories: ['HAIR CARE', 'FABRIC CLEANING'],
  }
}

/**
 * Fetch distinct dates available in availability_snapshots or v_ola_dates
 */
export async function getCheckerDates(): Promise<string[]> {
  if (demoMode || !supabase) return ['2026-09-23', '2026-09-22', '2026-09-21']
  try {
    const { data: vDates, error: vErr } = await supabase.from('v_ola_dates').select('snapshot_date').limit(30)
    if (!vErr && vDates && vDates.length > 0) {
      return vDates.map((r: any) => String(r.snapshot_date))
    }
  } catch {}

  const { data, error } = await supabase
    .from('availability_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(50)
  if (error) {
    console.error('Error fetching dates:', error)
    return ['2026-09-23']
  }
  const uniqueDates = Array.from(new Set((data || []).map((r: any) => String(r.snapshot_date))))
  return uniqueDates.length ? uniqueDates : ['2026-09-23']
}

/**
 * Fetch accounts and locations
 */
export async function getCheckerAccountsAndLocations(): Promise<{
  accounts: CheckerAccountOption[]
  locations: CheckerLocationOption[]
}> {
  if (demoMode || !supabase) return { accounts: DEMO_ACCOUNTS, locations: DEMO_LOCATIONS }

  const [accRes, locRes] = await Promise.all([
    supabase.from('accounts').select('id, code, name').eq('active', true).order('name', { ascending: true }),
    supabase.from('locations').select('id, account_id, code, name').eq('active', true).order('name', { ascending: true }),
  ])

  return {
    accounts: (accRes.data || []) as CheckerAccountOption[],
    locations: (locRes.data || []) as CheckerLocationOption[],
  }
}

/**
 * Main query for the checker panel: loads basepack snapshots & product observations
 * and formats them for high-speed client-side filtering.
 */
export async function getCheckerData(selectedDate?: string): Promise<CheckerDataResult> {
  const dates = await getCheckerDates()
  const targetDate = selectedDate || dates[0] || '2026-09-23'

  if (demoMode || !supabase) {
    return generateDemoData(targetDate)
  }

  try {
    const [accData] = await Promise.all([getCheckerAccountsAndLocations()])

    // 1. Fetch all snapshots for targetDate with pagination
    const snaps: any[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('availability_snapshots')
        .select(`
          account_id,
          location_id,
          basepack_id,
          available,
          sku_expected,
          sku_observed,
          sku_available,
          reason,
          accounts(id, code, name),
          locations(id, code, name),
          basepacks(id, name, brand, category, format, business_unit, active)
        `)
        .eq('snapshot_date', targetDate)
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (!data || data.length === 0) break
      snaps.push(...data)
      if (data.length < pageSize) break
    }

    // 2. Fetch all product observations for targetDate with pagination
    const obs: any[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('product_observations')
        .select(`
          id,
          account_id,
          location_id,
          basepack_id,
          account_sku,
          product_name,
          in_stock,
          price,
          original_price,
          status,
          product_url,
          observed_at,
          observed_date,
          accounts(id, code, name),
          locations(id, code, name),
          basepacks(id, name, brand, category, format, business_unit, active)
        `)
        .eq('observed_date', targetDate)
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (!data || data.length === 0) break
      obs.push(...data)
      if (data.length < pageSize) break
    }

    // Transform product observations to CheckerProduct[]
    const products: CheckerProduct[] = obs.map((o) => {
      const acc = relationItem(o.accounts)
      const loc = relationItem(o.locations)
      const bp = relationItem(o.basepacks)

      return {
        id: o.id,
        account_id: o.account_id,
        account_code: acc?.code || 'unknown',
        account_name: acc?.name || 'Unknown Account',
        location_id: o.location_id,
        location_name: loc?.name || null,
        basepack_id: o.basepack_id,
        basepack_name: bp?.name || 'Unknown Basepack',
        brand: bp?.brand || null,
        category: bp?.category || null,
        format: bp?.format || null,
        business_unit: bp?.business_unit || null,
        account_sku: o.account_sku || '—',
        product_name: o.product_name || bp?.name || 'Unnamed Product',
        available: Boolean(o.in_stock),
        price: o.price !== null && o.price !== undefined ? Number(o.price) : null,
        original_price: o.original_price !== null && o.original_price !== undefined ? Number(o.original_price) : null,
        status: o.status || (o.in_stock ? 'In Stock' : 'Out of Stock'),
        product_url: o.product_url || null,
        observed_at: o.observed_at,
        observed_date: o.observed_date,
      }
    })

    // Index observations by `basepack_id + account_id + location_id`
    const obsMap = new Map<string, CheckerProduct[]>()
    for (const p of products) {
      const key = `${p.basepack_id}:::${p.account_id}:::${p.location_id || ''}`
      const list = obsMap.get(key) || []
      list.push(p)
      obsMap.set(key, list)
    }

    // Group snapshots by Basepack
    const bpMap = new Map<string, { bp: any; snaps: any[] }>()
    for (const s of snaps) {
      const bp = relationItem(s.basepacks)
      if (!bp) continue
      const existing = bpMap.get(s.basepack_id) || { bp, snaps: [] }
      existing.snaps.push(s)
      bpMap.set(s.basepack_id, existing)
    }

    const basepacks: CheckerBasepack[] = []
    const allBrands = new Set<string>()
    const allCategories = new Set<string>()

    for (const [bpId, { bp, snaps: bpSnaps }] of bpMap.entries()) {
      if (bp.brand) allBrands.add(bp.brand)
      if (bp.category) allCategories.add(bp.category)

      const accountStatuses: AccountBasepackStatus[] = bpSnaps.map((s) => {
        const acc = relationItem(s.accounts)
        const loc = relationItem(s.locations)
        const key = `${s.basepack_id}:::${s.account_id}:::${s.location_id || ''}`
        const matchedProducts = obsMap.get(key) || []

        const baseLabel = acc?.code === 'daraz' ? 'dMart / Daraz' : acc?.name || 'Unknown'
        const label = acc?.code === 'pandamart' && loc?.name ? `${baseLabel} · ${loc.name}` : baseLabel

        return {
          account_id: s.account_id,
          account_code: acc?.code || '',
          account_name: acc?.name || '',
          location_id: s.location_id || null,
          location_name: loc?.name || null,
          label,
          available: Boolean(s.available),
          sku_expected: Number(s.sku_expected || 0),
          sku_observed: Number(s.sku_observed || 0),
          sku_available: Number(s.sku_available || 0),
          reason: s.reason || null,
          products: matchedProducts,
        }
      })

      const accountsCount = accountStatuses.length
      const availableAccountsCount = accountStatuses.filter((a) => a.available).length
      const allMatchedProducts = accountStatuses.flatMap((a) => a.products)
      const availableProductsCount = allMatchedProducts.filter((p) => p.available).length
      const unavailableProductsCount = allMatchedProducts.length - availableProductsCount

      let overallStatus: 'available' | 'unavailable' | 'mixed' = 'unavailable'
      if (availableAccountsCount === accountsCount && accountsCount > 0) {
        overallStatus = 'available'
      } else if (availableAccountsCount > 0) {
        overallStatus = 'mixed'
      } else {
        overallStatus = 'unavailable'
      }

      basepacks.push({
        id: bpId,
        name: bp.name,
        brand: bp.brand || null,
        category: bp.category || null,
        format: bp.format || null,
        business_unit: bp.business_unit || null,
        overall_status: overallStatus,
        accounts_count: accountsCount,
        available_accounts_count: availableAccountsCount,
        products_count: allMatchedProducts.length,
        available_products_count: availableProductsCount,
        unavailable_products_count: unavailableProductsCount,
        accounts: accountStatuses,
      })
    }

    basepacks.sort((a, b) => a.name.localeCompare(b.name))

    const totalBasepacks = basepacks.length
    const availableBasepacks = basepacks.filter((b) => b.overall_status === 'available').length
    const mixedBasepacks = basepacks.filter((b) => b.overall_status === 'mixed').length
    const unavailableBasepacks = basepacks.filter((b) => b.overall_status === 'unavailable').length

    const totalProducts = products.length
    const availableProducts = products.filter((p) => p.available).length
    const unavailableProducts = products.filter((p) => !p.available).length

    const basepackOlaPct = totalBasepacks > 0 ? Math.round(((availableBasepacks + mixedBasepacks) / totalBasepacks) * 100) : 0
    const productOlaPct = totalProducts > 0 ? Math.round((availableProducts / totalProducts) * 100) : 0

    return {
      date: targetDate,
      available_dates: dates,
      kpis: {
        total_basepacks: totalBasepacks,
        available_basepacks: availableBasepacks + mixedBasepacks,
        unavailable_basepacks: unavailableBasepacks,
        mixed_basepacks: mixedBasepacks,
        basepack_ola_pct: basepackOlaPct,
        total_products: totalProducts,
        available_products: availableProducts,
        unavailable_products: unavailableProducts,
        product_ola_pct: productOlaPct,
      },
      basepacks,
      products,
      accounts: accData.accounts,
      locations: accData.locations,
      brands: Array.from(allBrands).sort(),
      categories: Array.from(allCategories).sort(),
    }
  } catch (err) {
    console.error('Failed to load checker data from Supabase, falling back to demo mode:', err)
    return generateDemoData(targetDate)
  }
}
