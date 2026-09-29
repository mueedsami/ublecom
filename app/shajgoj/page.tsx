'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import ShajgojUploadTab from '@/components/ShajgojUploadTab'
import ShajgojPromoteModal from '@/components/ShajgojPromoteModal'
import {
  ShajgojSummary,
  ShajgojCoreBasepack,
  ShajgojUnresolvedItem,
  ShajgojLowStockItem,
  ShajgojExtraItem,
  ShajgojTrendPoint,
  getShajgojSummary,
  getShajgojCoreBasepacks,
  getShajgojUnresolvedSkus,
  getShajgojLowStockSkus,
  getShajgojOosBasepacks,
  getShajgojExtras,
  getShajgojDailyTrend,
  dismissShajgojExtra,
  checkShajgojSchemaInstalled,
} from '@/lib/shajgojOlaData'
import {
  ShoppingBag,
  PackageCheck,
  PackageX,
  AlertTriangle,
  HelpCircle,
  Layers,
  UploadCloud,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Boxes,
  Tag,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  ShieldCheck,
  Calendar,
  Sparkles,
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

export default function ShajgojPage() {
  const [activeTab, setActiveTab] = useState<'core_ola' | 'unresolved' | 'low_stock' | 'oos_basepacks' | 'extras' | 'upload'>('core_ola')
  const [summary, setSummary] = useState<ShajgojSummary | null>(null)
  const [basepacks, setBasepacks] = useState<ShajgojCoreBasepack[]>([])
  const [unresolved, setUnresolved] = useState<ShajgojUnresolvedItem[]>([])
  const [lowStock, setLowStock] = useState<ShajgojLowStockItem[]>([])
  const [oosBasepacks, setOosBasepacks] = useState<ShajgojCoreBasepack[]>([])
  const [extras, setExtras] = useState<ShajgojExtraItem[]>([])
  const [trend, setTrend] = useState<ShajgojTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters for Core OLA
  const [bpSearch, setBpSearch] = useState('')
  const [bpStatusFilter, setBpStatusFilter] = useState<'all' | 'available' | 'oos'>('all')
  const [bpBrandFilter, setBpBrandFilter] = useState('all')
  const [expandedBpIds, setExpandedBpIds] = useState<Set<string>>(new Set())

  // Filters for Unresolved
  const [unresolvedSearch, setUnresolvedSearch] = useState('')
  const [unresolvedStockFilter, setUnresolvedStockFilter] = useState<'all' | 'with_stock' | 'zero_stock'>('all')

  // Filters for Extras
  const [extrasSearch, setExtrasSearch] = useState('')
  const [extrasFilter, setExtrasFilter] = useState<'all' | 'in_stock' | 'has_sales' | 'dismissed'>('all')
  const [selectedExtraForPromote, setSelectedExtraForPromote] = useState<ShajgojExtraItem | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [sum, bps, unres, low, oos, ext, trnd] = await Promise.all([
        getShajgojSummary(),
        getShajgojCoreBasepacks(),
        getShajgojUnresolvedSkus(),
        getShajgojLowStockSkus(),
        getShajgojOosBasepacks(),
        getShajgojExtras(),
        getShajgojDailyTrend(),
      ])
      setSummary(sum)
      setBasepacks(bps)
      setUnresolved(unres)
      setLowStock(low)
      setOosBasepacks(oos)
      setExtras(ext)
      setTrend(trnd)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to load Shajgoj data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Toggle basepack expansion
  function toggleBpExpand(bpId: string) {
    setExpandedBpIds(prev => {
      const next = new Set(prev)
      if (next.has(bpId)) next.delete(bpId)
      else next.add(bpId)
      return next
    })
  }

  function expandAll() {
    setExpandedBpIds(new Set(basepacks.map(b => b.basepackId)))
  }
  function collapseAll() {
    setExpandedBpIds(new Set())
  }

  // Filtered Core Basepacks
  const distinctBrands = useMemo(() => {
    const s = new Set<string>()
    for (const b of basepacks) {
      if (b.brand) s.add(b.brand)
    }
    return Array.from(s).sort()
  }, [basepacks])

  const filteredBasepacks = useMemo(() => {
    return basepacks.filter(bp => {
      if (bpStatusFilter === 'available' && !bp.available) return false
      if (bpStatusFilter === 'oos' && bp.available) return false
      if (bpBrandFilter !== 'all' && bp.brand !== bpBrandFilter) return false
      if (bpSearch.trim()) {
        const q = bpSearch.toLowerCase()
        const matchesName = bp.basepackName.toLowerCase().includes(q)
        const matchesBrand = bp.brand.toLowerCase().includes(q)
        const matchesSku = bp.skus.some(s => s.sku.includes(q) || s.name.toLowerCase().includes(q))
        if (!matchesName && !matchesBrand && !matchesSku) return false
      }
      return true
    })
  }, [basepacks, bpStatusFilter, bpBrandFilter, bpSearch])

  // Filtered Unresolved SKUs
  const filteredUnresolved = useMemo(() => {
    return unresolved.filter(u => {
      if (unresolvedStockFilter === 'with_stock' && u.currentStock <= 0) return false
      if (unresolvedStockFilter === 'zero_stock' && u.currentStock > 0) return false
      if (unresolvedSearch.trim()) {
        const q = unresolvedSearch.toLowerCase()
        if (!u.name.toLowerCase().includes(q) && !u.sku.includes(q) && !u.basepackName.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [unresolved, unresolvedStockFilter, unresolvedSearch])

  // Filtered Extras
  const filteredExtras = useMemo(() => {
    return extras.filter(e => {
      if (extrasFilter === 'in_stock' && !e.inStock) return false
      if (extrasFilter === 'has_sales' && e.soldQty <= 0) return false
      if (extrasFilter === 'dismissed' && !e.dismissed) return false
      if (extrasFilter !== 'dismissed' && e.dismissed) return false
      if (extrasSearch.trim()) {
        const q = extrasSearch.toLowerCase()
        if (!e.name.toLowerCase().includes(q) && !e.sku.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [extras, extrasFilter, extrasSearch])

  async function handleToggleDismiss(item: ShajgojExtraItem) {
    try {
      await dismissShajgojExtra(item.id, !item.dismissed)
      setExtras(prev =>
        prev.map(it => (it.id === item.id ? { ...it, dismissed: !item.dismissed } : it))
      )
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <Header
        eyebrow="Shajgoj E-Commerce"
        title="Shajgoj Stock-Based OLA Command Center"
        subtitle="Stock dump source of truth · Core 142 Basepacks · Unresolved tracking · Extras isolated floor"
      />

      {/* Snapshot Topline */}
      <div className="report-topline" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShoppingBag size={15} color="var(--teal)" />
          <span>
            Stock as-of date: <b>{summary?.asOfDate || '2026-09-29'}</b>
            <span style={{ opacity: 0.7, marginLeft: 8 }}>
              ({summary?.daysOld === 0 ? 'Today' : `${summary?.daysOld} days old`})
            </span>
          </span>
          {summary?.periodLabel && (
            <span className="count-pill" style={{ marginLeft: 8 }}>
              {summary.periodLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: '#8eb8ff' }}>
            {summary?.totalCoreBasepacks || 142} Basepacks in Scope · {summary?.totalCoreSkus || 227} Core SKUs
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 20 }}>
        {/* 1. Core OLA */}
        <div className="card" style={{ borderLeft: '4px solid var(--blue)', background: 'linear-gradient(135deg, rgba(47,125,255,0.12), rgba(18,26,45,0.95))' }}>
          <div className="kpi-label">Core Shajgoj OLA</div>
          <div className="kpi-value" style={{ color: (summary?.olaPercentage || 0) >= 75 ? 'var(--green)' : 'var(--amber)' }}>
            {summary?.olaPercentage != null ? `${summary.olaPercentage}%` : '—'}
          </div>
          <div className="kpi-delta">
            <b>{summary?.availableBasepacks || 0}</b> of {summary?.totalCoreBasepacks || 142} basepacks available
          </div>
        </div>

        {/* 2. In Stock Basepacks */}
        <div className="card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="kpi-label">Available Basepacks</div>
          <div className="kpi-value green">{summary?.availableBasepacks || 0}</div>
          <div className="kpi-delta">
            <b>{summary?.skuInStockCount || 0}</b> of {summary?.totalCoreSkus || 227} SKUs in stock
          </div>
        </div>

        {/* 3. Basepacks OOS */}
        <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
          <div className="kpi-label">Basepacks Out of Stock</div>
          <div className="kpi-value red">
            {(summary?.totalCoreBasepacks || 142) - (summary?.availableBasepacks || 0)}
          </div>
          <div className="kpi-delta">
            Zero warehouse stock across all SKUs
          </div>
        </div>

        {/* 4. Low Stock SKUs */}
        <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="kpi-label">Low Stock SKUs (1–9 Units)</div>
          <div className="kpi-value amber">{summary?.lowStockSkusCount || 14}</div>
          <div className="kpi-delta">
            Imminent stockout warning
          </div>
        </div>

        {/* 5. Unresolved SKUs */}
        <div className="card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div className="kpi-label">Unresolved SKUs (Web Not Found)</div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>{summary?.unresolvedSkusCount || 44}</div>
          <div className="kpi-delta">
            <b>{summary?.unresolvedWithStockCount || 14}</b> have stock (counted in OLA)
          </div>
        </div>

        {/* 6. Extras Tier */}
        <div className="card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-label">Extras Tier (Separate Floor)</div>
          <div className="kpi-value" style={{ color: '#fb923c' }}>{summary?.totalExtrasCount || 123}</div>
          <div className="kpi-delta">
            <b>{summary?.extrasInStockCount || 26}</b> in stock · Excluded from OLA
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          type="button"
          className={activeTab === 'core_ola' ? 'active' : ''}
          onClick={() => setActiveTab('core_ola')}
        >
          Core OLA Explorer ({summary?.totalCoreBasepacks || 142})
        </button>
        <button
          type="button"
          className={activeTab === 'unresolved' ? 'active' : ''}
          onClick={() => setActiveTab('unresolved')}
        >
          Unresolved SKUs ({summary?.unresolvedSkusCount || 44})
        </button>
        <button
          type="button"
          className={activeTab === 'low_stock' ? 'active' : ''}
          onClick={() => setActiveTab('low_stock')}
        >
          Low Stock SKUs ({summary?.lowStockSkusCount || 14})
        </button>
        <button
          type="button"
          className={activeTab === 'oos_basepacks' ? 'active' : ''}
          onClick={() => setActiveTab('oos_basepacks')}
        >
          Out of Stock Basepacks ({oosBasepacks.length})
        </button>
        <button
          type="button"
          className={activeTab === 'extras' ? 'active' : ''}
          onClick={() => setActiveTab('extras')}
        >
          Extras Tier ({summary?.totalExtrasCount || 123})
        </button>
        <button
          type="button"
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          Dump Upload &amp; History
        </button>
      </div>

      {loading && <Loading />}

      {error && (
        <div className="card error-card" style={{ padding: 20 }}>
          <b>Error loading Shajgoj data:</b> {error}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CORE OLA EXPLORER */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'core_ola' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Trend Chart (if multiple snapshots exist) */}
          {trend.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="var(--teal)" />
                  <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800 }}>Historical OLA Daily Trend</h3>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Snapshots by stock as-of date</span>
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1d283f" />
                    <XAxis dataKey="date" stroke="#687b9d" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#687b9d" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{ background: '#0e1628', border: '1px solid #26334f', borderRadius: 8, fontSize: 12 }}
                      formatter={(val: any) => [`${val}%`, 'OLA %']}
                    />
                    <Line type="monotone" dataKey="olaPercentage" stroke="#32d1c3" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search basepack name, brand, SKU..."
                value={bpSearch}
                onChange={e => setBpSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#0c1425',
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>STATUS:</label>
              <select
                value={bpStatusFilter}
                onChange={e => setBpStatusFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Basepacks ({basepacks.length})</option>
                <option value="available">Available ({summary?.availableBasepacks || 0})</option>
                <option value="oos">Out of Stock ({oosBasepacks.length})</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>BRAND:</label>
              <select
                value={bpBrandFilter}
                onChange={e => setBpBrandFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Brands</option>
                {distinctBrands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="ghost-pill-btn" onClick={expandAll}>
                Expand All
              </button>
              <button type="button" className="ghost-pill-btn" onClick={collapseAll}>
                Collapse All
              </button>
            </div>
          </div>

          {/* Basepack List */}
          <div className="basepack-list">
            {filteredBasepacks.length === 0 ? (
              <div className="card empty">No basepacks match the current search filters.</div>
            ) : (
              filteredBasepacks.map(bp => {
                const isExpanded = expandedBpIds.has(bp.basepackId)
                return (
                  <div
                    key={bp.basepackId}
                    className={`card basepack-card ${!bp.available ? 'border-red-subtle' : ''}`}
                  >
                    <div className="basepack-header" onClick={() => toggleBpExpand(bp.basepackId)}>
                      <div className="basepack-left">
                        <button type="button" className="expand-icon-btn" aria-label="Expand basepack">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div className="basepack-info">
                          <div className="basepack-title-row">
                            <span className="basepack-title">{bp.basepackName}</span>
                            <span className={`status-chip ${bp.available ? 'status-available' : 'status-unavailable'}`}>
                              {bp.available ? 'Available' : 'Out of Stock'}
                            </span>
                            {bp.hasUnresolvedOnly && (
                              <span className="kpi-tag" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                                Unresolved SKUs Only
                              </span>
                            )}
                          </div>
                          <div className="basepack-meta">
                            <span className="meta-tag brand-tag">{bp.brand}</span>
                            <span className="meta-tag">{bp.category}</span>
                            <span className="meta-stats">
                              {bp.skuCount} {bp.skuCount === 1 ? 'SKU' : 'SKUs'} ({bp.inStockSkuCount} in stock)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            Basepack Total Stock
                          </span>
                          <div style={{ fontSize: 16, fontWeight: 900, color: bp.available ? 'var(--green)' : 'var(--red)' }}>
                            {bp.totalStock} units
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nested SKU Breakdown Drawer */}
                    {isExpanded && (
                      <div className="basepack-products-drawer">
                        <div className="drawer-title">SKUs in Basepack ({bp.skus.length})</div>
                        <div className="table-wrap">
                          <table className="table" style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th>SKU</th>
                                <th>Product Name</th>
                                <th>Website Status</th>
                                <th style={{ textAlign: 'right' }}>Current Stock</th>
                                <th style={{ textAlign: 'right' }}>Sold Qty (Sep)</th>
                                <th style={{ textAlign: 'right' }}>TP</th>
                                <th style={{ textAlign: 'right' }}>MRP</th>
                                <th>Link</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bp.skus.map(s => (
                                <tr key={s.id}>
                                  <td>
                                    <b>{s.sku}</b>
                                  </td>
                                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {s.name}
                                  </td>
                                  <td>
                                    {s.isUnresolved ? (
                                      <span className="kpi-tag" style={{ background: 'rgba(168,85,247,0.18)', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <AlertTriangle size={11} /> Unresolved
                                      </span>
                                    ) : s.webStatus === 'In Stock' ? (
                                      <span className="status ok">In Stock</span>
                                    ) : (
                                      <span className="status bad">Out of Stock</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: s.currentStock > 0 ? (s.currentStock < 10 ? 'var(--amber)' : 'var(--green)') : 'var(--red)' }}>
                                    {s.currentStock}
                                    {s.currentStock >= 1 && s.currentStock <= 9 && (
                                      <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 4 }}>(Low)</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{s.soldQty}</td>
                                  <td style={{ textAlign: 'right' }}>{s.tp ? `৳${s.tp}` : '—'}</td>
                                  <td style={{ textAlign: 'right' }}>{s.mrp ? `৳${s.mrp}` : '—'}</td>
                                  <td>
                                    {s.productUrl ? (
                                      <a
                                        href={s.productUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        Store <ExternalLink size={11} />
                                      </a>
                                    ) : (
                                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: UNRESOLVED SKUS (44) */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'unresolved' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Header Banner */}
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(18,26,45,0.95))', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <HelpCircle size={18} color="#c084fc" />
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Core Unresolved SKUs (Web Not Found)</h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#c8d4e8', lineHeight: 1.5 }}>
              These <b>44 core SKUs</b> were not matched by the web scraper on Shajgoj&apos;s site.
              Following the OLA specification, they are <b>never hidden</b>: they are evaluated using warehouse dump stock ({summary?.unresolvedWithStockCount || 14} currently have stock) and remain fully visible here so they can be reviewed and rectified.
            </p>
          </div>

          {/* Filter controls */}
          <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search unresolved SKU, name, or basepack..."
                value={unresolvedSearch}
                onChange={e => setUnresolvedSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 34px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>STOCK FILTER:</label>
              <select
                value={unresolvedStockFilter}
                onChange={e => setUnresolvedStockFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Unresolved ({unresolved.length})</option>
                <option value="with_stock">Has Warehouse Stock ({summary?.unresolvedWithStockCount || 14})</option>
                <option value="zero_stock">Zero Stock ({unresolved.length - (summary?.unresolvedWithStockCount || 14)})</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Master Basepack</th>
                    <th>Brand</th>
                    <th style={{ textAlign: 'right' }}>Dump Stock</th>
                    <th style={{ textAlign: 'right' }}>Sold Qty (Sep)</th>
                    <th style={{ textAlign: 'right' }}>TP</th>
                    <th style={{ textAlign: 'right' }}>MRP</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnresolved.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No unresolved SKUs match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUnresolved.map(u => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.sku}</b>
                        </td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.name}
                        </td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--muted)' }}>
                          {u.basepackName}
                        </td>
                        <td>
                          <span className="count-pill">{u.brand}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: u.currentStock > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {u.currentStock}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {u.soldQty}
                        </td>
                        <td style={{ textAlign: 'right' }}>{u.tp ? `৳${u.tp}` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{u.mrp ? `৳${u.mrp}` : '—'}</td>
                        <td>
                          <span className="kpi-tag" style={{ background: 'rgba(168,85,247,0.18)', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} /> Unresolved
                          </span>
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

      {/* ========================================================================= */}
      {/* TAB 3: LOW STOCK SKUS (14) */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'low_stock' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(255,191,75,0.12), rgba(18,26,45,0.95))', borderLeft: '4px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={18} color="var(--amber)" />
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Low Stock SKUs (1–9 Units)</h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#e5d1ac', lineHeight: 1.5 }}>
              These <b>{lowStock.length} SKUs</b> have between 1 and 9 units of warehouse stock remaining in Shajgoj.
              Check whether the parent basepack has healthy stock across companion SKUs, or if the entire basepack is at immediate stockout risk.
            </p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Parent Basepack</th>
                    <th>Brand</th>
                    <th style={{ textAlign: 'right' }}>SKU Stock</th>
                    <th style={{ textAlign: 'right' }}>Basepack Total Stock</th>
                    <th style={{ textAlign: 'right' }}>Sold Qty (Sep)</th>
                    <th>Basepack Health</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No core SKUs currently in low stock (1–9 units).
                      </td>
                    </tr>
                  ) : (
                    lowStock.map(item => (
                      <tr key={item.id}>
                        <td><b>{item.sku}</b></td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--muted)' }}>
                          {item.basepackName}
                        </td>
                        <td><span className="count-pill">{item.brand}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--amber)' }}>
                          {item.currentStock} units
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {item.basepackTotalStock} units
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.soldQty}</td>
                        <td>
                          {item.basepackLowStock ? (
                            <span className="status warn">Basepack Low (&lt;10)</span>
                          ) : (
                            <span className="status ok">Companion SKUs OK</span>
                          )}
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

      {/* ========================================================================= */}
      {/* TAB 4: OUT OF STOCK BASEPACKS */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'oos_basepacks' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(255,102,115,0.12), rgba(18,26,45,0.95))', borderLeft: '4px solid var(--red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <PackageX size={18} color="var(--red)" />
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>
                Out of Stock Basepacks ({oosBasepacks.length})
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#f7b6bc', lineHeight: 1.5 }}>
              These <b>{oosBasepacks.length} in-scope basepacks</b> have zero total stock across all of their SKUs.
              These represent your primary availability gap pulling down Shajgoj OLA %.
            </p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Basepack Name</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Business Unit</th>
                    <th style={{ textAlign: 'right' }}>Core SKUs</th>
                    <th style={{ textAlign: 'right' }}>Total Sold (Sep)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {oosBasepacks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        All core basepacks are currently in stock!
                      </td>
                    </tr>
                  ) : (
                    oosBasepacks.map(bp => {
                      const totalSold = bp.skus.reduce((sum, s) => sum + s.soldQty, 0)
                      return (
                        <tr key={bp.basepackId}>
                          <td style={{ fontWeight: 700 }}>{bp.basepackName}</td>
                          <td><span className="count-pill">{bp.brand}</span></td>
                          <td>{bp.category}</td>
                          <td style={{ color: 'var(--muted)' }}>{bp.businessUnit}</td>
                          <td style={{ textAlign: 'right' }}>{bp.skuCount}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{totalSold}</td>
                          <td>
                            <span className="status bad">0 Units (OOS)</span>
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

      {/* ========================================================================= */}
      {/* TAB 5: EXTRAS TIER ("SEPARATE FLOOR") */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'extras' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Header Banner */}
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(18,26,45,0.95))', borderLeft: '4px solid #f97316' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Layers size={18} color="#fb923c" />
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>
                Extras Tier — Dedicated Floor ({summary?.totalExtrasCount || 123} SKUs)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#fed7aa', lineHeight: 1.5 }}>
              These <b>123 SKUs</b> exist in Shajgoj warehouse dumps but are outside the Core 142 Basepack list.
              They are completely excluded from Core OLA %. You can review their performance, dismiss unwanted ones, or <b>Promote to Core</b> to bring them into OLA scope.
            </p>
          </div>

          {/* Extras Metrics Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Extras In Stock</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>
                {summary?.extrasInStockCount || 26}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Available in warehouse</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Extras Sold This Month</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal)', marginTop: 4 }}>
                {summary?.extrasWithSalesCount || 22}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Active sales demand</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Extras</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
                {summary?.totalExtrasCount || 123}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Unmapped SKUs</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search extra SKU or product name..."
                value={extrasSearch}
                onChange={e => setExtrasSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 34px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>VIEW:</label>
              <select
                value={extrasFilter}
                onChange={e => setExtrasFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Active Extras ({extras.filter(e => !e.dismissed).length})</option>
                <option value="in_stock">In Stock Only ({summary?.extrasInStockCount || 26})</option>
                <option value="has_sales">Has Sales Only ({summary?.extrasWithSalesCount || 22})</option>
                <option value="dismissed">Dismissed Queue ({extras.filter(e => e.dismissed).length})</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>Sold Qty (Sep)</th>
                    <th style={{ textAlign: 'right' }}>TP</th>
                    <th style={{ textAlign: 'right' }}>MRP</th>
                    <th style={{ textAlign: 'right' }}>Stock Value</th>
                    <th style={{ textAlign: 'right' }}>Total Sold (Amt)</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExtras.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No extras match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredExtras.map(e => (
                      <tr key={e.id} style={{ opacity: e.dismissed ? 0.5 : 1 }}>
                        <td><b>{e.sku}</b></td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: e.inStock ? 'var(--green)' : 'var(--muted)' }}>
                          {e.currentStock}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{e.soldQty}</td>
                        <td style={{ textAlign: 'right' }}>{e.tp ? `৳${e.tp}` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{e.mrp ? `৳${e.mrp}` : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                          {e.stockValue ? `৳${Math.round(e.stockValue).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                          {e.totalAmount ? `৳${Math.round(e.totalAmount).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="ghost-pill-btn"
                              style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                              onClick={() => setSelectedExtraForPromote(e)}
                              title="Promote to Core Master"
                            >
                              <Sparkles size={11} style={{ marginRight: 3 }} /> Promote to Core
                            </button>
                            <button
                              type="button"
                              className="ghost-pill-btn"
                              onClick={() => handleToggleDismiss(e)}
                              title={e.dismissed ? 'Restore to Active Extras' : 'Dismiss SKU'}
                            >
                              {e.dismissed ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
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

      {/* ========================================================================= */}
      {/* TAB 6: DUMP UPLOAD & AUDIT LOG */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'upload' && (
        <ShajgojUploadTab onUploadSuccess={loadData} />
      )}

      {/* Promote Modal */}
      {selectedExtraForPromote && (
        <ShajgojPromoteModal
          item={selectedExtraForPromote}
          onClose={() => setSelectedExtraForPromote(null)}
          onSuccess={async () => {
            await loadData()
          }}
        />
      )}
    </div>
  )
}
