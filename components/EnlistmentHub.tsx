'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  EnlistmentProduct,
  EnlistmentKPIs,
  computeEnlistmentKPIs,
  getEnlistmentProducts,
  createEnlistmentProduct,
  updateEnlistmentProduct,
  deleteEnlistmentProduct,
  exportEnlistmentToCSV,
  EnlistmentInput,
  STANDARD_PLATFORMS,
  togglePlatformEnlisted,
  bulkMarkEnlisted,
  bulkUpdateStatus,
  bulkDeleteProducts,
  EnlistmentAccount,
  getEnlistmentAccounts,
} from '@/lib/enlistmentData'
import EnlistmentModal from '@/components/EnlistmentModal'
import EnlistmentDetailModal from '@/components/EnlistmentDetailModal'
import EnlistmentShareModal from '@/components/EnlistmentShareModal'
import EnlistmentImportModal from '@/components/EnlistmentImportModal'
import EnlistmentAccountsModal from '@/components/EnlistmentAccountsModal'
import {
  Search,
  Plus,
  Share2,
  Download,
  Upload,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  Shield,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  X,
  ExternalLink,
  CheckCheck,
  Store,
} from 'lucide-react'

interface EnlistmentHubProps {
  initialIsPartnerView?: boolean
  initialPlatform?: string
}

export default function EnlistmentHub({
  initialIsPartnerView = false,
  initialPlatform = '',
}: EnlistmentHubProps) {
  const [products, setProducts] = useState<EnlistmentProduct[]>([])
  const [accounts, setAccounts] = useState<EnlistmentAccount[]>([])
  const [isAccountsOpen, setIsAccountsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPartnerView, setIsPartnerView] = useState(initialIsPartnerView)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState(initialPlatform || 'all')
  const [platformStatusFilter, setPlatformStatusFilter] = useState<'all' | 'live' | 'pending'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<EnlistmentProduct | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<EnlistmentProduct | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionBusy, setBulkActionBusy] = useState(false)
  const [bulkTargetPlatform, setBulkTargetPlatform] = useState<string>('Daraz')

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [items, accs] = await Promise.all([
        getEnlistmentProducts(),
        getEnlistmentAccounts(),
      ])
      setProducts(items)
      setAccounts(accs)
      // Clean up selections that no longer exist
      const existingIds = new Set(items.map((i) => i.id))
      setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => existingIds.has(id))))
    } catch (err: any) {
      console.error('Failed to load enlistment products from database:', err)
      setError(err?.message || 'Failed to load products from database')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sync initialPlatform if prop changes
  useEffect(() => {
    if (initialPlatform) {
      setPlatformFilter(initialPlatform)
    }
  }, [initialPlatform])

  // Active accounts for tracking, filtering, and bulk actions
  const activeAccountNames = useMemo(() => {
    const fromAccounts = accounts.filter((a) => a.active).map((a) => a.name)
    if (fromAccounts.length > 0) return fromAccounts

    // Fallback to accounts in products or standard platforms
    const set = new Set<string>()
    for (const p of products) {
      for (const tp of p.target_platforms || []) set.add(tp)
    }
    if (set.size > 0) return Array.from(set).sort()
    return Array.from(STANDARD_PLATFORMS)
  }, [accounts, products])

  // Sync bulk target platform when active accounts change
  useEffect(() => {
    if (activeAccountNames.length > 0 && !activeAccountNames.includes(bulkTargetPlatform)) {
      setBulkTargetPlatform(activeAccountNames[0])
    }
  }, [activeAccountNames, bulkTargetPlatform])

  // Compute KPIs
  const kpis: EnlistmentKPIs = useMemo(() => {
    return computeEnlistmentKPIs(products)
  }, [products])

  // Unique filter lists
  const brandsList = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter(Boolean))
    return Array.from(set).sort()
  }, [products])

  const categoriesList = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [products])

  const deptsList = useMemo(() => {
    const set = new Set(products.map((p) => p.dept).filter(Boolean))
    return Array.from(set).sort()
  }, [products])

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((p) => {
      if (brandFilter !== 'all' && p.brand?.toLowerCase() !== brandFilter.toLowerCase()) return false
      if (categoryFilter !== 'all' && p.category?.toLowerCase() !== categoryFilter.toLowerCase())
        return false
      if (deptFilter !== 'all' && p.dept?.toLowerCase() !== deptFilter.toLowerCase()) return false
      if (statusFilter !== 'all' && p.enlistment_status !== statusFilter) return false

      if (platformFilter !== 'all') {
        const isTargeted = p.target_platforms?.some(
          (tp) => tp.toLowerCase() === platformFilter.toLowerCase()
        )
        if (!isTargeted) return false

        const isLive = (p.enlisted_platforms || []).some(
          (ep) => ep.toLowerCase() === platformFilter.toLowerCase()
        )

        if (platformStatusFilter === 'live' && !isLive) return false
        if (platformStatusFilter === 'pending' && isLive) return false
      }

      if (!q) return true
      return (
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.subcategory?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    })
  }, [
    products,
    searchQuery,
    brandFilter,
    categoryFilter,
    deptFilter,
    statusFilter,
    platformFilter,
    platformStatusFilter,
  ])

  // Bulk Selection Handlers
  function toggleSelectProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAllFiltered() {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Clipboard copy helper
  function copyText(text: string, key: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  // Export CSV
  function handleExportCSV() {
    const csvContent = exportEnlistmentToCSV(filteredProducts)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const platformSuffix = platformFilter !== 'all' ? `_${platformFilter}` : ''
    link.setAttribute(
      'download',
      `UBL_Product_Enlistment${platformSuffix}_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CRUD Handlers
  async function handleSaveProduct(formData: EnlistmentInput, id?: string) {
    try {
      if (id) {
        const updated = await updateEnlistmentProduct(id, formData)
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
      } else {
        const created = await createEnlistmentProduct(formData)
        setProducts((prev) => [created, ...prev])
      }
    } catch (err: any) {
      alert(`Database operation failed: ${err.message || err}`)
      throw err
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (confirm(`Are you sure you want to remove "${name}" from the database?`)) {
      try {
        await deleteEnlistmentProduct(id)
        setProducts((prev) => prev.filter((p) => p.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (err: any) {
        alert(`Database delete failed: ${err.message || err}`)
      }
    }
  }

  async function handleQuickStatusChange(id: string, newStatus: any) {
    try {
      const updated = await updateEnlistmentProduct(id, { enlistment_status: newStatus })
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
    } catch (err: any) {
      alert(`Database update failed: ${err.message || err}`)
    }
  }

  // Per-Platform live status toggle
  async function handleTogglePlatformEnlisted(product: EnlistmentProduct, platform: string) {
    try {
      const updated = await togglePlatformEnlisted(product, platform)
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      if (selectedProduct && selectedProduct.id === updated.id) {
        setSelectedProduct(updated)
      }
    } catch (err: any) {
      alert(`Failed to update platform enlistment status: ${err.message || err}`)
    }
  }

  // Bulk Actions
  async function handleBulkMarkEnlisted(platform: string, markLive: boolean) {
    if (selectedIds.size === 0) return
    setBulkActionBusy(true)
    try {
      const ids = Array.from(selectedIds)
      const updated = await bulkMarkEnlisted(products, ids, platform, markLive)
      const updatedMap = new Map(updated.map((u) => [u.id, u]))
      setProducts((prev) => prev.map((p) => updatedMap.get(p.id) || p))
      clearSelection()
    } catch (err: any) {
      alert(`Bulk update failed: ${err.message || err}`)
    } finally {
      setBulkActionBusy(false)
    }
  }

  async function handleBulkStatusChange(status: any) {
    if (selectedIds.size === 0) return
    setBulkActionBusy(true)
    try {
      const ids = Array.from(selectedIds)
      await bulkUpdateStatus(ids, status)
      setProducts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, enlistment_status: status } : p))
      )
      clearSelection()
    } catch (err: any) {
      alert(`Bulk status update failed: ${err.message || err}`)
    } finally {
      setBulkActionBusy(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedIds.size} selected products from the database?`
      )
    ) {
      return
    }

    setBulkActionBusy(true)
    try {
      const ids = Array.from(selectedIds)
      await bulkDeleteProducts(ids)
      setProducts((prev) => prev.filter((p) => !ids.includes(p.id)))
      clearSelection()
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message || err}`)
    } finally {
      setBulkActionBusy(false)
    }
  }

  return (
    <div className="enlistment-container">
      {/* Top Banner: Mode Indicator */}
      <div className={`enlist-access-banner ${isPartnerView ? 'partner-mode' : 'manager-mode'}`}>
        <div className="banner-left">
          {isPartnerView ? (
            <>
              <div className="access-badge partner">
                <Shield size={14} />
                <span>External Retail Partner View (Read-Only)</span>
              </div>
              <span className="banner-desc">
                Enlistment dossier open for cataloging, barcode ingestion, packshot downloading, and
                commercial verification.
              </span>
            </>
          ) : (
            <>
              <div className="access-badge manager">
                <Shield size={14} />
                <span>Unilever Account Manager (Full Edit Access)</span>
              </div>
              <span className="banner-desc">
                Manage product pipeline, specifications, margins, bulk import sheets, and track
                live digital shelf status per retail partner.
              </span>
            </>
          )}
        </div>

        <div className="banner-actions">
          {isPartnerView ? (
            <button
              type="button"
              className="mode-switch-btn"
              onClick={() => setIsPartnerView(false)}
              title="Switch back to Unilever Internal Account Manager Mode"
            >
              <Unlock size={14} />
              Switch to Account Manager (Edit)
            </button>
          ) : (
            <button
              type="button"
              className="mode-switch-btn"
              onClick={() => setIsPartnerView(true)}
              title="Preview the exact view external e-commerce partners will receive"
            >
              <Eye size={14} />
              Preview External Partner View
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="checker-kpi-grid">
        <div className="card checker-kpi">
          <div className="kpi-icon-row">
            <span className="kpi-tag">Pipeline</span>
            <Layers size={18} className="text-teal" />
          </div>
          <div className="kpi-number">{kpis.total_products}</div>
          <div className="kpi-title">Total Products in Line</div>
          <div className="kpi-desc">Registered for e-commerce cataloging</div>
        </div>

        <div className="card checker-kpi">
          <div className="kpi-icon-row">
            <span className="kpi-tag tag-green">Pipeline Ready</span>
            <CheckCircle2 size={18} className="text-green" />
          </div>
          <div className="kpi-number text-green">{kpis.open_enlistments}</div>
          <div className="kpi-title">Open for Enlistment</div>
          <div className="kpi-desc">Specs validated & ready for upload</div>
        </div>

        <div className="card checker-kpi">
          <div className="kpi-icon-row">
            <span className="kpi-tag tag-coral">Active on Shelf</span>
            <Sparkles size={18} className="text-coral" />
          </div>
          <div className="kpi-number text-coral">{kpis.enlisted_live}</div>
          <div className="kpi-title">Enlisted & Live</div>
          <div className="kpi-desc">Live on at least 1 retail platform</div>
        </div>

        <div className="card checker-kpi">
          <div className="kpi-icon-row">
            <span className="kpi-tag">Average Margin</span>
            <span className="margin-pill-sm">{kpis.avg_margin_pct}%</span>
          </div>
          <div className="kpi-number">{kpis.avg_margin_pct}%</div>
          <div className="kpi-title">Avg. Retailer Margin</div>
          <div className="kpi-desc">Across {kpis.total_brands} Unilever brands</div>
        </div>
      </div>

      {/* Platform Coverage Quick Strip */}
      {products.length > 0 && (
        <div className="card platform-coverage-strip">
          <div className="pcs-header">
            <span className="pcs-title">Live on Retailers & Accounts:</span>
            {!isPartnerView && (
              <button
                type="button"
                className="pcs-manage-btn"
                onClick={() => setIsAccountsOpen(true)}
                title="Add or remove accounts, quick-commerce, and marketplace vendors"
              >
                <Store size={12} />
                Manage Accounts ({activeAccountNames.length})
              </button>
            )}
          </div>
          <div className="pcs-items">
            {activeAccountNames.map((plat) => {
              const liveCount =
                kpis.enlisted_by_platform[plat] ||
                kpis.enlisted_by_platform[plat.toLowerCase()] ||
                0
              const targetCount =
                kpis.targeted_by_platform[plat] ||
                kpis.targeted_by_platform[plat.toLowerCase()] ||
                0
              const pct = targetCount > 0 ? Math.round((liveCount / targetCount) * 100) : 0
              return (
                <div
                  key={plat}
                  className={`pcs-badge ${liveCount > 0 ? 'active' : ''} ${
                    platformFilter === plat ? 'filter-active' : ''
                  }`}
                  onClick={() => {
                    setPlatformFilter(platformFilter === plat ? 'all' : plat)
                  }}
                  title={`Click to filter by ${plat} (${liveCount}/${targetCount} live)`}
                >
                  <span className="pcs-name">{plat}</span>
                  <span className="pcs-count">
                    <strong>{liveCount}</strong> / {targetCount} live
                  </span>
                  <div className="pcs-progress-bar">
                    <div className="pcs-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toolbar: Actions & Search */}
      <div className="card enlist-toolbar-card">
        <div className="enlist-main-bar">
          <div className="search-box enlist-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search product name, barcode, brand, category, or features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="toolbar-button-group">
            {/* View Mode Toggle */}
            <div className="mode-tabs">
              <button
                type="button"
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
                title="Spreadsheet Table View with per-platform status"
              >
                <TableIcon size={14} />
                Table
              </button>
              <button
                type="button"
                className={viewMode === 'cards' ? 'active' : ''}
                onClick={() => setViewMode('cards')}
                title="Visual Packshot Grid"
              >
                <LayoutGrid size={14} />
                Cards
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              className="secondary-btn"
              onClick={handleExportCSV}
              title="Download standardized 20-column Excel/CSV Enlistment Sheet scoped to filter"
            >
              <Download size={14} />
              Export Sheet
            </button>

            {/* Manager Only: Bulk Import */}
            {!isPartnerView && (
              <button
                type="button"
                className="secondary-btn btn-highlight"
                onClick={() => setIsImportOpen(true)}
                title="Bulk upload Excel/CSV sheet of products into pipeline"
              >
                <Upload size={14} />
                Import Sheet
              </button>
            )}

            {/* Manager Only: Share Modal */}
            {!isPartnerView && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsShareOpen(true)}
                title="Generate view-only link to share with partner platforms"
              >
                <Share2 size={14} />
                Share with Partners
              </button>
            )}

            {/* Manager Only: Manage Accounts / Vendors */}
            {!isPartnerView && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsAccountsOpen(true)}
                title="Manage retail vendors, e-commerce accounts, and marketplaces"
              >
                <Store size={14} />
                Accounts ({activeAccountNames.length})
              </button>
            )}

            {/* Manager Only: Add Single Product */}
            {!isPartnerView && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setEditingProduct(null)
                  setIsAddEditOpen(true)
                }}
              >
                <Plus size={15} />
                Add Product
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="enlist-filter-row">
          <div className="filter-item">
            <label>Brand</label>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="all">All Brands ({brandsList.length})</option>
              {brandsList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories ({categoriesList.length})</option>
              {categoriesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Department</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All Departments ({deptsList.length})</option>
              {deptsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Global Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="open">Open for Enlistment</option>
              <option value="in_review">Under Review</option>
              <option value="enlisted">Enlisted & Live</option>
              <option value="paused">Paused / Delisted</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Retail Platform / Account</label>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="all">All Accounts & Platforms</option>
              {activeAccountNames.map((plat) => (
                <option key={plat} value={plat}>
                  {plat}
                </option>
              ))}
            </select>
          </div>

          {platformFilter !== 'all' && (
            <div className="filter-item highlight-filter">
              <label>Shelf Status on {platformFilter}</label>
              <select
                value={platformStatusFilter}
                onChange={(e) => setPlatformStatusFilter(e.target.value as any)}
              >
                <option value="all">All ({platformFilter})</option>
                <option value="live">✓ Live / Enlisted</option>
                <option value="pending">○ Pending Enlistment</option>
              </select>
            </div>
          )}

          {(brandFilter !== 'all' ||
            categoryFilter !== 'all' ||
            deptFilter !== 'all' ||
            statusFilter !== 'all' ||
            platformFilter !== 'all' ||
            platformStatusFilter !== 'all' ||
            searchQuery) && (
            <button
              type="button"
              className="reset-filter-btn"
              onClick={() => {
                setBrandFilter('all')
                setCategoryFilter('all')
                setDeptFilter('all')
                setStatusFilter('all')
                setPlatformFilter('all')
                setPlatformStatusFilter('all')
                setSearchQuery('')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {!isPartnerView && selectedIds.size > 0 && (
        <div className="enlist-bulk-bar">
          <div className="bulk-selection-count">
            <CheckCheck size={16} className="text-teal" />
            <span>
              <strong>{selectedIds.size}</strong> product(s) selected
            </span>
          </div>

          <div className="bulk-actions-group">
            {/* Mark Enlisted on Platform */}
            <div className="bulk-platform-action">
              <select
                value={bulkTargetPlatform}
                onChange={(e) => setBulkTargetPlatform(e.target.value)}
                className="bulk-select"
                disabled={bulkActionBusy}
              >
                {activeAccountNames.map((plat) => (
                  <option key={plat} value={plat}>
                    {plat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="bulk-btn bulk-btn-success"
                disabled={bulkActionBusy}
                onClick={() => handleBulkMarkEnlisted(bulkTargetPlatform, true)}
                title={`Mark selected ${selectedIds.size} products as confirmed live on ${bulkTargetPlatform}`}
              >
                <Check size={13} /> Mark Live on {bulkTargetPlatform}
              </button>

              <button
                type="button"
                className="bulk-btn bulk-btn-subtle"
                disabled={bulkActionBusy}
                onClick={() => handleBulkMarkEnlisted(bulkTargetPlatform, false)}
                title={`Unmark live status (set to pending) on ${bulkTargetPlatform}`}
              >
                Mark Pending
              </button>
            </div>

            {/* Change global status */}
            <select
              className="bulk-select"
              disabled={bulkActionBusy}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value)
                  e.target.value = ''
                }
              }}
            >
              <option value="" disabled>
                Change Status...
              </option>
              <option value="open">Set Open for Enlistment</option>
              <option value="in_review">Set Under Review</option>
              <option value="enlisted">Set Enlisted & Live</option>
              <option value="paused">Set Paused</option>
            </select>

            {/* Delete */}
            <button
              type="button"
              className="bulk-btn bulk-btn-danger"
              disabled={bulkActionBusy}
              onClick={handleBulkDelete}
              title="Delete selected products from database"
            >
              <Trash2 size={13} /> Delete
            </button>

            <button
              type="button"
              className="bulk-clear-btn"
              onClick={clearSelection}
              title="Deselect all"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Database Error Banner */}
      {error && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            marginBottom: '20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                Database Error: {error}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Please ensure the table <code style={{ color: '#93c5fd' }}>product_enlistments</code> is created in your Supabase project. You can run the SQL script in <code style={{ color: '#93c5fd' }}>supabase/008_product_enlistments.sql</code> and <code style={{ color: '#93c5fd' }}>supabase/011_enlistment_platform_tracking.sql</code> in the Supabase SQL Editor.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="card loading-card">
          <div className="spinner" />
          <div>Loading Product Enlistment Pipeline from Database...</div>
        </div>
      ) : products.length === 0 ? (
        <div className="card empty-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Layers size={40} className="text-muted" style={{ margin: '0 auto 16px' }} />
          <h3>No products in database</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 480, margin: '8px auto 20px' }}>
            There are currently no products registered in the database enlistment pipeline.
            You can add products manually or bulk import an Excel/CSV spreadsheet.
          </p>
          {!isPartnerView && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsImportOpen(true)}
              >
                <Upload size={15} style={{ marginRight: 6 }} />
                Bulk Import Sheet
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditingProduct(null)
                  setIsAddEditOpen(true)
                }}
              >
                <Plus size={15} style={{ marginRight: 6 }} />
                Add Product to Database
              </button>
            </div>
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card empty-panel">
          <Layers size={36} className="text-muted" />
          <h3>No products match your filter criteria</h3>
          <p>Try resetting filters or adjusting your search query.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* SPREADSHEET TABLE VIEW: Full specification columns + interactive platform tracking */
        <div className="card enlist-table-card">
          <div className="table-top-meta">
            <span>
              Showing <strong>{filteredProducts.length}</strong> of{' '}
              <strong>{products.length}</strong> pipeline products
              {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
            </span>
            <span className="scroll-hint">
              ← Scroll horizontally to inspect all 20 specification columns & platform tracking →
            </span>
          </div>

          <div className="table-wrap enlist-table-wrap">
            <table className="table enlist-sheet-table">
              <thead>
                <tr>
                  {!isPartnerView && (
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredProducts.length > 0 &&
                          filteredProducts.every((p) => selectedIds.has(p.id))
                        }
                        onChange={toggleSelectAllFiltered}
                        title="Select/Deselect all filtered rows"
                      />
                    </th>
                  )}
                  <th style={{ width: 45 }}>SL</th>
                  <th style={{ minWidth: 155 }}>Barcode</th>
                  <th style={{ minWidth: 260 }}>Product Name</th>
                  <th style={{ minWidth: 220 }}>Platform Shelf Tracking</th>
                  <th style={{ minWidth: 80 }}>Image</th>
                  <th style={{ minWidth: 110 }}>Brand</th>
                  <th style={{ minWidth: 90, textAlign: 'right' }}>TP (৳)</th>
                  <th style={{ minWidth: 90, textAlign: 'right' }}>MRP (৳)</th>
                  <th style={{ minWidth: 85, textAlign: 'center' }}>Margin</th>
                  <th style={{ minWidth: 110 }}>Dim L (cm)</th>
                  <th style={{ minWidth: 110 }}>Dim D (cm)</th>
                  <th style={{ minWidth: 110 }}>Dim H (cm)</th>
                  <th style={{ minWidth: 115 }}>Shelf Life</th>
                  <th style={{ minWidth: 130 }}>Dept</th>
                  <th style={{ minWidth: 120 }}>Category</th>
                  <th style={{ minWidth: 110 }}>SubCategory</th>
                  <th style={{ minWidth: 100 }}>Pcs / CRM</th>
                  <th style={{ minWidth: 90 }}>Cert/Licns</th>
                  <th style={{ minWidth: 180 }}>Supplier Name</th>
                  <th style={{ minWidth: 120 }}>Origin</th>
                  <th style={{ minWidth: 150 }}>Enlistment Status</th>
                  <th style={{ minWidth: 110, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, idx) => {
                  const isSelected = selectedIds.has(p.id)
                  const targetList = p.target_platforms || []
                  const liveList = p.enlisted_platforms || []

                  return (
                    <tr key={p.id} className={isSelected ? 'row-selected' : ''}>
                      {!isPartnerView && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                          />
                        </td>
                      )}
                      <td className="text-muted font-mono">{p.sl || idx + 1}</td>
                      <td>
                        <div className="barcode-cell">
                          <code className="barcode-text">{p.barcode}</code>
                          <button
                            type="button"
                            className="copy-cell-btn"
                            onClick={() => copyText(p.barcode, `bar-${p.id}`)}
                            title="Copy Barcode"
                          >
                            {copiedKey === `bar-${p.id}` ? (
                              <Check size={12} className="text-green" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div
                          className="product-name-link"
                          onClick={() => setSelectedProduct(p)}
                          title="Click to view full specification dossier"
                        >
                          <strong>{p.name}</strong>
                        </div>
                      </td>

                      {/* Interactive Platform Live Shelf Tracking */}
                      <td>
                        <div className="table-platform-chips">
                          {targetList.length === 0 ? (
                            <span className="text-muted" style={{ fontSize: 11 }}>
                              No platforms targeted
                            </span>
                          ) : (
                            targetList.map((plat) => {
                              const isLive = liveList.includes(plat)
                              return (
                                <button
                                  type="button"
                                  key={plat}
                                  className={`plat-live-chip ${isLive ? 'live' : 'pending'} ${
                                    isPartnerView ? 'read-only' : ''
                                  }`}
                                  disabled={isPartnerView}
                                  onClick={() => handleTogglePlatformEnlisted(p, plat)}
                                  title={
                                    isPartnerView
                                      ? isLive
                                        ? `Confirmed live on ${plat}`
                                        : `Pending enlistment on ${plat}`
                                      : isLive
                                      ? `Live on ${plat} (Click to mark pending)`
                                      : `Pending on ${plat} (Click to mark live)`
                                  }
                                >
                                  {isLive ? <Check size={10} /> : <span style={{ opacity: 0.5 }}>○</span>}
                                  {plat}
                                </button>
                              )
                            })
                          )}
                          {targetList.length > 0 && (
                            <span className="platform-ratio-tag">
                              {liveList.length}/{targetList.length}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div className="table-thumb-wrap">
                          <img
                            src={p.image_url || 'https://placehold.co/100x100/101a2d/75a9ff?text=No+Img'}
                            alt={p.name}
                            className="table-thumb"
                            onClick={() => setSelectedProduct(p)}
                            onError={(e) => {
                              ;(e.target as any).src =
                                'https://placehold.co/100x100/101a2d/75a9ff?text=Pack'
                            }}
                          />
                          {p.image_url && (
                            <button
                              type="button"
                              className="thumb-copy-btn"
                              onClick={() => copyText(p.image_url, `img-${p.id}`)}
                              title="Copy Image URL"
                            >
                              {copiedKey === `img-${p.id}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        <strong className="text-teal">{p.brand}</strong>
                      </td>
                      <td className="num-cell strong">৳ {p.tp?.toFixed(2)}</td>
                      <td className="num-cell strong highlight">৳ {p.mrp?.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="margin-pill-sm">{p.margin?.toFixed(2)}%</span>
                      </td>

                      <td className="num-cell">{p.dim_length_cm}</td>
                      <td className="num-cell">{p.dim_depth_cm}</td>
                      <td className="num-cell">{p.dim_height_cm}</td>
                      <td className="num-cell">
                        {p.shelf_life_days} <small className="text-muted">days</small>
                      </td>
                      <td>
                        <span className="badge-subtle">{p.dept}</span>
                      </td>
                      <td>{p.category}</td>
                      <td>{p.subcategory || '—'}</td>
                      <td className="num-cell">{p.pcs_per_crm}</td>
                      <td>
                        <span className="cert-badge">{p.cert_license || 'BSTI'}</span>
                      </td>
                      <td className="text-muted" style={{ fontSize: 11 }}>
                        {p.supplier_name}
                      </td>
                      <td>{p.country_of_origin}</td>
                      <td>
                        {!isPartnerView ? (
                          <select
                            className={`status-select ${
                              p.enlistment_status === 'enlisted'
                                ? 'status-ok-sel'
                                : p.enlistment_status === 'in_review'
                                ? 'status-review-sel'
                                : 'status-open-sel'
                            }`}
                            value={p.enlistment_status}
                            onChange={(e) => handleQuickStatusChange(p.id, e.target.value)}
                          >
                            <option value="open">Open for Enlistment</option>
                            <option value="in_review">Under Review</option>
                            <option value="enlisted">Enlisted & Live</option>
                            <option value="paused">Paused / Delisted</option>
                          </select>
                        ) : (
                          <span
                            className={`status-chip ${
                              p.enlistment_status === 'enlisted'
                                ? 'status-available'
                                : p.enlistment_status === 'in_review'
                                ? 'status-mixed'
                                : 'status-unavailable'
                            }`}
                          >
                            {p.enlistment_status === 'enlisted'
                              ? 'Enlisted Live'
                              : p.enlistment_status === 'in_review'
                              ? 'Under Review'
                              : 'Open'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() => setSelectedProduct(p)}
                            title="Inspect Dossier"
                          >
                            <Eye size={14} />
                          </button>

                          {!isPartnerView && (
                            <>
                              <button
                                type="button"
                                className="icon-action-btn"
                                onClick={() => {
                                  setEditingProduct(p)
                                  setIsAddEditOpen(true)
                                }}
                                title="Edit Specifications"
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                type="button"
                                className="icon-action-btn delete-btn"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                title="Delete Product"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISUAL CATALOG VIEW */
        <div className="enlist-card-grid">
          {filteredProducts.map((p) => {
            const isSelected = selectedIds.has(p.id)
            const targetList = p.target_platforms || []
            const liveList = p.enlisted_platforms || []

            return (
              <div
                key={p.id}
                className={`card enlist-card-item ${isSelected ? 'card-selected' : ''}`}
              >
                {!isPartnerView && (
                  <div
                    className="card-checkbox-anchor"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelectProduct(p.id)
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectProduct(p.id)}
                    />
                  </div>
                )}

                <div className="card-packshot-area" onClick={() => setSelectedProduct(p)}>
                  <img
                    src={p.image_url || 'https://placehold.co/400x400/101a2d/75a9ff?text=No+Packshot'}
                    alt={p.name}
                    className="card-packshot"
                    onError={(e) => {
                      ;(e.target as any).src =
                        'https://placehold.co/400x400/101a2d/75a9ff?text=Packshot'
                    }}
                  />
                  <span
                    className={`card-status-badge ${
                      p.enlistment_status === 'enlisted'
                        ? 'status-available'
                        : p.enlistment_status === 'in_review'
                        ? 'status-mixed'
                        : 'status-unavailable'
                    }`}
                  >
                    {p.enlistment_status === 'enlisted'
                      ? 'Enlisted'
                      : p.enlistment_status === 'in_review'
                      ? 'In Review'
                      : 'Open'}
                  </span>
                </div>

                <div className="card-body">
                  <div className="card-brand-row">
                    <span className="card-brand">{p.brand}</span>
                    <span className="card-cat">{p.category}</span>
                  </div>

                  <h4
                    className="card-title"
                    onClick={() => setSelectedProduct(p)}
                    title={p.name}
                  >
                    {p.name}
                  </h4>

                  <div className="card-barcode-line">
                    <code>{p.barcode}</code>
                    <button
                      type="button"
                      className="copy-mini-btn"
                      onClick={() => copyText(p.barcode, `card-bar-${p.id}`)}
                    >
                      {copiedKey === `card-bar-${p.id}` ? (
                        <Check size={12} className="text-green" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>

                  {/* Platforms on Card */}
                  <div className="card-platforms-strip">
                    {targetList.map((plat) => {
                      const isLive = liveList.includes(plat)
                      return (
                        <button
                          type="button"
                          key={plat}
                          className={`plat-live-chip sm ${isLive ? 'live' : 'pending'}`}
                          disabled={isPartnerView}
                          onClick={() => handleTogglePlatformEnlisted(p, plat)}
                          title={
                            isLive
                              ? `${plat}: Live (Click to mark pending)`
                              : `${plat}: Pending (Click to mark live)`
                          }
                        >
                          {isLive ? '✓' : '○'} {plat}
                        </button>
                      )
                    })}
                  </div>

                  <div className="card-pricing-strip">
                    <div>
                      <small>Trade (TP)</small>
                      <div>৳{p.tp.toFixed(2)}</div>
                    </div>
                    <div>
                      <small>Retail (MRP)</small>
                      <div className="mrp-val">৳{p.mrp.toFixed(2)}</div>
                    </div>
                    <div>
                      <small>Margin</small>
                      <div className="margin-val">{p.margin.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="card-dims-strip">
                    📦 {p.dim_length_cm} × {p.dim_depth_cm} × {p.dim_height_cm} cm • {p.pcs_per_crm} pcs/case
                  </div>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="ghost-pill-btn"
                      onClick={() => setSelectedProduct(p)}
                    >
                      Inspect Dossier
                    </button>

                    {!isPartnerView && (
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => {
                          setEditingProduct(p)
                          setIsAddEditOpen(true)
                        }}
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Single Product Modal */}
      <EnlistmentModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false)
          setEditingProduct(null)
        }}
        onSave={handleSaveProduct}
        initialData={editingProduct}
        nextSl={products.length + 1}
        availableAccounts={activeAccountNames}
        onOpenAccountManager={() => setIsAccountsOpen(true)}
      />

      {/* Bulk Upload Spreadsheet Modal */}
      <EnlistmentImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadData}
        availableAccounts={activeAccountNames}
      />

      {/* Detail Inspection Modal with interactive live toggling */}
      <EnlistmentDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isReadOnly={isPartnerView}
        onEdit={(p) => {
          setEditingProduct(p)
          setIsAddEditOpen(true)
        }}
        onTogglePlatformEnlisted={handleTogglePlatformEnlisted}
      />

      {/* Share with Partners Modal */}
      <EnlistmentShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onSwitchToPartnerView={() => setIsPartnerView(true)}
        availableAccounts={activeAccountNames}
      />

      {/* Manage Enlistment Accounts & Retailers Modal */}
      <EnlistmentAccountsModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={accounts}
        onAccountsChange={(updated) => setAccounts(updated)}
        products={products}
      />
    </div>
  )
}
