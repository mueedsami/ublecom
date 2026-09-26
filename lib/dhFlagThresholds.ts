/**
 * Named constants and thresholds for the Pandamart DH stock & sales flagging system.
 * Kept in one centralized location for easy calibration and tuning (Phase 1).
 */

export const DH_FLAG_THRESHOLDS = {
  // --- a. Stockout Risk ---
  // Top quartile cutoff among SKUs with 30d sales > 0
  STOCKOUT_PERCENTILE_CUTOFF: 0.75,
  // Critical severity if days of cover is below this threshold
  STOCKOUT_COVER_CRITICAL_DAYS: 3,
  // Warning severity if days of cover is below this threshold
  STOCKOUT_COVER_WARNING_DAYS: 7,
  // Warning severity if instock store count is <= half the store network (16 branch stores / 2 = 8)
  STOCKOUT_STORE_COUNT_WARNING: 8,

  // --- b. Distribution Imbalance ---
  // Flagged if instock store count is <= this number of stores
  IMBALANCE_MAX_STORES: 3,
  // And total network stock is >= this number of units
  IMBALANCE_MIN_STOCK: 50,

  // --- c. DC-Stuck Stock ---
  // dc_qty > 0 and branch_qty === 0
  // Warning normally; Critical if sold_qty_30d > 0

  // --- d. Dead Stock ---
  // dc_qty === 0 and branch_qty === 0
  // Info if sold_qty_30d === 0 (delisted/inactive); Critical if sold_qty_30d > 0

  // --- e. Sales Momentum Decline ---
  // Minimum prior-15d volume required to evaluate momentum decline (filters low-volume noise)
  DECLINE_MIN_PRIOR_QTY: 20,
  // Warning severity if percentage drop from prior 15d to recent 15d is >= 40%
  DECLINE_WARNING_DROP_PCT: 40,
  // Critical severity if drop is >= 70%
  DECLINE_CRITICAL_DROP_PCT: 70,
  // Or Critical severity if drop is >= 40% AND stock is healthy (demand fell off despite ample stock)
  DECLINE_HEALTHY_STOCK_BAR: 30,

  // --- f. Store Health Rollup ---
  // Warning severity if store out-of-stock % exceeds 30%
  STORE_OOS_WARNING_PCT: 30,
  // Critical severity if store out-of-stock % exceeds 45%
  STORE_OOS_CRITICAL_PCT: 45,
  // Day-over-day worsening trend: if OOS% increased by > 10 points vs prior detection
  STORE_OOS_TREND_WORSEN_POINTS: 10,
} as const
