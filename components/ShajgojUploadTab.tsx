'use client'
import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  Calendar,
  History,
  Info,
} from 'lucide-react'
import { ShajgojUploadRecord, getShajgojUploadHistory } from '@/lib/shajgojOlaData'

interface ShajgojUploadTabProps {
  onUploadSuccess: () => Promise<void>
}

export default function ShajgojUploadTab({ onUploadSuccess }: ShajgojUploadTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [asOfDate, setAsOfDate] = useState<string>('')
  const [periodLabel, setPeriodLabel] = useState<string>('')

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
  const [history, setHistory] = useState<ShajgojUploadRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const records = await getShajgojUploadHistory()
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
    await inspectWorkbook(f)
  }

  async function inspectWorkbook(f: File, sheetToInspect?: string) {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('preview', 'true')
      if (sheetToInspect) fd.append('sheetName', sheetToInspect)

      const res = await fetch('/api/shajgoj/upload?preview=true', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to inspect Excel workbook')
      }

      setSheetNames(data.sheetNames || [])
      setSelectedSheet(data.targetSheetName || '')
      if (data.dates) {
        setStartDate(data.dates.startDate || '')
        setEndDate(data.dates.endDate || '')
        setAsOfDate(data.dates.asOfDate || '')
        setPeriodLabel(data.dates.periodLabel || '')
      }
      setPreviewData(data)
    } catch (err: any) {
      setPreviewError(err.message || 'Error inspecting file')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSheetChange(sheetName: string) {
    setSelectedSheet(sheetName)
    if (file) {
      await inspectWorkbook(file, sheetName)
    }
  }

  async function handleRunImport() {
    if (!file) return
    setImporting(true)
    setImportProgress(10)
    setImportError(null)
    setImportResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      if (selectedSheet) fd.append('sheetName', selectedSheet)
      if (startDate) fd.append('startDate', startDate)
      if (endDate) fd.append('endDate', endDate)
      if (asOfDate) fd.append('asOfDate', asOfDate)
      if (periodLabel) fd.append('periodLabel', periodLabel)

      const timer = setInterval(() => {
        setImportProgress(prev => (prev < 80 ? prev + 15 : prev))
      }, 300)

      const res = await fetch('/api/shajgoj/upload', {
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

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. Upload & Setup Box */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 6px', fontWeight: 800 }}>
            Upload Shajgoj Stock Dump (.xlsx)
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Upload the monthly or periodic stock dump spreadsheet from Shajgoj (e.g.{' '}
            <code>Shajgoj x Unilever SKU Dashboard.xlsx</code>). The engine extracts <b>Total Stock QTY</b>, parses the cumulative sold column, and builds daily OLA snapshots.
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
          onClick={() => document.getElementById('shajgoj-file-input')?.click()}
        >
          <input
            id="shajgoj-file-input"
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <UploadCloud size={38} color="var(--blue)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {file ? file.name : 'Click to select or drag & drop Shajgoj Excel file'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Supports multi-sheet workbooks with monthly tabs (<code>Stock dump for September, 26</code> etc.)
          </div>
        </div>

        {loadingPreview && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--teal)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <RefreshCw size={16} className="spin" />
            Inspecting workbook sheets and column mappings...
          </div>
        )}

        {previewError && (
          <div style={{ padding: 14, background: 'rgba(255,102,115,0.1)', border: '1px solid var(--red)', borderRadius: 10, color: 'var(--red)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <AlertCircle size={18} />
            <span>{previewError}</span>
          </div>
        )}

        {/* Configuration Dialog: Sheet picker & Date Confirmation */}
        {file && !loadingPreview && (
          <div
            style={{
              background: '#090e1a',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'grid',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="var(--teal)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                Confirm Snapshot Dates &amp; Sheet Selection
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {/* Sheet selector */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Select Sheet
                </label>
                <select
                  value={selectedSheet}
                  onChange={e => handleSheetChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#0c1425',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 12,
                  }}
                >
                  {sheetNames.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Window Start Date */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Sales Window Start
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
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
              </div>

              {/* Window End Date */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Sales Window End
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value)
                    // Auto-compute stock as-of = end + 1
                    if (e.target.value) {
                      const d = new Date(e.target.value)
                      d.setDate(d.getDate() + 1)
                      setAsOfDate(d.toISOString().slice(0, 10))
                    }
                  }}
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
              </div>

              {/* Stock As-Of Date (Day after window ends) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
                  Stock As-Of Date (Window End + 1)
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={e => setAsOfDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#0c1425',
                    border: '1px solid var(--teal)',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {/* Explainer notice */}
            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} color="var(--blue)" style={{ flexShrink: 0 }} />
              <span>
                <b>Stock Dump Rule:</b> Shajgoj reports warehouse/shelf stock at the end of the sales window. Following standard practice, this snapshot is recorded as of <b>{asOfDate || 'the next day'}</b>.
              </span>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => inspectWorkbook(file, selectedSheet)}
                disabled={importing}
              >
                <Eye size={14} /> Re-inspect Sheet
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleRunImport}
                disabled={importing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Importing Dump ({importProgress}%)...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} /> Import &amp; Build OLA Snapshots
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Import Progress Bar */}
        {importing && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Writing snapshots, observations, and OLA calculations...</span>
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
              background: 'linear-gradient(180deg, rgba(68,209,122,0.1), rgba(12,20,37,0.8))',
              border: '1px solid rgba(68,209,122,0.3)',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              <CheckCircle2 size={18} />
              Import Successful: Shajgoj OLA {importResult.olaPercentage}%
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Stock As-Of Date</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{importResult.asOfDate}</div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Core SKUs Matched</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--teal)' }}>{importResult.coreMatched}</div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Available Basepacks</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--green)' }}>
                  {importResult.basepacksAvailable} / {importResult.basepacksScoped}
                </div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Extras Detected</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--amber)' }}>{importResult.extrasCount}</div>
              </div>
              <div style={{ background: '#090e1a', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Duplicates Dropped</span>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                  {importResult.duplicatesDropped?.length || 0}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Upload Audit History */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} color="var(--blue)" />
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>Upload Audit History</h2>
          </div>
          <button type="button" className="ghost-pill-btn" onClick={loadHistory} disabled={loadingHistory}>
            <RefreshCw size={12} className={loadingHistory ? 'spin' : ''} /> Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table className="table" style={{ width: '100%', minWidth: 700 }}>
            <thead>
              <tr>
                <th>Stock As-Of</th>
                <th>File Name</th>
                <th>Sheet Name</th>
                <th style={{ textAlign: 'right' }}>Total Rows</th>
                <th style={{ textAlign: 'right' }}>Core SKUs</th>
                <th style={{ textAlign: 'right' }}>Extras</th>
                <th style={{ textAlign: 'right' }}>OLA %</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    No uploads recorded yet. Upload a Shajgoj stock dump to generate historical data.
                  </td>
                </tr>
              ) : (
                history.map(h => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.reportDate}</b>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.fileName}</td>
                    <td>
                      <span className="count-pill">{h.sheetName}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{h.rowCount}</td>
                    <td style={{ textAlign: 'right', color: 'var(--teal)' }}>{h.coreCount || 227}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{h.extrasCount || 123}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="score-pill high" style={{ padding: '3px 8px', fontSize: 11 }}>
                        {h.olaPercentage ? `${h.olaPercentage}%` : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {new Date(h.uploadedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
