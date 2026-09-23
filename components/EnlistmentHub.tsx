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
} from '@/lib/enlistmentData'
import EnlistmentModal from '@/components/EnlistmentModal'
import EnlistmentDetailModal from '@/components/EnlistmentDetailModal'
import EnlistmentShareModal from '@/components/EnlistmentShareModal'
import {
  Search,
  Plus,
  Share2,
  Download,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  Shield,
  ShieldAlert,
  ArrowUpDown,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Sparkles,
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
  const [loading, setLoading] = useState(true)
  const [isPartnerView, setIsPartnerView] = useState(initialIsPartnerView)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState(initialPlatform || 'all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<EnlistmentProduct | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<EnlistmentProduct | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const items = await getEnlistmentProducts()
      setProducts(items)
    } catch (err) {
      console.error('Failed to load enlistment products:', err)
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
      if (brandFilter !== 'all' && p.brand.toLowerCase() !== brandFilter.toLowerCase()) return false
      if (categoryFilter !== 'all' && p.category.toLowerCase() !== categoryFilter.toLowerCase())
        return false
      if (deptFilter !== 'all' && p.dept.toLowerCase() !== deptFilter.toLowerCase()) return false
      if (statusFilter !== 'all' && p.enlistment_status !== statusFilter) return false
      if (platformFilter !== 'all') {
        const hasPlat = p.target_platforms?.some(
          (tp) => tp.toLowerCase() === platformFilter.toLowerCase()
        )
        if (!hasPlat) return false
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
  }, [products, searchQuery, brandFilter, categoryFilter, deptFilter, statusFilter, platformFilter])

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
    link.setAttribute(
      'download',
      `UBL_Product_Enlistment_Master_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CRUD Handlers
  async function handleSaveProduct(formData: EnlistmentInput, id?: string) {
    if (id) {
      const updated = await updateEnlistmentProduct(id, formData)
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
    } else {
      const created = await createEnlistmentProduct(formData)
      setProducts((prev) => [created, ...prev])
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (confirm(`Are you sure you want to remove "${name}" from the enlistment pipeline?`)) {
      await deleteEnlistmentProduct(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
    }
  }

  async function handleQuickStatusChange(id: string, newStatus: any) {
    const updated = await updateEnlistmentProduct(id, { enlistment_status: newStatus })
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  return (
    <div className="enlistment-container">
      {/* Top Banner: Mode Indicator */}
      <div className={`enlist-access-banner ${isPartnerView ? 'partner-mode' : 'manager-mode'}`}>
        <div className="banner-left">
          {isPartnerView ? (
            <>
              <div className="access-badge partner">
                <Lock size={14} />
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
                Manage product pipeline, specifications, margins, and share view links with
                e-commerce accounts.
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
            <span className="kpi-tag tag-green">Ready to Enlist</span>
            <CheckCircle2 size={18} className="text-green" />
          </div>
          <div className="kpi-number text-green">{kpis.open_enlistments}</div>
          <div className="kpi-title">Open for Enlistment</div>
          <div className="kpi-desc">Specs ready for partner upload</div>
        </div>

        <div className="card checker-kpi">
          <div className="kpi-icon-row">
            <span className="kpi-tag tag-coral">Active on Shelf</span>
            <Sparkles size={18} className="text-coral" />
          </div>
          <div className="kpi-number text-coral">{kpis.enlisted_live}</div>
          <div className="kpi-title">Enlisted & Live</div>
          <div className="kpi-desc">Currently published across platforms</div>
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
                title="Spreadsheet Table View (20 Columns)"
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
              title="Download standardized 20-column Excel/CSV Enlistment Sheet"
            >
              <Download size={14} />
              Export Sheet
            </button>

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

            {/* Manager Only: Add Product */}
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
            <label>Enlistment Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="open">Open for Enlistment</option>
              <option value="in_review">Under Review</option>
              <option value="enlisted">Enlisted & Live</option>
              <option value="paused">Paused / Delisted</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Platform Target</label>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="all">All E-Commerce Platforms</option>
              <option value="Chaldal">Chaldal</option>
              <option value="Daraz">Daraz</option>
              <option value="Shwapno">Shwapno</option>
              <option value="PandaMart">PandaMart</option>
              <option value="MeenaClick">MeenaClick</option>
            </select>
          </div>

          {(brandFilter !== 'all' ||
            categoryFilter !== 'all' ||
            deptFilter !== 'all' ||
            statusFilter !== 'all' ||
            platformFilter !== 'all' ||
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
                setSearchQuery('')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card loading-card">
          <div className="spinner" />
          <div>Loading Product Enlistment Pipeline...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card empty-panel">
          <Layers size={36} className="text-muted" />
          <h3>No products match your filter criteria</h3>
          <p>Try resetting filters or adding new items to the enlistment pipeline.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* SPREADSHEET TABLE VIEW: Exact 20 columns matching the user's specification sheet */
        <div className="card enlist-table-card">
          <div className="table-top-meta">
            <span>
              Showing <strong>{filteredProducts.length}</strong> of{' '}
              <strong>{products.length}</strong> pipeline products
            </span>
            <span className="scroll-hint">
              ← Scroll horizontally to inspect all 20 specification columns →
            </span>
          </div>

          <div className="table-wrap enlist-table-wrap">
            <table className="table enlist-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 45 }}>SL</th>
                  <th style={{ minWidth: 155 }}>Barcode</th>
                  <th style={{ minWidth: 110 }}>Dim L (cm)</th>
                  <th style={{ minWidth: 110 }}>Dim D (cm)</th>
                  <th style={{ minWidth: 110 }}>Dim H (cm)</th>
                  <th style={{ minWidth: 115 }}>Shelf Life</th>
                  <th style={{ minWidth: 260 }}>Product Name</th>
                  <th style={{ minWidth: 80 }}>Image</th>
                  <th style={{ minWidth: 220 }}>Description (Features)</th>
                  <th style={{ minWidth: 130 }}>Dept</th>
                  <th style={{ minWidth: 120 }}>Category</th>
                  <th style={{ minWidth: 110 }}>SubCategory</th>
                  <th style={{ minWidth: 100 }}>Pcs / CRM</th>
                  <th style={{ minWidth: 90, textAlign: 'right' }}>TP (৳)</th>
                  <th style={{ minWidth: 90, textAlign: 'right' }}>MRP (৳)</th>
                  <th style={{ minWidth: 95, textAlign: 'center' }}>Margin</th>
                  <th style={{ minWidth: 90 }}>Cert/Licns</th>
                  <th style={{ minWidth: 110 }}>Brand</th>
                  <th style={{ minWidth: 190 }}>Supplier Name</th>
                  <th style={{ minWidth: 120 }}>Origin</th>
                  <th style={{ minWidth: 150 }}>Enlistment Status</th>
                  <th style={{ minWidth: 120, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, idx) => (
                  <tr key={p.id}>
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
                    <td className="num-cell">{p.dim_length_cm}</td>
                    <td className="num-cell">{p.dim_depth_cm}</td>
                    <td className="num-cell">{p.dim_height_cm}</td>
                    <td className="num-cell">
                      {p.shelf_life_days} <small className="text-muted">days</small>
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
                      <div
                        className="description-cell-truncate"
                        title={p.description}
                        onClick={() => setSelectedProduct(p)}
                      >
                        {p.description || <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className="badge-subtle">{p.dept}</span>
                    </td>
                    <td>{p.category}</td>
                    <td>{p.subcategory || '—'}</td>
                    <td className="num-cell">{p.pcs_per_crm}</td>
                    <td className="num-cell strong">৳ {p.tp?.toFixed(2)}</td>
                    <td className="num-cell strong highlight">৳ {p.mrp?.toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="margin-pill-sm">{p.margin?.toFixed(2)}%</span>
                    </td>
                    <td>
                      <span className="cert-badge">{p.cert_license || 'BSTI'}</span>
                    </td>
                    <td>
                      <strong className="text-teal">{p.brand}</strong>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISUAL CATALOG VIEW */
        <div className="enlist-card-grid">
          {filteredProducts.map((p) => (
            <div key={p.id} className="card enlist-card-item">
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
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <EnlistmentModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false)
          setEditingProduct(null)
        }}
        onSave={handleSaveProduct}
        initialData={editingProduct}
        nextSl={products.length + 1}
      />

      {/* Detail Inspection Modal */}
      <EnlistmentDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isReadOnly={isPartnerView}
        onEdit={(p) => {
          setEditingProduct(p)
          setIsAddEditOpen(true)
        }}
      />

      {/* Share with Partners Modal */}
      <EnlistmentShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onSwitchToPartnerView={() => setIsPartnerView(true)}
      />
    </div>
  )
}
