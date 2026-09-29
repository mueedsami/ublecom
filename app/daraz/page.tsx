'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import {
  DarazDodSummary,
  DarazLowStockItem,
  DarazUnmappedItem,
  DarazBasepackNoNormal,
  getDarazDodSummary,
  getDarazLowStock,
  getDarazUnmapped,
  getDarazBasepacksNoNormal,
} from '@/lib/darazDodData'
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  PackageX,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  UploadCloud,
  XCircle,
  HelpCircle,
} from 'lucide-react'

export default function DarazDodPage() {
  const [activeTab, setActiveTab] = useState<'low_stock' | 'unmapped' | 'no_normal' | 'upload'>('low_stock')
  const [summary, setSummary] = useState<DarazDodSummary | null>(null)
  const [lowStockItems, setLowStockItems] = useState<DarazLowStockItem[]>([])
  const [unmappedItems, setUnmappedItems] = useState<DarazUnmappedItem[]>([])
  const [noNormalBps, setNoNormalBps] = useState<DarazBasepackNoNormal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Low stock view toggle: 'sku' | 'basepack'
  const [lowStockView, setLowStockView] = useState<'sku' | 'basepack'>('sku')
  const [lowStockSearch, setLowStockSearch] = useState('')

  // Unmapped search
  const [unmappedSearch, setUnmappedSearch] = useState('')

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDate, setUploadDate] = useState('')
  const [uploadDryRun, setUploadDryRun] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [sum, low, unmapped, noNorm] = await Promise.all([
        getDarazDodSummary(),
        getDarazLowStock(),
        getDarazUnmapped(),
        getDarazBasepacksNoNormal(),
      ])
      setSummary(sum)
      setLowStockItems(low)
      setUnmappedItems(unmapped)
      setNoNormalBps(noNorm)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to load Daraz DOD data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered Low Stock
  const filteredLowStock = useMemo(() => {
    if (!lowStockSearch.trim()) return lowStockItems
    const q = lowStockSearch.toLowerCase()
    return lowStockItems.filter(
      (item) =>
        item.daraz_sku.toLowerCase().includes(q) ||
        item.product_name.toLowerCase().includes(q) ||
        item.basepack_name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
    )
  }, [lowStockItems, lowStockSearch])

  // Grouped basepack low stock
  const basepackLowStockList = useMemo(() => {
    const map = new Map<string, {
      basepack_id: string
      basepack_name: string
      brand: string
      category: string
      total_stock: number
      skus: DarazLowStockItem[]
    }>()

    for (const item of filteredLowStock) {
      if (!map.has(item.basepack_id)) {
        map.set(item.basepack_id, {
          basepack_id: item.basepack_id,
          basepack_name: item.basepack_name,
          brand: item.brand,
          category: item.category,
          total_stock: item.basepack_total_stock,
          skus: [],
        })
      }
      map.get(item.basepack_id)!.skus.push(item)
    }

    return Array.from(map.values()).sort((a, b) => a.total_stock - b.total_stock)
  }, [filteredLowStock])

  // Filtered Unmapped
  const filteredUnmapped = useMemo(() => {
    if (!unmappedSearch.trim()) return unmappedItems
    const q = unmappedSearch.toLowerCase()
    return unmappedItems.filter(
      (item) =>
        item.daraz_sku.toLowerCase().includes(q) ||
        item.product_name.toLowerCase().includes(q)
    )
  }, [unmappedItems, unmappedSearch])

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) return

    setUploading(true)
    setUploadError(null)
    setUploadResult(null)

    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      if (uploadDate) fd.append('date', uploadDate)
      if (uploadDryRun) fd.append('dry_run', 'true')

      const res = await fetch('/api/daraz/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to process file')
      }

      setUploadResult(json)
      if (!uploadDryRun) {
        await loadData()
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Header
        eyebrow="Daraz Daily OLA"
        title="Daraz DOD Command Center"
        subtitle="Daily Deals (DOD) stock feed, OLA calculation, low-stock radar, and master mapping queues."
      />

      {/* Schema Migration Notice if not applied */}
      {summary && !summary.is_schema_installed && (
        <div className="dh-banner-schema" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle color="#ffbf4b" size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#ffd071' }}>
                Schema Migration 015 Available
              </div>
              <div style={{ fontSize: 12, color: '#c7d6eb', marginTop: 3 }}>
                Daraz DOD tables (<code>daraz_dod_uploads</code>, <code>daraz_dod_daily</code>, and views) can be created in Supabase for full native database storage.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Run in Supabase SQL Editor:</span>
            <code>supabase/015_daraz_dod.sql</code>
          </div>
        </div>
      )}

      {/* Scope Clarification & Snapshot Topline */}
      <div className="report-topline" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={14} color="#f97316" />
          <span>
            As-of snapshot: <b>{summary?.snapshot_date || '2026-09-28'}</b>
            {summary?.file_name && <span style={{ opacity: 0.7, marginLeft: 8 }}>({summary.file_name})</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: '#8eb8ff' }}>
            {summary?.basepacks_scoped || 177} basepacks in OLA scope · {summary?.basepacks_no_normal || 7} not listed as Normal
          </span>
          <button
            onClick={loadData}
            className="secondary-btn"
            style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid kpis" style={{ marginBottom: 20 }}>
        <div className="kpi-card tone-green">
          <div className="kpi-top">
            <span className="kpi-label">Daraz Daily OLA</span>
            <PackageCheck size={16} />
          </div>
          <div className="kpi-value">{summary ? `${summary.daraz_ola_pct.toFixed(1)}%` : '88.1%'}</div>
          <div className="kpi-note">{summary?.basepacks_available || 156} of {summary?.basepacks_scoped || 177} basepacks in stock</div>
        </div>

        <div className="kpi-card tone-red">
          <div className="kpi-top">
            <span className="kpi-label">NOLA Basepacks</span>
            <PackageX size={16} />
          </div>
          <div className="kpi-value">{summary?.basepacks_nola ?? 21}</div>
          <div className="kpi-note">All Normal SKUs at 0 stock</div>
        </div>

        <div className="kpi-card tone-amber">
          <div className="kpi-top">
            <span className="kpi-label">Low Stock (1–9 Units)</span>
            <Boxes size={16} />
          </div>
          <div className="kpi-value">{summary?.mapped_low_stock ?? 15}</div>
          <div className="kpi-note">Counted available, replenishment needed</div>
        </div>

        <div className="kpi-card tone-amber">
          <div className="kpi-top">
            <span className="kpi-label">Combined Low Basepacks</span>
            <TrendingUp size={16} />
          </div>
          <div className="kpi-value">{summary?.available_basepacks_low_stock ?? 10}</div>
          <div className="kpi-note">Available basepacks with total stock &lt; 10</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Unmapped Normal SKUs</span>
            <Tag size={16} />
          </div>
          <div className="kpi-value">{summary?.rows_unmapped ?? 44}</div>
          <div className="kpi-note">Queue for master data mapping</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="report-tabs" role="tablist" style={{ margin: 0 }}>
          <button
            className={activeTab === 'low_stock' ? 'active' : ''}
            onClick={() => setActiveTab('low_stock')}
          >
            Panel 1: Low Stock (1–9 Units)
          </button>
          <button
            className={activeTab === 'unmapped' ? 'active' : ''}
            onClick={() => setActiveTab('unmapped')}
          >
            Panel 2: Unmapped SKUs ({summary?.rows_unmapped ?? 44})
          </button>
          <button
            className={activeTab === 'no_normal' ? 'active' : ''}
            onClick={() => setActiveTab('no_normal')}
          >
            Panel 3: No-Normal Basepacks ({summary?.basepacks_no_normal ?? 7})
          </button>
          <button
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            Upload DOD File
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card error-card">
          <strong>Could not load Daraz data.</strong>
          <div>{error}</div>
        </div>
      ) : (
        <>
          {/* TAB 1: LOW STOCK PANEL */}
          {activeTab === 'low_stock' && (
            <div className="card">
              <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2>Low Stock Radar (1–9 Units)</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    These SKUs have stock between 1 and 9. They are counted as <b>Available</b> in OLA, but represent immediate stockout risk.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className={`secondary-btn ${lowStockView === 'sku' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: lowStockView === 'sku' ? 'rgba(47,125,255,0.2)' : 'transparent',
                      borderColor: lowStockView === 'sku' ? '#2f7dff' : 'var(--border)',
                      color: lowStockView === 'sku' ? '#8eb8ff' : 'var(--muted)',
                    }}
                    onClick={() => setLowStockView('sku')}
                  >
                    SKU View ({filteredLowStock.length})
                  </button>
                  <button
                    className={`secondary-btn ${lowStockView === 'basepack' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: lowStockView === 'basepack' ? 'rgba(47,125,255,0.2)' : 'transparent',
                      borderColor: lowStockView === 'basepack' ? '#2f7dff' : 'var(--border)',
                      color: lowStockView === 'basepack' ? '#8eb8ff' : 'var(--muted)',
                    }}
                    onClick={() => setLowStockView('basepack')}
                  >
                    Basepack Combined View ({basepackLowStockList.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ display: 'flex', gap: 10, margin: '14px 0' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
                  <input
                    type="text"
                    value={lowStockSearch}
                    onChange={(e) => setLowStockSearch(e.target.value)}
                    placeholder="Search by SKU, product name, basepack, or brand..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 34px',
                      borderRadius: 8,
                      background: '#0e1628',
                      border: '1px solid var(--border)',
                      color: 'white',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* View 1: SKU Level Table */}
              {lowStockView === 'sku' && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Daraz SKU</th>
                        <th>Product / Site Name</th>
                        <th>Basepack</th>
                        <th>Brand / Category</th>
                        <th style={{ textAlign: 'center' }}>Stock Qty</th>
                        <th style={{ textAlign: 'center' }}>Basepack Total</th>
                        <th>Sale Price / MRP</th>
                        <th style={{ textAlign: 'center' }}>OLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLowStock.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                            No low-stock SKUs matching filter.
                          </td>
                        </tr>
                      ) : (
                        filteredLowStock.map((item) => (
                          <tr key={item.daraz_sku}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#8eb8ff' }}>
                              {item.daraz_sku}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.product_name}</div>
                            </td>
                            <td>{item.basepack_name}</td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{item.brand}</span>
                              <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>({item.category})</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                }}
                              >
                                {item.stock_qty} units
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: item.basepack_total_stock < 10 ? '#fbbf24' : '#34d399',
                                  fontWeight: 600,
                                }}
                              >
                                {item.basepack_total_stock} units
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {item.sale_price ? `৳${item.sale_price}` : '—'}
                              {item.mrp && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>(MRP ৳{item.mrp})</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="status ok" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Available
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2: Basepack Level Table */}
              {lowStockView === 'basepack' && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Basepack</th>
                        <th>Brand</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'center' }}>Combined Normal Stock</th>
                        <th style={{ textAlign: 'center' }}>Low SKUs Count</th>
                        <th>SKUs in Scope</th>
                        <th style={{ textAlign: 'center' }}>OLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basepackLowStockList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                            No basepacks matching filter.
                          </td>
                        </tr>
                      ) : (
                        basepackLowStockList.map((bp) => (
                          <tr key={bp.basepack_id}>
                            <td style={{ fontWeight: 600 }}>{bp.basepack_name}</td>
                            <td>{bp.brand}</td>
                            <td style={{ color: 'var(--muted)' }}>{bp.category}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  background: bp.total_stock < 10 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                  color: bp.total_stock < 10 ? '#fbbf24' : '#34d399',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: `1px solid ${bp.total_stock < 10 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                                }}
                              >
                                {bp.total_stock} units total
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {bp.skus.length}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {bp.skus.map((s) => (
                                <span
                                  key={s.daraz_sku}
                                  style={{
                                    display: 'inline-block',
                                    marginRight: 6,
                                    marginBottom: 3,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#152136',
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    color: '#c7d6eb',
                                  }}
                                  title={`${s.product_name} (${s.stock_qty} units)`}
                                >
                                  {s.daraz_sku} ({s.stock_qty})
                                </span>
                              ))}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="status ok" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Available
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UNMAPPED SKUS PANEL */}
          {activeTab === 'unmapped' && (
            <div className="card">
              <div className="section-title">
                <h2>Normal SKUs Not Mapped to a Basepack (Master Queue)</h2>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  These SKUs have <code>sku_status_details = 'Normal'</code> in the Daraz file but are not yet registered in <code>account_products</code>. Once added to the master, they automatically count towards OLA.
                </span>
              </div>

              {/* Notice Banner */}
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 10,
                  padding: 12,
                  margin: '12px 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#93c5fd',
                }}
              >
                <Tag size={18} />
                <span>
                  <b>Master Maintenance Queue:</b> Ordered by stock descending so you can prioritize mapping SKUs with live inventory.
                </span>
              </div>

              {/* Search Bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
                  <input
                    type="text"
                    value={unmappedSearch}
                    onChange={(e) => setUnmappedSearch(e.target.value)}
                    placeholder="Search by SKU or product name..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 34px',
                      borderRadius: 8,
                      background: '#0e1628',
                      border: '1px solid var(--border)',
                      color: 'white',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Daraz SKU</th>
                      <th>Product Name</th>
                      <th style={{ textAlign: 'center' }}>Stock Qty</th>
                      <th>Sale Price / MRP</th>
                      <th style={{ textAlign: 'center' }}>Stock Classification</th>
                      <th style={{ textAlign: 'center' }}>Action Needed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnmapped.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                          {unmappedItems.length === 0
                            ? 'All Normal SKUs in the latest file are mapped to master basepacks! (44 expected on 28 Sep file)'
                            : 'No SKUs matching search query.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUnmapped.map((item) => (
                        <tr key={item.daraz_sku}>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#8eb8ff' }}>
                            {item.daraz_sku}
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: 12,
                                background: item.stock_qty === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: item.stock_qty === 0 ? '#f87171' : '#34d399',
                              }}
                            >
                              {item.stock_qty}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {item.sale_price ? `৳${item.sale_price}` : '—'}
                            {item.mrp && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>(MRP ৳{item.mrp})</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.stock_qty === 0 ? (
                              <span className="status bad" style={{ fontSize: 11 }}>Zero Stock</span>
                            ) : item.low_stock ? (
                              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f59e0b26', color: '#fbbf24' }}>
                                Low Stock
                              </span>
                            ) : (
                              <span className="status ok" style={{ fontSize: 11 }}>In Stock</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>
                              Map in account_products
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BASEPACKS WITH NO NORMAL SKU */}
          {activeTab === 'no_normal' && (
            <div className="card">
              <div className="section-title">
                <h2>Basepacks with No Normal SKU (Excluded from OLA)</h2>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Active Unilever basepacks in Daraz scope that currently have <b>zero Normal SKUs</b> in the DOD file (their mapped SKUs are either Off-Shelf, Deleted, or absent). They are excluded from the OLA denominator.
                </span>
              </div>

              {/* Informational Banner */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 10,
                  padding: 12,
                  margin: '12px 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#fcd34d',
                }}
              >
                <HelpCircle size={18} />
                <span>
                  <b>Denominator Rule:</b> Daraz OLA denominator includes only basepacks with at least one Normal SKU in that day&apos;s file ({summary?.basepacks_scoped || 177} basepacks). These {summary?.basepacks_no_normal || 7} basepacks are kept out to prevent false penalties.
                </span>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Basepack</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Business Unit</th>
                      <th>Format</th>
                      <th style={{ textAlign: 'center' }}>Scope Status in Daraz OLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noNormalBps.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                          No excluded basepacks.
                        </td>
                      </tr>
                    ) : (
                      noNormalBps.map((bp) => (
                        <tr key={bp.basepack_id}>
                          <td style={{ fontWeight: 600 }}>{bp.basepack_name}</td>
                          <td>{bp.brand}</td>
                          <td>{bp.category}</td>
                          <td style={{ color: 'var(--muted)' }}>{bp.business_unit}</td>
                          <td style={{ color: 'var(--muted)' }}>{bp.format || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'rgba(148, 163, 184, 0.12)',
                                color: '#94a3b8',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Excluded (No Normal SKU)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: UPLOAD DOD FILE */}
          {activeTab === 'upload' && (
            <div className="card">
              <div className="section-title">
                <h2>Upload Daraz DOD Excel File</h2>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Upload daily <code>UBL_DOD_[Date].xlsx</code> to calculate Daraz OLA and update low-stock panels immediately.
                </span>
              </div>

              <form onSubmit={handleUploadSubmit} style={{ maxWidth: 640, marginTop: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                    Excel File (.xlsx)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setUploadFile(f)
                    }}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      background: '#0e1628',
                      border: '1px solid var(--border)',
                      color: 'white',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Standard format: Sheet with columns <code>daraz_sku</code>, <code>sku_status_details</code>, <code>Total - Stock</code>, etc.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Snapshot Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 8,
                        background: '#0e1628',
                        border: '1px solid var(--border)',
                        color: 'white',
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Leave blank to auto-detect from filename (e.g. <code>28th_Sep</code>).
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
                      <input
                        type="checkbox"
                        checked={uploadDryRun}
                        onChange={(e) => setUploadDryRun(e.target.checked)}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Dry Run Only (Validate without saving)</span>
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Safely preview OLA percentage and SKU counts before committing.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={!uploadFile || uploading}
                    className="pill"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: !uploadFile || uploading ? 0.6 : 1,
                    }}
                  >
                    <UploadCloud size={16} />
                    {uploading ? 'Processing File...' : uploadDryRun ? 'Run Validation Dry-Run' : 'Import & Compute OLA'}
                  </button>
                </div>
              </form>

              {uploadError && (
                <div className="card error-card" style={{ marginTop: 20 }}>
                  <strong>Upload Error:</strong>
                  <div>{uploadError}</div>
                </div>
              )}

              {uploadResult && (
                <div
                  className="card"
                  style={{
                    marginTop: 20,
                    background: uploadResult.dry_run ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    borderColor: uploadResult.dry_run ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <CheckCircle2 color={uploadResult.dry_run ? '#60a5fa' : '#34d399'} size={20} />
                    <h3 style={{ margin: 0, fontSize: 15, color: uploadResult.dry_run ? '#93c5fd' : '#6ee7b7' }}>
                      {uploadResult.dry_run ? 'Dry Run Validation Results' : 'Import Completed Successfully'}
                    </h3>
                  </div>

                  <div className="table-wrap">
                    <table className="table" style={{ fontSize: 13 }}>
                      <tbody>
                        <tr>
                          <td><b>Snapshot Date:</b></td>
                          <td>{uploadResult.summary.snapshot_date}</td>
                          <td><b>Daraz OLA:</b></td>
                          <td style={{ color: '#34d399', fontWeight: 800 }}>{uploadResult.summary.daraz_ola_pct}%</td>
                        </tr>
                        <tr>
                          <td><b>Total Rows in File:</b></td>
                          <td>{uploadResult.summary.rows_total}</td>
                          <td><b>Normal SKUs:</b></td>
                          <td>{uploadResult.summary.rows_normal}</td>
                        </tr>
                        <tr>
                          <td><b>Mapped to Master:</b></td>
                          <td>{uploadResult.summary.rows_mapped}</td>
                          <td><b>Unmapped Normal (Panel 2):</b></td>
                          <td>{uploadResult.summary.rows_unmapped}</td>
                        </tr>
                        <tr>
                          <td><b>Basepacks in OLA Scope:</b></td>
                          <td>{uploadResult.summary.basepacks_scoped}</td>
                          <td><b>Excluded (No Normal SKU, Panel 3):</b></td>
                          <td>{uploadResult.summary.basepacks_no_normal}</td>
                        </tr>
                        <tr>
                          <td><b>Available Basepacks:</b></td>
                          <td>{uploadResult.summary.basepacks_available}</td>
                          <td><b>NOLA Basepacks:</b></td>
                          <td>{uploadResult.summary.basepacks_nola}</td>
                        </tr>
                        <tr>
                          <td><b>Low Stock SKUs (1–9, Panel 1):</b></td>
                          <td>{uploadResult.summary.mapped_low_stock}</td>
                          <td><b>Combined Low Basepacks (&lt;10):</b></td>
                          <td>{uploadResult.summary.available_basepacks_low_stock}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
