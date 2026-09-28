import { supabase as defaultClient } from './supabase'

export interface InScopeSkuInfo {
  sku: string
  basepack_id: string
  basepack_name: string
  brand: string | null
  category: string | null
  product_name: string | null
  active: boolean
  scrape_enabled: boolean
  locations: Array<{ id: string; name: string; code: string }>
}

export interface PandamartScopeSummary {
  skuMap: Map<string, InScopeSkuInfo>
  branchBasepacksMap: Map<string, Set<string>> // location_id -> Set of basepack_id
  allActiveBasepackIds: Set<string>
  basepackToSkusMap: Map<string, string[]> // basepack_id -> skus
  totalActiveSkus: number
  totalActiveBasepacks: number
  locations: Array<{ id: string; name: string; code: string }>
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
      console.warn('Pagination query error in dhScope:', res.error)
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

/**
 * Checks if migration 014 columns (last_seen_date, skip_stats, dismissed) exist on dh_items.
 */
export async function checkDhScopeSchemaInstalled(client: any = defaultClient): Promise<boolean> {
  if (!client) return false
  try {
    const { error } = await client
      .from('dh_items')
      .select('id,last_seen_date,dismissed')
      .limit(1)
    if (error && (error.code === 'PGRST204' || error.message?.includes('last_seen_date'))) {
      return false
    }
    return !error
  } catch {
    return false
  }
}

/**
 * Loads the canonical Pandamart legacy SKU list from account_products.
 * Scope = active account_products for account 'pandamart'.
 */
export async function getInScopePandamartSkus(client: any = defaultClient): Promise<PandamartScopeSummary> {
  if (!client) {
    return {
      skuMap: new Map(),
      branchBasepacksMap: new Map(),
      allActiveBasepackIds: new Set(),
      basepackToSkusMap: new Map(),
      totalActiveSkus: 0,
      totalActiveBasepacks: 0,
      locations: [],
    }
  }

  // 1. Get Pandamart account
  const { data: pandamartAcc, error: accErr } = await client
    .from('accounts')
    .select('id')
    .eq('code', 'pandamart')
    .maybeSingle()

  if (accErr || !pandamartAcc?.id) {
    console.warn('Pandamart account not found:', accErr)
    return {
      skuMap: new Map(),
      branchBasepacksMap: new Map(),
      allActiveBasepackIds: new Set(),
      basepackToSkusMap: new Map(),
      totalActiveSkus: 0,
      totalActiveBasepacks: 0,
      locations: [],
    }
  }

  // 2. Fetch all locations for Pandamart
  const { data: locationsData } = await client
    .from('locations')
    .select('id,name,code')
    .eq('account_id', pandamartAcc.id)
    .eq('active', true)
    .order('name', { ascending: true })

  const locations = locationsData || []

  // 3. Fetch all active account_products for Pandamart
  const rows = await fetchAllPages<any>((from, to) =>
    client
      .from('account_products')
      .select(`
        id,
        account_sku,
        basepack_id,
        location_id,
        product_name,
        active,
        scrape_enabled,
        basepacks(id,name,brand,category),
        locations(id,name,code)
      `)
      .eq('account_id', pandamartAcc.id)
      .eq('active', true)
      .range(from, to)
  )

  const skuMap = new Map<string, InScopeSkuInfo>()
  const branchBasepacksMap = new Map<string, Set<string>>()
  const allActiveBasepackIds = new Set<string>()
  const basepackToSkusMap = new Map<string, Set<string>>()

  for (const r of rows) {
    const rawSku = (r.account_sku || '').trim()
    if (!rawSku || !r.basepack_id) continue

    allActiveBasepackIds.add(r.basepack_id)

    // Map basepack to SKUs
    if (!basepackToSkusMap.has(r.basepack_id)) {
      basepackToSkusMap.set(r.basepack_id, new Set())
    }
    basepackToSkusMap.get(r.basepack_id)!.add(rawSku)

    // Map branch location to basepacks
    if (r.location_id) {
      if (!branchBasepacksMap.has(r.location_id)) {
        branchBasepacksMap.set(r.location_id, new Set())
      }
      branchBasepacksMap.get(r.location_id)!.add(r.basepack_id)
    }

    // Consolidated SKU record (union across branches)
    const existing = skuMap.get(rawSku)
    const locObj = r.locations ? { id: r.locations.id, name: r.locations.name, code: r.locations.code } : null

    if (!existing) {
      skuMap.set(rawSku, {
        sku: rawSku,
        basepack_id: r.basepack_id,
        basepack_name: r.basepacks?.name || 'Unknown',
        brand: r.basepacks?.brand || null,
        category: r.basepacks?.category || null,
        product_name: r.product_name || null,
        active: r.active ?? true,
        scrape_enabled: r.scrape_enabled ?? true,
        locations: locObj ? [locObj] : [],
      })
    } else {
      if (locObj && !existing.locations.some(l => l.id === locObj.id)) {
        existing.locations.push(locObj)
      }
      if (!existing.product_name && r.product_name) {
        existing.product_name = r.product_name
      }
      if (r.scrape_enabled) {
        existing.scrape_enabled = true
      }
    }
  }

  const finalBpSkusMap = new Map<string, string[]>()
  for (const [bpId, skuSet] of basepackToSkusMap.entries()) {
    finalBpSkusMap.set(bpId, Array.from(skuSet))
  }

  return {
    skuMap,
    branchBasepacksMap,
    allActiveBasepackIds,
    basepackToSkusMap: finalBpSkusMap,
    totalActiveSkus: skuMap.size,
    totalActiveBasepacks: allActiveBasepackIds.size,
    locations,
  }
}

/**
 * Re-evaluates all items in dh_items against the legacy SKU scope.
 * - Promotes on-list items to 'matched' and populates basepack_id.
 * - Demotes off-list items to 'ignored'.
 * - Resolves open flags for demoted items.
 */
export async function syncDhItemsScope(
  client: any = defaultClient,
  options?: { resolveStaleFlags?: boolean }
): Promise<{
  promoted: number
  demoted: number
  total_matched: number
  total_ignored: number
  total_items: number
}> {
  if (!client) {
    return { promoted: 0, demoted: 0, total_matched: 0, total_ignored: 0, total_items: 0 }
  }

  const scope = await getInScopePandamartSkus(client)
  const allItems = await fetchAllPages<any>((from, to) =>
    client.from('dh_items').select('id,dh_sku,dh_name,basepack_id,match_status').range(from, to)
  )

  const toPromote: any[] = []
  const toDemote: string[] = []
  const nowIso = new Date().toISOString()

  let totalMatched = 0
  let totalIgnored = 0

  for (const it of allItems) {
    const sku = (it.dh_sku || '').trim()
    const inScope = scope.skuMap.get(sku)

    if (inScope) {
      totalMatched++
      // If not currently matched or basepack_id differs, promote
      if (it.match_status !== 'matched' || it.basepack_id !== inScope.basepack_id) {
        toPromote.push({
          id: it.id,
          match_status: 'matched',
          basepack_id: inScope.basepack_id,
          matched_at: nowIso,
          updated_at: nowIso,
        })
      }
    } else {
      // Off-list
      totalIgnored++
      if (it.match_status !== 'ignored') {
        toDemote.push(it.id)
      }
    }
  }

  // Batch updates for promoted
  for (let i = 0; i < toPromote.length; i += 100) {
    const batch = toPromote.slice(i, i + 100)
    for (const item of batch) {
      await client
        .from('dh_items')
        .update({
          match_status: item.match_status,
          basepack_id: item.basepack_id,
          matched_at: item.matched_at,
          updated_at: item.updated_at,
        })
        .eq('id', item.id)
    }
  }

  // Batch updates for demoted
  for (let i = 0; i < toDemote.length; i += 100) {
    const batch = toDemote.slice(i, i + 100)
    await client
      .from('dh_items')
      .update({
        match_status: 'ignored',
        updated_at: nowIso,
      })
      .in('id', batch)
  }

  // Resolve stale flags for demoted items if requested (default true)
  if (options?.resolveStaleFlags !== false && toDemote.length > 0) {
    try {
      await client
        .from('dh_flags')
        .update({
          status: 'resolved',
          resolved_at: nowIso,
          message: 'Flag automatically resolved because item is out of Pandamart SKU scope.',
        })
        .in('dh_item_id', toDemote)
        .eq('status', 'open')
    } catch (err) {
      console.warn('Error resolving stale flags in syncDhItemsScope:', err)
    }
  }

  return {
    promoted: toPromote.length,
    demoted: toDemote.length,
    total_matched: totalMatched,
    total_ignored: totalIgnored,
    total_items: allItems.length,
  }
}

/**
 * Computes coverage stats between a dump SKU set and the legacy SKU scope.
 */
export function computeDhDumpCoverage(
  dumpSkus: Set<string> = new Set(),
  skuMap: Map<string, InScopeSkuInfo> = new Map()
) {
  const safeDumpSkus = dumpSkus || new Set()
  const safeSkuMap = skuMap || new Map()
  let listSkusFound = 0
  const missingFromDump: Array<{
    sku: string
    basepack_name: string
    brand: string | null
    product_name: string | null
  }> = []

  for (const [sku, info] of safeSkuMap.entries()) {
    if (safeDumpSkus.has(sku)) {
      listSkusFound++
    } else {
      missingFromDump.push({
        sku,
        basepack_name: info.basepack_name,
        brand: info.brand,
        product_name: info.product_name,
      })
    }
  }

  let dumpSkusSkipped = 0
  for (const sku of safeDumpSkus) {
    if (!safeSkuMap.has(sku)) {
      dumpSkusSkipped++
    }
  }

  return {
    list_skus_total: safeSkuMap.size,
    list_skus_found: listSkusFound,
    list_skus_missing: missingFromDump.length,
    dump_skus_total: safeDumpSkus.size,
    dump_skus_skipped: dumpSkusSkipped,
    missing_from_dump: missingFromDump,
  }
}
