'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Building2,
  Package,
  ArrowUpRight,
  Check,
  X,
  ShieldAlert,
  Info,
  HelpCircle,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { searchBasepacks } from '@/lib/dhData'

export interface ScopeSkuRow {
  sku: string
  product_name: string | null
  basepack_id: string
  basepack_name: string
  brand: string | null
  category: string | null
  branches_count: number
  branches_total: number
  locations: Array<{ id: string; name: string; code: string }>
  active: boolean
  scrape_enabled: boolean
  dh_match_status: string
  dh_item_id: string | null
}

export interface SkippedSkuRow {
  id: string
  dh_sku: string
  dh_name: string
  sold_qty_30d: number
  total_stock: number
  last_sale_date: string | null
  last_seen_date: string | null
  dismissed: boolean
  suggested_basepack: {
    id: string
    name: string
    brand: string | null
    confidence: number
  } | null
}

export interface MissingSkuRow {
  sku: string
  basepack_id: string
  basepack_name: string
  brand: string | null
  product_name: string | null
  branches_count: number
}

interface DhScopePanelProps {
  onScopeChanged?: () => void
}

export default function DhScopePanel({ onScopeChanged }: DhScopePanelProps) {
  const [subTab, setSubTab] = useState<'manager' | 'skipped' | 'missing'>('manager')

  // List Manager State
  const [skus, setSkus] = useState<ScopeSkuRow[]>([])
  const [locations, setLocations] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [loadingSkus, setLoadingSkus] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'full' | 'partial'>('all')

  // Skipped SKUs State
  const [skipped, setSkipped] = useState<SkippedSkuRow[]>([])
  const [missing, setMissing] = useState<MissingSkuRow[]>([])
  const [loadingSkipped, setLoadingSkipped] = useState(false)
  const [skippedSearch, setSkippedSearch] = useState('')
  const [skippedFilter, setSkippedFilter] = useState<'all' | 'selling' | 'zero' | 'dismissed'>('all')
  const [is014Installed, setIs014Installed] = useState(true)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [editingSku, setEditingSku] = useState<ScopeSkuRow | null>(null)

  // Add SKU Form State
  const [formSku, setFormSku] = useState('')
  const [formName, setFormName] = useState('')
  const [formBasepackSearch, setFormBasepackSearch] = useState('')
  const [formBasepackResults, setFormBasepackResults] = useState<Array<{ id: string; name: string; brand: string | null }>>([])
  const [formSelectedBasepack, setFormSelectedBasepack] = useState<{ id: string; name: string } | null>(null)
  const [formSelectedLocations, setFormSelectedLocations] = useState<Set<string>>(new Set())
  const [formScrapeEnabled, setFormScrapeEnabled] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Upload Modal State
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'merge' | 'replace'>('merge')
  const [uploadPreview, setUploadPreview] = useState<any | null>(null)
  const [uploadInspecting, setUploadInspecting] = useState(false)
  const [uploadApplying, setUploadApplying] = useState(false)
  const [replaceConfirmText, setReplaceConfirmText] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Load scope list
  async function loadScopeList() {
    setLoadingSkus(true)
    try {
      const res = await fetch('/api/dh/scope/skus')
      const json = await res.json()
      if (json.success) {
        setSkus(json.skus || [])
        setLocations(json.locations || [])
      }
    } catch (err) {
      console.error('Failed to load scope SKUs:', err)
    } finally {
      setLoadingSkus(false)
    }
  }

  // Load skipped list
  async function loadSkippedList() {
    setLoadingSkipped(true)
    try {
      const res = await fetch('/api/dh/scope/skipped?dismissed=all')
      const json = await res.json()
      if (json.success) {
        setSkipped(json.skipped_items || [])
        setMissing(json.missing_from_dump || [])
        setIs014Installed(Boolean(json.is_014_installed))
      }
    } catch (err) {
      console.error('Failed to load skipped SKUs:', err)
    } finally {
      setLoadingSkipped(false)
    }
  }

  useEffect(() => {
    loadScopeList()
    loadSkippedList()
  }, [])

  // Auto-search basepacks when adding SKU
  useEffect(() => {
    let active = true
    async function doSearch() {
      if (!formBasepackSearch.trim()) {
        setFormBasepackResults([])
        return
      }
      try {
        const res = await searchBasepacks(formBasepackSearch)
        if (active) setFormBasepackResults(res)
      } catch (err) {
        console.error(err)
      }
    }
    const timer = setTimeout(doSearch, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [formBasepackSearch])

  // Open Add modal with optional pre-filled values
  function handleOpenAddModal(prefill?: { sku: string; name: string; basepack?: { id: string; name: string } | null }) {
    setFormSku(prefill?.sku || '')
    setFormName(prefill?.name || '')
    setFormBasepackSearch('')
    setFormBasepackResults([])
    setFormSelectedBasepack(prefill?.basepack || null)
    setFormSelectedLocations(new Set(locations.map(l => l.id)))
    setFormScrapeEnabled(false)
    setFormError(null)
    setIsAddModalOpen(true)
  }

  // Handle Add SKU Submit
  async function handleAddSkuSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formSku.trim()) {
      setFormError('Item ID (SKU) is required')
      return
    }
    if (!formSelectedBasepack) {
      setFormError('Please select a valid Basepack')
      return
    }

    setFormSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/dh/scope/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_sku: formSku.trim(),
          basepack_id: formSelectedBasepack.id,
          product_name: formName.trim() || undefined,
          location_ids: Array.from(formSelectedLocations),
          scrape_enabled: formScrapeEnabled,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to add SKU')
      }

      setIsAddModalOpen(false)
      loadScopeList()
      loadSkippedList()
      onScopeChanged?.()
    } catch (err: any) {
      setFormError(err.message || 'Error saving SKU')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle SKU Deactivation / Removal
  async function handleDeactivateSku(sku: string) {
    if (!confirm(`Are you sure you want to deactivate SKU ${sku}?\n\nThis will remove it from Pandamart DH stock/sales tracking and OLA scraping.`)) {
      return
    }
    try {
      const res = await fetch(`/api/dh/scope/skus?sku=${encodeURIComponent(sku)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to deactivate')
      loadScopeList()
      loadSkippedList()
      onScopeChanged?.()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  // Handle Dismiss Toggle on Skipped SKU
  async function handleToggleDismiss(dhItemId: string, currentDismissed: boolean) {
    try {
      await fetch('/api/dh/scope/skipped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dh_item_id: dhItemId,
          dismissed: !currentDismissed,
        }),
      })
      setSkipped(prev =>
        prev.map(it => (it.id === dhItemId ? { ...it, dismissed: !currentDismissed } : it))
      )
    } catch (err) {
      console.error(err)
    }
  }

  // Upload Preview Diff
  async function handleInspectUpload(file: File) {
    setUploadFile(file)
    setUploadInspecting(true)
    setUploadError(null)
    setUploadPreview(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('action', 'preview')
    fd.append('mode', uploadMode)

    try {
      const res = await fetch('/api/dh/scope/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to inspect file')
      setUploadPreview(json.preview)
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploadInspecting(false)
    }
  }

  // Apply Upload
  async function handleApplyUpload() {
    if (!uploadFile) return
    if (uploadMode === 'replace' && replaceConfirmText.trim().toUpperCase() !== 'REPLACE') {
      setUploadError('Please type REPLACE to confirm replacement mode.')
      return
    }

    setUploadApplying(true)
    setUploadError(null)

    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('action', 'apply')
    fd.append('mode', uploadMode)

    try {
      const res = await fetch('/api/dh/scope/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to apply upload')

      setIsUploadModalOpen(false)
      setUploadFile(null)
      setUploadPreview(null)
      loadScopeList()
      loadSkippedList()
      onScopeChanged?.()
      alert(`Scope updated! Applied ${json.applied_rows} mappings across branches.`)
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploadApplying(false)
    }
  }

  // Unique Brands and Categories
  const brands = useMemo(() => {
    const s = new Set<string>()
    for (const r of skus) if (r.brand) s.add(r.brand)
    return Array.from(s).sort()
  }, [skus])

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const r of skus) if (r.category) s.add(r.category)
    return Array.from(s).sort()
  }, [skus])

  // Filtered Scope List
  const filteredSkus = useMemo(() => {
    return skus.filter(r => {
      if (brandFilter !== 'all' && r.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (coverageFilter === 'full' && r.branches_count < locations.length) return false
      if (coverageFilter === 'partial' && r.branches_count >= locations.length) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchSku = r.sku.toLowerCase().includes(q)
        const matchName = (r.product_name || '').toLowerCase().includes(q)
        const matchBp = r.basepack_name.toLowerCase().includes(q)
        const matchBrand = (r.brand || '').toLowerCase().includes(q)
        if (!matchSku && !matchName && !matchBp && !matchBrand) return false
      }
      return true
    })
  }, [skus, brandFilter, categoryFilter, coverageFilter, searchQuery, locations.length])

  // Filtered Skipped List
  const filteredSkipped = useMemo(() => {
    return skipped.filter(it => {
      if (skippedFilter === 'selling' && it.sold_qty_30d <= 0) return false
      if (skippedFilter === 'zero' && it.sold_qty_30d > 0) return false
      if (skippedFilter === 'dismissed' && !it.dismissed) return false
      if (skippedFilter !== 'dismissed' && it.dismissed) return false
      if (skippedSearch.trim()) {
        const q = skippedSearch.toLowerCase().trim()
        const matchSku = it.dh_sku.toLowerCase().includes(q)
        const matchName = it.dh_name.toLowerCase().includes(q)
        const matchBp = (it.suggested_basepack?.name || '').toLowerCase().includes(q)
        if (!matchSku && !matchName && !matchBp) return false
      }
      return true
    })
  }, [skipped, skippedFilter, skippedSearch])

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Bar & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setSubTab('manager')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === 'manager'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Legacy SKU Scope</span>
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-black/40 text-purple-200 font-mono">
              {skus.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('skipped')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === 'skipped'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Skipped Dump SKUs</span>
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-black/40 text-amber-200 font-mono">
              {skipped.filter(it => !it.dismissed).length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('missing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === 'missing'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Missing from Dump</span>
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-black/40 text-rose-200 font-mono">
              {missing.length}
            </span>
          </button>
        </div>

        {/* Global Panel Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add SKU to Scope</span>
          </button>

          <button
            onClick={() => {
              setUploadFile(null)
              setUploadPreview(null)
              setUploadError(null)
              setIsUploadModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload List (.xlsx)</span>
          </button>

          <a
            href="/api/dh/scope/upload"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Master List</span>
          </a>

          <button
            onClick={() => {
              loadScopeList()
              loadSkippedList()
            }}
            title="Refresh scope"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSkus || loadingSkipped ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scope Policy Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-900 border border-purple-800/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <strong className="text-white font-semibold">Single Source of Truth:</strong> The daily DH dump contains hundreds of Unilever and third-party products. Only the <strong className="text-purple-300 font-mono">{skus.length} active SKUs</strong> in your legacy Pandamart scope flow into sales analytics, inventory matrices, and automated flags. Off-list items are silently skipped to preserve accurate KPIs across all 17 delivery stores.
        </div>
      </div>

      {/* SUBTAB 1: LEGACY SKU LIST MANAGER */}
      {subTab === 'manager' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Item ID, Name, Basepack..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <select
                value={brandFilter}
                onChange={e => setBrandFilter(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Brands ({brands.length})</option>
                {brands.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={coverageFilter}
                onChange={e => setCoverageFilter(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Branch Coverages</option>
                <option value="full">In All 11 Scraped Branches</option>
                <option value="partial">Partial Branch Coverage (&lt;11)</option>
              </select>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item ID (SKU)</th>
                    <th className="py-3 px-4">Pandamart Product Name</th>
                    <th className="py-3 px-4">Mapped Basepack</th>
                    <th className="py-3 px-4">Brand / Category</th>
                    <th className="py-3 px-4 text-center">Branches</th>
                    <th className="py-3 px-4 text-center">DH Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingSkus ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        Loading Pandamart legacy SKU scope...
                      </td>
                    </tr>
                  ) : filteredSkus.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-zinc-500">
                        No SKUs found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSkus.map(row => (
                      <tr key={row.sku} className="hover:bg-zinc-800/40 transition-colors group">
                        <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                          {row.sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-200 max-w-xs truncate" title={row.product_name || ''}>
                          {row.product_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-purple-300 font-semibold max-w-xs truncate" title={row.basepack_name}>
                          {row.basepack_name}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-zinc-200 font-medium">{row.brand || '—'}</span>
                          {row.category && (
                            <span className="block text-[10px] text-zinc-500">{row.category}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              row.branches_count >= locations.length
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                                : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                            }`}
                            title={`${row.locations.map(l => l.name).join(', ')} (Tracked across all 17 DH stores)`}
                          >
                            {row.branches_count}/{locations.length}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {row.dh_match_status === 'matched' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                              <CheckCircle2 className="w-3 h-3" />
                              Active in DH
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/40">
                              Not in dump
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDeactivateSku(row.sku)}
                              title="Deactivate SKU from scope"
                              className="p-1 rounded hover:bg-rose-950/50 text-zinc-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {filteredSkus.length} of {skus.length} scoped SKUs
              </span>
              <span className="text-[11px] text-zinc-400">
                11 scraped locations define hero product eligibility across all 17 DH delivery branches.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SKIPPED DUMP SKUS (VIEW B) */}
      {subTab === 'skipped' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search skipped Item ID or Name..."
                value={skippedSearch}
                onChange={e => setSkippedSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={skippedFilter}
                onChange={e => setSkippedFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Active Skipped ({skipped.filter(it => !it.dismissed).length})</option>
                <option value="selling">Selling in 30d (Sales &gt; 0)</option>
                <option value="zero">Zero Sales (30d Qty = 0)</option>
                <option value="dismissed">Dismissed / Hidden</option>
              </select>

              <a
                href="/api/dh/scope/skipped?format=xlsx"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Skipped (.xlsx)</span>
              </a>
            </div>
          </div>

          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item ID</th>
                    <th className="py-3 px-4">Dump Product Name</th>
                    <th className="py-3 px-4 text-right">30d Sold Qty</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4">Suggested Basepack</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingSkipped ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                        Scanning skipped items from latest dumps...
                      </td>
                    </tr>
                  ) : filteredSkipped.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-zinc-500">
                        No skipped SKUs found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSkipped.map(row => (
                      <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-zinc-200 whitespace-nowrap">
                          {row.dh_sku}
                        </td>
                        <td className="py-3 px-4 text-zinc-300 max-w-sm truncate" title={row.dh_name}>
                          {row.dh_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {row.sold_qty_30d > 0 ? (
                            <span className="text-amber-400 font-semibold">
                              {row.sold_qty_30d.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-zinc-300">
                          {row.total_stock.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {row.suggested_basepack ? (
                            <div className="flex items-center gap-1.5" title={`Confidence: ${row.suggested_basepack.confidence}%`}>
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-zinc-200 font-medium truncate max-w-xs">
                                {row.suggested_basepack.name}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                ({row.suggested_basepack.confidence}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">No suggestion</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                handleOpenAddModal({
                                  sku: row.dh_sku,
                                  name: row.dh_name,
                                  basepack: row.suggested_basepack
                                    ? { id: row.suggested_basepack.id, name: row.suggested_basepack.name }
                                    : null,
                                })
                              }
                              className="px-2.5 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white font-semibold text-[11px] shadow transition-colors"
                            >
                              Add to Scope
                            </button>
                            <button
                              onClick={() => handleToggleDismiss(row.id, row.dismissed)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors"
                            >
                              {row.dismissed ? 'Undismiss' : 'Ignore'}
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

      {/* SUBTAB 3: MISSING FROM DUMP */}
      {subTab === 'missing' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/30 text-xs text-rose-200">
            <strong>Missing Products Alert:</strong> These {missing.length} SKUs exist on your legacy Pandamart list but were completely absent from the latest DH sales and stock feeds.
          </div>

          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item ID (SKU)</th>
                    <th className="py-3 px-4">Basepack Name</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Expected Product Name</th>
                    <th className="py-3 px-4 text-center">Branches Expected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {missing.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-zinc-500">
                        All legacy scope SKUs were present in the latest dump!
                      </td>
                    </tr>
                  ) : (
                    missing.map(row => (
                      <tr key={row.sku} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-300">{row.sku}</td>
                        <td className="py-3 px-4 text-zinc-200 font-medium">{row.basepack_name}</td>
                        <td className="py-3 px-4 text-zinc-300">{row.brand || '—'}</td>
                        <td className="py-3 px-4 text-zinc-400">{row.product_name || '—'}</td>
                        <td className="py-3 px-4 text-center font-mono text-zinc-300">
                          {row.branches_count} of {locations.length}
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

      {/* MODAL: ADD SKU TO SCOPE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-base">Add SKU to Legacy Scope</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSkuSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-200 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Item ID / Delivery Hero SKU <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5IL7H4"
                  value={formSku}
                  onChange={e => setFormSku(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Pandamart Product Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Boost Chocolate Jar 400g"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Map to Basepack <span className="text-rose-400">*</span>
                </label>
                {formSelectedBasepack ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50 text-xs text-purple-200">
                    <span className="font-semibold">{formSelectedBasepack.name}</span>
                    <button
                      type="button"
                      onClick={() => setFormSelectedBasepack(null)}
                      className="text-xs text-zinc-400 hover:text-white underline ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search basepack name..."
                      value={formBasepackSearch}
                      onChange={e => setFormBasepackSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                    />
                    {formBasepackResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
                        {formBasepackResults.map(bp => (
                          <div
                            key={bp.id}
                            onClick={() => {
                              setFormSelectedBasepack(bp)
                              setFormBasepackSearch('')
                              setFormBasepackResults([])
                            }}
                            className="p-2 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center justify-between"
                          >
                            <span>{bp.name}</span>
                            <span className="text-[10px] text-zinc-500">{bp.brand}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Branches Covered ({formSelectedLocations.size} of {locations.length} selected)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg max-h-36 overflow-y-auto">
                  {locations.map(loc => {
                    const checked = formSelectedLocations.has(loc.id)
                    return (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = new Set(formSelectedLocations)
                            if (checked) next.delete(loc.id)
                            else next.add(loc.id)
                            setFormSelectedLocations(next)
                          }}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="truncate">{loc.name}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormSelectedLocations(new Set(locations.map(l => l.id)))}
                    className="text-[10px] text-purple-400 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSelectedLocations(new Set())}
                    className="text-[10px] text-zinc-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="scrape_opt"
                  checked={formScrapeEnabled}
                  onChange={e => setFormScrapeEnabled(e.target.checked)}
                  className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="scrape_opt" className="text-xs text-zinc-300 cursor-pointer select-none">
                  Also scrape for OLA (On-Shelf Availability)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Add SKU to Scope'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD SKU LIST */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white text-base">Upload Pandamart SKU Master (.xlsx)</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-200 text-xs">
                  {uploadError}
                </div>
              )}

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Import Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setUploadMode('merge')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      uploadMode === 'merge'
                        ? 'bg-purple-950/50 border-purple-500 text-purple-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">Merge (Safe, Default)</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Adds new SKUs and updates mappings. No existing products are removed.
                    </div>
                  </div>

                  <div
                    onClick={() => setUploadMode('replace')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      uploadMode === 'replace'
                        ? 'bg-rose-950/50 border-rose-500 text-rose-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-rose-300">Replace (Strict)</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Deactivates any legacy SKUs missing from this file.
                    </div>
                  </div>
                </div>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select Excel File (.xlsx)
                </label>
                <div className="p-6 border-2 border-dashed border-zinc-700 rounded-xl bg-zinc-950/50 text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    id="excel_upload_input"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleInspectUpload(f)
                    }}
                    className="hidden"
                  />
                  <label htmlFor="excel_upload_input" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                    <span className="text-xs font-medium text-purple-400 hover:underline">
                      Click to choose file
                    </span>
                    <span className="text-xs text-zinc-500 block mt-1">
                      {uploadFile ? uploadFile.name : 'Multi-branch workbook (e.g. Pandamart SKU List.xlsx)'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Diff Preview Inspection */}
              {uploadInspecting && (
                <div className="text-center py-4 text-xs text-purple-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Inspecting sheets and computing diff...
                </div>
              )}

              {uploadPreview && (
                <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2 text-xs">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>File Inspection Summary:</span>
                    <span className="font-mono text-purple-400">{uploadPreview.total_file_skus} Total SKUs in File</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                    <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                      <div className="text-base font-bold">+{uploadPreview.to_add_count}</div>
                      <div className="text-[10px] text-zinc-400">New SKUs</div>
                    </div>
                    <div className="p-2 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300">
                      <div className="text-base font-bold">~{uploadPreview.to_update_count}</div>
                      <div className="text-[10px] text-zinc-400">Mappings Updated</div>
                    </div>
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300">
                      <div className="text-base font-bold">
                        {uploadMode === 'replace' ? `-${uploadPreview.to_deactivate_count}` : '0'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {uploadMode === 'replace' ? 'To Deactivate' : 'Preserved'}
                      </div>
                    </div>
                  </div>

                  {uploadPreview.unknown_basepacks_count > 0 && (
                    <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-amber-200 text-[11px]">
                      ⚠️ {uploadPreview.unknown_basepacks_count} basepacks not recognized in master catalog (will be skipped).
                    </div>
                  )}

                  {uploadMode === 'replace' && uploadPreview.to_deactivate_count > 0 && (
                    <div className="pt-2 border-t border-zinc-800 space-y-1">
                      <label className="text-[11px] font-semibold text-rose-300 block">
                        Type &quot;REPLACE&quot; to confirm deactivating {uploadPreview.to_deactivate_count} SKUs:
                      </label>
                      <input
                        type="text"
                        placeholder="REPLACE"
                        value={replaceConfirmText}
                        onChange={e => setReplaceConfirmText(e.target.value)}
                        className="w-full bg-zinc-900 border border-rose-800 rounded px-2.5 py-1 text-xs text-white uppercase font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyUpload}
                  disabled={!uploadPreview || uploadApplying}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md disabled:opacity-40"
                >
                  {uploadApplying ? 'Applying...' : 'Apply Scope Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
