'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import FoodiUploadTab from '@/components/FoodiUploadTab'
import {
  FoodiSummary,
  FoodiSkuItem,
  FoodiCategoryItem,
  FoodiExceptionItem,
  FoodiTrendPoint,
  getFoodiSummary,
  getFoodiSkuList,
  getFoodiCategoryOla,
  getFoodiExceptions,
  getFoodiDailyTrend,
} from '@/lib/foodiOlaData'
import {
  ShoppingBag,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Flame,
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
  Info,
  Calendar,
  Sparkles,
  BarChart3,
  Percent,
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

export default function FoodiPage() {
  const [activeTab, setActiveTab] = useState<'sku_listing' | 'category_breakdown' | 'exceptions' | 'trend' | 'upload'>('sku_listing')
  const [summary, setSummary] = useState<FoodiSummary | null>(null)
  const [skus, setSkus] = useState<FoodiSkuItem[]>([])
  const [categories, setCategories] = useState<FoodiCategoryItem[]>([])
  const [exceptions, setExceptions] = useState<FoodiExceptionItem[]>([])
  const [trend, setTrend] = useState<FoodiTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters for SKU listing
  const [skuSearch, setSkuSearch] = useState('')
  const [skuCategoryFilter, setSkuCategoryFilter] = useState('all')
  const [skuStatusFilter, setSkuStatusFilter] = useState<'all' | 'available' | 'low_stock' | 'out_of_stock'>('all')
  const [skuBundleFilter, setSkuBundleFilter] = useState<'all' | 'regular_only' | 'bundles_only'>('all')
  const [sortBy, setSortBy] = useState<'sales_desc' | 'stock_asc' | 'stock_desc' | 'name_asc' | 'doc_asc'>('sales_desc')

  // Filters for Exceptions
  const [exceptionFilter, setExceptionFilter] = useState<'all' | 'critical' | 'oos' | 'low_stock' | 'missing'>('all')
  const [exceptionSearch, setExceptionSearch] = useState('')

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [sum, skuList, catList, excList, trndList] = await Promise.all([
        getFoodiSummary(),
        getFoodiSkuList(),
        getFoodiCategoryOla(),
        getFoodiExceptions(),
        getFoodiDailyTrend(),
      ])
      setSummary(sum)
      setSkus(skuList)
      setCategories(catList)
      setExceptions(excList)
      setTrend(trndList)
    } catch (err: any) {
      console.error('Error loading Foodi data:', err)
      setError(err?.message || 'Failed to load Foodi data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Unique category list for dropdown
  const categoryNames = useMemo(() => {
    const s = new Set<string>()
    for (const item of skus) {
      if (item.category) s.add(item.category)
    }
    return Array.from(s).sort()
  }, [skus])

  // Filtered and Sorted SKUs
  const filteredSkus = useMemo(() => {
    let result = skus.filter(item => {
      if (skuCategoryFilter !== 'all' && item.category !== skuCategoryFilter) return false
      if (skuStatusFilter === 'available' && item.currentStock <= 0) return false
      if (skuStatusFilter === 'low_stock' && (item.currentStock < 1 || item.currentStock > 9)) return false
      if (skuStatusFilter === 'out_of_stock' && item.currentStock > 0) return false
      if (skuBundleFilter === 'bundles_only' && !item.isBundle) return false
      if (skuBundleFilter === 'regular_only' && item.isBundle) return false

      if (skuSearch.trim()) {
        const q = skuSearch.toLowerCase()
        const matchesSku = item.sku.toLowerCase().includes(q)
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesBarcode = item.barcodes.some(b => b.includes(q))
        if (!matchesSku && !matchesName && !matchesBarcode) return false
      }
      return true
    })

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'sales_desc') return b.soldQty - a.soldQty || b.currentStock - a.currentStock
      if (sortBy === 'stock_desc') return b.currentStock - a.currentStock || b.soldQty - a.soldQty
      if (sortBy === 'stock_asc') return a.currentStock - b.currentStock || b.soldQty - a.soldQty
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'doc_asc') {
        const da = a.daysOfCover ?? 9999
        const db = b.daysOfCover ?? 9999
        return da - db
      }
      return 0
    })

    return result
  }, [skus, skuCategoryFilter, skuStatusFilter, skuBundleFilter, skuSearch, sortBy])

  // Filtered Exceptions
  const filteredExceptions = useMemo(() => {
    return exceptions.filter(e => {
      if (exceptionFilter === 'critical' && e.exceptionType !== 'out_of_stock_sold_recently') return false
      if (exceptionFilter === 'oos' && e.exceptionType !== 'out_of_stock' && e.exceptionType !== 'out_of_stock_sold_recently') return false
      if (exceptionFilter === 'low_stock' && e.exceptionType !== 'low_stock') return false
      if (exceptionFilter === 'missing' && e.exceptionType !== 'missing_from_report') return false

      if (exceptionSearch.trim()) {
        const q = exceptionSearch.toLowerCase()
        if (!e.sku.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [exceptions, exceptionFilter, exceptionSearch])

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <Header
        eyebrow="Foodi Quick Commerce"
        title="Foodi SKU-Level OLA Command Center"
        subtitle="Stock report source of truth · 208 SKUs · SKU-level OLA · Category breakdown · Priority exceptions"
      />

      {/* Snapshot Topline */}
      <div className="report-topline" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ShoppingBag size={15} color="var(--teal)" />
          <span>
            Stock as of: <b>{summary?.asOfDate || 'No upload yet'}</b>
            {summary && (
              <span style={{ opacity: 0.8, marginLeft: 8 }}>
                (file dated {summary.fileDate}, {summary.stockBasis === 'same_day' ? 'same-day basis' : 'previous-day basis T-1'})
              </span>
            )}
            {summary?.daysOld != null && (
              <span style={{ opacity: 0.7, marginLeft: 8 }}>
                · {summary.daysOld === 0 ? 'Today' : `${summary.daysOld} days old`}
              </span>
            )}
          </span>
          <span className="count-pill" style={{ background: 'rgba(50,209,195,0.15)', color: 'var(--teal)', border: '1px solid rgba(50,209,195,0.3)' }}>
            SKU-level · Not yet mapped to basepacks
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: '#8eb8ff' }}>
            {summary?.totalSkus || 208} Active SKUs in Foodi Catalog
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 20 }}>
        {/* 1. Foodi SKU OLA */}
        <div className="card" style={{ borderLeft: '4px solid var(--teal)', background: 'linear-gradient(135deg, rgba(50,209,195,0.12), rgba(18,26,45,0.95))' }}>
          <div className="kpi-label">Foodi SKU-Level OLA</div>
          <div className="kpi-value" style={{ color: (summary?.olaPercentage || 0) >= 90 ? 'var(--teal)' : 'var(--amber)' }}>
            {summary?.olaPercentage != null ? `${summary.olaPercentage}%` : '—'}
          </div>
          <div className="kpi-delta">
            <b>{summary?.availableSkus || 0}</b> of {summary?.totalSkus || 0} SKUs in stock (stock &gt; 0)
          </div>
        </div>

        {/* 2. In Stock SKUs */}
        <div className="card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="kpi-label">Available SKUs</div>
          <div className="kpi-value green">{summary?.availableSkus || 0}</div>
          <div className="kpi-delta">
            Healthy warehouse stock (&gt;0 units)
          </div>
        </div>

        {/* 3. Out of Stock SKUs */}
        <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
          <div className="kpi-label">Out of Stock SKUs</div>
          <div className="kpi-value red">{summary?.outOfStockSkus || 0}</div>
          <div className="kpi-delta">
            Zero units on shelf in XL Point
          </div>
        </div>

        {/* 4. Low Stock SKUs (1-9) */}
        <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="kpi-label">Low Stock (1–9 Units)</div>
          <div className="kpi-value amber">{summary?.lowStockSkus || 0}</div>
          <div className="kpi-delta">
            Imminent stockout vulnerability
          </div>
        </div>

        {/* 5. Critical OOS with Recent Sales */}
        <div className="card" style={{ borderLeft: '4px solid #ef4444', background: (summary?.oosWithSalesCount || 0) > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(18,26,45,0.95))' : undefined }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={14} color="#f87171" /> High-Priority OOS (w/ Sales)
          </div>
          <div className="kpi-value" style={{ color: '#f87171' }}>{summary?.oosWithSalesCount || 0}</div>
          <div className="kpi-delta">
            Recent buyers experiencing stockout
          </div>
        </div>

        {/* 6. Bundles / Promos */}
        <div className="card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div className="kpi-label">Promo / Bundle SKUs</div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>{summary?.bundlesCount || 0}</div>
          <div className="kpi-delta">
            B1G1 &amp; combo offers included in OLA
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          type="button"
          className={activeTab === 'sku_listing' ? 'active' : ''}
          onClick={() => setActiveTab('sku_listing')}
        >
          SKU Listing ({skus.length})
        </button>
        <button
          type="button"
          className={activeTab === 'category_breakdown' ? 'active' : ''}
          onClick={() => setActiveTab('category_breakdown')}
        >
          Category Breakdown ({categories.length})
        </button>
        <button
          type="button"
          className={activeTab === 'exceptions' ? 'active' : ''}
          onClick={() => setActiveTab('exceptions')}
        >
          Exceptions &amp; Gaps ({exceptions.length})
        </button>
        <button
          type="button"
          className={activeTab === 'trend' ? 'active' : ''}
          onClick={() => setActiveTab('trend')}
        >
          Daily OLA Trend ({trend.length})
        </button>
        <button
          type="button"
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          Report Upload &amp; History
        </button>
      </div>

      {loading && <Loading />}

      {error && (
        <div className="card error-card" style={{ padding: 20 }}>
          <b>Error loading Foodi data:</b> {error}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: SKU LISTING */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'sku_listing' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Filter Bar */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search Foodi SKU, product name, barcode..."
                value={skuSearch}
                onChange={e => setSkuSearch(e.target.value)}
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
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>CATEGORY:</label>
              <select
                value={skuCategoryFilter}
                onChange={e => setSkuCategoryFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Categories ({categoryNames.length})</option>
                {categoryNames.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>STATUS:</label>
              <select
                value={skuStatusFilter}
                onChange={e => setSkuStatusFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Statuses ({skus.length})</option>
                <option value="available">In Stock ({summary?.availableSkus || 0})</option>
                <option value="low_stock">Low Stock 1–9 ({summary?.lowStockSkus || 0})</option>
                <option value="out_of_stock">Out of Stock ({summary?.outOfStockSkus || 0})</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>PROMOS:</label>
              <select
                value={skuBundleFilter}
                onChange={e => setSkuBundleFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All SKUs</option>
                <option value="regular_only">Exclude Bundles</option>
                <option value="bundles_only">Bundles Only ({summary?.bundlesCount || 0})</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>SORT:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="sales_desc">30-Day Sales (High to Low)</option>
                <option value="stock_desc">Stock (High to Low)</option>
                <option value="stock_asc">Stock (Low to High)</option>
                <option value="name_asc">Product Name (A to Z)</option>
                <option value="doc_asc">Days of Cover (Imminent First)</option>
              </select>
            </div>

            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
              Showing <b>{filteredSkus.length}</b> of {skus.length} SKUs
            </span>
          </div>

          {/* SKU Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%', minWidth: 960 }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Barcode(s)</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>TP</th>
                    <th style={{ textAlign: 'right' }}>MRP</th>
                    <th style={{ textAlign: 'right' }}>Selling Price</th>
                    <th style={{ textAlign: 'right' }}>Total Stock</th>
                    <th style={{ textAlign: 'right' }}>30d Sales</th>
                    <th style={{ textAlign: 'right' }}>Cover</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkus.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                        No SKUs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSkus.map(item => (
                      <tr key={item.id}>
                        <td>
                          <b>{item.sku}</b>
                        </td>
                        <td>
                          {item.barcodes.length === 0 ? (
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                          ) : item.barcodes.length === 1 ? (
                            <code style={{ fontSize: 11, color: '#93c5fd' }}>{item.barcodes[0]}</code>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="count-pill" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: 10 }}>
                                2 Barcodes (Combo)
                              </span>
                              <code style={{ fontSize: 10, color: 'var(--muted)' }}>{item.barcodes.join(' >> ')}</code>
                            </div>
                          )}
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{item.name}</span>
                            {item.isBundle && (
                              <span className="kpi-tag" style={{ background: 'rgba(168,85,247,0.18)', color: '#c084fc', fontSize: 10 }}>
                                Bundle / Promo
                              </span>
                            )}
                            {item.name.includes('[Duplicate SKU]') && (
                              <span className="kpi-tag" style={{ background: 'rgba(255,102,115,0.18)', color: '#fca5a5', fontSize: 10 }}>
                                Review Flag
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="count-pill">{item.category}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.tp ? `৳${item.tp}` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.mrp ? `৳${item.mrp}` : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--teal)' }}>
                          {item.sellingPrice ? `৳${item.sellingPrice}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: item.currentStock > 0 ? (item.currentStock < 10 ? 'var(--amber)' : 'var(--green)') : 'var(--red)' }}>
                          {item.currentStock}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {item.soldQty}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 11, color: item.daysOfCover != null && item.daysOfCover < 7 ? 'var(--amber)' : 'var(--text)' }}>
                          {item.daysOfCover != null ? `${item.daysOfCover}d` : '—'}
                        </td>
                        <td>
                          {item.currentStock > 0 ? (
                            item.currentStock < 10 ? (
                              <span className="status warn">Low ({item.currentStock})</span>
                            ) : (
                              <span className="status ok">In Stock</span>
                            )
                          ) : (
                            <span className="status bad">
                              {item.soldQty > 0 ? 'OOS (Recent Sales)' : 'Out of Stock'}
                            </span>
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
      {/* TAB 2: CATEGORY BREAKDOWN */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'category_breakdown' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(50,209,195,0.12), rgba(18,26,45,0.95))', borderLeft: '4px solid var(--teal)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BarChart3 size={18} color="var(--teal)" />
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Category OLA &amp; Inventory Breakdown</h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#c8d4e8', lineHeight: 1.5 }}>
              Foodi carries 5 active Unilever categories in its XL Point warehouse.
              Category percentages sum up to the total <b>{summary?.olaPercentage}% SKU OLA</b> across all 208 products.
            </p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Total SKUs</th>
                    <th style={{ textAlign: 'right' }}>In Stock</th>
                    <th style={{ textAlign: 'right' }}>Out of Stock</th>
                    <th style={{ textAlign: 'right' }}>Low Stock (1-9)</th>
                    <th style={{ textAlign: 'right' }}>Category OLA %</th>
                    <th style={{ textAlign: 'right' }}>Total Warehouse Stock</th>
                    <th style={{ textAlign: 'right' }}>30d Sales Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c.category}>
                      <td>
                        <b>{c.category}</b>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.totalSkus}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 700 }}>{c.availableSkus}</td>
                      <td style={{ textAlign: 'right', color: c.outOfStockSkus > 0 ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>
                        {c.outOfStockSkus}
                      </td>
                      <td style={{ textAlign: 'right', color: c.lowStockSkus > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                        {c.lowStockSkus}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`score-pill ${c.olaPercentage >= 95 ? 'high' : c.olaPercentage >= 80 ? 'mid' : 'low'}`}
                          style={{ padding: '3px 8px', fontSize: 12 }}
                        >
                          {c.olaPercentage}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{c.totalStock} units</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.totalSales30d}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>Total / Overall</b></td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>{summary?.totalSkus || 208}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--green)' }}>{summary?.availableSkus || 204}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--red)' }}>{summary?.outOfStockSkus || 4}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--amber)' }}>{summary?.lowStockSkus || 9}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--teal)' }}>{summary?.olaPercentage}%</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXCEPTIONS & GAPS */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'exceptions' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Critical Callout: OOS with Recent Sales */}
          {summary && summary.oosWithSalesCount > 0 && (
            <div
              className="card"
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(18,26,45,0.95))',
                borderLeft: '4px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Flame size={24} color="#f87171" />
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fca5a5' }}>
                    Highest Priority Gap: Out of Stock with Active Sales Demand
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#e2e8f0' }}>
                    <b>{summary.oosWithSalesCount} SKU</b> has zero warehouse inventory despite generating sales in the rolling 30-day window. Immediate replenishment required!
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="primary"
                onClick={() => setExceptionFilter('critical')}
                style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '6px 12px' }}
              >
                View High-Priority SKU
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search exception SKU or name..."
                value={exceptionSearch}
                onChange={e => setExceptionSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 34px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>FILTER:</label>
              <select
                value={exceptionFilter}
                onChange={e => setExceptionFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, background: '#0c1425', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="all">All Exceptions ({exceptions.length})</option>
                <option value="critical">Critical: OOS with Recent Sales ({summary?.oosWithSalesCount || 0})</option>
                <option value="oos">All Out of Stock ({summary?.outOfStockSkus || 0})</option>
                <option value="low_stock">Low Stock (1–9 Units) ({summary?.lowStockSkus || 0})</option>
                <option value="missing">Missing from Latest Report ({summary?.missingSkusCount || 0})</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>30d Sales</th>
                    <th style={{ textAlign: 'right' }}>TP</th>
                    <th style={{ textAlign: 'right' }}>Selling Price</th>
                    <th>Issue Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExceptions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No exceptions match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredExceptions.map(item => (
                      <tr key={item.id} style={{ background: item.exceptionType === 'out_of_stock_sold_recently' ? 'rgba(239,68,68,0.08)' : undefined }}>
                        <td>
                          {item.exceptionType === 'out_of_stock_sold_recently' ? (
                            <span className="status bad" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Flame size={12} /> P1 Critical
                            </span>
                          ) : item.exceptionType === 'out_of_stock' ? (
                            <span className="status bad">P2 OOS</span>
                          ) : item.exceptionType === 'low_stock' ? (
                            <span className="status warn">P3 Low Stock</span>
                          ) : (
                            <span className="status" style={{ background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}>
                              P4 Missing
                            </span>
                          )}
                        </td>
                        <td><b>{item.sku}</b></td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                        <td><span className="count-pill">{item.category}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: item.currentStock > 0 ? 'var(--amber)' : 'var(--red)' }}>
                          {item.currentStock}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: item.soldQty > 0 ? 'var(--green)' : 'var(--muted)' }}>
                          {item.soldQty}
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.tp ? `৳${item.tp}` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.sellingPrice ? `৳${item.sellingPrice}` : '—'}</td>
                        <td>
                          {item.exceptionType === 'out_of_stock_sold_recently' && (
                            <span style={{ color: '#f87171', fontWeight: 700, fontSize: 11 }}>
                              Zero stock but sold {item.soldQty} units in 30d
                            </span>
                          )}
                          {item.exceptionType === 'out_of_stock' && (
                            <span style={{ color: 'var(--red)', fontSize: 11 }}>
                              Stockout · 0 sales
                            </span>
                          )}
                          {item.exceptionType === 'low_stock' && (
                            <span style={{ color: 'var(--amber)', fontSize: 11 }}>
                              Imminent stockout (1–9 units)
                            </span>
                          )}
                          {item.exceptionType === 'missing_from_report' && (
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                              SKU dropped from latest report file
                            </span>
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
      {/* TAB 4: DAILY OLA TREND */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'trend' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="var(--teal)" />
                <h3 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Historical Foodi SKU-Level OLA Trend</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Tracking OLA % across report uploads by stock as-of date</span>
            </div>

            {trend.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>
                No historical uploads recorded yet. Upload multiple report files to view trend trajectory.
              </div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1d283f" />
                    <XAxis dataKey="date" stroke="#687b9d" fontSize={11} />
                    <YAxis domain={[90, 100]} stroke="#687b9d" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{ background: '#0e1628', border: '1px solid #26334f', borderRadius: 8, fontSize: 12 }}
                      formatter={(val: any) => [`${val}%`, 'Foodi SKU OLA']}
                    />
                    <Line type="monotone" dataKey="olaPercentage" stroke="#32d1c3" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Trend Data Table */}
          {trend.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Stock As-Of Date</th>
                      <th>File Date</th>
                      <th>Basis</th>
                      <th style={{ textAlign: 'right' }}>Total SKUs</th>
                      <th style={{ textAlign: 'right' }}>Available SKUs</th>
                      <th style={{ textAlign: 'right' }}>SKU OLA %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map(t => (
                      <tr key={t.date}>
                        <td><b>{t.date}</b></td>
                        <td>{t.fileDate}</td>
                        <td>
                          <span className={`count-pill ${t.stockBasis === 'same_day' ? 'badge-blue' : 'badge-teal'}`}>
                            {t.stockBasis === 'same_day' ? 'Same Day' : 'Previous Day (T-1)'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{t.totalSkus}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 700 }}>{t.availableSkus}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="score-pill high" style={{ padding: '3px 8px', fontSize: 11 }}>
                            {t.olaPercentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: UPLOAD & HISTORY */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'upload' && (
        <FoodiUploadTab onUploadSuccess={loadData} />
      )}
    </div>
  )
}
