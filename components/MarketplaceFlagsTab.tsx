'use client'
import React, { useState, useMemo } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  TrendingDown,
  Boxes,
  PackageX,
  RefreshCw,
  Search,
  Check,
  Tag,
  ArrowDownRight,
  Filter,
  Download,
  RotateCcw,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  MarketplaceFlag,
  MarketplaceFlagsSummary,
  MarketplaceFlagSeverity,
  MarketplaceFlagType,
  MarketplaceFlagStatus,
} from '@/lib/marketplaceFlags'

interface MarketplaceFlagsTabProps {
  accountCode: string
  accountName: string
  flags: MarketplaceFlag[]
  summary: MarketplaceFlagsSummary
  loading: boolean
  onRefresh: () => Promise<void>
  onUpdateStatus: (flagId: string, newStatus: MarketplaceFlagStatus) => Promise<void>
}

const TYPE_CONFIG: Record<
  MarketplaceFlagType,
  { label: string; icon: React.ComponentType<any>; color: string; bg: string }
> = {
  stockout_risk: {
    label: 'Stockout Risk',
    icon: ArrowDownRight,
    color: '#ff6673',
    bg: 'rgba(255, 102, 115, 0.15)',
  },
  dead_stock: {
    label: 'Dead Stock',
    icon: PackageX,
    color: '#ffbf4b',
    bg: 'rgba(255, 191, 75, 0.15)',
  },
  sales_decline: {
    label: 'Sales Velocity Drop',
    icon: TrendingDown,
    color: '#e056fd',
    bg: 'rgba(224, 86, 253, 0.15)',
  },
  price_mismatch: {
    label: 'Price Variance',
    icon: Tag,
    color: '#2f7dff',
    bg: 'rgba(47, 125, 255, 0.15)',
  },
}

export default function MarketplaceFlagsTab({
  accountCode,
  accountName,
  flags,
  summary,
  loading,
  onRefresh,
  onUpdateStatus,
}: MarketplaceFlagsTabProps) {
  const [severityFilter, setSeverityFilter] = useState<MarketplaceFlagSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<MarketplaceFlagType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<MarketplaceFlagStatus | 'all'>('open')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleRefreshClick() {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleStatusAction(flagId: string, status: MarketplaceFlagStatus) {
    setActionLoadingId(flagId)
    try {
      await onUpdateStatus(flagId, status)
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredFlags = useMemo(() => {
    return flags.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false
      if (typeFilter !== 'all' && f.flag_type !== typeFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = f.title.toLowerCase().includes(q)
        const msgMatch = f.message.toLowerCase().includes(q)
        const nameMatch = f.item?.name.toLowerCase().includes(q) || false
        const skuMatch = f.item?.sku?.toLowerCase().includes(q) || false
        const srcMatch = f.item?.source_product_id?.toLowerCase().includes(q) || false
        if (!titleMatch && !msgMatch && !nameMatch && !skuMatch && !srcMatch) return false
      }

      return true
    })
  }, [flags, severityFilter, typeFilter, statusFilter, searchQuery])

  const exportUrl = `/api/marketplace/flags/export/xlsx?account=${accountCode}&severity=${severityFilter}&type=${typeFilter}&status=${statusFilter}`

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. Header Summary Cards */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card stat-card" style={{ borderLeft: '4px solid #ff6673' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Critical Stockouts</span>
            <AlertCircle size={18} color="#ff6673" />
          </div>
          <div className="stat-value" style={{ color: '#ff6673', marginTop: 4 }}>
            {summary.critical_count}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>0 or near-zero cover with demand</span>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #ffbf4b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Dead Stock at Risk</span>
            <PackageX size={18} color="#ffbf4b" />
          </div>
          <div className="stat-value" style={{ color: '#ffbf4b', marginTop: 4 }}>
            ৳{(summary.dead_stock_value_at_risk || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Unsold capital sitting on shelf</span>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #e056fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Velocity Drops</span>
            <TrendingDown size={18} color="#e056fd" />
          </div>
          <div className="stat-value" style={{ color: '#e056fd', marginTop: 4 }}>
            {summary.by_type?.sales_decline || 0}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Run rate dropped &gt;40% vs prior</span>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Total Open Alerts</span>
            <AlertTriangle size={18} color="var(--blue)" />
          </div>
          <div className="stat-value" style={{ color: '#fff', marginTop: 4 }}>
            {summary.total_open}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {summary.resolved_count} resolved this period
          </span>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Severity & Type filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {/* Status Segment */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 }}>
              {(['open', 'acknowledged', 'resolved', 'all'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === st ? 'var(--blue)' : 'transparent',
                    color: statusFilter === st ? '#fff' : 'var(--muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

            {/* Severity Pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`count-pill ${severityFilter === sev ? 'active-pill' : ''}`}
                  style={{
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '5px 10px',
                    border: severityFilter === sev ? '1px solid var(--blue)' : '1px solid var(--border)',
                    background: severityFilter === sev ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.03)',
                    color:
                      sev === 'critical'
                        ? '#ff6673'
                        : sev === 'warning'
                        ? '#ffbf4b'
                        : sev === 'info'
                        ? 'var(--blue)'
                        : 'var(--text)',
                    textTransform: 'capitalize',
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

            {/* Flag Type Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'stockout_risk', 'dead_stock', 'sales_decline', 'price_mismatch'] as const).map(t => {
                const isSelected = typeFilter === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    style={{
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: isSelected ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(0, 212, 180, 0.15)' : 'rgba(255,255,255,0.02)',
                      color: isSelected ? 'var(--teal)' : 'var(--muted)',
                    }}
                  >
                    {t === 'all' ? 'All Types' : TYPE_CONFIG[t]?.label || t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search + Action Buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
              />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 30, height: 32, fontSize: 12 }}
              />
            </div>

            <a
              href={exportUrl}
              download
              className="ghost-btn"
              style={{
                fontSize: 11,
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'var(--text)',
              }}
            >
              <Download size={13} />
              Export Excel
            </a>

            <button
              type="button"
              className="primary"
              onClick={handleRefreshClick}
              disabled={isRefreshing || loading}
              style={{ fontSize: 11, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              Re-scan Flags
            </button>
          </div>
        </div>
      </div>

      {/* 3. Flags List */}
      <div style={{ display: 'grid', gap: 12 }}>
        {filteredFlags.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={36} color="var(--green)" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>No flags found</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              No automated alerts match your selected filters. Everything looks healthy!
            </p>
          </div>
        ) : (
          filteredFlags.map(flag => {
            const typeConf = TYPE_CONFIG[flag.flag_type] || {
              label: flag.flag_type,
              icon: AlertTriangle,
              color: 'var(--muted)',
              bg: 'rgba(255,255,255,0.05)',
            }
            const Icon = typeConf.icon
            const isCritical = flag.severity === 'critical'
            const isWarning = flag.severity === 'warning'
            const isExpanded = expandedId === flag.id

            return (
              <div
                key={flag.id}
                className="card"
                style={{
                  padding: '14px 18px',
                  borderLeft: `4px solid ${isCritical ? '#ff6673' : isWarning ? '#ffbf4b' : 'var(--blue)'}`,
                  background: isCritical ? 'rgba(255, 102, 115, 0.03)' : 'var(--card-bg)',
                  display: 'grid',
                  gap: 10,
                }}
              >
                {/* Top Row: Type, Severity, Badges & Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        background: typeConf.bg,
                        color: typeConf.color,
                        padding: '6px 10px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '.03em',
                      }}
                    >
                      <Icon size={14} />
                      {typeConf.label.toUpperCase()}
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: isCritical ? 'rgba(255, 102, 115, 0.2)' : isWarning ? 'rgba(255, 191, 75, 0.2)' : 'rgba(74, 158, 255, 0.2)',
                        color: isCritical ? '#ff6673' : isWarning ? '#ffbf4b' : 'var(--blue)',
                      }}
                    >
                      {flag.severity}
                    </span>

                    {flag.item?.sku && (
                      <span className="count-pill" style={{ fontSize: 11 }}>
                        SKU: {flag.item.sku}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {flag.status === 'open' ? (
                      <>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={actionLoadingId === flag.id}
                          onClick={() => handleStatusAction(flag.id, 'acknowledged')}
                          style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Clock size={12} />
                          Acknowledge
                        </button>
                        <button
                          type="button"
                          className="primary"
                          disabled={actionLoadingId === flag.id}
                          onClick={() => handleStatusAction(flag.id, 'resolved')}
                          style={{
                            fontSize: 11,
                            padding: '5px 12px',
                            background: 'var(--green)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Check size={12} />
                          Resolve
                        </button>
                      </>
                    ) : flag.status === 'acknowledged' ? (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> Acknowledged
                        </span>
                        <button
                          type="button"
                          className="primary"
                          disabled={actionLoadingId === flag.id}
                          onClick={() => handleStatusAction(flag.id, 'resolved')}
                          style={{
                            fontSize: 11,
                            padding: '5px 12px',
                            background: 'var(--green)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Check size={12} />
                          Resolve
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={actionLoadingId === flag.id}
                        onClick={() => handleStatusAction(flag.id, 'open')}
                        style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <RotateCcw size={12} />
                        Re-open
                      </button>
                    )}

                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setExpandedId(isExpanded ? null : flag.id)}
                      style={{ padding: 4 }}
                      aria-label="Expand flag details"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Title & Product Name */}
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {flag.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {flag.message}
                  </p>
                </div>

                {/* Metrics Pill Strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {flag.metrics?.current_stock != null && (
                    <div>
                      Stock:{' '}
                      <b style={{ color: flag.metrics.current_stock === 0 ? '#ff6673' : '#fff' }}>
                        {flag.metrics.current_stock} units
                      </b>
                    </div>
                  )}
                  {flag.metrics?.sold_qty != null && (
                    <div>
                      Sold:{' '}
                      <b style={{ color: '#fff' }}>{flag.metrics.sold_qty} units</b>
                    </div>
                  )}
                  {flag.metrics?.run_rate != null && (
                    <div>
                      Run Rate:{' '}
                      <b style={{ color: 'var(--teal)' }}>{Number(flag.metrics.run_rate).toFixed(2)}/day</b>
                    </div>
                  )}
                  {flag.metrics?.days_of_cover != null && (
                    <div>
                      Days of Cover:{' '}
                      <b
                        style={{
                          color:
                            flag.metrics.days_of_cover <= 3
                              ? '#ff6673'
                              : flag.metrics.days_of_cover <= 7
                              ? '#ffbf4b'
                              : '#fff',
                        }}
                      >
                        {flag.metrics.days_of_cover} days
                      </b>
                    </div>
                  )}
                  {flag.metrics?.stock_value != null && (
                    <div>
                      Stock Value:{' '}
                      <b style={{ color: '#fff' }}>৳{Math.round(flag.metrics.stock_value).toLocaleString()}</b>
                    </div>
                  )}
                </div>

                {/* Expanded Accordion Details */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 11,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>First Detected: <b>{new Date(flag.first_detected_at).toLocaleString()}</b></span>
                      <span>Last Seen: <b>{new Date(flag.last_seen_at).toLocaleString()}</b></span>
                      <span>Report As-Of: <b>{flag.report_date}</b></span>
                    </div>
                    {flag.item?.basepacks && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--teal)' }}>
                        <Sparkles size={13} />
                        Linked Master Basepack: <b>{flag.item.basepacks.name}</b> ({flag.item.basepacks.brand})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
