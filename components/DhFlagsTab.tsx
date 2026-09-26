'use client'
import React, { useState, useMemo } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  TrendingDown,
  Boxes,
  Layers,
  PackageX,
  Building2,
  RefreshCw,
  Search,
  Check,
  Tag,
  ArrowDownRight,
  Filter,
  CheckCheck,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import { DhFlag, DhFlagsSummary, DhFlagSeverity, DhFlagType, DhFlagStatus } from '@/lib/dhFlags'
import FlagsDownloadMenu from './dh/FlagsDownloadMenu'

interface DhFlagsTabProps {
  flags: DhFlag[]
  summary: DhFlagsSummary
  loading: boolean
  onRefresh: () => Promise<void>
  onUpdateStatus: (flagId: string, newStatus: DhFlagStatus) => Promise<void>
}

const TYPE_CONFIG: Record<
  DhFlagType,
  { label: string; icon: React.ComponentType<any>; color: string; bg: string }
> = {
  sales_decline: {
    label: 'Sales Decline',
    icon: TrendingDown,
    color: '#ff6673',
    bg: 'rgba(255, 102, 115, 0.15)',
  },
  stockout_risk: {
    label: 'Stockout Risk',
    icon: ArrowDownRight,
    color: '#ffbf4b',
    bg: 'rgba(255, 191, 75, 0.15)',
  },
  distribution_imbalance: {
    label: 'Distribution Imbalance',
    icon: Boxes,
    color: '#ff9f43',
    bg: 'rgba(255, 159, 67, 0.15)',
  },
  dc_stuck: {
    label: 'DC-Stuck Stock',
    icon: Layers,
    color: '#2f7dff',
    bg: 'rgba(47, 125, 255, 0.15)',
  },
  dead_stock: {
    label: 'Dead Stock',
    icon: PackageX,
    color: '#93a4c3',
    bg: 'rgba(147, 164, 195, 0.15)',
  },
  store_health: {
    label: 'Store Health',
    icon: Building2,
    color: '#e056fd',
    bg: 'rgba(224, 86, 253, 0.15)',
  },
}

export default function DhFlagsTab({
  flags,
  summary,
  loading,
  onRefresh,
  onUpdateStatus,
}: DhFlagsTabProps) {
  const [severityFilter, setSeverityFilter] = useState<DhFlagSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<DhFlagType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<DhFlagStatus | 'all'>('open')
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [storeViewMode, setStoreViewMode] = useState<'compact' | 'expanded'>('compact')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  async function handleRefreshClick() {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleStatusAction(flagId: string, status: DhFlagStatus) {
    setActionLoadingId(flagId)
    try {
      await onUpdateStatus(flagId, status)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Sort store health worst-first (§3): lowest in_stock_pct first
  const sortedStoreHealth = useMemo(() => {
    return [...summary.store_health].sort((a, b) => a.in_stock_pct - b.in_stock_pct)
  }, [summary.store_health])

  // Filtered flags
  const filteredFlags = useMemo(() => {
    let result = flags

    if (severityFilter !== 'all') {
      result = result.filter(f => f.severity === severityFilter)
    }
    if (typeFilter !== 'all') {
      result = result.filter(f => f.flag_type === typeFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter)
    }
    if (selectedStore) {
      result = result.filter(
        f =>
          f.dh_store_id === selectedStore ||
          f.store?.store_code === selectedStore ||
          f.store?.display_name === selectedStore
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        f =>
          f.title.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q) ||
          f.item?.dh_name.toLowerCase().includes(q) ||
          f.item?.dh_sku.toLowerCase().includes(q) ||
          f.item?.basepacks?.name.toLowerCase().includes(q) ||
          f.store?.display_name.toLowerCase().includes(q)
      )
    }

    return result
  }, [flags, severityFilter, typeFilter, statusFilter, selectedStore, searchQuery])

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. SEVERITY KPI COUNTERS */}
      <div className="dh-flag-kpi-grid">
        {/* Critical Card */}
        <div
          className={`card dh-flag-kpi-card ${severityFilter === 'critical' ? 'selected' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--red)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="kpi-label">Critical Action Required</div>
            <div className="dh-flag-icon-badge red">
              <AlertTriangle size={18} color="var(--red)" />
            </div>
          </div>
          <div className="kpi-value text-red">{summary.critical_count}</div>
          <div className="kpi-delta text-red" style={{ fontWeight: 600 }}>
            {summary.critical_count > 0 ? 'Urgent supply & price risk' : 'No critical alerts'}
          </div>
        </div>

        {/* Warning Card */}
        <div
          className={`card dh-flag-kpi-card ${severityFilter === 'warning' ? 'selected' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--amber)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="kpi-label">Warning Attention</div>
            <div className="dh-flag-icon-badge amber">
              <AlertCircle size={18} color="var(--amber)" />
            </div>
          </div>
          <div className="kpi-value text-amber">{summary.warning_count}</div>
          <div className="kpi-delta text-amber" style={{ fontWeight: 600 }}>
            Imbalance &amp; thin coverage
          </div>
        </div>

        {/* Info Card */}
        <div
          className={`card dh-flag-kpi-card ${severityFilter === 'info' ? 'selected' : ''}`}
          onClick={() => setSeverityFilter(severityFilter === 'info' ? 'all' : 'info')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--blue)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="kpi-label">Catalog / Info</div>
            <div className="dh-flag-icon-badge blue">
              <Info size={18} color="var(--blue)" />
            </div>
          </div>
          <div className="kpi-value text-blue">{summary.info_count}</div>
          <div className="kpi-delta" style={{ color: 'var(--muted)' }}>
            Inactive or delisted items
          </div>
        </div>

        {/* Resolved Card */}
        <div
          className={`card dh-flag-kpi-card ${statusFilter === 'resolved' ? 'selected' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'open' : 'resolved')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--green)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="kpi-label">Resolved This Week</div>
            <div className="dh-flag-icon-badge green">
              <CheckCircle2 size={18} color="var(--green)" />
            </div>
          </div>
          <div className="kpi-value text-green">{summary.resolved_week_count}</div>
          <div className="kpi-delta text-green" style={{ fontWeight: 600 }}>
            Closed or healed on restock
          </div>
        </div>
      </div>

      {/* 2. FLAG TYPE BREAKDOWN & FILTER CHIPS (§1) */}
      <div className="dh-flag-breakdown-row">
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800 }}>Flag Types Distribution</h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Filter operational flags by root cause category
              </span>
            </div>
            {typeFilter !== 'all' && (
              <button
                className="secondary-btn"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() => setTypeFilter('all')}
              >
                Clear Type Filter
              </button>
            )}
          </div>

          <div className="dh-flag-types-grid">
            {(Object.keys(TYPE_CONFIG) as DhFlagType[]).map((typeKey) => {
              const cfg = TYPE_CONFIG[typeKey]
              const Icon = cfg.icon
              const count = summary.by_type[typeKey] || 0
              const isSelected = typeFilter === typeKey

              return (
                <button
                  key={typeKey}
                  className={`dh-flag-type-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => setTypeFilter(isSelected ? 'all' : typeKey)}
                >
                  <div className="dh-flag-type-pill-icon" style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon size={14} />
                  </div>
                  <div className="dh-flag-type-pill-body">
                    <span className="type-title">{cfg.label}</span>
                    <b className="type-count" style={{ color: count > 0 ? cfg.color : 'var(--muted)' }}>
                      {count}
                    </b>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3. STORE HEALTH STRIP: WORST-FIRST SORTED, COMPACT HEAT-STRIP BY DEFAULT (§3) */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800 }}>Store Health &amp; In-Stock Depth</h3>
              <span className="count-pill">Sorted Worst-First</span>
              {selectedStore && (
                <span className="count-pill" style={{ background: 'rgba(50,209,195,0.15)', color: 'var(--teal)' }}>
                  Filtered: {selectedStore}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Fuller bar = healthier in-stock depth (Green &ge;85% · Amber 70–84% · Red &lt;70%)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedStore && (
              <button
                className="secondary-btn"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() => setSelectedStore(null)}
              >
                Clear Store Filter
              </button>
            )}
            <button
              className="secondary-btn"
              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setStoreViewMode(m => m === 'compact' ? 'expanded' : 'compact')}
            >
              {storeViewMode === 'compact' ? (
                <>Show all 17 store cards <ChevronDown size={13} /></>
              ) : (
                <>Compact heat-strip <ChevronUp size={13} /></>
              )}
            </button>
          </div>
        </div>

        {/* Compact Heat-Strip View (Default - §3) */}
        {storeViewMode === 'compact' ? (
          <div className="dh-store-heatstrip">
            {sortedStoreHealth.map((store) => {
              const isSelected = selectedStore === store.store_id || selectedStore === store.store_code
              const inStock = store.in_stock_pct
              const tone = inStock < 70 ? 'critical' : inStock < 85 ? 'warning' : 'normal'

              return (
                <button
                  key={store.store_id}
                  className={`dh-heatstrip-pill ${tone} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedStore(isSelected ? null : store.store_code)}
                  title={`${store.display_name}: ${inStock}% instock (${store.oos_pct}% OOS) · ${store.zero_count} of ${store.total_skus} SKUs dry. Click to filter flags.`}
                >
                  <span className={`dh-heatstrip-dot ${tone}`} />
                  <span className="dh-heatstrip-name">
                    {store.display_name.replace('Chittagong_', 'CTG-').replace('Sylhet_', 'SYL-')}
                    {store.is_dc ? ' (DC)' : ''}
                  </span>
                  <b className={`dh-heatstrip-pct ${tone}`}>{inStock}%</b>
                </button>
              )
            })}
          </div>
        ) : (
          /* Full Gauge Cards View (Expanded on demand - §3) */
          <div className="gauge-grid">
            {sortedStoreHealth.map((store) => {
              const isSelected = selectedStore === store.store_id || selectedStore === store.store_code
              const inStock = store.in_stock_pct
              const oos = store.oos_pct

              let barColor = 'linear-gradient(90deg, #32d1c3, #44d17a)'
              let toneClass = 'green'
              if (inStock < 70) {
                barColor = 'linear-gradient(90deg, #ff6673, #ff4757)'
                toneClass = 'red'
              } else if (inStock < 85) {
                barColor = 'linear-gradient(90deg, #ffbf4b, #ffa502)'
                toneClass = 'amber'
              }

              return (
                <div
                  key={store.store_id}
                  className={`gauge dh-store-health-gauge ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedStore(isSelected ? null : store.store_code)}
                  style={{ cursor: 'pointer' }}
                  title={`${store.display_name}: ${inStock}% instock (${oos}% OOS) · ${store.zero_count} dry SKUs. Click to filter flags.`}
                >
                  <div className="gauge-top">
                    <span style={{ fontWeight: 700, fontSize: 12 }}>
                      {store.display_name} {store.is_dc ? '🏛️' : ''}
                    </span>
                    <b className={toneClass}>{inStock}% instock</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.max(0, Math.min(100, inStock))}%`, background: barColor }} />
                  </div>
                  <div className="kpi-delta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {store.store_code}
                    </span>
                    <span style={{ color: store.zero_count > 50 ? 'var(--red)' : 'var(--muted)' }}>
                      {store.zero_count} SKUs dry
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. FILTER BAR: SEARCH FULL WIDTH, CLEAR SEGMENTED CONTROLS, ACTIONS ON RIGHT (§7) */}
      <div className="card dh-filter-panel" style={{ padding: 16 }}>
        {/* Full-width Search on its own line */}
        <div className="dh-filter-search-row">
          <div className="dh-matrix-search" style={{ width: '100%' }}>
            <input
              type="search"
              placeholder="Search flags by SKU, product name, basepack, or store code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={15} className="dh-matrix-search-icon" />
          </div>
        </div>

        {/* Filter Controls Row: Labeled Segmented Controls + Actions */}
        <div className="dh-filter-controls-row">
          <div className="dh-filter-groups">
            {/* Severity Group */}
            <div className="dh-filter-group">
              <span className="dh-filter-group-label">Severity:</span>
              <div className="mini-tabs">
                <button
                  className={severityFilter === 'all' ? 'active' : ''}
                  onClick={() => setSeverityFilter('all')}
                >
                  All
                </button>
                <button
                  className={severityFilter === 'critical' ? 'active' : ''}
                  onClick={() => setSeverityFilter('critical')}
                  style={{ color: severityFilter === 'critical' ? 'white' : 'var(--red)' }}
                >
                  Critical ({summary.critical_count})
                </button>
                <button
                  className={severityFilter === 'warning' ? 'active' : ''}
                  onClick={() => setSeverityFilter('warning')}
                  style={{ color: severityFilter === 'warning' ? 'white' : 'var(--amber)' }}
                >
                  Warning ({summary.warning_count})
                </button>
                <button
                  className={severityFilter === 'info' ? 'active' : ''}
                  onClick={() => setSeverityFilter('info')}
                >
                  Info ({summary.info_count})
                </button>
              </div>
            </div>

            <div className="dh-filter-divider" />

            {/* Status Group */}
            <div className="dh-filter-group">
              <span className="dh-filter-group-label">Status:</span>
              <div className="mini-tabs">
                <button
                  className={statusFilter === 'open' ? 'active' : ''}
                  onClick={() => setStatusFilter('open')}
                >
                  Open
                </button>
                <button
                  className={statusFilter === 'acknowledged' ? 'active' : ''}
                  onClick={() => setStatusFilter('acknowledged')}
                >
                  Acknowledged
                </button>
                <button
                  className={statusFilter === 'resolved' ? 'active' : ''}
                  onClick={() => setStatusFilter('resolved')}
                >
                  Resolved
                </button>
                <button
                  className={statusFilter === 'all' ? 'active' : ''}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
              </div>
            </div>
          </div>

          {/* Right-aligned Actions */}
          <div className="dh-filter-actions">
            {(severityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'open' || selectedStore || searchQuery) && (
              <button
                className="ghost-btn"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => {
                  setSeverityFilter('all')
                  setTypeFilter('all')
                  setStatusFilter('open')
                  setSelectedStore(null)
                  setSearchQuery('')
                }}
              >
                Reset all filters
              </button>
            )}

            <div className="dh-filter-divider" />

            <FlagsDownloadMenu
              severity={severityFilter}
              flagType={typeFilter}
              status={statusFilter}
              store={selectedStore}
              searchQuery={searchQuery}
              totalCount={filteredFlags.length}
            />

            <button
              className="secondary-btn"
              onClick={handleRefreshClick}
              disabled={isRefreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              {isRefreshing ? 'Re-scanning...' : 'Re-scan Flags'}
            </button>
          </div>
        </div>

        {/* Results Counter Subtitle */}
        <div className="dh-filter-status-row">
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            Showing <b>{filteredFlags.length}</b> flag{filteredFlags.length === 1 ? '' : 's'}
            {selectedStore && ` · Store: ${selectedStore}`}
            {typeFilter !== 'all' && ` · ${TYPE_CONFIG[typeFilter]?.label}`}
          </span>
        </div>
      </div>

      {/* 5. THE FLAGS TABLE (§4, §5, §6) */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="dh-flag-table">
            <thead>
              <tr>
                <th style={{ width: 175 }}>Severity &amp; Type</th>
                <th style={{ minWidth: 240 }}>DH Product / Location</th>
                <th style={{ minWidth: 320 }}>Key Diagnostic Metrics</th>
                <th style={{ width: 115, textAlign: 'center' }}>Velocity Trend</th>
                <th style={{ width: 95 }}>Status</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                    <CheckCircle2 size={32} color="var(--green)" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <b style={{ fontSize: 14, color: 'var(--text)' }}>No matching flags found</b>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                      All items in this slice meet health standards or the active filter narrowed all rows out.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFlags.map((flag) => {
                  const typeCfg = TYPE_CONFIG[flag.flag_type] || {
                    label: flag.flag_type,
                    icon: AlertCircle,
                    color: '#93a4c3',
                    bg: 'rgba(255,255,255,0.1)',
                  }
                  const TypeIcon = typeCfg.icon
                  const isItem = !!flag.item
                  const isStore = !!flag.store
                  const isUnmatched = flag.item && flag.item.match_status === 'unmatched'
                  const isExpanded = expandedRowId === flag.id

                  return (
                    <React.Fragment key={flag.id}>
                      <tr
                        className={`dh-flag-table-row ${flag.severity === 'critical' ? 'row-critical' : ''}`}
                      >
                        {/* 1. Merged Severity + Type Badge (§5) */}
                        <td>
                          <div
                            className="dh-merged-badge-wrap"
                            title={flag.message}
                            onClick={() => setExpandedRowId(isExpanded ? null : flag.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={`dh-merged-flag-badge ${flag.severity}`}>
                              <TypeIcon size={12} />
                              <span className="dh-badge-sev">{flag.severity}</span>
                              <span className="dh-badge-dot">·</span>
                              <span className="dh-badge-type">{typeCfg.label}</span>
                            </span>
                          </div>
                        </td>

                        {/* 2. Product / Target 2-Line Cell (§5) */}
                        <td style={{ minWidth: 230, maxWidth: 360 }}>
                          <div className="dh-product-cell">
                            {isItem ? (
                              <>
                                <div className="dh-product-name" title={flag.item?.dh_name}>
                                  {flag.item?.dh_name}
                                </div>
                                <div className="dh-product-meta">
                                  <code className="dh-sku-mono">{flag.item?.dh_sku}</code>
                                  <span className="dh-meta-sep">·</span>
                                  {flag.item?.basepacks?.name ? (
                                    <span className="dh-basepack-mapped" title="Mapped Master Basepack">
                                      ↳ {flag.item.basepacks.name}
                                    </span>
                                  ) : (
                                    <span className="dh-unmatched-text" title="Needs basepack mapping">
                                      Unmatched DH SKU
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : isStore ? (
                              <>
                                <div className="dh-product-name">
                                  {flag.store?.display_name} {flag.store?.is_dc ? '(Central DC)' : 'Dark Store'}
                                </div>
                                <div className="dh-product-meta">
                                  <code className="dh-sku-mono">{flag.store?.store_code}</code>
                                </div>
                              </>
                            ) : (
                              <div className="dh-product-name">{flag.title}</div>
                            )}
                          </div>
                        </td>

                        {/* 3. Aligned Plain Diagnostic Metrics (§4) */}
                        <td>
                          <div
                            className="dh-metrics-aligned-grid"
                            title={flag.message}
                            onClick={() => setExpandedRowId(isExpanded ? null : flag.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Cover Days */}
                            <div className="dh-metric-col">
                              <span className="dh-col-lbl">Cover</span>
                              <span
                                className={`dh-col-val ${
                                  flag.metrics.days_of_cover !== undefined
                                    ? flag.metrics.days_of_cover < 3
                                      ? 'text-red'
                                      : flag.metrics.days_of_cover < 7
                                      ? 'text-amber'
                                      : ''
                                    : 'text-muted'
                                }`}
                              >
                                {flag.metrics.days_of_cover !== undefined
                                  ? `${flag.metrics.days_of_cover}d`
                                  : '—'}
                              </span>
                            </div>

                            {/* 30d Velocity / Drop */}
                            <div className="dh-metric-col">
                              <span className="dh-col-lbl">30d Sold</span>
                              <span
                                className={`dh-col-val ${
                                  flag.metrics.drop_pct !== undefined ? 'text-red' : ''
                                }`}
                              >
                                {flag.metrics.drop_pct !== undefined
                                  ? `-${flag.metrics.drop_pct}%`
                                  : flag.metrics.sold_qty_30d !== undefined
                                  ? `${flag.metrics.sold_qty_30d.toLocaleString()}`
                                  : '—'}
                              </span>
                            </div>

                            {/* Total Stock (with DC note) */}
                            <div className="dh-metric-col">
                              <span className="dh-col-lbl">Network Stock</span>
                              <span className="dh-col-val">
                                {flag.metrics.total_stock !== undefined
                                  ? flag.metrics.total_stock.toLocaleString()
                                  : '—'}
                              </span>
                              {flag.metrics.dc_qty !== undefined && flag.metrics.dc_qty > 0 && (
                                <span className="dh-col-sub" title="Central DC stock">
                                  DC: {flag.metrics.dc_qty.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {/* Store Reach / OOS Rate */}
                            <div className="dh-metric-col">
                              <span className="dh-col-lbl">Presence</span>
                              <span
                                className={`dh-col-val ${
                                  flag.metrics.oos_pct !== undefined && flag.metrics.oos_pct > 30 ? 'text-red' : ''
                                }`}
                              >
                                {flag.metrics.store_count_instock !== undefined
                                  ? `${flag.metrics.store_count_instock}/16 stores`
                                  : flag.metrics.oos_pct !== undefined
                                  ? `${flag.metrics.oos_pct}% OOS`
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Selective Sparkline or Static Icon (§6) */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {flag.flag_type === 'sales_decline' || flag.flag_type === 'stockout_risk' ? (
                            flag.sparkline && flag.sparkline.length > 0 ? (
                              <div style={{ width: 110, height: 36, margin: '0 auto' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={flag.sparkline}>
                                    <Tooltip
                                      contentStyle={{
                                        background: '#111a2d',
                                        border: '1px solid #26334f',
                                        borderRadius: 6,
                                        fontSize: 10,
                                        padding: '4px 8px',
                                      }}
                                      formatter={(v: any) => [`${v} sold`, 'Units']}
                                      labelFormatter={(l) => `Date: ${l}`}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="sold_qty"
                                      stroke={flag.flag_type === 'sales_decline' ? '#ff6673' : '#ffbf4b'}
                                      strokeWidth={2}
                                      dot={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                                <span style={{ fontSize: 9, color: 'var(--muted)', display: 'block' }}>30d velocity</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                            )
                          ) : (
                            /* Small static context icon explaining why there is no chart (§6) */
                            <div
                              className="dh-no-sparkline-indicator"
                              title={
                                flag.flag_type === 'distribution_imbalance'
                                  ? 'Store-to-store inventory distribution disparity'
                                  : flag.flag_type === 'dc_stuck'
                                  ? 'Excess stock centralized at DC'
                                  : flag.flag_type === 'dead_stock'
                                  ? 'Zero movement across 30 days'
                                  : 'Store-level out of stock rate'
                              }
                            >
                              {flag.flag_type === 'distribution_imbalance' && <MapPin size={15} color="#ff9f43" />}
                              {flag.flag_type === 'dc_stuck' && <Layers size={15} color="#8ec5fc" />}
                              {flag.flag_type === 'dead_stock' && <PackageX size={15} color="#93a4c3" />}
                              {flag.flag_type === 'store_health' && <Building2 size={15} color="#e056fd" />}
                              <span className="dh-no-chart-label">
                                {flag.flag_type === 'distribution_imbalance'
                                  ? 'Disparity'
                                  : flag.flag_type === 'dc_stuck'
                                  ? 'DC Concentrated'
                                  : flag.flag_type === 'dead_stock'
                                  ? 'Zero Sales'
                                  : 'Store Health'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 5. Status Column */}
                        <td>
                          <span className={`dh-flag-status-pill ${flag.status}`}>
                            {flag.status === 'open' && <span className="status-dot red" />}
                            {flag.status === 'acknowledged' && <span className="status-dot amber" />}
                            {flag.status === 'resolved' && <Check size={10} />}
                            {flag.status}
                          </span>
                        </td>

                        {/* 6. Actions Column */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {flag.status === 'open' && (
                              <button
                                className="dh-flag-action-btn ack"
                                onClick={() => handleStatusAction(flag.id, 'acknowledged')}
                                disabled={actionLoadingId === flag.id}
                                title="Acknowledge issue"
                              >
                                <CheckCheck size={11} />
                                Ack
                              </button>
                            )}
                            {flag.status !== 'resolved' && (
                              <button
                                className="dh-flag-action-btn resolve"
                                onClick={() => handleStatusAction(flag.id, 'resolved')}
                                disabled={actionLoadingId === flag.id}
                                title="Mark resolved"
                              >
                                <Check size={11} />
                                Resolve
                              </button>
                            )}
                            {flag.status === 'resolved' && (
                              <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Resolved</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable row diagnostic sentence (§4) */}
                      {isExpanded && (
                        <tr className="dh-flag-detail-row">
                          <td colSpan={6}>
                            <div className="dh-flag-detail-box">
                              <Info size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div>
                                <b style={{ color: '#fff', marginRight: 6 }}>Diagnostic Finding:</b>
                                {flag.message}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
