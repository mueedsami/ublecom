'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import DhTagModal from '@/components/DhTagModal'
import {
  DhItem,
  DhSalesTrendPoint,
  DhStockMatrixRow,
  DhStore,
  DhSummaryStats,
  getDhSalesTrend,
  getDhStockMatrix,
  getDhSummaryStats,
  listDhCatalog,
  listDhStores,
  listUnmatchedItems,
} from '@/lib/dhData'
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  UploadCloud,
  AlertTriangle,
  Building2,
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

export default function DhPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'tagging' | 'import'>('analytics')
  const [stats, setStats] = useState<DhSummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Analytics Tab State
  const [salesTrend, setSalesTrend] = useState<DhSalesTrendPoint[]>([])
  const [stockMatrix, setStockMatrix] = useState<{ stores: DhStore[]; rows: DhStockMatrixRow[] }>({
    stores: [],
    rows: [],
  })
  const [trendMetric, setTrendMetric] = useState<'sold_qty' | 'gfv_local'>('gfv_local')
  const [stockSearch, setStockSearch] = useState('')

  // Tagging Tab State
  const [catalog, setCatalog] = useState<DhItem[]>([])
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'unmatched' | 'matched' | 'ignored'>('unmatched')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedTagItem, setSelectedTagItem] = useState<DhItem | null>(null)

  // Upload Tab State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<any | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [sData, trendData, matrixData, catData] = await Promise.all([
        getDhSummaryStats(),
        getDhSalesTrend(),
        getDhStockMatrix(),
        listDhCatalog({ status: catalogFilter === 'all' ? undefined : catalogFilter }),
      ])
      setStats(sData)
      setSalesTrend(trendData)
      setStockMatrix(matrixData)
      setCatalog(catData)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load Pandamart DH data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Refresh catalog when filter changes
  useEffect(() => {
    async function filterChange() {
      try {
        if (catalogFilter === 'unmatched') {
          const res = await listUnmatchedItems()
          setCatalog(res)
        } else {
          const res = await listDhCatalog({
            status: catalogFilter === 'all' ? undefined : catalogFilter,
          })
          setCatalog(res)
        }
      } catch (err) {
        console.error(err)
      }
    }
    filterChange()
  }, [catalogFilter])

  // Filtered catalog by search
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return catalog
    const q = catalogSearch.toLowerCase().trim()
    return catalog.filter(
      (item) =>
        item.dh_sku.toLowerCase().includes(q) ||
        item.dh_name.toLowerCase().includes(q) ||
        item.basepacks?.name.toLowerCase().includes(q) ||
        item.basepacks?.brand?.toLowerCase().includes(q)
    )
  }, [catalog, catalogSearch])

  // Filtered stock matrix rows
  const filteredStockRows = useMemo(() => {
    if (!stockSearch.trim()) return stockMatrix.rows
    const q = stockSearch.toLowerCase().trim()
    return stockMatrix.rows.filter(
      (r) =>
        r.dh_sku.toLowerCase().includes(q) ||
        r.dh_name.toLowerCase().includes(q) ||
        r.basepack_name.toLowerCase().includes(q)
    )
  }, [stockMatrix.rows, stockSearch])

  // Handle file drop / selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setImportError(null)
      setImportResult(null)
    }
  }

  async function handleImportSubmit() {
    if (!selectedFile) return
    setImporting(true)
    setImportProgress(25)
    setImportError(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      setImportProgress(50)
      const res = await fetch('/api/dh/import', {
        method: 'POST',
        body: formData,
      })

      setImportProgress(85)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setImportProgress(100)
      setImportResult(data.summary)
      await loadData()
    } catch (err: any) {
      setImportError(err.message || 'Import error')
    } finally {
      setImporting(false)
    }
  }

  const matchRate = stats
    ? Math.round((stats.matched_skus / (stats.total_skus || 1)) * 100)
    : 0

  return (
    <>
      <Header
        eyebrow="Direct Catalog & Stock Feed"
        title="Pandamart DH Command Center"
        subtitle="Catalog mapping, 30-day unit & revenue sales, and real-time store-wise inventory across 17 branches and DC."
      />

      {/* Migration Notice Banner if DB tables are not created yet */}
      {stats && !stats.is_schema_installed && (
        <div className="dh-banner-schema">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle color="#ffbf4b" size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#ffd071' }}>
                Supabase Schema Migration Needed
              </div>
              <div style={{ fontSize: 12, color: '#c7d6eb', marginTop: 3 }}>
                Tables <code>dh_stores</code>, <code>dh_items</code>, <code>dh_sales_daily</code>, and{' '}
                <code>dh_stock_daily</code> have not been applied yet in your Supabase project. Currently displaying
                preview mode.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Run in Supabase SQL Editor:
            </span>
            <code>supabase/009_dh_integration.sql</code>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <div className="card">
          <div className="kpi-label">30-Day Pandamart GFV</div>
          <div className="kpi-value text-teal">
            ৳{((stats?.total_gfv_30d || 0) / 1000000).toFixed(2)}M
          </div>
          <div className="kpi-delta green">
            ৳{(stats?.total_gfv_30d || 0).toLocaleString()} Total Sales
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">30-Day Units Sold</div>
          <div className="kpi-value">
            {(stats?.total_sold_30d || 0).toLocaleString()}
          </div>
          <div className="kpi-delta text-green">Across all branches</div>
        </div>

        <div className="card">
          <div className="kpi-label">Total Network Stock</div>
          <div className="kpi-value">
            {(stats?.total_stock || 0).toLocaleString()}
          </div>
          <div className="kpi-delta" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>DC: {(stats?.dc_stock || 0).toLocaleString()}</span>
            <span>Stores: {(stats?.branch_stock || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Basepack Match Rate</div>
          <div className="kpi-value" style={{ color: matchRate > 75 ? 'var(--green)' : 'var(--amber)' }}>
            {matchRate}%
          </div>
          <div className="kpi-delta">
            {stats?.matched_skus || 0} mapped / {stats?.unmatched_skus || 0} open
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Network Dark Stores</div>
          <div className="kpi-value text-blue">
            {stats?.active_stores || 17}
          </div>
          <div className="kpi-delta text-teal">16 Branches + 1 Central DC</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dh-tabs">
        <button
          className={`dh-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          Sales & Store Stock
        </button>
        <button
          className={`dh-tab-btn ${activeTab === 'tagging' ? 'active' : ''}`}
          onClick={() => setActiveTab('tagging')}
        >
          <Tag size={16} />
          Catalog & Tagging Hub
          {stats && stats.unmatched_skus > 0 && (
            <span
              style={{
                background: 'rgba(255,102,115,.25)',
                color: '#ff8a94',
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              {stats.unmatched_skus} open
            </span>
          )}
        </button>
        <button
          className={`dh-tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <UploadCloud size={16} />
          Daily Upload & Ingest
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card error-card">
          <b>Error:</b> {error}
        </div>
      ) : (
        <>
          {/* TAB 1: ANALYTICS & STORE STOCK */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Sales & Revenue Trend Chart */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>
                      Pandamart 30-Day Sales Velocity & Revenue
                    </h2>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Daily aggregate performance from official Pandamart DH transactions
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="mini-tabs">
                      <button
                        className={trendMetric === 'gfv_local' ? 'active' : ''}
                        onClick={() => setTrendMetric('gfv_local')}
                      >
                        Revenue (৳ GFV)
                      </button>
                      <button
                        className={trendMetric === 'sold_qty' ? 'active' : ''}
                        onClick={() => setTrendMetric('sold_qty')}
                      >
                        Units Sold
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ height: 280, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrend}>
                      <CartesianGrid stroke="#26334f" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#7284a2"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis
                        stroke="#7284a2"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          trendMetric === 'gfv_local'
                            ? `৳${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                            : `${v}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#111a2d',
                          border: '1px solid #26334f',
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        formatter={(val: any) => [
                          trendMetric === 'gfv_local'
                            ? `৳${Number(val).toLocaleString()}`
                            : `${Number(val).toLocaleString()} units`,
                          trendMetric === 'gfv_local' ? 'GFV Revenue' : 'Units Sold',
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey={trendMetric}
                        stroke={trendMetric === 'gfv_local' ? '#32d1c3' : '#2f7dff'}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Store-wise Stock Heatmap & Inventory Matrix */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>
                      Store-wise Inventory Matrix (T-1 Depth)
                    </h2>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Granular inventory depth across Central DC and all 16 dark stores
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 240 }}>
                      <input
                        type="search"
                        placeholder="Search SKU or Basepack..."
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#0c1425',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '6px 10px 6px 30px',
                          color: 'var(--text)',
                          fontSize: 12,
                        }}
                      />
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)' }}
                      />
                    </div>
                    <span className="count-pill">
                      {filteredStockRows.length} Items
                    </span>
                  </div>
                </div>

                <div className="dh-stock-grid-wrap">
                  <table className="dh-stock-table">
                    <thead>
                      <tr>
                        <th>DH Product &amp; Basepack</th>
                        <th style={{ background: '#172740', color: 'var(--teal)' }}>Network Total</th>
                        <th style={{ background: '#1c314f', color: '#8ec5fc' }}>Central DC</th>
                        <th style={{ background: '#172740' }}>Branch Stock</th>
                        {stockMatrix.stores
                          .filter((s) => !s.is_dc)
                          .map((store) => (
                            <th key={store.id} title={store.display_name}>
                              {store.store_code.replace('_', ' ')}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStockRows.slice(0, 50).map((row) => (
                        <tr key={row.dh_item_id}>
                          <td>
                            <div style={{ display: 'grid', gap: 2 }}>
                              <b style={{ color: '#fff', fontSize: 12 }}>{row.dh_name}</b>
                              <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', gap: 6 }}>
                                <span className="count-pill" style={{ padding: '2px 5px', fontSize: 9 }}>
                                  {row.dh_sku}
                                </span>
                                <span style={{ color: row.match_status === 'matched' ? 'var(--teal)' : 'var(--amber)' }}>
                                  ↳ {row.basepack_name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="dh-cell-stock" style={{ fontWeight: 800 }}>
                              {row.total_qty.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ background: 'rgba(47,125,255,.07)' }}>
                            <span className="dh-cell-stock dc">
                              {row.dc_qty.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <span className="dh-cell-stock">
                              {row.branch_qty.toLocaleString()}
                            </span>
                          </td>
                          {stockMatrix.stores
                            .filter((s) => !s.is_dc)
                            .map((store) => {
                              const q = row.store_qtys[store.store_code] || 0
                              const cls =
                                q === 0 ? 'zero' : q < 5 ? 'low' : 'healthy'
                              return (
                                <td key={store.id}>
                                  <span className={`dh-cell-stock ${cls}`}>
                                    {q > 0 ? q : '—'}
                                  </span>
                                </td>
                              )
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredStockRows.length > 50 && (
                  <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                    Showing top 50 items by inventory volume. Use search to find specific items.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CATALOG & TAGGING HUB */}
          {activeTab === 'tagging' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Priority Explainer Banner */}
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(47,125,255,.12), rgba(50,209,195,.08))',
                  border: '1px solid #2f5485',
                  borderRadius: 12,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={18} color="var(--teal)" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: '#dbe7f7' }}>
                    <b>Priority Tagging Engine:</b> Unmatched SKUs are automatically prioritized by their{' '}
                    <b>30-day sales volume</b> via view <code>v_dh_unmatched_items</code>. Tag high-selling items first to
                    maximize digital shelf visibility.
                  </div>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="master-toolbar">
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <input
                    type="search"
                    placeholder="Search by DH SKU, product title, or mapped basepack..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                  <Search
                    size={15}
                    style={{ position: 'absolute', right: 12, top: 13, color: 'var(--muted)' }}
                  />
                </div>

                <div className="mini-tabs" style={{ padding: 4 }}>
                  <button
                    className={catalogFilter === 'unmatched' ? 'active' : ''}
                    onClick={() => setCatalogFilter('unmatched')}
                  >
                    Unmatched ({stats?.unmatched_skus || 0})
                  </button>
                  <button
                    className={catalogFilter === 'matched' ? 'active' : ''}
                    onClick={() => setCatalogFilter('matched')}
                  >
                    Matched ({stats?.matched_skus || 0})
                  </button>
                  <button
                    className={catalogFilter === 'all' ? 'active' : ''}
                    onClick={() => setCatalogFilter('all')}
                  >
                    All SKUs ({stats?.total_skus || 0})
                  </button>
                  <button
                    className={catalogFilter === 'ignored' ? 'active' : ''}
                    onClick={() => setCatalogFilter('ignored')}
                  >
                    Ignored ({stats?.ignored_skus || 0})
                  </button>
                </div>

                <span className="count-pill">
                  {filteredCatalog.length} Displayed
                </span>
              </div>

              {/* Items Table */}
              <div className="card">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>DH SKU</th>
                        <th>Pandamart Product Title</th>
                        <th>30D Sales Volume</th>
                        <th>Mapped Master Basepack</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                            No items found matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredCatalog.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <code style={{ color: 'var(--teal)', fontWeight: 700 }}>
                                {item.dh_sku}
                              </code>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 380 }}>
                                {item.dh_name}
                              </div>
                            </td>
                            <td>
                              {item.sold_qty_30d != null ? (
                                <div style={{ display: 'grid', gap: 1 }}>
                                  <b style={{ color: '#fff', fontSize: 13 }}>
                                    {item.sold_qty_30d.toLocaleString()} units
                                  </b>
                                  {item.gfv_30d ? (
                                    <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                                      ৳{Number(item.gfv_30d).toLocaleString()} GFV
                                    </small>
                                  ) : null}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>—</span>
                              )}
                            </td>
                            <td>
                              {item.basepacks ? (
                                <div style={{ display: 'grid', gap: 2 }}>
                                  <b style={{ color: '#e0ecff', fontSize: 12 }}>
                                    {item.basepacks.name}
                                  </b>
                                  <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                                    <span style={{ color: 'var(--teal)' }}>{item.basepacks.brand}</span>
                                    {item.basepacks.category && (
                                      <span style={{ color: 'var(--muted)' }}>
                                        • {item.basepacks.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
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
                                className={item.match_status === 'matched' ? 'ghost-btn' : 'primary'}
                                style={{
                                  fontSize: 11,
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                onClick={() => setSelectedTagItem(item)}
                              >
                                <Tag size={13} />
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

          {/* TAB 3: DAILY UPLOAD & INGEST */}
          {activeTab === 'import' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Upload Box */}
              <div className="card">
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 16, margin: '0 0 4px', fontWeight: 800 }}>
                    Upload Pandamart DH Excel (.xlsx)
                  </h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                    Feed the daily Pandamart catalog file containing <b>Last 30 days sales</b> and{' '}
                    <b>Stock T-1 Days storewise</b> tabs.
                  </p>
                </div>

                <label className="dh-upload-zone">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    disabled={importing}
                  />
                  <FileSpreadsheet size={40} color="var(--blue)" />
                  <div>
                    <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>
                      {selectedFile ? selectedFile.name : 'Click to select or drag Pandamart DH file here'}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB selected`
                        : 'Supports standard 2-tab DH files (e.g. DH_file_base.xlsx)'}
                    </span>
                  </div>
                </label>

                {importing && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--teal)', fontWeight: 700 }}>
                        Importing &amp; Auto-matching...
                      </span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="dh-progress-bar">
                      <div className="dh-progress-bar-fill" style={{ width: `${importProgress}%` }} />
                    </div>
                  </div>
                )}

                {importError && (
                  <div className="card error-card" style={{ marginTop: 16, padding: '12px 14px' }}>
                    <b>Import Failed:</b> {importError}
                  </div>
                )}

                {importResult && (
                  <div
                    style={{
                      marginTop: 16,
                      background: 'rgba(68,209,122,.1)',
                      border: '1px solid rgba(68,209,122,.3)',
                      borderRadius: 12,
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
                      <CheckCircle2 size={16} />
                      Import &amp; Ingestion Successful!
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
                      <div>Total Catalog Items: <b>{importResult.total_catalog_items}</b></div>
                      <div>New Items Added: <b>{importResult.new_items_added}</b></div>
                      <div>Auto-matched Basepacks: <b style={{ color: 'var(--teal)' }}>{importResult.auto_matched_new}</b></div>
                      <div>Active Branches: <b>{importResult.active_stores_count}</b></div>
                      <div>Daily Sales Upserted: <b>{importResult.sales_records_upserted} rows</b></div>
                      <div>Store Stock Upserted: <b>{importResult.stock_records_upserted} rows</b></div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                  <button
                    className="primary"
                    disabled={!selectedFile || importing}
                    onClick={handleImportSubmit}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
                  >
                    <UploadCloud size={16} />
                    {importing ? 'Processing Feed...' : 'Run Import Feed'}
                  </button>
                </div>
              </div>

              {/* Collector Command Helper Card */}
              <div className="card">
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 800, color: 'var(--teal)' }}>
                    Python Collector CLI Workflow
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>
                    You can also run imports directly from the local analyst terminal using the integrated collector CLI.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 10, fontSize: 12 }}>
                  <div style={{ background: '#091120', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: 5 }}>
                      Terminal Command
                    </div>
                    <code style={{ color: '#88b6ff', wordBreak: 'break-all' }}>
                      collector\.venv\Scripts\python.exe -m ubl_collector.cli dh-import &quot;DH file base.xlsx&quot;
                    </code>
                  </div>

                  <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5 }}>
                    <b>How it works:</b>
                    <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
                      <li>Preserves all existing manual tagging tags in <code>dh_items</code>.</li>
                      <li>Auto-matches new items with Pandamart SKUs and Basepack names.</li>
                      <li>Upserts 30-day daily sales and 17-store inventory into Supabase.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tag Modal */}
      {selectedTagItem && (
        <DhTagModal
          item={selectedTagItem}
          onClose={() => setSelectedTagItem(null)}
          onSuccess={() => loadData()}
        />
      )}
    </>
  )
}
