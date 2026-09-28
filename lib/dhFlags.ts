import { demoMode, supabase } from './supabase'
import { DH_FLAG_THRESHOLDS } from './dhFlagThresholds'
import { DhItem, DhStore } from './dhData'

export type DhFlagType =
  | 'stockout_risk'
  | 'distribution_imbalance'
  | 'dc_stuck'
  | 'dead_stock'
  | 'sales_decline'
  | 'store_health'

export type DhFlagSeverity = 'info' | 'warning' | 'critical'
export type DhFlagStatus = 'open' | 'acknowledged' | 'resolved'

export interface DhFlagMetrics {
  sold_qty_30d?: number
  total_stock?: number
  dc_qty?: number
  branch_qty?: number
  store_count_instock?: number
  days_of_cover?: number
  quartile_cutoff?: number
  prior_15d?: number
  recent_15d?: number
  drop_pct?: number
  oos_pct?: number
  zero_count?: number
  total_skus?: number
  prior_oos_pct?: number
  sales_trend_30d?: Array<{ date: string; sold_qty: number }>
  [key: string]: any
}

export interface DhFlag {
  id: string
  flag_type: DhFlagType
  severity: DhFlagSeverity
  dh_item_id: string | null
  dh_store_id: string | null
  stock_date: string
  metrics: DhFlagMetrics
  title: string
  message: string
  status: DhFlagStatus
  first_detected_at: string
  last_seen_at: string
  resolved_at: string | null
  created_at?: string
  item?: (DhItem & { basepacks?: { id: string; name: string; brand: string | null; category?: string | null } | null }) | null
  store?: DhStore | null
  sparkline?: Array<{ date: string; sold_qty: number }>
}

export interface StoreHealthRollup {
  store_id: string
  store_code: string
  display_name: string
  is_dc: boolean
  oos_pct: number
  in_stock_pct: number
  zero_count: number
  total_skus: number
  severity: 'normal' | 'warning' | 'critical'
}

export interface DhFlagsSummary {
  critical_count: number
  warning_count: number
  info_count: number
  resolved_week_count: number
  total_open: number
  by_type: Record<DhFlagType, number>
  store_health: StoreHealthRollup[]
  is_schema_installed: boolean
  stock_date: string | null
  sale_date: string | null
  stockDate?: string | null
  saleDate?: string | null
}

export async function checkDhFlagsSchemaInstalled(): Promise<boolean> {
  if (demoMode || !supabase) return false
  try {
    const { error } = await supabase.from('dh_flags').select('id', { head: true, count: 'exact' })
    if (error && (error.code === 'PGRST205' || error.message.includes('relation "public.dh_flags" does not exist'))) {
      return false
    }
    return !error
  } catch {
    return false
  }
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
      console.warn('Pagination query error in dhFlags:', res.error)
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
 * Computes all active flags from latest stock and 30-day sales.
 */
export async function computeDhFlags(client: any = supabase): Promise<{
  flags: DhFlag[]
  summary: DhFlagsSummary
  stockDate: string
  saleDate: string
}> {
  if (!client) {
    return getDemoComputedFlags()
  }

  // 1. Fetch metadata and latest dates
  const [itemsRes, storesRes, latestStockRes, latestSaleRes] = await Promise.all([
    client.from('dh_items').select('id,dh_sku,dh_name,basepack_id,match_status,basepacks(id,name,brand,category)'),
    client.from('dh_stores').select('id,store_code,display_name,is_dc,location_id,active').order('is_dc', { ascending: false }).order('display_name', { ascending: true }),
    client.from('dh_stock_daily').select('stock_date').order('stock_date', { ascending: false }).limit(1).maybeSingle(),
    client.from('dh_sales_daily').select('sale_date').order('sale_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  const stockDate: string = latestStockRes.data?.stock_date || new Date().toISOString().slice(0, 10)
  const saleDate: string = latestSaleRes.data?.sale_date || stockDate

  const items: any[] = itemsRes.data || []
  const stores: any[] = storesRes.data || []
  const itemMap = new Map<string, any>(items.map(it => [it.id, it]))
  const storeMap = new Map<string, any>(stores.map(st => [st.id, st]))
  const dcStore = stores.find(st => st.is_dc)
  const dcStoreId = dcStore?.id
  const branchStores = stores.filter(st => !st.is_dc)

  // 2. Sales window: 30 days anchored to latest saleDate
  // Split into 15 days prior and 15 days recent
  const [y, m, d] = saleDate.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d))
  const start30Obj = new Date(anchor.getTime() - 29 * 24 * 3600 * 1000)
  const split15Obj = new Date(anchor.getTime() - 14 * 24 * 3600 * 1000)
  const start30Str = start30Obj.toISOString().slice(0, 10)
  const split15Str = split15Obj.toISOString().slice(0, 10)

  // 3. Fetch stock rows for stockDate and sales rows for 30d window
  const [stockRows, salesRows] = await Promise.all([
    fetchAllPages<{ dh_item_id: string; dh_store_id: string; qty: number }>(
      (from, to) =>
        client
          .from('dh_stock_daily')
          .select('dh_item_id,dh_store_id,qty')
          .eq('stock_date', stockDate)
          .range(from, to)
    ),
    fetchAllPages<{ sale_date: string; dh_item_id: string; sold_qty: number; gfv_local: number }>(
      (from, to) =>
        client
          .from('dh_sales_daily')
          .select('sale_date,dh_item_id,sold_qty,gfv_local')
          .gte('sale_date', start30Str)
          .range(from, to)
    ),
  ])

  // Generate 30 date strings for sparkline alignment
  const dateList: string[] = []
  for (let i = 29; i >= 0; i--) {
    const cur = new Date(anchor.getTime() - i * 24 * 3600 * 1000)
    dateList.push(cur.toISOString().slice(0, 10))
  }

  // 4. Aggregate sales per item
  const salesByItem = new Map<
    string,
    { totalQty: number; priorQty: number; recentQty: number; daily: Record<string, number> }
  >()

  for (const sr of salesRows) {
    let cur = salesByItem.get(sr.dh_item_id)
    if (!cur) {
      cur = { totalQty: 0, priorQty: 0, recentQty: 0, daily: {} }
      salesByItem.set(sr.dh_item_id, cur)
    }
    const q = sr.sold_qty || 0
    cur.totalQty += q
    cur.daily[sr.sale_date] = (cur.daily[sr.sale_date] || 0) + q
    if (sr.sale_date < split15Str) {
      cur.priorQty += q
    } else {
      cur.recentQty += q
    }
  }

  // 5. Aggregate stock per item and per store
  const stockByItem = new Map<
    string,
    { total: number; dc: number; branch: number; storeCountInstock: number }
  >()
  const stockByStore = new Map<string, { total: number; zeroCount: number }>()
  for (const st of stores) {
    stockByStore.set(st.id, { total: 0, zeroCount: 0 })
  }

  for (const row of stockRows) {
    let cur = stockByItem.get(row.dh_item_id)
    if (!cur) {
      cur = { total: 0, dc: 0, branch: 0, storeCountInstock: 0 }
      stockByItem.set(row.dh_item_id, cur)
    }
    const q = row.qty || 0
    cur.total += q
    if (row.dh_store_id === dcStoreId) {
      cur.dc += q
    } else {
      cur.branch += q
      if (q > 0) cur.storeCountInstock++
    }

    const stStat = stockByStore.get(row.dh_store_id)
    if (stStat) {
      stStat.total++
      if (q === 0) stStat.zeroCount++
    }
  }

  // 6. Compute top quartile volume cutoff for stockout risk
  const soldQtyList: number[] = []
  for (const it of items) {
    const sStat = salesByItem.get(it.id)
    if (sStat && sStat.totalQty > 0) {
      soldQtyList.push(sStat.totalQty)
    }
  }
  soldQtyList.sort((a, b) => a - b)
  const q75Idx = Math.floor(soldQtyList.length * DH_FLAG_THRESHOLDS.STOCKOUT_PERCENTILE_CUTOFF)
  const p75Cutoff = soldQtyList[q75Idx] || 0

  const nowIso = new Date().toISOString()
  const flags: DhFlag[] = []

  // 7. Evaluate SKU-level flag rules
  for (const it of items) {
    const sStat = salesByItem.get(it.id) || { totalQty: 0, priorQty: 0, recentQty: 0, daily: {} }
    const stStat = stockByItem.get(it.id) || { total: 0, dc: 0, branch: 0, storeCountInstock: 0 }

    // 30-day sparkline points
    const sparkline = dateList.map(dt => ({
      date: dt,
      sold_qty: sStat.daily[dt] || 0,
    }))

    const dailyBurn = sStat.totalQty / 30
    const daysOfCover = dailyBurn > 0 ? stStat.total / dailyBurn : (stStat.total > 0 ? 999 : 0)

    // Rule a: Stockout Risk
    if (sStat.totalQty >= p75Cutoff && sStat.totalQty > 0) {
      if (daysOfCover < DH_FLAG_THRESHOLDS.STOCKOUT_COVER_CRITICAL_DAYS) {
        flags.push({
          id: `crit_doc_${it.id}`,
          flag_type: 'stockout_risk',
          severity: 'critical',
          dh_item_id: it.id,
          dh_store_id: null,
          stock_date: stockDate,
          metrics: {
            sold_qty_30d: sStat.totalQty,
            total_stock: stStat.total,
            dc_qty: stStat.dc,
            branch_qty: stStat.branch,
            store_count_instock: stStat.storeCountInstock,
            days_of_cover: Number(daysOfCover.toFixed(1)),
            quartile_cutoff: p75Cutoff,
            sales_trend_30d: sparkline,
          },
          title: `${it.dh_name} — Critical Stockout Risk`,
          message: `Top seller (${sStat.totalQty.toLocaleString()} units sold in 30d) has only ${daysOfCover.toFixed(1)} days of cover (${stStat.total.toLocaleString()} units left across ${stStat.storeCountInstock} stores).`,
          status: 'open',
          first_detected_at: nowIso,
          last_seen_at: nowIso,
          resolved_at: null,
          item: it,
          sparkline,
        })
      } else if (
        daysOfCover < DH_FLAG_THRESHOLDS.STOCKOUT_COVER_WARNING_DAYS ||
        stStat.storeCountInstock <= DH_FLAG_THRESHOLDS.STOCKOUT_STORE_COUNT_WARNING
      ) {
        flags.push({
          id: `warn_doc_${it.id}`,
          flag_type: 'stockout_risk',
          severity: 'warning',
          dh_item_id: it.id,
          dh_store_id: null,
          stock_date: stockDate,
          metrics: {
            sold_qty_30d: sStat.totalQty,
            total_stock: stStat.total,
            dc_qty: stStat.dc,
            branch_qty: stStat.branch,
            store_count_instock: stStat.storeCountInstock,
            days_of_cover: Number(daysOfCover.toFixed(1)),
            quartile_cutoff: p75Cutoff,
            sales_trend_30d: sparkline,
          },
          title: `${it.dh_name} — Thin Stock Coverage`,
          message: `High volume SKU (${sStat.totalQty.toLocaleString()} sold in 30d) has ${daysOfCover.toFixed(1)} days of cover and is present in only ${stStat.storeCountInstock} of 16 dark stores.`,
          status: 'open',
          first_detected_at: nowIso,
          last_seen_at: nowIso,
          resolved_at: null,
          item: it,
          sparkline,
        })
      }
    }

    // Rule b: Distribution Imbalance
    if (
      stStat.storeCountInstock <= DH_FLAG_THRESHOLDS.IMBALANCE_MAX_STORES &&
      stStat.total >= DH_FLAG_THRESHOLDS.IMBALANCE_MIN_STOCK
    ) {
      const severity: DhFlagSeverity = sStat.totalQty > 0 ? 'critical' : 'warning'
      flags.push({
        id: `imb_${it.id}`,
        flag_type: 'distribution_imbalance',
        severity,
        dh_item_id: it.id,
        dh_store_id: null,
        stock_date: stockDate,
        metrics: {
          total_stock: stStat.total,
          store_count_instock: stStat.storeCountInstock,
          dc_qty: stStat.dc,
          branch_qty: stStat.branch,
          sold_qty_30d: sStat.totalQty,
          sales_trend_30d: sparkline,
        },
        title: `${it.dh_name} — Distribution Imbalance`,
        message: `${stStat.total.toLocaleString()} units hoarded in only ${stStat.storeCountInstock} store(s); zero stock in ${16 - stStat.storeCountInstock} dark stores despite demonstrated demand.`,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
        item: it,
        sparkline,
      })
    }

    // Rule c: DC-Stuck Stock
    if (stStat.dc > 0 && stStat.branch === 0) {
      const severity: DhFlagSeverity = sStat.totalQty > 0 ? 'critical' : 'warning'
      flags.push({
        id: `dc_stuck_${it.id}`,
        flag_type: 'dc_stuck',
        severity,
        dh_item_id: it.id,
        dh_store_id: null,
        stock_date: stockDate,
        metrics: {
          dc_qty: stStat.dc,
          branch_qty: stStat.branch,
          total_stock: stStat.total,
          sold_qty_30d: sStat.totalQty,
          sales_trend_30d: sparkline,
        },
        title: `${it.dh_name} — Stock Stuck at Central DC`,
        message: `${stStat.dc.toLocaleString()} units sit at Central DC while all 16 dark stores are completely dry (${sStat.totalQty.toLocaleString()} units sold in trailing 30d).`,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
        item: it,
        sparkline,
      })
    }

    // Rule d: Dead Stock
    if (stStat.dc === 0 && stStat.branch === 0) {
      const severity: DhFlagSeverity = sStat.totalQty > 0 ? 'critical' : 'info'
      flags.push({
        id: `dead_${it.id}`,
        flag_type: 'dead_stock',
        severity,
        dh_item_id: it.id,
        dh_store_id: null,
        stock_date: stockDate,
        metrics: {
          dc_qty: 0,
          branch_qty: 0,
          total_stock: 0,
          sold_qty_30d: sStat.totalQty,
          sales_trend_30d: sparkline,
        },
        title:
          severity === 'critical'
            ? `${it.dh_name} — Out of Stock Network-Wide`
            : `${it.dh_name} — Inactive / Zero Stock Catalog Item`,
        message:
          severity === 'critical'
            ? `Zero stock across Central DC and all 16 dark stores despite proven demand (${sStat.totalQty.toLocaleString()} units sold in 30d).`
            : `Zero stock network-wide with zero 30-day sales (likely delisted or pending restock).`,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
        item: it,
        sparkline,
      })
    }

    // Rule e: Sales Momentum Decline (split 15-day comparison)
    if (sStat.priorQty >= DH_FLAG_THRESHOLDS.DECLINE_MIN_PRIOR_QTY) {
      const dropPct = (sStat.priorQty - sStat.recentQty) / sStat.priorQty
      const dropPctRound = Math.round(dropPct * 100)

      if (
        dropPctRound >= DH_FLAG_THRESHOLDS.DECLINE_CRITICAL_DROP_PCT ||
        (dropPctRound >= DH_FLAG_THRESHOLDS.DECLINE_WARNING_DROP_PCT &&
          stStat.total >= DH_FLAG_THRESHOLDS.DECLINE_HEALTHY_STOCK_BAR)
      ) {
        flags.push({
          id: `crit_decline_${it.id}`,
          flag_type: 'sales_decline',
          severity: 'critical',
          dh_item_id: it.id,
          dh_store_id: null,
          stock_date: stockDate,
          metrics: {
            prior_15d: sStat.priorQty,
            recent_15d: sStat.recentQty,
            drop_pct: dropPctRound,
            total_stock: stStat.total,
            sold_qty_30d: sStat.totalQty,
            sales_trend_30d: sparkline,
          },
          title: `${it.dh_name} — Severe Sales Cliff (-${dropPctRound}%)`,
          message: `Sales plummeted from ${sStat.priorQty.toLocaleString()} to ${sStat.recentQty.toLocaleString()} units (-${dropPctRound}%) despite healthy inventory (${stStat.total.toLocaleString()} units in stock). Potential price resistance or competitor promotion.`,
          status: 'open',
          first_detected_at: nowIso,
          last_seen_at: nowIso,
          resolved_at: null,
          item: it,
          sparkline,
        })
      } else if (dropPctRound >= DH_FLAG_THRESHOLDS.DECLINE_WARNING_DROP_PCT) {
        flags.push({
          id: `warn_decline_${it.id}`,
          flag_type: 'sales_decline',
          severity: 'warning',
          dh_item_id: it.id,
          dh_store_id: null,
          stock_date: stockDate,
          metrics: {
            prior_15d: sStat.priorQty,
            recent_15d: sStat.recentQty,
            drop_pct: dropPctRound,
            total_stock: stStat.total,
            sold_qty_30d: sStat.totalQty,
            sales_trend_30d: sparkline,
          },
          title: `${it.dh_name} — Sales Velocity Slowdown (-${dropPctRound}%)`,
          message: `Sales tapered from ${sStat.priorQty.toLocaleString()} units down to ${sStat.recentQty.toLocaleString()} units (-${dropPctRound}%) over the trailing 15-day period.`,
          status: 'open',
          first_detected_at: nowIso,
          last_seen_at: nowIso,
          resolved_at: null,
          item: it,
          sparkline,
        })
      }
    }
  }

  // 8. Rule f: Store Health Rollup
  const storeHealthList: StoreHealthRollup[] = []
  for (const st of branchStores) {
    const stStat = stockByStore.get(st.id) || { total: 0, zeroCount: 0 }
    const oosPct = stStat.total > 0 ? Math.round((stStat.zeroCount / stStat.total) * 100) : 0
    const inStockPct = 100 - oosPct

    let severity: 'normal' | 'warning' | 'critical' = 'normal'
    if (oosPct > DH_FLAG_THRESHOLDS.STORE_OOS_CRITICAL_PCT) {
      severity = 'critical'
      flags.push({
        id: `store_crit_${st.id}`,
        flag_type: 'store_health',
        severity: 'critical',
        dh_item_id: null,
        dh_store_id: st.id,
        stock_date: stockDate,
        metrics: {
          oos_pct: oosPct,
          zero_count: stStat.zeroCount,
          total_skus: stStat.total,
        },
        title: `${st.display_name} — Critical Out-of-Stock Level (${oosPct}%)`,
        message: `${oosPct}% of the tracked catalog (${stStat.zeroCount}/${stStat.total} SKUs) is currently out of stock in ${st.display_name}. Urgent stock replenishment required.`,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
        store: st,
      })
    } else if (oosPct > DH_FLAG_THRESHOLDS.STORE_OOS_WARNING_PCT) {
      severity = 'warning'
      flags.push({
        id: `store_warn_${st.id}`,
        flag_type: 'store_health',
        severity: 'warning',
        dh_item_id: null,
        dh_store_id: st.id,
        stock_date: stockDate,
        metrics: {
          oos_pct: oosPct,
          zero_count: stStat.zeroCount,
          total_skus: stStat.total,
        },
        title: `${st.display_name} — Elevated Out-of-Stock Level (${oosPct}%)`,
        message: `${oosPct}% of items (${stStat.zeroCount}/${stStat.total} SKUs) are at zero stock in ${st.display_name}.`,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
        store: st,
      })
    }

    storeHealthList.push({
      store_id: st.id,
      store_code: st.store_code,
      display_name: st.display_name,
      is_dc: false,
      oos_pct: oosPct,
      in_stock_pct: inStockPct,
      zero_count: stStat.zeroCount,
      total_skus: stStat.total,
      severity,
    })
  }

  // Add Central DC to store health list as well
  if (dcStore) {
    const dcStat = stockByStore.get(dcStore.id) || { total: 0, zeroCount: 0 }
    const dcOosPct = dcStat.total > 0 ? Math.round((dcStat.zeroCount / dcStat.total) * 100) : 0
    storeHealthList.unshift({
      store_id: dcStore.id,
      store_code: dcStore.store_code,
      display_name: dcStore.display_name,
      is_dc: true,
      oos_pct: dcOosPct,
      in_stock_pct: 100 - dcOosPct,
      zero_count: dcStat.zeroCount,
      total_skus: dcStat.total,
      severity: dcOosPct > 45 ? 'critical' : dcOosPct > 30 ? 'warning' : 'normal',
    })
  }

  // 9. Build summary counters
  let critical_count = 0
  let warning_count = 0
  let info_count = 0
  const by_type: Record<DhFlagType, number> = {
    stockout_risk: 0,
    distribution_imbalance: 0,
    dc_stuck: 0,
    dead_stock: 0,
    sales_decline: 0,
    store_health: 0,
  }

  for (const f of flags) {
    if (f.severity === 'critical') critical_count++
    else if (f.severity === 'warning') warning_count++
    else info_count++

    by_type[f.flag_type] = (by_type[f.flag_type] || 0) + 1
  }

  return {
    flags,
    summary: {
      critical_count,
      warning_count,
      info_count,
      resolved_week_count: 0,
      total_open: flags.length,
      by_type,
      store_health: storeHealthList,
      is_schema_installed: true,
      stock_date: stockDate,
      sale_date: saleDate,
      stockDate,
      saleDate,
    },
    stockDate,
    saleDate,
  }
}

/**
 * Persists computed flags to Supabase `dh_flags`, auto-resolves healed issues,
 * and mirrors new warning/critical flags to `alerts`.
 */
export async function persistDhFlags(client: any, computedFlags: DhFlag[]): Promise<{
  upsertedCount: number
  resolvedCount: number
  mirroredAlertsCount: number
}> {
  const isInstalled = await checkDhFlagsSchemaInstalled()
  if (!isInstalled || !client) {
    return { upsertedCount: computedFlags.length, resolvedCount: 0, mirroredAlertsCount: 0 }
  }

  const nowIso = new Date().toISOString()

  // 1. Fetch currently open flags from dh_flags
  const { data: existingOpenFlags, error: fetchErr } = await client
    .from('dh_flags')
    .select('id,flag_type,dh_item_id,dh_store_id,severity,status,first_detected_at')
    .eq('status', 'open')

  if (fetchErr) {
    console.error('Failed to fetch existing dh_flags:', fetchErr)
    return { upsertedCount: 0, resolvedCount: 0, mirroredAlertsCount: 0 }
  }

  const existingMap = new Map<string, any>()
  for (const f of existingOpenFlags || []) {
    const key = `${f.flag_type}|${f.dh_item_id || 'null'}|${f.dh_store_id || 'null'}`
    existingMap.set(key, f)
  }

  // 2. Fetch pandamart account id for mirroring into alerts
  const { data: pandamartAcc } = await client
    .from('accounts')
    .select('id')
    .eq('code', 'pandamart')
    .maybeSingle()

  const pandamartAccountId = pandamartAcc?.id || null

  const seenKeys = new Set<string>()
  const newFlagsToInsert: any[] = []
  const existingFlagsToUpdate: any[] = []
  const newAlertsToMirror: any[] = []

  for (const flag of computedFlags) {
    const key = `${flag.flag_type}|${flag.dh_item_id || 'null'}|${flag.dh_store_id || 'null'}`
    seenKeys.add(key)

    const existing = existingMap.get(key)
    if (existing) {
      // Flag remains open -> update last_seen_at and metrics
      existingFlagsToUpdate.push({
        id: existing.id,
        severity: flag.severity,
        stock_date: flag.stock_date,
        metrics: flag.metrics,
        title: flag.title,
        message: flag.message,
        last_seen_at: nowIso,
      })
    } else {
      // New open flag
      newFlagsToInsert.push({
        flag_type: flag.flag_type,
        severity: flag.severity,
        dh_item_id: flag.dh_item_id,
        dh_store_id: flag.dh_store_id,
        stock_date: flag.stock_date,
        metrics: flag.metrics,
        title: flag.title,
        message: flag.message,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
      })

      // Mirror warning and critical flags to generic alerts table
      if (flag.severity === 'critical' || flag.severity === 'warning') {
        newAlertsToMirror.push({
          alert_type: `dh_${flag.flag_type}`,
          severity: flag.severity,
          account_id: pandamartAccountId,
          location_id: flag.store?.location_id || null,
          basepack_id: flag.item?.basepack_id || null,
          title: flag.title,
          message: flag.message,
          status: 'open',
          created_at: nowIso,
        })
      }
    }
  }

  // 3. Auto-resolve flags that are no longer triggering
  const idsToResolve: string[] = []
  for (const [key, existing] of existingMap.entries()) {
    if (!seenKeys.has(key)) {
      idsToResolve.push(existing.id)
    }
  }

  // Batch insert new flags
  if (newFlagsToInsert.length > 0) {
    const { error: insErr } = await client.from('dh_flags').insert(newFlagsToInsert)
    if (insErr) console.warn('dh_flags insert error:', insErr)
  }

  // Batch update existing refreshed flags
  for (const upd of existingFlagsToUpdate) {
    await client
      .from('dh_flags')
      .update({
        severity: upd.severity,
        stock_date: upd.stock_date,
        metrics: upd.metrics,
        title: upd.title,
        message: upd.message,
        last_seen_at: upd.last_seen_at,
      })
      .eq('id', upd.id)
  }

  // Batch resolve healed flags
  if (idsToResolve.length > 0) {
    await client
      .from('dh_flags')
      .update({
        status: 'resolved',
        resolved_at: nowIso,
      })
      .in('id', idsToResolve)
  }

  // Mirror to alerts table
  if (newAlertsToMirror.length > 0) {
    const { error: alertErr } = await client.from('alerts').insert(newAlertsToMirror)
    if (alertErr) console.warn('alerts mirror insert warning:', alertErr)
  }

  return {
    upsertedCount: newFlagsToInsert.length + existingFlagsToUpdate.length,
    resolvedCount: idsToResolve.length,
    mirroredAlertsCount: newAlertsToMirror.length,
  }
}

/**
 * Main query function called by UI / API to list flags and summary counters.
 */
export async function getDhFlags(options?: {
  status?: DhFlagStatus | 'all'
  severity?: DhFlagSeverity | 'all'
  flagType?: DhFlagType | 'all'
  search?: string
  store?: string
}): Promise<{
  flags: DhFlag[]
  summary: DhFlagsSummary
}> {
  const isInstalled = await checkDhFlagsSchemaInstalled()

  if (!isInstalled || !supabase) {
    // Schema not installed or demo mode: compute live on the fly from current stock & sales!
    const res = await computeDhFlags(supabase)
    let filtered = res.flags

    if (options?.status && options.status !== 'all') {
      filtered = filtered.filter(f => f.status === options.status)
    }
    if (options?.severity && options.severity !== 'all') {
      filtered = filtered.filter(f => f.severity === options.severity)
    }
    if (options?.flagType && options.flagType !== 'all') {
      filtered = filtered.filter(f => f.flag_type === options.flagType)
    }
    if (options?.store && options.store.trim()) {
      const st = options.store.toLowerCase().trim()
      filtered = filtered.filter(
        f =>
          f.dh_store_id === options.store ||
          f.store?.id === options.store ||
          f.store?.store_code?.toLowerCase() === st ||
          f.store?.display_name?.toLowerCase().includes(st)
      )
    }
    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim()
      filtered = filtered.filter(
        f =>
          f.title.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q) ||
          f.item?.dh_name.toLowerCase().includes(q) ||
          f.item?.dh_sku.toLowerCase().includes(q) ||
          f.store?.display_name.toLowerCase().includes(q)
      )
    }

    return {
      flags: filtered,
      summary: {
        ...res.summary,
        is_schema_installed: isInstalled,
      },
    }
  }

  try {
    // 1. Fetch flags from dh_flags table
    let query = supabase
      .from('dh_flags')
      .select(`
        id,
        flag_type,
        severity,
        dh_item_id,
        dh_store_id,
        stock_date,
        metrics,
        title,
        message,
        status,
        first_detected_at,
        last_seen_at,
        resolved_at,
        created_at,
        dh_items(id,dh_sku,dh_name,basepack_id,match_status,basepacks(id,name,brand,category)),
        dh_stores(id,store_code,display_name,is_dc,location_id)
      `)
      .order('severity', { ascending: false }) // critical first
      .order('last_seen_at', { ascending: false })

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    } else if (!options?.status) {
      query = query.eq('status', 'open')
    }

    if (options?.severity && options.severity !== 'all') {
      query = query.eq('severity', options.severity)
    }
    if (options?.flagType && options.flagType !== 'all') {
      query = query.eq('flag_type', options.flagType)
    }

    const { data: dbFlags, error: flagsErr } = await query
    if (flagsErr) throw flagsErr

    // 2. Fetch counts for summary strip
    const [critCount, warnCount, infoCount, resolvedWeekCount] = await Promise.all([
      supabase.from('dh_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'critical'),
      supabase.from('dh_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'warning'),
      supabase.from('dh_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'info'),
      supabase.from('dh_flags').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    ])

    // Compute type breakdown and format rows
    const by_type: Record<DhFlagType, number> = {
      stockout_risk: 0,
      distribution_imbalance: 0,
      dc_stuck: 0,
      dead_stock: 0,
      sales_decline: 0,
      store_health: 0,
    }

    const formatted: DhFlag[] = (dbFlags || []).map((r: any) => {
      const ft = r.flag_type as DhFlagType
      if (r.status === 'open') {
        by_type[ft] = (by_type[ft] || 0) + 1
      }
      return {
        id: r.id,
        flag_type: ft,
        severity: r.severity,
        dh_item_id: r.dh_item_id,
        dh_store_id: r.dh_store_id,
        stock_date: r.stock_date,
        metrics: r.metrics || {},
        title: r.title,
        message: r.message,
        status: r.status,
        first_detected_at: r.first_detected_at,
        last_seen_at: r.last_seen_at,
        resolved_at: r.resolved_at,
        created_at: r.created_at,
        item: r.dh_items,
        store: r.dh_stores,
        sparkline: r.metrics?.sales_trend_30d || [],
      }
    })

    // Also get store health rollups
    const computed = await computeDhFlags(supabase)

    let filtered = formatted
    if (options?.store && options.store.trim()) {
      const st = options.store.toLowerCase().trim()
      filtered = filtered.filter(
        f =>
          f.dh_store_id === options.store ||
          f.store?.id === options.store ||
          f.store?.store_code?.toLowerCase() === st ||
          f.store?.display_name?.toLowerCase().includes(st)
      )
    }
    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim()
      filtered = filtered.filter(
        f =>
          f.title.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q) ||
          f.item?.dh_name.toLowerCase().includes(q) ||
          f.item?.dh_sku.toLowerCase().includes(q) ||
          f.store?.display_name.toLowerCase().includes(q)
      )
    }

    return {
      flags: filtered,
      summary: {
        critical_count: critCount.count || 0,
        warning_count: warnCount.count || 0,
        info_count: infoCount.count || 0,
        resolved_week_count: resolvedWeekCount.count || 0,
        total_open: (critCount.count || 0) + (warnCount.count || 0) + (infoCount.count || 0),
        by_type,
        store_health: computed.summary.store_health,
        is_schema_installed: true,
        stock_date: computed.stockDate,
        sale_date: computed.saleDate,
        stockDate: computed.stockDate,
        saleDate: computed.saleDate,
      },
    }
  } catch (err) {
    console.warn('Error reading dh_flags table, falling back to live computation:', err)
    const fallback = await computeDhFlags(supabase)
    return {
      flags: fallback.flags,
      summary: {
        ...fallback.summary,
        is_schema_installed: false,
      },
    }
  }
}

/**
 * Updates a flag status (e.g. acknowledge or resolve).
 */
export async function updateDhFlagStatus(
  flagId: string,
  newStatus: DhFlagStatus
): Promise<void> {
  if (demoMode || !supabase) return

  const isInstalled = await checkDhFlagsSchemaInstalled()
  if (!isInstalled) return

  const payload: any = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'resolved') {
    payload.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase.from('dh_flags').update(payload).eq('id', flagId)
  if (error) throw error
}

/**
 * Full orchestrator to compute and persist DH flags.
 */
export async function generateDhFlagsPass(customClient?: any): Promise<{
  success: boolean
  stockDate: string
  saleDate: string
  totalFlags: number
  criticalCount: number
  warningCount: number
  infoCount: number
  upsertedCount: number
  resolvedCount: number
  mirroredAlertsCount: number
}> {
  const client = customClient || supabase
  const computed = await computeDhFlags(client)
  const persistRes = await persistDhFlags(client, computed.flags)

  return {
    success: true,
    stockDate: computed.stockDate,
    saleDate: computed.saleDate,
    totalFlags: computed.flags.length,
    criticalCount: computed.summary.critical_count,
    warningCount: computed.summary.warning_count,
    infoCount: computed.summary.info_count,
    upsertedCount: persistRes.upsertedCount,
    resolvedCount: persistRes.resolvedCount,
    mirroredAlertsCount: persistRes.mirroredAlertsCount,
  }
}

// Demo fallback data generator
function getDemoComputedFlags(): {
  flags: DhFlag[]
  summary: DhFlagsSummary
  stockDate: string
  saleDate: string
} {
  const stockDate = '2026-09-23'
  const saleDate = '2026-09-23'
  const nowIso = new Date().toISOString()

  const demoSparkline = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    sold_qty: Math.max(0, Math.floor(40 + Math.sin(i / 3) * 20 - (i > 15 ? (i - 15) * 3 : 0))),
  }))

  const sampleFlags: DhFlag[] = [
    {
      id: 'demo-1',
      flag_type: 'sales_decline',
      severity: 'critical',
      dh_item_id: 'item-1',
      dh_store_id: null,
      stock_date: stockDate,
      metrics: {
        prior_15d: 1857,
        recent_15d: 424,
        drop_pct: 77,
        total_stock: 820,
        sold_qty_30d: 2281,
        sales_trend_30d: demoSparkline,
      },
      title: 'Surf Excel Synthetic Laundry Detergent Powder 1kg — Severe Sales Cliff (-77%)',
      message: 'Sales plummeted from 1,857 to 424 units (-77%) despite healthy inventory (820 units in stock). Potential price resistance or competitor promotion.',
      status: 'open',
      first_detected_at: nowIso,
      last_seen_at: nowIso,
      resolved_at: null,
      item: {
        id: 'item-1',
        dh_sku: '448102',
        dh_name: 'Surf Excel Synthetic Laundry Detergent Powder 1kg',
        basepack_id: 'bp-1',
        match_status: 'matched',
        matched_at: nowIso,
        basepacks: { id: 'bp-1', name: 'Surf Excel 1kg', brand: 'Surf Excel', category: 'Fabric Cleaning' },
      },
      sparkline: demoSparkline,
    },
    {
      id: 'demo-2',
      flag_type: 'distribution_imbalance',
      severity: 'critical',
      dh_item_id: 'item-2',
      dh_store_id: null,
      stock_date: stockDate,
      metrics: {
        total_stock: 2138,
        store_count_instock: 1,
        dc_qty: 0,
        branch_qty: 2138,
        sold_qty_30d: 412,
        sales_trend_30d: demoSparkline,
      },
      title: 'Buy Lux Soap Bar Serum Flawless Glow 90g & Get Free Sunsilk Mini — Distribution Imbalance',
      message: '2,138 units hoarded in only 1 store; zero stock in 15 dark stores despite demonstrated demand.',
      status: 'open',
      first_detected_at: nowIso,
      last_seen_at: nowIso,
      resolved_at: null,
      item: {
        id: 'item-2',
        dh_sku: '984120',
        dh_name: 'Buy Lux Soap Bar Serum Flawless Glow 90g & Get Free Sunsilk Mini Shampoo 2 Pieces',
        basepack_id: 'bp-2',
        match_status: 'matched',
        matched_at: nowIso,
        basepacks: { id: 'bp-2', name: 'Lux Soap 90g Promo', brand: 'Lux', category: 'Skin Cleansing' },
      },
      sparkline: demoSparkline,
    },
    {
      id: 'demo-3',
      flag_type: 'store_health',
      severity: 'critical',
      dh_item_id: null,
      dh_store_id: 'store-lalbagh',
      stock_date: stockDate,
      metrics: {
        oos_pct: 46,
        zero_count: 129,
        total_skus: 280,
      },
      title: 'Lalbagh — Critical Out-of-Stock Level (46%)',
      message: '46% of the tracked catalog (129/280 SKUs) is currently out of stock in Lalbagh. Urgent stock replenishment required.',
      status: 'open',
      first_detected_at: nowIso,
      last_seen_at: nowIso,
      resolved_at: null,
      store: {
        id: 'store-lalbagh',
        store_code: 'Lalbagh',
        display_name: 'Lalbagh',
        location_id: null,
        is_dc: false,
        active: true,
      },
    },
    {
      id: 'demo-4',
      flag_type: 'stockout_risk',
      severity: 'warning',
      dh_item_id: 'item-4',
      dh_store_id: null,
      stock_date: stockDate,
      metrics: {
        sold_qty_30d: 1035,
        total_stock: 142,
        dc_qty: 0,
        branch_qty: 142,
        store_count_instock: 5,
        days_of_cover: 4.1,
        quartile_cutoff: 323,
        sales_trend_30d: demoSparkline,
      },
      title: 'Vim Liquid Dishwash 475ml — Thin Stock Coverage',
      message: 'High volume SKU (1,035 sold in 30d) has 4.1 days of cover and is present in only 5 of 16 dark stores.',
      status: 'open',
      first_detected_at: nowIso,
      last_seen_at: nowIso,
      resolved_at: null,
      item: {
        id: 'item-4',
        dh_sku: '381921',
        dh_name: 'Vim Liquid Dishwash 475ml',
        basepack_id: 'bp-4',
        match_status: 'matched',
        matched_at: nowIso,
        basepacks: { id: 'bp-4', name: 'Vim Liquid 475ml', brand: 'Vim', category: 'Dishwash' },
      },
      sparkline: demoSparkline,
    },
    {
      id: 'demo-5',
      flag_type: 'dc_stuck',
      severity: 'critical',
      dh_item_id: 'item-5',
      dh_store_id: null,
      stock_date: stockDate,
      metrics: {
        dc_qty: 480,
        branch_qty: 0,
        total_stock: 480,
        sold_qty_30d: 215,
        sales_trend_30d: demoSparkline,
      },
      title: 'Closeup Diamond Attraction Toothpaste 100g — Stock Stuck at Central DC',
      message: '480 units sit at Central DC while all 16 dark stores are completely dry (215 units sold in trailing 30d).',
      status: 'open',
      first_detected_at: nowIso,
      last_seen_at: nowIso,
      resolved_at: null,
      item: {
        id: 'item-5',
        dh_sku: '551029',
        dh_name: 'Closeup Diamond Attraction Toothpaste 100g',
        basepack_id: null,
        match_status: 'unmatched',
        matched_at: null,
      },
      sparkline: demoSparkline,
    },
  ]

  const storeHealth: StoreHealthRollup[] = [
    { store_id: '1', store_code: 'DC', display_name: 'Distribution Center', is_dc: true, oos_pct: 12, in_stock_pct: 88, zero_count: 34, total_skus: 280, severity: 'normal' },
    { store_id: '2', store_code: 'Lalbagh', display_name: 'Lalbagh', is_dc: false, oos_pct: 46, in_stock_pct: 54, zero_count: 129, total_skus: 280, severity: 'critical' },
    { store_id: '3', store_code: 'Mirpur_02', display_name: 'Mirpur 02', is_dc: false, oos_pct: 32, in_stock_pct: 68, zero_count: 90, total_skus: 280, severity: 'warning' },
    { store_id: '4', store_code: 'Gulshan_1', display_name: 'Gulshan-Banani', is_dc: false, oos_pct: 14, in_stock_pct: 86, zero_count: 39, total_skus: 280, severity: 'normal' },
    { store_id: '5', store_code: 'Dhanmondi', display_name: 'Dhanmondi', is_dc: false, oos_pct: 18, in_stock_pct: 82, zero_count: 50, total_skus: 280, severity: 'normal' },
    { store_id: '6', store_code: 'Uttara', display_name: 'Uttara', is_dc: false, oos_pct: 15, in_stock_pct: 85, zero_count: 42, total_skus: 280, severity: 'normal' },
  ]

  return {
    flags: sampleFlags,
    summary: {
      critical_count: 3,
      warning_count: 1,
      info_count: 1,
      resolved_week_count: 8,
      total_open: 5,
      by_type: {
        sales_decline: 1,
        distribution_imbalance: 1,
        dc_stuck: 1,
        dead_stock: 0,
        stockout_risk: 1,
        store_health: 1,
      },
      store_health: storeHealth,
      is_schema_installed: false,
      stock_date: stockDate,
      sale_date: saleDate,
      stockDate,
      saleDate,
    },
    stockDate,
    saleDate,
  }
}
