'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Layers,
  PackageCheck,
  PackageX,
  RotateCcw,
  Search,
  Store,
  XCircle,
} from 'lucide-react'
import {
  CheckerBasepack,
  CheckerDataResult,
  CheckerProduct,
} from '@/lib/checkerData'

type ViewMode = 'basepacks' | 'products' | 'matrix'
type StatusFilter = 'all' | 'available' | 'unavailable' | 'mixed'

export default function CheckerPanel({
  data,
  selectedDate,
  onDateChange,
  loading,
}: {
  data: CheckerDataResult
  selectedDate: string
  onDateChange: (date: string) => void
  loading?: boolean
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('basepacks')
  const [q, setQ] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Pagination for basepacks and products
  const [bpPage, setBpPage] = useState(1)
  const [prodPage, setProdPage] = useState(1)
  const pageSize = 25

  // Expanded basepack IDs
  const [expandedBpIds, setExpandedBpIds] = useState<Set<string>>(new Set())

  // Copy feedback state
  const [copied, setCopied] = useState(false)

  // Selected product for inspect modal
  const [inspectProduct, setInspectProduct] = useState<CheckerProduct | null>(null)

  function toggleExpand(id: string) {
    setExpandedBpIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll(ids: string[]) {
    setExpandedBpIds(new Set(ids))
  }

  function collapseAll() {
    setExpandedBpIds(new Set())
  }

  function resetFilters() {
    setQ('')
    setAccountFilter('all')
    setBranchFilter('all')
    setStatusFilter('all')
    setBrandFilter('all')
    setCategoryFilter('all')
    setBpPage(1)
    setProdPage(1)
  }

  // Filter branches based on account
  const availableBranches = useMemo(() => {
    if (accountFilter === 'all') return data.locations
    const selectedAcc = data.accounts.find((a) => a.id === accountFilter || a.code === accountFilter)
    if (!selectedAcc) return []
    return data.locations.filter((l) => l.account_id === selectedAcc.id)
  }, [accountFilter, data.accounts, data.locations])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.products.filter((p) => {
      // Account filter
      if (accountFilter !== 'all') {
        const matchesAccount = p.account_id === accountFilter || p.account_code === accountFilter
        if (!matchesAccount) return false
      }
      // Branch filter
      if (branchFilter !== 'all') {
        const matchesBranch = p.location_id === branchFilter || p.location_name?.toLowerCase() === branchFilter.toLowerCase()
        if (!matchesBranch) return false
      }
      // Status filter
      if (statusFilter === 'available' && !p.available) return false
      if (statusFilter === 'unavailable' && p.available) return false

      // Brand & Category
      if (brandFilter !== 'all' && (p.brand || '').toLowerCase() !== brandFilter.toLowerCase()) return false
      if (categoryFilter !== 'all' && (p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false

      // Keyword query
      if (!needle) return true
      return (
        p.product_name.toLowerCase().includes(needle) ||
        p.basepack_name.toLowerCase().includes(needle) ||
        p.account_sku.toLowerCase().includes(needle) ||
        (p.brand && p.brand.toLowerCase().includes(needle)) ||
        (p.category && p.category.toLowerCase().includes(needle)) ||
        p.account_name.toLowerCase().includes(needle)
      )
    })
  }, [data.products, q, accountFilter, branchFilter, statusFilter, brandFilter, categoryFilter])

  // Filtered Basepacks
  const filteredBasepacks = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.basepacks
      .map((bp) => {
        // Filter account statuses within this basepack
        let accounts = bp.accounts
        if (accountFilter !== 'all') {
          accounts = accounts.filter((a) => a.account_id === accountFilter || a.account_code === accountFilter)
        }
        if (branchFilter !== 'all') {
          accounts = accounts.filter(
            (a) => a.location_id === branchFilter || a.location_name?.toLowerCase() === branchFilter.toLowerCase()
          )
        }

        // Filter products inside accounts based on status & search
        const filteredAccounts = accounts
          .map((acc) => {
            const accProducts = acc.products.filter((p) => {
              if (statusFilter === 'available' && !p.available) return false
              if (statusFilter === 'unavailable' && p.available) return false
              if (!needle) return true
              return (
                p.product_name.toLowerCase().includes(needle) ||
                p.account_sku.toLowerCase().includes(needle) ||
                bp.name.toLowerCase().includes(needle)
              )
            })
            return {
              ...acc,
              products: accProducts,
            }
          })
          .filter((acc) => {
            // If status is filtered, only keep accounts matching the condition
            if (statusFilter === 'available') return acc.available
            if (statusFilter === 'unavailable') return !acc.available
            return true
          })

        const totalAcc = filteredAccounts.length
        const availAcc = filteredAccounts.filter((a) => a.available).length
        let calculatedStatus: 'available' | 'unavailable' | 'mixed' = 'unavailable'
        if (availAcc === totalAcc && totalAcc > 0) calculatedStatus = 'available'
        else if (availAcc > 0) calculatedStatus = 'mixed'
        else calculatedStatus = 'unavailable'

        return {
          ...bp,
          accounts: filteredAccounts,
          overall_status: calculatedStatus,
        }
      })
      .filter((bp) => {
        // If accounts were filtered out completely, skip
        if (accountFilter !== 'all' && bp.accounts.length === 0) return false

        // Status filter at basepack level
        if (statusFilter === 'available' && bp.overall_status !== 'available' && bp.overall_status !== 'mixed') return false
        if (statusFilter === 'unavailable' && bp.overall_status !== 'unavailable') return false
        if (statusFilter === 'mixed' && bp.overall_status !== 'mixed') return false

        // Brand & Category filters
        if (brandFilter !== 'all' && (bp.brand || '').toLowerCase() !== brandFilter.toLowerCase()) return false
        if (categoryFilter !== 'all' && (bp.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false

        // Text query
        if (!needle) return true
        const textMatch =
          bp.name.toLowerCase().includes(needle) ||
          (bp.brand && bp.brand.toLowerCase().includes(needle)) ||
          (bp.category && bp.category.toLowerCase().includes(needle)) ||
          bp.accounts.some((a) =>
            a.products.some((p) => p.product_name.toLowerCase().includes(needle) || p.account_sku.toLowerCase().includes(needle))
          )
        return textMatch
      })
  }, [data.basepacks, q, accountFilter, branchFilter, statusFilter, brandFilter, categoryFilter])

  // Dynamic KPI summary calculated on currently filtered data
  const currentKpis = useMemo(() => {
    const totalBp = filteredBasepacks.length
    const availBp = filteredBasepacks.filter((b) => b.overall_status === 'available' || b.overall_status === 'mixed').length
    const unavailBp = filteredBasepacks.filter((b) => b.overall_status === 'unavailable').length

    const totalProd = filteredProducts.length
    const availProd = filteredProducts.filter((p) => p.available).length
    const unavailProd = filteredProducts.filter((p) => !p.available).length

    const bpOla = totalBp > 0 ? Math.round((availBp / totalBp) * 100) : 0
    const prodOla = totalProd > 0 ? Math.round((availProd / totalProd) * 100) : 0

    return {
      totalBp,
      availBp,
      unavailBp,
      bpOla,
      totalProd,
      availProd,
      unavailProd,
      prodOla,
    }
  }, [filteredBasepacks, filteredProducts])

  // Paginated basepacks
  const pagedBasepacks = useMemo(() => {
    const start = (bpPage - 1) * pageSize
    return filteredBasepacks.slice(start, start + pageSize)
  }, [filteredBasepacks, bpPage])

  const totalBpPages = Math.max(1, Math.ceil(filteredBasepacks.length / pageSize))

  // Paginated products
  const pagedProducts = useMemo(() => {
    const start = (prodPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, prodPage])

  const totalProdPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))

  // Copy Out of Stock SKUs to clipboard
  async function copyUnavailableSkus() {
    const unavail = filteredProducts.filter((p) => !p.available)
    if (!unavail.length) return

    const lines = [
      'Account\tBranch\tSKU\tProduct Name\tBasepack\tPrice\tStatus',
      ...unavail.map(
        (p) =>
          `${p.account_name}\t${p.location_name || 'All'}\t${p.account_sku}\t${p.product_name}\t${p.basepack_name}\t${
            p.price !== null ? p.price : '—'
          }\t${p.status || 'Out of Stock'}`
      ),
    ]

    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Export CSV
  function exportCsv() {
    const rows = filteredProducts.map((p) => ({
      Account: p.account_name,
      Branch: p.location_name || 'All',
      SKU: p.account_sku,
      ProductName: `"${p.product_name.replace(/"/g, '""')}"`,
      Basepack: `"${p.basepack_name.replace(/"/g, '""')}"`,
      Brand: p.brand || '',
      Category: p.category || '',
      Availability: p.available ? 'Available' : 'Unavailable',
      Price: p.price !== null ? p.price : '',
      OriginalPrice: p.original_price !== null ? p.original_price : '',
      Status: `"${(p.status || '').replace(/"/g, '""')}"`,
      Url: p.product_url || '',
      ObservedDate: p.observed_date,
    }))

    if (!rows.length) return
    const headers = Object.keys(rows[0]).join(',')
    const body = rows.map((r) => Object.values(r).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ubl-shelf-check-${data.date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="checker-container">
      {/* Top Banner / Topline */}
      <div className="checker-topline">
        <div className="topline-left">
          <span className="live-pulse" />
          <span>
            <b>Live Shelf Check</b> · {data.date}
          </span>
          <span className="divider">•</span>
          <span className="date-select-wrap">
            <label htmlFor="checker-date-select">Snapshot Date:</label>
            <select
              id="checker-date-select"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="checker-date-select"
            >
              {data.available_dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </span>
        </div>

        <div className="topline-actions">
          <button
            className={`secondary-btn ${copied ? 'btn-success' : ''}`}
            onClick={copyUnavailableSkus}
            title="Copy out-of-stock SKUs to clipboard for operational updates"
          >
            {copied ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : `Copy Out of Stock (${currentKpis.unavailProd})`}</span>
          </button>
          <button className="secondary-btn" onClick={exportCsv} title="Download current filtered list as CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="checker-kpi-grid">
        <div className="checker-kpi card">
          <div className="kpi-icon-row">
            <PackageCheck size={18} className="text-teal" />
            <span className="kpi-tag">{currentKpis.bpOla}% OLA</span>
          </div>
          <div className="kpi-number">{currentKpis.availBp}</div>
          <div className="kpi-title">Available Basepacks</div>
          <div className="kpi-desc">of {currentKpis.totalBp} tracked basepacks</div>
        </div>

        <div className="checker-kpi card">
          <div className="kpi-icon-row">
            <PackageX size={18} className="text-red" />
            <span className="kpi-tag tag-red">{currentKpis.unavailBp} NOLA</span>
          </div>
          <div className="kpi-number text-red">{currentKpis.unavailBp}</div>
          <div className="kpi-title">Unavailable Basepacks</div>
          <div className="kpi-desc">0 available SKUs across scope</div>
        </div>

        <div className="checker-kpi card">
          <div className="kpi-icon-row">
            <CheckCircle2 size={18} className="text-green" />
            <span className="kpi-tag tag-green">{currentKpis.prodOla}% In Stock</span>
          </div>
          <div className="kpi-number text-green">{currentKpis.availProd.toLocaleString()}</div>
          <div className="kpi-title">Available Products</div>
          <div className="kpi-desc">Active in-stock retailer SKUs</div>
        </div>

        <div className="checker-kpi card highlight-card">
          <div className="kpi-icon-row">
            <XCircle size={18} className="text-coral" />
            <span className="kpi-tag tag-coral">Immediate Attention</span>
          </div>
          <div className="kpi-number text-coral">{currentKpis.unavailProd.toLocaleString()}</div>
          <div className="kpi-title">Unavailable Products</div>
          <div className="kpi-desc">Out of stock or missing SKUs</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="checker-filter-bar card">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setBpPage(1)
              setProdPage(1)
            }}
            placeholder="Search basepack name, SKU code, product title, or brand..."
          />
          {q && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setQ('')
                setBpPage(1)
                setProdPage(1)
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          {/* Account Filter */}
          <div className="control-field">
            <label>Retailer</label>
            <select
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value)
                setBranchFilter('all')
                setBpPage(1)
                setProdPage(1)
              }}
            >
              <option value="all">All Retailers ({data.accounts.length})</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pandamart Branch Filter (if applicable) */}
          {availableBranches.length > 0 && (
            <div className="control-field">
              <label>Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value)
                  setBpPage(1)
                  setProdPage(1)
                }}
              >
                <option value="all">All Branches ({availableBranches.length})</option>
                {availableBranches.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="control-field">
            <label>Availability</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter)
                setBpPage(1)
                setProdPage(1)
              }}
            >
              <option value="all">All Items</option>
              <option value="available">Available (In Stock)</option>
              <option value="unavailable">Unavailable (Out of Stock)</option>
              <option value="mixed">Mixed (Partial Coverage)</option>
            </select>
          </div>

          {/* Brand Filter */}
          <div className="control-field">
            <label>Brand</label>
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value)
                setBpPage(1)
                setProdPage(1)
              }}
            >
              <option value="all">All Brands ({data.brands.length})</option>
              {data.brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="control-field">
            <label>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setBpPage(1)
                setProdPage(1)
              }}
            >
              <option value="all">All Categories ({data.categories.length})</option>
              {data.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {(q ||
            accountFilter !== 'all' ||
            branchFilter !== 'all' ||
            statusFilter !== 'all' ||
            brandFilter !== 'all' ||
            categoryFilter !== 'all') && (
            <button className="reset-filter-btn" onClick={resetFilters} title="Reset all filters">
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode Switcher & Expand/Collapse Controls */}
      <div className="checker-toolbar">
        <div className="mode-tabs">
          <button
            className={viewMode === 'basepacks' ? 'active' : ''}
            onClick={() => setViewMode('basepacks')}
          >
            <Layers size={15} />
            <span>Basepacks Hierarchy ({filteredBasepacks.length})</span>
          </button>
          <button
            className={viewMode === 'products' ? 'active' : ''}
            onClick={() => setViewMode('products')}
          >
            <Store size={15} />
            <span>All Products Table ({filteredProducts.length})</span>
          </button>
        </div>

        {viewMode === 'basepacks' && filteredBasepacks.length > 0 && (
          <div className="expand-controls">
            <button
              className="ghost-pill-btn"
              onClick={() => expandAll(filteredBasepacks.map((b) => b.id))}
            >
              Expand All
            </button>
            <button className="ghost-pill-btn" onClick={collapseAll}>
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Main Content Areas */}
      {loading ? (
        <div className="card loading-card">
          <div className="spinner" />
          <p>Loading shelf intelligence & availability data…</p>
        </div>
      ) : (
        <>
          {/* VIEW 1: Basepacks Grouped Hierarchy */}
          {viewMode === 'basepacks' && (
            <div className="basepack-list">
              {pagedBasepacks.map((bp) => {
                const isExpanded = expandedBpIds.has(bp.id)
                return (
                  <div
                    key={bp.id}
                    className={`card basepack-card ${bp.overall_status === 'unavailable' ? 'border-red-subtle' : ''}`}
                  >
                    {/* Header Row */}
                    <div className="basepack-header" onClick={() => toggleExpand(bp.id)}>
                      <div className="basepack-left">
                        <button className="expand-icon-btn" aria-label="Toggle details">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div className="basepack-info">
                          <div className="basepack-title-row">
                            <h3 className="basepack-title">{bp.name}</h3>
                            <span
                              className={`status-chip ${
                                bp.overall_status === 'available'
                                  ? 'status-available'
                                  : bp.overall_status === 'mixed'
                                  ? 'status-mixed'
                                  : 'status-unavailable'
                              }`}
                            >
                              {bp.overall_status === 'available' && '✓ Available Everywhere'}
                              {bp.overall_status === 'mixed' && '⚡ Partial Availability'}
                              {bp.overall_status === 'unavailable' && '✕ Unavailable (NOLA)'}
                            </span>
                          </div>
                          <div className="basepack-meta">
                            {bp.brand && <span className="meta-tag brand-tag">{bp.brand}</span>}
                            {bp.category && <span className="meta-tag">{bp.category}</span>}
                            {bp.format && <span className="meta-tag">{bp.format}</span>}
                            <span className="meta-stats">
                              {bp.available_accounts_count} of {bp.accounts_count} accounts available ·{' '}
                              {bp.available_products_count} in stock / {bp.products_count} total SKUs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right side account coverage pills */}
                      <div className="account-coverage-pills" onClick={(e) => e.stopPropagation()}>
                        {bp.accounts.map((acc, idx) => (
                          <span
                            key={`${acc.account_id}-${acc.location_id || ''}-${idx}`}
                            className={`account-pill ${acc.available ? 'acc-available' : 'acc-unavailable'}`}
                            title={`${acc.label}: ${
                              acc.available
                                ? `In stock (${acc.sku_available}/${acc.sku_expected} SKUs)`
                                : `Out of stock (${acc.reason || 'OOS'})`
                            }`}
                          >
                            <i className="dot" />
                            <span className="acc-name">{acc.label}</span>
                            <span className="acc-count">
                              {acc.sku_available}/{acc.sku_expected}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expandable Mapped Products Section */}
                    {isExpanded && (
                      <div className="basepack-products-drawer">
                        <div className="drawer-title">
                          <span>Mapped Retailer Products & Live Observation ({bp.accounts.flatMap((a) => a.products).length})</span>
                        </div>

                        {bp.accounts.flatMap((a) => a.products).length === 0 ? (
                          <div className="empty-drawer">No products observed for this basepack on {data.date}.</div>
                        ) : (
                          <div className="table-wrap">
                            <table className="table checker-table">
                              <thead>
                                <tr>
                                  <th>Status</th>
                                  <th>Retailer / Branch</th>
                                  <th>Product Title</th>
                                  <th>SKU Code</th>
                                  <th>Selling Price</th>
                                  <th>Store Link</th>
                                  <th>Observation Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bp.accounts.flatMap((acc) =>
                                  acc.products.map((p) => (
                                    <tr
                                      key={p.id}
                                      className={!p.available ? 'row-unavailable' : 'row-available'}
                                      onClick={() => setInspectProduct(p)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <td>
                                        <span className={`status ${p.available ? 'ok' : 'bad'}`}>
                                          <i className="dot" />
                                          {p.available ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                      </td>
                                      <td>
                                        <b>{acc.label}</b>
                                      </td>
                                      <td>
                                        <div className="product-name-cell" title={p.product_name}>
                                          {p.product_name}
                                        </div>
                                      </td>
                                      <td>
                                        <code className="sku-badge">{p.account_sku}</code>
                                      </td>
                                      <td>
                                        {p.price !== null ? (
                                          <span className="price-tag">
                                            ৳{p.price}
                                            {p.original_price && p.original_price > p.price && (
                                              <del className="original-price">৳{p.original_price}</del>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-muted">—</span>
                                        )}
                                      </td>
                                      <td>
                                        {p.product_url ? (
                                          <a
                                            href={p.product_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="store-link"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            View Store <ExternalLink size={12} />
                                          </a>
                                        ) : (
                                          <span className="text-muted">No URL</span>
                                        )}
                                      </td>
                                      <td>
                                        <span className="obs-status-text" title={p.status || ''}>
                                          {p.status || (p.available ? 'Available' : 'Unavailable')}
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
                  </div>
                )
              })}

              {!pagedBasepacks.length && (
                <div className="card empty-panel">
                  <PackageX size={36} className="text-muted" />
                  <h3>No basepacks match your current filters</h3>
                  <p>Try searching for a different keyword or resetting your filters.</p>
                  <button className="primary" onClick={resetFilters}>
                    Reset Filters
                  </button>
                </div>
              )}

              {/* Basepack Pagination */}
              {totalBpPages > 1 && (
                <div className="pagination-bar">
                  <span>
                    Showing {(bpPage - 1) * pageSize + 1} -{' '}
                    {Math.min(bpPage * pageSize, filteredBasepacks.length)} of {filteredBasepacks.length} basepacks
                  </span>
                  <div className="page-buttons">
                    <button
                      className="ghost-pill-btn"
                      disabled={bpPage === 1}
                      onClick={() => setBpPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-indicator">
                      Page {bpPage} of {totalBpPages}
                    </span>
                    <button
                      className="ghost-pill-btn"
                      disabled={bpPage >= totalBpPages}
                      onClick={() => setBpPage((p) => Math.min(totalBpPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: All Products Audit Table */}
          {viewMode === 'products' && (
            <div className="card product-audit-card">
              <div className="audit-header">
                <div>
                  <h3>Retailer Products Audit Table</h3>
                  <p>Showing {filteredProducts.length} observed SKUs matching active criteria.</p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table checker-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Account / Retailer</th>
                      <th>Product Title</th>
                      <th>SKU</th>
                      <th>Mapped Basepack</th>
                      <th>Brand</th>
                      <th>Price</th>
                      <th>Raw Observation Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProducts.map((p) => (
                      <tr
                        key={p.id}
                        className={!p.available ? 'row-unavailable' : 'row-available'}
                        onClick={() => setInspectProduct(p)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className={`status ${p.available ? 'ok' : 'bad'}`}>
                            <i className="dot" />
                            {p.available ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td>
                          <b>{p.account_name}</b>
                          {p.location_name && <small className="branch-label"> · {p.location_name}</small>}
                        </td>
                        <td>
                          <div className="product-name-cell" title={p.product_name}>
                            {p.product_name}
                          </div>
                        </td>
                        <td>
                          <code className="sku-badge">{p.account_sku}</code>
                        </td>
                        <td>
                          <div className="basepack-name-cell" title={p.basepack_name}>
                            {p.basepack_name}
                          </div>
                        </td>
                        <td>{p.brand || '—'}</td>
                        <td>
                          {p.price !== null ? (
                            <span className="price-tag">
                              ৳{p.price}
                              {p.original_price && p.original_price > p.price && (
                                <del className="original-price">৳{p.original_price}</del>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="obs-status-text" title={p.status || ''}>
                            {p.status || (p.available ? 'Available' : 'Unavailable')}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {p.product_url ? (
                            <a
                              href={p.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="store-link-icon"
                              title="Open product on retailer website"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!pagedProducts.length && (
                      <tr>
                        <td colSpan={9} className="empty">
                          No products match your current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Product Pagination */}
              {totalProdPages > 1 && (
                <div className="pagination-bar" style={{ marginTop: 14 }}>
                  <span>
                    Showing {(prodPage - 1) * pageSize + 1} -{' '}
                    {Math.min(prodPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
                  </span>
                  <div className="page-buttons">
                    <button
                      className="ghost-pill-btn"
                      disabled={prodPage === 1}
                      onClick={() => setProdPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-indicator">
                      Page {prodPage} of {totalProdPages}
                    </span>
                    <button
                      className="ghost-pill-btn"
                      disabled={prodPage >= totalProdPages}
                      onClick={() => setProdPage((p) => Math.min(totalProdPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Inspect Product Details Modal */}
      {inspectProduct && (
        <div className="modal-overlay" onClick={() => setInspectProduct(null)}>
          <div className="modal-card inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Product Observation Details</h3>
              <button className="icon-btn" onClick={() => setInspectProduct(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body inspect-body">
              <div className="inspect-status-banner">
                <span className={`status ${inspectProduct.available ? 'ok' : 'bad'}`}>
                  <i className="dot" />
                  {inspectProduct.available ? 'Currently In Stock (Available)' : 'Currently Out of Stock (Unavailable)'}
                </span>
                <span className="inspect-date">Observed: {inspectProduct.observed_at?.replace('T', ' ').slice(0, 19)}</span>
              </div>

              <div className="inspect-grid">
                <div className="inspect-item">
                  <label>Product Title</label>
                  <b>{inspectProduct.product_name}</b>
                </div>

                <div className="inspect-item">
                  <label>SKU / Product Code</label>
                  <code>{inspectProduct.account_sku}</code>
                </div>

                <div className="inspect-item">
                  <label>Retailer Account</label>
                  <b>
                    {inspectProduct.account_name}
                    {inspectProduct.location_name ? ` (${inspectProduct.location_name})` : ''}
                  </b>
                </div>

                <div className="inspect-item">
                  <label>Current Price</label>
                  <b className="price-highlight">
                    {inspectProduct.price !== null ? `৳${inspectProduct.price}` : 'Not listed'}
                    {inspectProduct.original_price && inspectProduct.original_price > (inspectProduct.price || 0) && (
                      <span className="inspect-orig"> (was ৳{inspectProduct.original_price})</span>
                    )}
                  </b>
                </div>

                <div className="inspect-item span2">
                  <label>Mapped Basepack</label>
                  <b>{inspectProduct.basepack_name}</b>
                </div>

                <div className="inspect-item">
                  <label>Brand</label>
                  <span>{inspectProduct.brand || '—'}</span>
                </div>

                <div className="inspect-item">
                  <label>Category / Format</label>
                  <span>
                    {inspectProduct.category || '—'} · {inspectProduct.format || '—'}
                  </span>
                </div>

                <div className="inspect-item span2">
                  <label>Scraper Status Message</label>
                  <div className="status-quote">{inspectProduct.status || 'No specific status message recorded.'}</div>
                </div>

                {inspectProduct.product_url && (
                  <div className="inspect-item span2">
                    <label>Store URL</label>
                    <a
                      href={inspectProduct.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="store-full-link"
                    >
                      {inspectProduct.product_url} <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
                <button className="primary" onClick={() => setInspectProduct(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
