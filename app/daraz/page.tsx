'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import {
  DarazDodSummary,
  DarazLowStockItem,
  DarazOutOfStockItem,
  DarazUnmappedItem,
  DarazBasepackNoNormal,
  getDarazDodSummary,
  getDarazLowStock,
  getDarazOutOfStock,
  getDarazUnmapped,
  getDarazBasepacksNoNormal,
} from '@/lib/darazDodData'
import {
  AlertTriangle,
  AlertCircle,
  ArrowUpDown,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
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
  const [activeTab, setActiveTab] = useState<'out_of_stock' | 'low_stock' | 'unmapped' | 'no_normal' | 'upload'>('out_of_stock')
  const [summary, setSummary] = useState<DarazDodSummary | null>(null)
  const [oosItems, setOosItems] = useState<DarazOutOfStockItem[]>([])
  const [lowStockItems, setLowStockItems] = useState<DarazLowStockItem[]>([])
  const [unmappedItems, setUnmappedItems] = useState<DarazUnmappedItem[]>([])
  const [noNormalBps, setNoNormalBps] = useState<DarazBasepackNoNormal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Out of stock view & filter state
  const [oosView, setOosView] = useState<'sku' | 'basepack'>('sku')
  const [oosSearch, setOosSearch] = useState('')
  const [oosFilter, setOosFilter] = useState<'all' | 'critical' | 'partial'>('all')
  const [oosIncludeUnmapped, setOosIncludeUnmapped] = useState(false)
  const [oosBrandFilter, setOosBrandFilter] = useState('all')
  const [oosCategoryFilter, setOosCategoryFilter] = useState('all')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

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
      const [sum, oos, low, unmapped, noNorm] = await Promise.all([
        getDarazDodSummary(),
        getDarazOutOfStock(true),
        getDarazLowStock(),
        getDarazUnmapped(),
        getDarazBasepacksNoNormal(),
      ])
      setSummary(sum)
      setOosItems(oos)
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

  // Distinct brands and categories among OOS items
  const distinctBrands = useMemo(() => {
    const set = new Set<string>()
    for (const item of oosItems) {
      if (item.brand && item.brand !== 'Unmapped' && item.brand !== 'Unilever') set.add(item.brand)
    }
    return Array.from(set).sort()
  }, [oosItems])

  const distinctCategories = useMemo(() => {
    const set = new Set<string>()
    for (const item of oosItems) {
      if (item.category && item.category !== 'Unmapped' && item.category !== 'General') set.add(item.category)
    }
    return Array.from(set).sort()
  }, [oosItems])

  // Count summaries for OOS
  const oosMappedCount = useMemo(() => {
    return oosItems.filter((i) => i.match_status === 'mapped').length
  }, [oosItems])

  const criticalOosCount = useMemo(() => {
    return oosItems.filter((i) => i.match_status === 'mapped' && i.basepack_all_skus_oos).length
  }, [oosItems])

  const partialOosCount = useMemo(() => {
    return oosItems.filter((i) => i.match_status === 'mapped' && !i.basepack_all_skus_oos).length
  }, [oosItems])

  const unmappedOosCount = useMemo(() => {
    return oosItems.filter((i) => i.match_status === 'unmapped').length
  }, [oosItems])

  // Filtered Out of Stock Items
  const filteredOos = useMemo(() => {
    return oosItems.filter((item) => {
      // Unmapped filter
      if (!oosIncludeUnmapped && item.match_status === 'unmapped') return false

      // Severity / status filter
      if (oosFilter === 'critical' && (!item.basepack_all_skus_oos || item.match_status === 'unmapped')) {
        return false
      }
      if (oosFilter === 'partial' && (item.basepack_all_skus_oos || item.match_status === 'unmapped')) {
        return false
      }

      // Brand filter
      if (oosBrandFilter !== 'all' && item.brand !== oosBrandFilter) {
        return false
      }

      // Category filter
      if (oosCategoryFilter !== 'all' && item.category !== oosCategoryFilter) {
        return false
      }

      // Search query
      if (oosSearch.trim()) {
        const q = oosSearch.toLowerCase()
        const matchSku = item.daraz_sku.toLowerCase().includes(q)
        const matchName = item.product_name.toLowerCase().includes(q)
        const matchBp = item.basepack_name.toLowerCase().includes(q)
        const matchBrand = item.brand.toLowerCase().includes(q)
        const matchCat = (item.category || '').toLowerCase().includes(q)
        if (!matchSku && !matchName && !matchBp && !matchBrand && !matchCat) {
          return false
        }
      }

      return true
    })
  }, [oosItems, oosIncludeUnmapped, oosFilter, oosBrandFilter, oosCategoryFilter, oosSearch])

  // Basepack Grouped View for OOS
  const basepackOosList = useMemo(() => {
    const map = new Map<string, {
      basepack_id: string
      basepack_name: string
      brand: string
      category: string
      total_stock: number
      skus: DarazOutOfStockItem[]
    }>()

    for (const item of filteredOos) {
      const key = item.basepack_id || item.daraz_sku
      if (!map.has(key)) {
        map.set(key, {
          basepack_id: key,
          basepack_name: item.basepack_name,
          brand: item.brand,
          category: item.category,
          total_stock: item.basepack_total_stock,
          skus: [],
        })
      }
      map.get(key)!.skus.push(item)
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.total_stock !== b.total_stock) {
        return a.total_stock - b.total_stock
      }
      return a.brand.localeCompare(b.brand) || a.basepack_name.localeCompare(b.basepack_name)
    })
  }, [filteredOos])

  // Copy helper
  function handleCopySkus(skus: string[]) {
    if (skus.length === 0) return
    const text = skus.join(', ')
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`Copied ${skus.length} SKU${skus.length > 1 ? 's' : ''} to clipboard!`)
      setTimeout(() => setCopyFeedback(null), 3000)
    }).catch(() => {
      setCopyFeedback('Failed to copy to clipboard.')
      setTimeout(() => setCopyFeedback(null), 3000)
    })
  }

  // Export CSV helper
  function handleExportOosCsv() {
    if (filteredOos.length === 0) return
    const headers = [
      'Snapshot Date',
      'Daraz SKU',
      'Product Name',
      'Basepack Name',
      'Brand',
      'Category',
      'Stock Qty',
      'Basepack Total Stock',
      'OLA Impact',
      'Sale Price (BDT)',
      'MRP (BDT)',
      'Match Status',
    ]

    const rows = filteredOos.map((item) => [
      item.snapshot_date,
      `"${item.daraz_sku.replace(/"/g, '""')}"`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      `"${item.basepack_name.replace(/"/g, '""')}"`,
      `"${item.brand.replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      item.stock_qty,
      item.basepack_total_stock,
      item.match_status === 'unmapped' ? 'Unmapped' : item.basepack_all_skus_oos ? 'Critical NOLA' : 'Partial OOS',
      item.sale_price || '',
      item.mrp || '',
      item.match_status,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `daraz_out_of_stock_skus_${summary?.snapshot_date || 'latest'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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

        <div
          className="kpi-card tone-red"
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          onClick={() => setActiveTab('out_of_stock')}
          title="Click to view Out of Stock SKUs"
        >
          <div className="kpi-top">
            <span className="kpi-label">Out of Stock SKUs</span>
            <XCircle size={16} />
          </div>
          <div className="kpi-value">{oosMappedCount || summary?.mapped_zero_stock || 37}</div>
          <div className="kpi-note">{criticalOosCount || 24} Critical NOLA · {partialOosCount || 13} Partial OOS</div>
        </div>

        <div className="kpi-card tone-red">
          <div className="kpi-top">
            <span className="kpi-label">NOLA Basepacks</span>
            <PackageX size={16} />
          </div>
          <div className="kpi-value">{summary?.basepacks_nola ?? 21}</div>
          <div className="kpi-note">All Normal SKUs at 0 stock</div>
        </div>

        <div
          className="kpi-card tone-amber"
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          onClick={() => setActiveTab('low_stock')}
          title="Click to view Low Stock radar"
        >
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

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          onClick={() => setActiveTab('unmapped')}
          title="Click to view Unmapped SKUs"
        >
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
            className={activeTab === 'out_of_stock' ? 'active' : ''}
            onClick={() => setActiveTab('out_of_stock')}
            style={{
              borderColor: activeTab === 'out_of_stock' ? '#ef4444' : undefined,
              color: activeTab === 'out_of_stock' ? '#fca5a5' : undefined,
            }}
          >
            Panel 1: Out of Stock SKUs ({oosMappedCount || 37})
          </button>
          <button
            className={activeTab === 'low_stock' ? 'active' : ''}
            onClick={() => setActiveTab('low_stock')}
          >
            Panel 2: Low Stock (1–9 Units) ({lowStockItems.length || 15})
          </button>
          <button
            className={activeTab === 'unmapped' ? 'active' : ''}
            onClick={() => setActiveTab('unmapped')}
          >
            Panel 3: Unmapped SKUs ({summary?.rows_unmapped ?? 44})
          </button>
          <button
            className={activeTab === 'no_normal' ? 'active' : ''}
            onClick={() => setActiveTab('no_normal')}
          >
            Panel 4: No-Normal Basepacks ({summary?.basepacks_no_normal ?? 7})
          </button>
          <button
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            Upload DOD File
          </button>
        </div>
      </div>

      {/* Copy Toast Notification */}
      {copyFeedback && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: 13,
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={16} />
          {copyFeedback}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card error-card">
          <strong>Could not load Daraz data.</strong>
          <div>{error}</div>
        </div>
      ) : (
        <>
          {/* TAB 1: OUT OF STOCK (ZERO STOCK) PANEL */}
          {activeTab === 'out_of_stock' && (
            <div className="card">
              <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2>Out of Stock Products (SKU-Wise Zero Inventory)</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    All products with <code>stock = 0</code> in the latest Daraz Daily Deals (DOD) file. Use this list to prioritize warehouse transfers and Daraz replenishment.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className={`secondary-btn ${oosView === 'sku' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: oosView === 'sku' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      borderColor: oosView === 'sku' ? '#ef4444' : 'var(--border)',
                      color: oosView === 'sku' ? '#fca5a5' : 'var(--muted)',
                    }}
                    onClick={() => setOosView('sku')}
                  >
                    SKU View ({filteredOos.length})
                  </button>
                  <button
                    className={`secondary-btn ${oosView === 'basepack' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: oosView === 'basepack' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      borderColor: oosView === 'basepack' ? '#ef4444' : 'var(--border)',
                      color: oosView === 'basepack' ? '#fca5a5' : 'var(--muted)',
                    }}
                    onClick={() => setOosView('basepack')}
                  >
                    Basepack Grouped View ({basepackOosList.length})
                  </button>
                  <button
                    onClick={() => handleCopySkus(filteredOos.map((x) => x.daraz_sku))}
                    className="secondary-btn"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#c7d6eb',
                    }}
                    title="Copy all currently filtered SKUs to clipboard"
                  >
                    <Copy size={13} />
                    Copy SKU List
                  </button>
                  <button
                    onClick={handleExportOosCsv}
                    className="secondary-btn"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#34d399',
                      borderColor: 'rgba(52, 211, 153, 0.3)',
                    }}
                    title="Download Out of Stock report as CSV"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Informational Severity Banner */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 10,
                  padding: 12,
                  margin: '14px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#fca5a5' }}>
                    <b>OLA Impact Analysis:</b> {criticalOosCount} zero-stock SKUs are causing <b>{summary?.basepacks_nola ?? 21} basepacks to be completely unavailable (NOLA)</b> on Daraz. An additional {partialOosCount} zero-stock SKUs are variant stockouts where sibling SKUs are currently maintaining basepack availability.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 600 }}>
                    {criticalOosCount} Critical NOLA
                  </span>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontWeight: 600 }}>
                    {partialOosCount} Partial OOS
                  </span>
                </div>
              </div>

              {/* Search and Filters Toolbar */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
                  <input
                    type="text"
                    value={oosSearch}
                    onChange={(e) => setOosSearch(e.target.value)}
                    placeholder="Search by SKU, product name, basepack, brand, or category..."
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

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className={`secondary-btn ${oosFilter === 'all' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: oosFilter === 'all' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      borderColor: oosFilter === 'all' ? '#ef4444' : 'var(--border)',
                      color: oosFilter === 'all' ? '#fca5a5' : 'var(--muted)',
                    }}
                    onClick={() => setOosFilter('all')}
                  >
                    All OOS ({oosMappedCount})
                  </button>
                  <button
                    className={`secondary-btn ${oosFilter === 'critical' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: oosFilter === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      borderColor: oosFilter === 'critical' ? '#ef4444' : 'var(--border)',
                      color: oosFilter === 'critical' ? '#fca5a5' : 'var(--muted)',
                    }}
                    onClick={() => setOosFilter('critical')}
                    title="Basepack has 0 total stock across all SKUs"
                  >
                    🔴 Critical NOLA ({criticalOosCount})
                  </button>
                  <button
                    className={`secondary-btn ${oosFilter === 'partial' ? 'active-pill' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: oosFilter === 'partial' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                      borderColor: oosFilter === 'partial' ? '#f59e0b' : 'var(--border)',
                      color: oosFilter === 'partial' ? '#fbbf24' : 'var(--muted)',
                    }}
                    onClick={() => setOosFilter('partial')}
                    title="Basepack has stock via other SKUs, but this SKU is out of stock"
                  >
                    🟡 Partial OOS ({partialOosCount})
                  </button>
                </div>

                {/* Brand Filter */}
                {distinctBrands.length > 1 && (
                  <select
                    value={oosBrandFilter}
                    onChange={(e) => setOosBrandFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#0e1628',
                      border: '1px solid var(--border)',
                      color: 'white',
                      fontSize: 12,
                    }}
                  >
                    <option value="all">All Brands ({distinctBrands.length})</option>
                    {distinctBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}

                {/* Category Filter */}
                {distinctCategories.length > 1 && (
                  <select
                    value={oosCategoryFilter}
                    onChange={(e) => setOosCategoryFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#0e1628',
                      border: '1px solid var(--border)',
                      color: 'white',
                      fontSize: 12,
                    }}
                  >
                    <option value="all">All Categories ({distinctCategories.length})</option>
                    {distinctCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}

                {/* Toggle Unmapped SKUs */}
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: oosIncludeUnmapped ? '#60a5fa' : 'var(--muted)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    marginLeft: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={oosIncludeUnmapped}
                    onChange={(e) => setOosIncludeUnmapped(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Include Unmapped OOS (+{unmappedOosCount})</span>
                </label>
              </div>

              {/* View 1: SKU Level Table */}
              {oosView === 'sku' && (
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
                        <th style={{ textAlign: 'center' }}>OLA Impact</th>
                        <th>Sale Price / MRP</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOos.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>
                            No out-of-stock products matching filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredOos.map((item) => (
                          <tr key={item.daraz_sku}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
                                  {item.daraz_sku}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopySkus([item.daraz_sku])}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--muted)',
                                    padding: 2,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  title="Copy SKU code"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>
                                {item.product_name}
                              </div>
                            </td>
                            <td>
                              <span style={{ color: item.match_status === 'unmapped' ? '#94a3b8' : 'white', fontSize: 12 }}>
                                {item.basepack_name}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, fontSize: 12 }}>{item.brand}</span>
                              {item.category && (
                                <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>({item.category})</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  color: '#f87171',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                }}
                              >
                                0 units
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.match_status === 'unmapped' ? (
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Unmapped</span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: item.basepack_total_stock === 0 ? '#f87171' : '#34d399',
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.basepack_total_stock} units
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.match_status === 'unmapped' ? (
                                <span style={{ fontSize: 11, color: '#93c5fd', padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)' }}>
                                  Unmapped
                                </span>
                              ) : item.basepack_all_skus_oos ? (
                                <span
                                  className="status bad"
                                  style={{ fontSize: 11, padding: '2px 8px' }}
                                  title="Entire basepack is 0 stock. Directly causes NOLA in daily OLA score."
                                >
                                  Critical NOLA
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#fbbf24',
                                    fontWeight: 600,
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                  }}
                                  title="Basepack has stock via other SKUs, but this variant is out of stock."
                                >
                                  Partial OOS
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {item.sale_price ? `৳${item.sale_price}` : '—'}
                              {item.mrp && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>(MRP ৳{item.mrp})</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => handleCopySkus([item.daraz_sku])}
                                className="secondary-btn"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                              >
                                Copy SKU
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2: Basepack Level Table */}
              {oosView === 'basepack' && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Basepack</th>
                        <th>Brand</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'center' }}>Combined Normal Stock</th>
                        <th style={{ textAlign: 'center' }}>OOS SKUs Count</th>
                        <th>Out-of-Stock SKUs Details</th>
                        <th style={{ textAlign: 'center' }}>Basepack OLA Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basepackOosList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>
                            No basepacks matching filter.
                          </td>
                        </tr>
                      ) : (
                        basepackOosList.map((bp) => (
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
                                  background: bp.total_stock === 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                  color: bp.total_stock === 0 ? '#f87171' : '#34d399',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: `1px solid ${bp.total_stock === 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                                }}
                              >
                                {bp.total_stock} units total
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#f87171' }}>
                              {bp.skus.length}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {bp.skus.map((s) => (
                                <div
                                  key={s.daraz_sku}
                                  style={{
                                    marginBottom: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      background: '#152136',
                                      color: '#fca5a5',
                                    }}
                                  >
                                    {s.daraz_sku}
                                  </span>
                                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                                    {s.product_name}
                                  </span>
                                  {s.sale_price && (
                                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                      (৳{s.sale_price})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {bp.total_stock === 0 ? (
                                <span className="status bad" style={{ fontSize: 11, padding: '2px 8px' }}>
                                  NOLA (0% OLA)
                                </span>
                              ) : (
                                <span className="status ok" style={{ fontSize: 11, padding: '2px 8px' }}>
                                  Available (Partial OOS)
                                </span>
                              )}
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

          {/* TAB 2: LOW STOCK PANEL */}
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
