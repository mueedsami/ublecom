'use client'
import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  Sparkles,
  Calendar,
  History,
  Info,
  Clock,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import {
  FoodiUploadRecord,
  getFoodiUploadHistory,
  editFoodiUploadBasis,
} from '@/lib/foodiOlaData'

interface FoodiUploadTabProps {
  onUploadSuccess: () => Promise<void>
}

export default function FoodiUploadTab({ onUploadSuccess }: FoodiUploadTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileDate, setFileDate] = useState<string>('')
  const [stockBasis, setStockBasis] = useState<'same_day' | 'previous_day'>('previous_day')
  const [asOfDate, setAsOfDate] = useState<string>('')

  // Preview state
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Commit state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<any | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // History state
  const [history, setHistory] = useState<FoodiUploadRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Edit Basis Modal state
  const [editingRecord, setEditingRecord] = useState<FoodiUploadRecord | null>(null)
  const [editBasisChoice, setEditBasisChoice] = useState<'same_day' | 'previous_day'>('previous_day')
  const [updatingBasis, setUpdatingBasis] = useState(false)
  const [editBasisError, setEditBasisError] = useState<string | null>(null)

  // Load remembered basis choice on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('foodi_stock_basis')
      if (saved === 'same_day' || saved === 'previous_day') {
        setStockBasis(saved)
      }
    } catch {}
  }, [])

  // Recalculate asOfDate when fileDate or stockBasis changes
  useEffect(() => {
    if (!fileDate) return
    const parts = fileDate.split('-').map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
      if (stockBasis === 'previous_day') {
        d.setUTCDate(d.getUTCDate() - 1)
      }
      setAsOfDate(d.toISOString().slice(0, 10))
    }
  }, [fileDate, stockBasis])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const records = await getFoodiUploadHistory()
      setHistory(records)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewData(null)
    setImportResult(null)
    setPreviewError(null)
    setImportError(null)

    await inspectFile(f, fileDate, stockBasis)
  }

  async function inspectFile(
    f: File,
    overrideFileDate?: string,
    overrideBasis?: 'same_day' | 'previous_day'
  ) {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('preview', 'true')
      if (overrideFileDate) fd.append('fileDate', overrideFileDate)
      if (overrideBasis) fd.append('stockBasis', overrideBasis)

      const res = await fetch('/api/foodi/upload?preview=true', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to inspect Foodi Excel file')
      }

      setFileDate(data.fileDate || '')
      setStockBasis(data.stockBasis || 'previous_day')
      setAsOfDate(data.asOfDate || '')
      setPreviewData(data)
    } catch (err: any) {
      setPreviewError(err.message || 'Error inspecting file')
    } finally {
      setLoadingPreview(false)
    }
  }

  function handleBasisChange(basis: 'same_day' | 'previous_day') {
    setStockBasis(basis)
    try {
      localStorage.setItem('foodi_stock_basis', basis)
    } catch {}
    if (file) {
      inspectFile(file, fileDate, basis)
    }
  }

  function handleFileDateChange(dateStr: string) {
    setFileDate(dateStr)
    if (file) {
      inspectFile(file, dateStr, stockBasis)
    }
  }

  async function handleRunImport() {
    if (!file) return
    setImporting(true)
    setImportProgress(15)
    setImportError(null)
    setImportResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      if (fileDate) fd.append('fileDate', fileDate)
      fd.append('stockBasis', stockBasis)

      const timer = setInterval(() => {
        setImportProgress(prev => (prev < 85 ? prev + 15 : prev))
      }, 250)

      const res = await fetch('/api/foodi/upload', {
        method: 'POST',
        body: fd,
      })
      clearInterval(timer)
      setImportProgress(95)

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Import failed')
      }

      setImportProgress(100)
      setImportResult(data)
      await onUploadSuccess()
      await loadHistory()
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleSaveEditBasis() {
    if (!editingRecord) return
    setUpdatingBasis(true)
    setEditBasisError(null)
    try {
      await editFoodiUploadBasis(editingRecord.id, editBasisChoice)
      setEditingRecord(null)
      await onUploadSuccess()
      await loadHistory()
    } catch (err: any) {
      setEditBasisError(err.message || 'Failed to update stock basis')
    } finally {
      setUpdatingBasis(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. Upload & Setup Box */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 6px', fontWeight: 800 }}>
            Upload Foodi XL Point Stock Report (.xlsx)
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Upload the official Foodi stock report (e.g. <code>Foodi - XL Point Stock Report (Sep29).xlsx</code>).
            The importer reads barcodes as exact text, identifies bundles, extracts rolling 30-day sales, and builds daily SKU-level OLA.
          </p>
        </div>

        {/* File Dropzone */}
        <div
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 14,
            padding: '28px 20px',
            textAlign: 'center',
            background: 'rgba(12,20,37,0.5)',
            marginBottom: 20,
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('foodi-file-input')?.click()}
        >
          <input
            id="foodi-file-input"
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <UploadCloud size={38} color="var(--teal)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {file ? file.name : 'Click to select or drag & drop Foodi Excel report'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            First 9 columns parsed: Barcodes, SKU, Product Name, Category, TP, MRP, Selling Price, 30 Day Sale Qty, Total Stock
          </div>
        </div>

        {loadingPreview && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--teal)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <RefreshCw size={16} className="spin" />
            Analyzing file structure, barcodes, and verifying mistake catchers...
          </div>
        )}

        {previewError && (
          <div style={{ padding: 14, background: 'rgba(255,102,115,0.1)', border: '1px solid var(--red)', borderRadius: 10, color: 'var(--red)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <AlertCircle size={18} />
            <span>{previewError}</span>
          </div>
        )}

        {/* Configuration Dialog: File Date & Stock Basis Selection */}
        {file && !loadingPreview && (
          <div
            style={{
              background: '#090e1a',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'grid',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="var(--teal)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                Configure Date &amp; Stock Basis
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {/* File Date */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  File Date (Report Received Date)
                </label>
                <input
                  type="date"
                  value={fileDate}
                  onChange={e => handleFileDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#0c1425',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  Prefilled from filename ({file.name})
                </span>
              </div>

              {/* Stock Basis (Same Day vs Previous Day) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Stock Column Represents
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleBasisChange('previous_day')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: stockBasis === 'previous_day' ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: stockBasis === 'previous_day' ? 'rgba(50,209,195,0.15)' : '#0c1425',
                      color: stockBasis === 'previous_day' ? 'var(--teal)' : 'var(--text)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {stockBasis === 'previous_day' && <Check size={14} />} Previous Day (T-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBasisChange('same_day')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: stockBasis === 'same_day' ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: stockBasis === 'same_day' ? 'rgba(50,209,195,0.15)' : '#0c1425',
                      color: stockBasis === 'same_day' ? 'var(--teal)' : 'var(--text)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {stockBasis === 'same_day' && <Check size={14} />} Same Day
                  </button>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  Remembered for Foodi uploads
                </span>
              </div>

              {/* Calculated Stock As-Of Date (Read-Only) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
                  Stock As-Of Date (Calculated)
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#0c1425',
                    border: '1px solid var(--teal)',
                    color: 'var(--teal)',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {asOfDate || '—'}
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  {stockBasis === 'previous_day' ? 'File Date - 1 day (T-1 basis)' : 'File Date (Same day basis)'}
                </span>
              </div>
            </div>

            {/* Warnings from Mistake Catchers */}
            {previewData?.warnings?.collision && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255,191,75,0.12)',
                  border: '1px solid var(--amber)',
                  borderRadius: 8,
                  color: 'var(--amber)',
                  fontSize: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <b>Collision Warning:</b> {previewData.warnings.collision.message}
                </span>
              </div>
            )}

            {previewData?.warnings?.basisChange && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(74,144,226,0.12)',
                  border: '1px solid var(--blue)',
                  borderRadius: 8,
                  color: '#93c5fd',
                  fontSize: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Info size={16} style={{ flexShrink: 0 }} />
                <span>
                  <b>Basis Change:</b> {previewData.warnings.basisChange.message}
                </span>
              </div>
            )}

            {previewData?.warnings?.identicalStock && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255,102,115,0.12)',
                  border: '1px solid var(--red)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  fontSize: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <b>Identical Stock Warning:</b> {previewData.warnings.identicalStock.message}
                </span>
              </div>
            )}

            {/* Preview Statistics Cards */}
            {previewData?.stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 4 }}>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Total SKUs</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{previewData.stats.uniqueSkus}</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>In Stock</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, color: 'var(--green)' }}>{previewData.stats.availableSkus}</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Out of Stock</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, color: 'var(--red)' }}>{previewData.stats.oosSkus}</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>SKU OLA %</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, color: 'var(--teal)' }}>{previewData.stats.olaPercentage}%</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Low Stock (1-9)</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, color: 'var(--amber)' }}>{previewData.stats.lowStockSkus}</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Bundles</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{previewData.stats.bundlesCount}</div>
                </div>
                <div style={{ background: '#0c1425', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>OOS w/ Sales</span>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, color: '#f87171' }}>{previewData.stats.oosWithSalesCount}</div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => inspectFile(file, fileDate, stockBasis)}
                disabled={importing}
              >
                <Eye size={14} /> Re-inspect File
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleRunImport}
                disabled={importing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--teal)', color: '#090e1a', fontWeight: 800 }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Importing Foodi Report ({importProgress}%)...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} /> Import &amp; Build Foodi OLA
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {importing && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Writing snapshots, 30-day sales, and SKU-level OLA calculations...</span>
              <b>{importProgress}%</b>
            </div>
            <div className="bar">
              <i style={{ width: `${importProgress}%`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* Error message */}
        {importError && (
          <div style={{ padding: 14, background: 'rgba(255,102,115,0.1)', border: '1px solid var(--red)', borderRadius: 10, color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
            {importError}
          </div>
        )}

        {/* Success / Result Summary */}
        {importResult && (
          <div
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(180deg, rgba(50,209,195,0.12), rgba(12,20,37,0.8))',
              border: '1px solid rgba(50,209,195,0.3)',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              <CheckCircle2 size={18} />
              Import Successful: Foodi SKU OLA {importResult.stats?.olaPercentage}%
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Stock As-Of Date</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{importResult.asOfDate}</div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>File Date</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{importResult.fileDate}</div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Stock Basis</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--teal)' }}>
                  {importResult.stockBasis === 'same_day' ? 'Same Day' : 'Previous Day (T-1)'}
                </div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Available SKUs</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--green)' }}>
                  {importResult.stats?.availableSkus} / {importResult.stats?.uniqueSkus}
                </div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Low Stock SKUs</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--amber)' }}>
                  {importResult.stats?.lowStockSkus}
                </div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>OOS w/ Sales</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: '#f87171' }}>
                  {importResult.stats?.oosWithSalesCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Upload Audit History & Edit Basis */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} color="var(--teal)" />
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Upload History &amp; Basis Manager</h2>
          </div>
          <button type="button" className="ghost-pill-btn" onClick={loadHistory} disabled={loadingHistory}>
            <RefreshCw size={12} className={loadingHistory ? 'spin' : ''} /> Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table className="table" style={{ width: '100%', minWidth: 720 }}>
            <thead>
              <tr>
                <th>Stock As-Of</th>
                <th>File Date</th>
                <th>Stock Basis</th>
                <th>File Name</th>
                <th style={{ textAlign: 'right' }}>Total SKUs</th>
                <th style={{ textAlign: 'right' }}>SKU OLA %</th>
                <th>Uploaded At</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    No Foodi uploads recorded yet. Upload a Foodi stock report above.
                  </td>
                </tr>
              ) : (
                history.map(h => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.stockAsOf || h.reportDate}</b>
                    </td>
                    <td>{h.reportDate}</td>
                    <td>
                      <span className={`count-pill ${h.stockBasis === 'same_day' ? 'badge-blue' : 'badge-teal'}`}>
                        {h.stockBasis === 'same_day' ? 'Same Day' : 'Previous Day (T-1)'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.fileName}</td>
                    <td style={{ textAlign: 'right' }}>{h.rowCount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="score-pill high" style={{ padding: '3px 8px', fontSize: 11 }}>
                        {h.olaPercentage ? `${h.olaPercentage}%` : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {new Date(h.uploadedAt).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="ghost-pill-btn"
                        onClick={() => {
                          setEditingRecord(h)
                          setEditBasisChoice(h.stockBasis === 'same_day' ? 'previous_day' : 'same_day')
                          setEditBasisError(null)
                        }}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        <Edit2 size={11} /> Edit Basis
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Basis Modal */}
      {editingRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0c1425',
              border: '1px solid var(--border)',
              borderRadius: 14,
              maxWidth: 480,
              width: '100%',
              padding: '24px 24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--teal)" />
                <h3 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>Edit Stock Basis</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Fixing a wrong choice updates the as-of date and moves all {editingRecord.rowCount} snapshots, trend lines, and exceptions automatically without needing to re-upload the file.
            </p>

            <div style={{ background: '#070b14', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <b>File:</b> {editingRecord.fileName}
              </div>
              <div style={{ marginBottom: 4 }}>
                <b>File Date:</b> {editingRecord.reportDate}
              </div>
              <div>
                <b>Current As-Of Date:</b> {editingRecord.stockAsOf} ({editingRecord.stockBasis === 'same_day' ? 'Same day' : 'Previous day T-1'})
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                Switch Stock Basis To:
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditBasisChoice('previous_day')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: editBasisChoice === 'previous_day' ? '1px solid var(--teal)' : '1px solid var(--border)',
                    background: editBasisChoice === 'previous_day' ? 'rgba(50,209,195,0.15)' : '#0c1425',
                    color: editBasisChoice === 'previous_day' ? 'var(--teal)' : 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Previous Day (T-1)
                </button>
                <button
                  type="button"
                  onClick={() => setEditBasisChoice('same_day')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: editBasisChoice === 'same_day' ? '1px solid var(--teal)' : '1px solid var(--border)',
                    background: editBasisChoice === 'same_day' ? 'rgba(50,209,195,0.15)' : '#0c1425',
                    color: editBasisChoice === 'same_day' ? 'var(--teal)' : 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Same Day
                </button>
              </div>
            </div>

            {editBasisError && (
              <div style={{ padding: 12, background: 'rgba(255,102,115,0.1)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)', fontSize: 12, marginBottom: 14 }}>
                {editBasisError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setEditingRecord(null)}
                disabled={updatingBasis}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleSaveEditBasis}
                disabled={updatingBasis}
                style={{ background: 'var(--teal)', color: '#090e1a', fontWeight: 800 }}
              >
                {updatingBasis ? 'Saving...' : 'Apply Basis Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
