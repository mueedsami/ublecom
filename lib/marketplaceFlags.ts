import { demoMode, supabase } from './supabase'
import { getAccountIdByCode, MarketplaceItem } from './marketplaceData'

export type MarketplaceFlagType =
  | 'stockout_risk'
  | 'dead_stock'
  | 'sales_decline'
  | 'price_mismatch'

export type MarketplaceFlagSeverity = 'info' | 'warning' | 'critical'
export type MarketplaceFlagStatus = 'open' | 'acknowledged' | 'resolved'

export interface MarketplaceFlagMetrics {
  current_stock?: number
  sold_qty?: number
  run_rate?: number
  days_of_cover?: number
  stock_value?: number
  mrp?: number
  tp?: number
  basepack_mrp?: number
  basepack_tp?: number
  prior_run_rate?: number
  drop_pct?: number
  [key: string]: any
}

export interface MarketplaceFlag {
  id: string
  account_id: string
  flag_type: MarketplaceFlagType
  severity: MarketplaceFlagSeverity
  item_id: string | null
  report_date: string
  metrics: MarketplaceFlagMetrics
  title: string
  message: string
  status: MarketplaceFlagStatus
  first_detected_at: string
  last_seen_at: string
  resolved_at: string | null
  created_at?: string
  item?: MarketplaceItem | null
}

export interface MarketplaceFlagsSummary {
  critical_count: number
  warning_count: number
  info_count: number
  total_open: number
  resolved_count: number
  dead_stock_value_at_risk: number
  stockout_skus_count: number
  by_type: Record<MarketplaceFlagType, number>
  is_schema_installed: boolean
  report_date: string | null
}

export async function checkMarketplaceFlagsSchemaInstalled(): Promise<boolean> {
  if (demoMode || !supabase) return false
  try {
    const { error } = await supabase
      .from('marketplace_flags')
      .select('id', { head: true, count: 'exact' })
    if (error && (error.code === 'PGRST205' || error.message.includes('relation "public.marketplace_flags" does not exist'))) {
      return false
    }
    return !error
  } catch {
    return false
  }
}

export async function getMarketplaceFlags(
  accountCode: string,
  options?: {
    status?: MarketplaceFlagStatus | 'all'
    severity?: MarketplaceFlagSeverity | 'all'
    type?: MarketplaceFlagType | 'all'
    search?: string
  }
): Promise<{ flags: MarketplaceFlag[]; summary: MarketplaceFlagsSummary }> {
  const isInstalled = await checkMarketplaceFlagsSchemaInstalled()
  if (!isInstalled || !supabase) {
    return getDemoMarketplaceFlags(accountCode, options)
  }

  try {
    const accountId = await getAccountIdByCode(accountCode)
    if (!accountId) return getDemoMarketplaceFlags(accountCode, options)

    let query = supabase
      .from('marketplace_flags')
      .select(`
        id,
        account_id,
        flag_type,
        severity,
        item_id,
        report_date,
        metrics,
        title,
        message,
        status,
        first_detected_at,
        last_seen_at,
        resolved_at,
        created_at,
        marketplace_items (
          id,
          source_product_id,
          sku,
          name,
          vendor_name,
          basepack_id,
          match_status,
          basepacks (
            id,
            name,
            brand,
            category,
            tp,
            mrp
          )
        )
      `)
      .eq('account_id', accountId)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }
    if (options?.severity && options.severity !== 'all') {
      query = query.eq('severity', options.severity)
    }
    if (options?.type && options.type !== 'all') {
      query = query.eq('flag_type', options.type)
    }

    const { data, error } = await query.limit(500)
    if (error) throw error

    const mappedFlags: MarketplaceFlag[] = (data || []).map((row: any) => ({
      id: row.id,
      account_id: row.account_id,
      flag_type: row.flag_type,
      severity: row.severity,
      item_id: row.item_id,
      report_date: row.report_date,
      metrics: row.metrics || {},
      title: row.title,
      message: row.message,
      status: row.status,
      first_detected_at: row.first_detected_at,
      last_seen_at: row.last_seen_at,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      item: row.marketplace_items
        ? {
            id: row.marketplace_items.id,
            account_id: row.account_id,
            source_product_id: row.marketplace_items.source_product_id,
            sku: row.marketplace_items.sku,
            name: row.marketplace_items.name,
            vendor_name: row.marketplace_items.vendor_name,
            basepack_id: row.marketplace_items.basepack_id,
            match_status: row.marketplace_items.match_status,
            matched_at: null,
            basepacks: row.marketplace_items.basepacks || null,
          }
        : null,
    }))

    // Calculate Summary Stats
    const by_type: Record<MarketplaceFlagType, number> = {
      stockout_risk: 0,
      dead_stock: 0,
      sales_decline: 0,
      price_mismatch: 0,
    }

    let critical_count = 0
    let warning_count = 0
    let info_count = 0
    let total_open = 0
    let resolved_count = 0
    let dead_stock_value_at_risk = 0
    let stockout_skus_count = 0
    let latestReportDate: string | null = null

    for (const f of mappedFlags) {
      if (f.status === 'open') {
        total_open++
        if (f.severity === 'critical') critical_count++
        else if (f.severity === 'warning') warning_count++
        else info_count++

        if (by_type[f.flag_type] != null) {
          by_type[f.flag_type]++
        }
        if (f.flag_type === 'dead_stock') {
          dead_stock_value_at_risk += Number(f.metrics?.stock_value || 0)
        }
        if (f.flag_type === 'stockout_risk') {
          stockout_skus_count++
        }
      } else if (f.status === 'resolved') {
        resolved_count++
      }

      if (!latestReportDate || f.report_date > latestReportDate) {
        latestReportDate = f.report_date
      }
    }

    return {
      flags: mappedFlags,
      summary: {
        critical_count,
        warning_count,
        info_count,
        total_open,
        resolved_count,
        dead_stock_value_at_risk,
        stockout_skus_count,
        by_type,
        is_schema_installed: true,
        report_date: latestReportDate,
      },
    }
  } catch (err) {
    console.warn('Failed to load marketplace flags from DB, using demo:', err)
    return getDemoMarketplaceFlags(accountCode, options)
  }
}

export async function updateMarketplaceFlagStatus(
  flagId: string,
  status: MarketplaceFlagStatus
): Promise<void> {
  if (!supabase) return
  const updates: any = {
    status,
    last_seen_at: new Date().toISOString(),
  }
  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString()
  } else {
    updates.resolved_at = null
  }

  const { error } = await supabase.from('marketplace_flags').update(updates).eq('id', flagId)
  if (error) throw error
}

/**
 * Computes automated flags for a given upload snapshot
 */
export async function computeMarketplaceFlags(
  accountId: string,
  uploadId: string
): Promise<Array<Omit<MarketplaceFlag, 'id' | 'created_at' | 'first_detected_at' | 'last_seen_at' | 'resolved_at'>>> {
  if (!supabase) return []

  // 1. Fetch upload info
  const { data: upload } = await supabase
    .from('marketplace_report_uploads')
    .select('id,account_id,period_label,report_date')
    .eq('id', uploadId)
    .single()

  if (!upload) return []

  const reportDate = upload.report_date || new Date().toISOString().slice(0, 10)

  // 2. Fetch stock snapshots + sales periods + item catalog + basepack prices
  const [{ data: stockRows }, { data: salesRows }, { data: items }] = await Promise.all([
    supabase.from('marketplace_stock_snapshots').select('*').eq('upload_id', uploadId),
    supabase.from('marketplace_sales_periods').select('*').eq('upload_id', uploadId),
    supabase.from('marketplace_items').select('id,source_product_id,sku,name,basepack_id,basepacks(id,name,brand,mrp,tp)').eq('account_id', accountId),
  ])

  const itemMap = new Map<string, any>((items || []).map(i => [i.id, i]))
  const salesMap = new Map<string, any>((salesRows || []).map(s => [s.item_id, s]))

  // 3. Fetch prior upload if any to detect sales pace decline
  const { data: priorUploads } = await supabase
    .from('marketplace_report_uploads')
    .select('id')
    .eq('account_id', accountId)
    .neq('id', uploadId)
    .lt('report_date', reportDate)
    .order('report_date', { ascending: false })
    .limit(1)

  const priorUploadId = priorUploads?.[0]?.id
  const priorSalesMap = new Map<string, number>()
  if (priorUploadId) {
    const { data: priorSales } = await supabase
      .from('marketplace_sales_periods')
      .select('item_id,run_rate,sold_qty')
      .eq('upload_id', priorUploadId)
    for (const ps of priorSales || []) {
      priorSalesMap.set(ps.item_id, Number(ps.run_rate || 0))
    }
  }

  const generatedFlags: Array<Omit<MarketplaceFlag, 'id' | 'created_at' | 'first_detected_at' | 'last_seen_at' | 'resolved_at'>> = []

  for (const st of stockRows || []) {
    const item = itemMap.get(st.item_id)
    if (!item) continue

    const sp = salesMap.get(st.item_id) || { sold_qty: 0, run_rate: 0 }
    const currentStock = Number(st.current_stock || 0)
    const soldQty = Number(sp.sold_qty || 0)
    const runRate = Number(sp.run_rate || (soldQty > 0 ? soldQty / 30 : 0))
    const stockValue = Number(st.stock_value || (currentStock * Number(st.tp || st.mrp || 0)))
    const daysOfCover = runRate > 0 ? Math.round(currentStock / runRate) : null

    // FLAG 1: Complete Stockout (Sold > 0, Stock == 0)
    if (currentStock === 0 && soldQty > 0) {
      generatedFlags.push({
        account_id: accountId,
        flag_type: 'stockout_risk',
        severity: 'critical',
        item_id: st.item_id,
        report_date: reportDate,
        metrics: {
          current_stock: 0,
          sold_qty: soldQty,
          run_rate: runRate,
          days_of_cover: 0,
          stock_value: 0,
        },
        title: `Out of Stock: ${item.name}`,
        message: `Product is completely stock out on Othoba with 0 units remaining, despite selling ${soldQty} units in this period (daily run rate: ${runRate.toFixed(2)} units/day). Immediate replenishment required.`,
        status: 'open',
      })
    }
    // FLAG 1B: Severe Stockout Risk (Days of cover <= 3 days)
    else if (runRate > 0 && daysOfCover !== null && daysOfCover <= 3) {
      generatedFlags.push({
        account_id: accountId,
        flag_type: 'stockout_risk',
        severity: 'critical',
        item_id: st.item_id,
        report_date: reportDate,
        metrics: {
          current_stock: currentStock,
          sold_qty: soldQty,
          run_rate: runRate,
          days_of_cover: daysOfCover,
          stock_value: stockValue,
        },
        title: `Imminent Stockout Risk: ${item.name}`,
        message: `Only ${currentStock} units in stock with ${daysOfCover} day(s) of cover remaining at current run rate of ${runRate.toFixed(2)} units/day.`,
        status: 'open',
      })
    }
    // FLAG 1C: Stockout Warning (Days of cover <= 7 days)
    else if (runRate > 0 && daysOfCover !== null && daysOfCover <= 7) {
      generatedFlags.push({
        account_id: accountId,
        flag_type: 'stockout_risk',
        severity: 'warning',
        item_id: st.item_id,
        report_date: reportDate,
        metrics: {
          current_stock: currentStock,
          sold_qty: soldQty,
          run_rate: runRate,
          days_of_cover: daysOfCover,
          stock_value: stockValue,
        },
        title: `Low Stock Warning: ${item.name}`,
        message: `Inventory buffer low (${daysOfCover} days of cover). ${currentStock} units in stock.`,
        status: 'open',
      })
    }

    // FLAG 2: Dead Stock (Stock > 0, Sold == 0)
    if (currentStock >= 50 && soldQty === 0) {
      generatedFlags.push({
        account_id: accountId,
        flag_type: 'dead_stock',
        severity: 'critical',
        item_id: st.item_id,
        report_date: reportDate,
        metrics: {
          current_stock: currentStock,
          sold_qty: 0,
          stock_value: stockValue,
        },
        title: `Heavy Dead Stock: ${item.name}`,
        message: `${currentStock} units sitting idle on the shelf with zero sales this period. Capital at risk: ৳${Math.round(stockValue).toLocaleString()}. Review price competitiveness or visibility on storefront.`,
        status: 'open',
      })
    } else if (currentStock >= 10 && soldQty === 0) {
      generatedFlags.push({
        account_id: accountId,
        flag_type: 'dead_stock',
        severity: 'warning',
        item_id: st.item_id,
        report_date: reportDate,
        metrics: {
          current_stock: currentStock,
          sold_qty: 0,
          stock_value: stockValue,
        },
        title: `Dormant Stock: ${item.name}`,
        message: `${currentStock} units in stock with 0 units sold in reporting period. Stock value: ৳${Math.round(stockValue).toLocaleString()}.`,
        status: 'open',
      })
    }

    // FLAG 3: Sales Pace Decline vs Prior Upload
    if (priorSalesMap.has(st.item_id)) {
      const priorRate = priorSalesMap.get(st.item_id)!
      if (priorRate >= 1.0 && runRate < priorRate * 0.4) {
        const dropPct = Math.round(((priorRate - runRate) / priorRate) * 100)
        generatedFlags.push({
          account_id: accountId,
          flag_type: 'sales_decline',
          severity: dropPct >= 70 ? 'critical' : 'warning',
          item_id: st.item_id,
          report_date: reportDate,
          metrics: {
            current_stock: currentStock,
            sold_qty: soldQty,
            run_rate: runRate,
            prior_run_rate: priorRate,
            drop_pct: dropPct,
          },
          title: `Sales Velocity Drop (-${dropPct}%): ${item.name}`,
          message: `Daily sales velocity collapsed from ${priorRate.toFixed(2)} to ${runRate.toFixed(2)} units/day (${dropPct}% drop) compared to previous upload period.`,
          status: 'open',
        })
      }
    }

    // FLAG 4: Price Mismatch against Master Catalog Basepack
    if (item.basepack_id && item.basepacks) {
      const bp = item.basepacks
      const currentTp = Number(st.tp || 0)
      const basepackTp = Number(bp.tp || 0)
      if (currentTp > 0 && basepackTp > 0 && Math.abs(currentTp - basepackTp) / basepackTp > 0.08) {
        generatedFlags.push({
          account_id: accountId,
          flag_type: 'price_mismatch',
          severity: 'info',
          item_id: st.item_id,
          report_date: reportDate,
          metrics: {
            current_stock: currentStock,
            tp: currentTp,
            basepack_tp: basepackTp,
            mrp: Number(st.mrp || 0),
            basepack_mrp: Number(bp.mrp || 0),
          },
          title: `Selling Price Variance: ${item.name}`,
          message: `Marketplace TP is ৳${currentTp}, differing from master catalog basepack TP of ৳${basepackTp}.`,
          status: 'open',
        })
      }
    }
  }

  return generatedFlags
}

/**
 * Persists computed flags using upsert pattern (refreshes open flags, reopens if needed)
 */
export async function persistMarketplaceFlags(
  accountId: string,
  flags: Array<Omit<MarketplaceFlag, 'id' | 'created_at' | 'first_detected_at' | 'last_seen_at' | 'resolved_at'>>
): Promise<number> {
  if (!supabase || flags.length === 0) return 0

  let insertedOrUpdated = 0
  const nowIso = new Date().toISOString()

  for (const f of flags) {
    // Check if open flag already exists
    const { data: existing } = await supabase
      .from('marketplace_flags')
      .select('id,metrics')
      .eq('account_id', accountId)
      .eq('flag_type', f.flag_type)
      .eq('item_id', f.item_id)
      .eq('status', 'open')
      .maybeSingle()

    if (existing) {
      // Update existing open flag
      await supabase
        .from('marketplace_flags')
        .update({
          severity: f.severity,
          report_date: f.report_date,
          metrics: f.metrics,
          title: f.title,
          message: f.message,
          last_seen_at: nowIso,
        })
        .eq('id', existing.id)
      insertedOrUpdated++
    } else {
      // Insert new open flag
      await supabase.from('marketplace_flags').insert({
        account_id: accountId,
        flag_type: f.flag_type,
        severity: f.severity,
        item_id: f.item_id,
        report_date: f.report_date,
        metrics: f.metrics,
        title: f.title,
        message: f.message,
        status: 'open',
        first_detected_at: nowIso,
        last_seen_at: nowIso,
      })
      insertedOrUpdated++
    }
  }

  return insertedOrUpdated
}

export async function generateMarketplaceFlagsPass(accountCode: string): Promise<number> {
  if (!supabase) return 0
  const accountId = await getAccountIdByCode(accountCode)
  if (!accountId) return 0

  // Get latest upload
  const { data: upload } = await supabase
    .from('marketplace_report_uploads')
    .select('id')
    .eq('account_id', accountId)
    .order('report_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!upload) return 0

  const flags = await computeMarketplaceFlags(accountId, upload.id)
  return await persistMarketplaceFlags(accountId, flags)
}

// -------------------------------------------------------------
// Demo Fallback Flags (High Fidelity Real-World Scenarios)
// -------------------------------------------------------------

function getDemoMarketplaceFlags(
  accountCode: string,
  options?: {
    status?: MarketplaceFlagStatus | 'all'
    severity?: MarketplaceFlagSeverity | 'all'
    type?: MarketplaceFlagType | 'all'
  }
): { flags: MarketplaceFlag[]; summary: MarketplaceFlagsSummary } {
  const flags: MarketplaceFlag[] = [
    {
      id: 'demo-flag-1',
      account_id: 'othoba',
      flag_type: 'stockout_risk',
      severity: 'critical',
      item_id: 'demo-6',
      report_date: '2026-09-21',
      metrics: { current_stock: 0, sold_qty: 95, run_rate: 3.16, days_of_cover: 0 },
      title: 'Complete Stockout: Sunsilk Shampoo Silky Smooth 170ml',
      message: 'Zero stock units left on Othoba Unilever Flagship Store despite 95 units sold this month. Estimated lost sales: ৳4,800/week.',
      status: 'open',
      first_detected_at: '2026-09-18T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-6',
        account_id: 'othoba',
        source_product_id: '1057091',
        sku: 'UNFS1057091',
        name: 'Sunsilk Shampoo Silky Smooth 170ml',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: null,
        match_status: 'unmatched',
        matched_at: null,
        current_stock: 0,
        sold_qty: 95,
      },
    },
    {
      id: 'demo-flag-2',
      account_id: 'othoba',
      flag_type: 'stockout_risk',
      severity: 'critical',
      item_id: 'demo-5',
      report_date: '2026-09-21',
      metrics: { current_stock: 4, sold_qty: 180, run_rate: 6.0, days_of_cover: 1 },
      title: 'Imminent Stockout Risk: Sunsilk Shampoo Silky Smooth 340ml',
      message: 'Only 4 units left in inventory with 1 day of cover at current run rate of 6.0 units/day. High volume hero SKU.',
      status: 'open',
      first_detected_at: '2026-09-19T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-5',
        account_id: 'othoba',
        source_product_id: '1057092',
        sku: 'UNFS1057092',
        name: 'Sunsilk Shampoo Silky Smooth 340ml',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: null,
        match_status: 'unmatched',
        matched_at: null,
        current_stock: 4,
        sold_qty: 180,
      },
    },
    {
      id: 'demo-flag-3',
      account_id: 'othoba',
      flag_type: 'stockout_risk',
      severity: 'warning',
      item_id: 'demo-4',
      report_date: '2026-09-21',
      metrics: { current_stock: 12, sold_qty: 210, run_rate: 7.0, days_of_cover: 2 },
      title: 'Low Buffer Warning: Vim Dishwashing Liquid 950ml (Wooden Spoon Free)',
      message: 'Current stock of 12 units will deplete in approximately 2 days at current demand run rate.',
      status: 'open',
      first_detected_at: '2026-09-20T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-4',
        account_id: 'othoba',
        source_product_id: '1011851',
        sku: 'UNFS1011851',
        name: 'Vim Dishwashing Liquid 950ml (Wooden Spoon Free)',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: 'bp-4',
        match_status: 'matched',
        matched_at: '2026-09-01T10:00:00Z',
        current_stock: 12,
        sold_qty: 210,
      },
    },
    {
      id: 'demo-flag-4',
      account_id: 'othoba',
      flag_type: 'dead_stock',
      severity: 'critical',
      item_id: 'demo-7',
      report_date: '2026-09-21',
      metrics: { current_stock: 140, sold_qty: 0, stock_value: 51130 },
      title: 'Dead Stock: Buy 2 Surf Excel Liquid Top Load 500ml Free Clothing Organizer',
      message: '140 promo units sitting in warehouse with 0 sales for September. ৳51,130 tied in inventory. Requires storefront banner or flash deal.',
      status: 'open',
      first_detected_at: '2026-09-10T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-7',
        account_id: 'othoba',
        source_product_id: '1069473',
        sku: 'UNFS1069473',
        name: 'Buy 2 Surf Excel Liquid Detergent Top Load 500ml Free Clothing Organizer',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: null,
        match_status: 'unmatched',
        matched_at: null,
        current_stock: 140,
        sold_qty: 0,
      },
    },
    {
      id: 'demo-flag-5',
      account_id: 'othoba',
      flag_type: 'dead_stock',
      severity: 'warning',
      item_id: 'demo-3',
      report_date: '2026-09-21',
      metrics: { current_stock: 372, sold_qty: 12, run_rate: 0.4, days_of_cover: 930, stock_value: 77376 },
      title: 'Slow Mover / Excessive Cover: Pepsodent Sensitive Expert Gum Expert 140g',
      message: 'Over 2.5 years of inventory (930 days of cover) sitting at current velocity (0.4 units/day). Stock value: ৳77,376.',
      status: 'open',
      first_detected_at: '2026-09-12T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-3',
        account_id: 'othoba',
        source_product_id: '1070020',
        sku: 'UNFS1070020',
        name: 'Pepsodent Sensitive Expert Gum Expert 140g',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: 'bp-3',
        match_status: 'matched',
        matched_at: '2026-09-02T11:00:00Z',
        current_stock: 372,
        sold_qty: 12,
      },
    },
    {
      id: 'demo-flag-6',
      account_id: 'othoba',
      flag_type: 'sales_decline',
      severity: 'warning',
      item_id: 'demo-9',
      report_date: '2026-09-21',
      metrics: { current_stock: 15, sold_qty: 110, run_rate: 3.66, prior_run_rate: 7.2, drop_pct: 49 },
      title: 'Sales Velocity Drop (-49%): Tresemme Shampoo Keratin Smooth 580ml',
      message: 'Run rate dropped from 7.2 to 3.66 units/day vs August. Check search ranking and competitor pricing.',
      status: 'open',
      first_detected_at: '2026-09-15T10:00:00Z',
      last_seen_at: '2026-09-21T08:00:00Z',
      resolved_at: null,
      item: {
        id: 'demo-9',
        account_id: 'othoba',
        source_product_id: '1048820',
        sku: 'UNFS1048820',
        name: 'Tresemme Shampoo Keratin Smooth 580ml',
        vendor_name: 'Unilever Flagship Store',
        basepack_id: 'bp-9',
        match_status: 'matched',
        matched_at: '2026-09-01T10:00:00Z',
        current_stock: 15,
        sold_qty: 110,
      },
    },
  ]

  let filtered = [...flags]
  if (options?.status && options.status !== 'all') {
    filtered = filtered.filter(f => f.status === options.status)
  }
  if (options?.severity && options.severity !== 'all') {
    filtered = filtered.filter(f => f.severity === options.severity)
  }
  if (options?.type && options.type !== 'all') {
    filtered = filtered.filter(f => f.flag_type === options.type)
  }

  return {
    flags: filtered,
    summary: {
      critical_count: 3,
      warning_count: 3,
      info_count: 0,
      total_open: 6,
      resolved_count: 14,
      dead_stock_value_at_risk: 128506,
      stockout_skus_count: 3,
      by_type: {
        stockout_risk: 3,
        dead_stock: 2,
        sales_decline: 1,
        price_mismatch: 0,
      },
      is_schema_installed: false,
      report_date: '2026-09-21',
    },
  }
}
