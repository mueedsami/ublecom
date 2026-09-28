'use client'
import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import MarketplaceTagModal from '@/components/MarketplaceTagModal'
import MarketplaceFlagsTab from '@/components/MarketplaceFlagsTab'
import MarketplaceImportTab from '@/components/MarketplaceImportTab'
import {
  MarketplaceItem,
  MarketplaceSummaryStats,
  MarketplaceSalesTrendPoint,
  getMarketplaceSummaryStats,
  listMarketplaceCatalog,
  getMarketplaceSalesTrend,
  checkMarketplaceSchemaInstalled,
} from '@/lib/marketplaceData'
import {
  MarketplaceFlag,
  MarketplaceFlagsSummary,
  MarketplaceFlagStatus,
  getMarketplaceFlags,
  updateMarketplaceFlagStatus,
  generateMarketplaceFlagsPass,
  checkMarketplaceFlagsSchemaInstalled,
} from '@/lib/marketplaceFlags'
import { getMarketplaceConfig } from '@/lib/marketplaceConfig'
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  UploadCloud,
  AlertTriangle,
  ShoppingBag,
  ArrowDownRight,
  PackageX,
  ExternalLink,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function MarketplaceAccountPage({
  params,
}: {
  params: { account: string }
}) {
  const accountCode = (params.account || 'othoba').toLowerCase()
  const config = getMarketplaceConfig(accountCode)

  const [activeTab, setActiveTab] = useState<'analytics' | 'flags' | 'tagging' | 'import'>('analytics')
  const [stats, setStats] = useState<MarketplaceSummaryStats | null>(null)
  const [catalog, setCatalog] = useState<MarketplaceItem[]>([])
  const [salesTrend, setSalesTrend] = useState<MarketplaceSalesTrendPoint[]>([])
  const [flags, setFlags] = useState<MarketplaceFlag[]>([])
  const [flagsSummary, setFlagsSummary] = useState<MarketplaceFlagsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtering states for Stock / Catalog
  const [stockSearch, setStockSearch] = useState('')
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'unmatched' | 'matched' | 'ignored'>('unmatched')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedTagItem, setSelectedTagItem] = useState<MarketplaceItem | null>(null)
  const [trendMetric, setTrendMetric] = useState<'sold_qty' | 'total_amount'>('sold_qty')

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [sData, trendData, catData, flagsData] = await Promise.all([
        getMarketplaceSummaryStats(accountCode),
        getMarketplaceSalesTrend(accountCode),
        listMarketplaceCatalog(accountCode),
        getMarketplaceFlags(accountCode),
      ])
      setStats(sData)
      setSalesTrend(trendData)
      setCatalog(catData)
      setFlags(flagsData.flags)
      setFlagsSummary(flagsData.summary)
    } catch (err: any) {
      console.error(err)
      setError(err.message || `Failed to load ${config.displayName}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accountCode])

  async function handleRefreshFlags() {
    try {
      await generateMarketplaceFlagsPass(accountCode)
      const res = await getMarketplaceFlags(accountCode)
      setFlags(res.flags)
      setFlagsSummary(res.summary)
    } catch (err) {
      console.error('Error refreshing flags:', err)
    }
  }

  async function handleUpdateFlagStatus(flagId: string, status: MarketplaceFlagStatus) {
    try {
      await updateMarketplaceFlagStatus(flagId, status)
      setFlags(prev =>
        prev.map(f => (f.id === flagId ? { ...f, status, resolved_at: status === 'resolved' ? new Date().toISOString() : null } : f))
      )
    } catch (err) {
      console.error('Error updating flag status:', err)
    }
  }

  // Stock Matrix search filter
  const filteredStockRows = useMemo(() => {
    if (!stockSearch.trim()) return catalog
    const q = stockSearch.toLowerCase()
    return catalog.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q)) ||
        r.source_product_id.includes(q) ||
        (r.basepacks && r.basepacks.name.toLowerCase().includes(q))
    )
  }, [catalog, stockSearch])

  // Catalog Tagging tab filter
  const filteredCatalog = useMemo(() => {
    let list = catalog
    if (catalogFilter !== 'all') {
      list = list.filter(i => i.match_status === catalogFilter)
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase()
      list = list.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.sku && i.sku.toLowerCase().includes(q)) ||
          i.source_product_id.includes(q) ||
          (i.basepacks && i.basepacks.name.toLowerCase().includes(q))
      )
    }
    return list
  }, [catalog, catalogFilter, catalogSearch])

  return (
    <>
      <Header
        eyebrow="Marketplace Stock & Sales Feed"
        title={config.displayName}
        subtitle={`Single-storefront stock & sales tracking, product catalog matching, and automated inventory flags for ${config.name}.`}
      />

      {/* Schema Migration Notice if not installed */}
      {stats && !stats.is_schema_installed && (
        <div className="dh-banner-schema">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle color="#ffbf4b" size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#ffd071' }}>
                Schema Migration Required (Preview Mode Active)
              </div>
              <div style={{ fontSize: 12, color: '#c7d6eb', marginTop: 3 }}>
                Generic marketplace tables (<code>marketplace_report_uploads</code>, <code>marketplace_items</code>, etc.) are not yet applied in Supabase.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Run in Supabase SQL Editor:</span>
            <code>supabase/012_marketplace_reports.sql</code>
          </div>
        </div>
      )}

      {/* Top Navigation & Action Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        {/* Navigation Tabs */}
        <div className="tab-strip" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={15} />
            <span>Overview &amp; Inventory</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'flags' ? 'active' : ''}`}
            onClick={() => setActiveTab('flags')}
          >
            <AlertTriangle size={15} />
            <span>Automated Flags</span>
            {flagsSummary && flagsSummary.total_open > 0 && (
              <span
                className="tab-badge"
                style={{
                  background:
                    activeTab === 'flags'
                      ? 'rgba(255, 255, 255, 0.22)'
                      : flagsSummary.critical_count > 0
                      ? 'rgba(255, 102, 115, 0.25)'
                      : 'rgba(47, 125, 255, 0.25)',
                  color:
                    activeTab === 'flags'
                      ? '#fff'
                      : flagsSummary.critical_count > 0
                      ? '#ff8a94'
                      : '#8eb8ff',
                  marginLeft: 4,
                }}
              >
                {flagsSummary.total_open}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'tagging' ? 'active' : ''}`}
            onClick={() => setActiveTab('tagging')}
          >
            <Tag size={15} />
            <span>Catalog Tagging</span>
            {stats && stats.unmatched_skus > 0 && (
              <span
                className="tab-badge"
                style={{
                  background:
                    activeTab === 'tagging'
                      ? 'rgba(255, 255, 255, 0.22)'
                      : 'rgba(255, 191, 75, 0.25)',
                  color:
                    activeTab === 'tagging'
                      ? '#fff'
                      : '#ffd071',
                  marginLeft: 4,
                }}
              >
                {stats.unmatched_skus}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <UploadCloud size={15} />
            <span>Data Import</span>
          </button>
        </div>

        {/* Top Right Action Bar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {stats && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(12, 20, 37, 0.72)',
                border: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--muted)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <span>Period:</span>
              <strong style={{ color: '#fff' }}>{stats.period_label}</strong>
            </div>
          )}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => loadData()}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 15px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: 'rgba(18, 26, 45, 0.85)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card error-card">
          <b>Error:</b> {error}
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & INVENTORY */}
          {activeTab === 'analytics' && stats && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* KPI Strip */}
              <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="card stat-card">
                  <span className="stat-label">Catalog SKUs</span>
                  <div className="stat-value">{stats.total_skus}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    <b style={{ color: 'var(--green)' }}>{stats.matched_skus}</b> matched (
                    {stats.total_skus > 0 ? Math.round((stats.matched_skus / stats.total_skus) * 100) : 0}%)
                  </div>
                </div>

                <div className="card stat-card">
                  <span className="stat-label">Total Stock Units</span>
                  <div className="stat-value" style={{ color: 'var(--blue)' }}>
                    {stats.total_stock_units.toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Across active listings
                  </span>
                </div>

                <div className="card stat-card">
                  <span className="stat-label">Period Sold Units</span>
                  <div className="stat-value" style={{ color: 'var(--teal)' }}>
                    {stats.total_sold_units.toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {stats.period_label} cumulative
                  </span>
                </div>

                <div className="card stat-card">
                  <span className="stat-label">Revenue / GFV</span>
                  <div className="stat-value" style={{ color: 'var(--green)' }}>
                    ৳{stats.total_revenue_gfv.toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Total Period Value
                  </span>
                </div>

                <div className="card stat-card">
                  <span className="stat-label">Total Inventory Value</span>
                  <div className="stat-value">
                    ৳{Math.round(stats.total_stock_value).toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    At Unit Selling Price
                  </span>
                </div>

                <div className="card stat-card" style={{ borderLeft: '4px solid #ffbf4b' }}>
                  <span className="stat-label">Dead Stock at Risk</span>
                  <div className="stat-value" style={{ color: '#ffbf4b' }}>
                    ৳{Math.round(stats.dead_stock_value).toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Stock &gt; 0 with 0 sales
                  </span>
                </div>
              </div>

              {/* Sales Velocity Chart */}
              {salesTrend.length > 0 && (
                <div className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, margin: '0 0 2px', fontWeight: 800 }}>
                        Historical Period Trend
                      </h3>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Sales velocity &amp; inventory trajectory across reporting periods
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={`count-pill ${trendMetric === 'sold_qty' ? 'active-pill' : ''}`}
                        onClick={() => setTrendMetric('sold_qty')}
                        style={{ cursor: 'pointer', fontSize: 11 }}
                      >
                        Sold Units
                      </button>
                      <button
                        type="button"
                        className={`count-pill ${trendMetric === 'total_amount' ? 'active-pill' : ''}`}
                        onClick={() => setTrendMetric('total_amount')}
                        style={{ cursor: 'pointer', fontSize: 11 }}
                      >
                        Revenue (৳)
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={salesTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="period_label" stroke="var(--muted)" fontSize={11} />
                        <YAxis stroke="var(--muted)" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: '#0e1726',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey={trendMetric}
                          name={trendMetric === 'sold_qty' ? 'Sold Units' : 'Revenue (৳)'}
                          stroke="#00d4b4"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#00d4b4' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="stock_units"
                          name="Stock Units"
                          stroke="#4a9eff"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#4a9eff' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Current Inventory Matrix Table */}
              <div className="card" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, margin: '0 0 2px', fontWeight: 800 }}>
                      Current Inventory &amp; Sales Velocity
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      As-of report: <b>{stats.period_label}</b> ({stats.report_date}) · {filteredStockRows.length} items
                    </span>
                  </div>

                  <div style={{ position: 'relative', width: 280 }}>
                    <Search
                      size={14}
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                    />
                    <input
                      type="text"
                      placeholder="Search product, SKU or basepack..."
                      value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      style={{ width: '100%', paddingLeft: 30, height: 34, fontSize: 12 }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Source ID</th>
                        <th>SKU</th>
                        <th>Product Name</th>
                        <th>Master Basepack</th>
                        <th>Current Stock</th>
                        <th>Sold Qty</th>
                        <th>Run Rate</th>
                        <th>Cover</th>
                        <th>Selling Price</th>
                        <th>Stock Value</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStockRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                            No items found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredStockRows.map(item => {
                          const isStockout = item.current_stock === 0 && (item.sold_qty || 0) > 0
                          const isLowCover = item.days_of_cover !== null && item.days_of_cover !== undefined && item.days_of_cover <= 7
                          const isDead = (item.current_stock || 0) >= 10 && (item.sold_qty || 0) === 0

                          return (
                            <tr key={item.id}>
                              <td><code>{item.source_product_id}</code></td>
                              <td>
                                {item.sku ? (
                                  <span className="count-pill" style={{ fontSize: 10 }}>{item.sku}</span>
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>—</span>
                                )}
                              </td>
                              <td style={{ maxWidth: 300 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                              </td>
                              <td style={{ maxWidth: 220 }}>
                                {item.basepacks ? (
                                  <div style={{ display: 'grid', gap: 1 }}>
                                    <span style={{ color: '#e0ecff', fontWeight: 600, fontSize: 11 }}>
                                      {item.basepacks.name}
                                    </span>
                                    <span style={{ color: 'var(--teal)', fontSize: 10 }}>
                                      {item.basepacks.brand}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#ffbf4b', fontStyle: 'italic', fontSize: 11 }}>
                                    Not linked
                                  </span>
                                )}
                              </td>
                              <td>
                                <b style={{ color: isStockout ? '#ff6673' : 'var(--text)' }}>
                                  {item.current_stock ?? 0}
                                </b>
                              </td>
                              <td>
                                <b style={{ color: '#fff' }}>{item.sold_qty ?? 0}</b>
                              </td>
                              <td>
                                {item.run_rate != null ? (
                                  <span style={{ color: 'var(--teal)' }}>
                                    {Number(item.run_rate).toFixed(2)}/d
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                {isStockout ? (
                                  <span style={{ color: '#ff6673', fontWeight: 700, fontSize: 11 }}>
                                    Stockout
                                  </span>
                                ) : item.days_of_cover != null ? (
                                  <span
                                    style={{
                                      color: isLowCover ? '#ffbf4b' : 'var(--text)',
                                      fontWeight: isLowCover ? 700 : 500,
                                    }}
                                  >
                                    {item.days_of_cover}d
                                  </span>
                                ) : isDead ? (
                                  <span style={{ color: '#93a4c3', fontSize: 11 }}>Dead (0 sold)</span>
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                {item.tp ? `৳${item.tp}` : item.mrp ? `৳${item.mrp}` : '—'}
                              </td>
                              <td>
                                {item.stock_value ? `৳${Math.round(item.stock_value).toLocaleString()}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className={item.match_status === 'matched' ? 'ghost-btn' : 'primary'}
                                  onClick={() => setSelectedTagItem(item)}
                                  style={{ fontSize: 11, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Tag size={12} />
                                  {item.match_status === 'matched' ? 'Edit' : 'Tag'}
                                </button>
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
          )}

          {/* TAB 2: AUTOMATED FLAGS */}
          {activeTab === 'flags' && flagsSummary && (
            <MarketplaceFlagsTab
              accountCode={accountCode}
              accountName={config.name}
              flags={flags}
              summary={flagsSummary}
              loading={loading}
              onRefresh={handleRefreshFlags}
              onUpdateStatus={handleUpdateFlagStatus}
            />
          )}

          {/* TAB 3: PRODUCT CATALOG MATCHING */}
          {activeTab === 'tagging' && stats && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Top Controls */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 }}>
                      {(['unmatched', 'matched', 'ignored', 'all'] as const).map(tabKey => (
                        <button
                          key={tabKey}
                          type="button"
                          onClick={() => setCatalogFilter(tabKey)}
                          style={{
                            padding: '6px 14px',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: catalogFilter === tabKey ? 'var(--blue)' : 'transparent',
                            color: catalogFilter === tabKey ? '#fff' : 'var(--muted)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {tabKey} (
                          {tabKey === 'unmatched'
                            ? stats.unmatched_skus
                            : tabKey === 'matched'
                            ? stats.matched_skus
                            : tabKey === 'ignored'
                            ? stats.ignored_skus
                            : stats.total_skus}
                          )
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ position: 'relative', width: 280 }}>
                    <Search
                      size={14}
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                    />
                    <input
                      type="text"
                      placeholder="Search catalog SKUs..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      style={{ width: '100%', paddingLeft: 30, height: 34, fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>

              {/* Tagging Table */}
              <div className="card" style={{ padding: '18px 22px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Source ID</th>
                        <th>SKU</th>
                        <th>Marketplace Product Name</th>
                        <th>Vendor / Store</th>
                        <th>Period Volume</th>
                        <th>Linked Master Basepack</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                            No items found for filter &quot;{catalogFilter}&quot;.
                          </td>
                        </tr>
                      ) : (
                        filteredCatalog.map(item => (
                          <tr key={item.id}>
                            <td><code>{item.source_product_id}</code></td>
                            <td>{item.sku || '—'}</td>
                            <td style={{ maxWidth: 320 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {item.vendor_name || config.defaultVendorName}
                              </span>
                            </td>
                            <td>
                              {item.sold_qty != null ? (
                                <b style={{ color: '#fff' }}>{item.sold_qty} units</b>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ maxWidth: 240 }}>
                              {item.basepacks ? (
                                <div style={{ display: 'grid', gap: 1 }}>
                                  <b style={{ color: '#e0ecff', fontSize: 11 }}>{item.basepacks.name}</b>
                                  <span style={{ color: 'var(--teal)', fontSize: 10 }}>{item.basepacks.brand}</span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 11 }}>
                                  Not linked
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`status ${
                                  item.match_status === 'matched'
                                    ? 'ok'
                                    : item.match_status === 'ignored'
                                    ? 'bad'
                                    : 'warn'
                                }`}
                              >
                                <i className="dot" />
                                {item.match_status === 'matched'
                                  ? 'Matched'
                                  : item.match_status === 'ignored'
                                  ? 'Ignored'
                                  : 'Unmatched'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className={item.match_status === 'matched' ? 'ghost-btn' : 'primary'}
                                onClick={() => setSelectedTagItem(item)}
                                style={{ fontSize: 11, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Tag size={12} />
                                {item.match_status === 'matched' ? 'Edit Tag' : 'Tag Basepack'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA IMPORT & SHEET INGEST */}
          {activeTab === 'import' && (
            <MarketplaceImportTab
              accountCode={accountCode}
              accountName={config.name}
              onImportComplete={loadData}
            />
          )}
        </>
      )}

      {/* Tag Modal */}
      {selectedTagItem && (
        <MarketplaceTagModal
          item={selectedTagItem}
          accountName={config.name}
          onClose={() => setSelectedTagItem(null)}
          onSuccess={loadData}
        />
      )}
    </>
  )
}
