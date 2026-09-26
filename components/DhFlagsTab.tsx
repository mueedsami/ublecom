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
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import { DhFlag, DhFlagsSummary, DhFlagSeverity, DhFlagType, DhFlagStatus } from '@/lib/dhFlags'

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
      {/* 1. KPI STRIP: SEVERITY COUNTERS WITH LUCIDE ICONS & DELTA NOTES */}
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

        {/* Resolved This Week */}
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

      {/* 2. TWO-COLUMN STRIP: FLAG TYPE BREAKDOWN & CONTROLS */}
      <div className="dh-flag-breakdown-row">
        {/* Breakdown by Type Card */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800 }}>Flag Types Distribution</h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Click a category below to filter flags
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

      {/* 3. STORE HEALTH STRIP: DARK STORE INVENTORY DEPTH GAUGES */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800 }}>Store Health &amp; In-Stock Depth</h3>
              <span className="count-pill">16 Dark Stores + 1 Central DC</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Repurposed network gauges · Fuller bar = healthier in-stock depth (Green &lt;15% OOS · Amber 15–30% · Red &gt;30%)
            </span>
          </div>

          {selectedStore && (
            <button
              className="secondary-btn"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => setSelectedStore(null)}
            >
              Clear Store Filter ({selectedStore})
            </button>
          )}
        </div>

        <div className="gauge-grid">
          {summary.store_health.map((store) => {
            const isSelected = selectedStore === store.store_id || selectedStore === store.store_code
            const oos = store.oos_pct
            const inStock = store.in_stock_pct

            // Gauge bar color based on OOS thresholds
            let barColor = 'linear-gradient(90deg, #32d1c3, #44d17a)'
            let toneClass = 'green'
            if (oos > 45) {
              barColor = 'linear-gradient(90deg, #ff6673, #ff4757)'
              toneClass = 'red'
            } else if (oos > 30) {
              barColor = 'linear-gradient(90deg, #ffbf4b, #ffa502)'
              toneClass = 'amber'
            }

            return (
              <div
                key={store.store_id}
                className={`gauge dh-store-health-gauge ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedStore(isSelected ? null : store.store_code)}
                style={{ cursor: 'pointer' }}
                title={`Click to filter flags for ${store.display_name}`}
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
                  <span style={{ color: oos > 30 ? 'var(--red)' : 'var(--muted)' }}>
                    {oos}% OOS
                  </span>
                  <span>{store.zero_count} SKUs dry</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. FILTER BAR & TABLE CONTROLS */}
      <div className="card" style={{ padding: 16 }}>
        <div className="dh-flag-toolbar">
          {/* Search box */}
          <div className="dh-matrix-search" style={{ flex: '1 1 240px', minWidth: 200 }}>
            <input
              type="search"
              placeholder="Search by SKU, product, basepack, or store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={14} className="dh-matrix-search-icon" />
          </div>

          {/* Severity selector */}
          <div className="mini-tabs">
            <button
              className={severityFilter === 'all' ? 'active' : ''}
              onClick={() => setSeverityFilter('all')}
            >
              All Severities
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

          {/* Status selector */}
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
              All Statuses
            </button>
          </div>

          {/* Rescan / Refresh Button */}
          <button
            className="secondary-btn"
            onClick={handleRefreshClick}
            disabled={isRefreshing || loading}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? 'Re-scanning...' : 'Re-scan Flags'}
          </button>
        </div>

        {/* Results Counter Pill */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>
            Showing <b>{filteredFlags.length}</b> flag(s)
            {selectedStore && ` for store: ${selectedStore}`}
            {typeFilter !== 'all' && ` · ${TYPE_CONFIG[typeFilter]?.label}`}
          </span>
          {(severityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'open' || selectedStore || searchQuery) && (
            <button
              className="ghost-btn"
              style={{ padding: '2px 8px', fontSize: 11 }}
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
        </div>
      </div>

      {/* 5. THE FLAGS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="dh-flag-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Severity / Type</th>
                <th>DH Product / Target</th>
                <th>Diagnostic Findings &amp; Metrics</th>
                <th style={{ width: 140, textAlign: 'center' }}>30d Sales Momentum</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
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

                  return (
                    <tr
                      key={flag.id}
                      className={`dh-flag-table-row ${flag.severity === 'critical' ? 'row-critical' : ''}`}
                    >
                      {/* Severity & Type Column */}
                      <td>
                        <div style={{ display: 'grid', gap: 5 }}>
                          <span
                            className={`dh-flag-severity-pill ${flag.severity}`}
                          >
                            <i className="dot" />
                            {flag.severity}
                          </span>
                          <span
                            className="dh-flag-type-badge"
                            style={{ color: typeCfg.color, background: typeCfg.bg }}
                            title={typeCfg.label}
                          >
                            <TypeIcon size={11} />
                            <span>{typeCfg.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Product / Target Column */}
                      <td style={{ minWidth: 260, maxWidth: 380 }}>
                        <div style={{ display: 'grid', gap: 4 }}>
                          {isItem ? (
                            <>
                              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>
                                {flag.item?.dh_name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span className="sku-code-pill">SKU: {flag.item?.dh_sku}</span>

                                {/* Basepack / Unmatched tag */}
                                {flag.item?.basepacks?.name ? (
                                  <span className="dh-matched-pill" title="Mapped Basepack">
                                    <Tag size={10} />
                                    {flag.item.basepacks.name}
                                  </span>
                                ) : isUnmatched ? (
                                  <span className="dh-unmatched-pill" title="Needs Basepack Mapping">
                                    Unmatched DH SKU
                                  </span>
                                ) : null}
                              </div>
                            </>
                          ) : isStore ? (
                            <>
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                                {flag.store?.display_name} {flag.store?.is_dc ? '(Central DC)' : 'Branch'}
                              </div>
                              <span className="sku-code-pill">Code: {flag.store?.store_code}</span>
                            </>
                          ) : (
                            <div style={{ fontWeight: 700 }}>{flag.title}</div>
                          )}
                        </div>
                      </td>

                      {/* Diagnostic Message & Metrics Column */}
                      <td style={{ minWidth: 280 }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ fontSize: 12, color: '#dbe5f5', lineHeight: 1.4 }}>
                            {flag.message}
                          </div>

                          {/* Key Metrics Chips */}
                          <div className="dh-flag-metric-chips">
                            {flag.metrics.days_of_cover !== undefined && (
                              <span className="metric-chip">
                                <b>{flag.metrics.days_of_cover}d</b> cover
                              </span>
                            )}
                            {flag.metrics.sold_qty_30d !== undefined && (
                              <span className="metric-chip">
                                <b>{flag.metrics.sold_qty_30d.toLocaleString()}</b> sold/30d
                              </span>
                            )}
                            {flag.metrics.total_stock !== undefined && (
                              <span className="metric-chip">
                                <b>{flag.metrics.total_stock.toLocaleString()}</b> stock
                              </span>
                            )}
                            {flag.metrics.store_count_instock !== undefined && (
                              <span className="metric-chip">
                                in <b>{flag.metrics.store_count_instock}/16</b> stores
                              </span>
                            )}
                            {flag.metrics.dc_qty !== undefined && flag.metrics.dc_qty > 0 && (
                              <span className="metric-chip" style={{ color: '#8ec5fc' }}>
                                DC: <b>{flag.metrics.dc_qty.toLocaleString()}</b>
                              </span>
                            )}
                            {flag.metrics.drop_pct !== undefined && (
                              <span
                                className="metric-chip"
                                style={{
                                  color: 'var(--red)',
                                  background: 'rgba(255,102,115,0.15)',
                                }}
                              >
                                <b>-{flag.metrics.drop_pct}%</b> decline
                              </span>
                            )}
                            {flag.metrics.oos_pct !== undefined && (
                              <span
                                className="metric-chip"
                                style={{
                                  color: flag.metrics.oos_pct > 30 ? 'var(--red)' : 'var(--amber)',
                                }}
                              >
                                <b>{flag.metrics.oos_pct}%</b> OOS
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 30-Day Sales Momentum Sparkline Column */}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        {flag.sparkline && flag.sparkline.length > 0 ? (
                          <div style={{ width: 130, height: 42, margin: '0 auto' }}>
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
                                  stroke={flag.flag_type === 'sales_decline' ? '#ff6673' : '#32d1c3'}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                            <span style={{ fontSize: 9, color: 'var(--muted)' }}>30-day velocity</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td>
                        <span className={`dh-flag-status-pill ${flag.status}`}>
                          {flag.status === 'open' && <span className="status-dot red" />}
                          {flag.status === 'acknowledged' && <span className="status-dot amber" />}
                          {flag.status === 'resolved' && <Check size={10} />}
                          {flag.status}
                        </span>
                      </td>

                      {/* Action Buttons Column */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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
