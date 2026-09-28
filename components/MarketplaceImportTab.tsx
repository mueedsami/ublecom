'use client'
import React, { useState } from 'react'
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
  Terminal,
} from 'lucide-react'

interface MarketplaceImportTabProps {
  accountCode: string
  accountName: string
  onImportComplete: () => Promise<void>
}

export default function MarketplaceImportTab({
  accountCode,
  accountName,
  onImportComplete,
}: MarketplaceImportTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [periodLabel, setPeriodLabel] = useState<string>('')
  const [reportDate, setReportDate] = useState<string>('')

  // Preview state
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Ingestion state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<any | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewData(null)
    setImportResult(null)
    setPreviewError(null)
    setImportError(null)

    // Automatically inspect workbook sheets
    await inspectFile(f)
  }

  async function inspectFile(f: File, sheetToInspect?: string) {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('account', accountCode)
      fd.append('preview', 'true')
      if (sheetToInspect) {
        fd.append('sheetName', sheetToInspect)
      }

      const res = await fetch('/api/marketplace/import?preview=true', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to inspect Excel file')
      }

      setSheetNames(data.sheetNames || [])
      setSelectedSheet(data.targetSheetName || '')
      setPeriodLabel(data.periodLabel || '')
      setReportDate(data.reportDate || '')
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
      await inspectFile(file, sheetName)
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
      fd.append('account', accountCode)
      if (selectedSheet) fd.append('sheetName', selectedSheet)
      if (periodLabel) fd.append('periodLabel', periodLabel)
      if (reportDate) fd.append('reportDate', reportDate)

      const timer = setInterval(() => {
        setImportProgress(prev => (prev < 85 ? prev + 15 : prev))
      }, 400)

      const res = await fetch('/api/marketplace/import', {
        method: 'POST',
        body: fd,
      })

      clearInterval(timer)
      setImportProgress(95)

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Import failed')
      }

      setImportProgress(100)
      setImportResult(data)
      await onImportComplete()
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
            Upload {accountName} Stock &amp; Sales Report (.xlsx)
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Upload the monthly or periodic spreadsheet for <b>{accountName}</b>. The intelligent engine automatically maps
            varied header names (e.g. <code>Sold Qty(1-21)</code>, <code>Current Stock</code>, <code>Unit Selling Price</code>)
            and auto-links items to Master Catalog Basepacks.
          </p>
        </div>

        {/* Drag & Drop Zone */}
        <label
          className="dh-upload-zone"
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 12,
            padding: '24px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            cursor: importing ? 'not-allowed' : 'pointer',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={importing}
          />
          <FileSpreadsheet size={36} color="var(--blue)" />
          <div>
            <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>
              {file ? file.name : `Click or drag ${accountName} Excel file here`}
            </strong>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB selected`
                : 'Supports single or multi-sheet monthly reports (e.g. Copy of Unilever Sales & Stock Tracker.xlsx)'}
            </span>
          </div>
        </label>

        {/* Multi-Sheet Picker & Period Overrides */}
        {sheetNames.length > 1 && (
          <div
            style={{
              marginTop: 18,
              padding: '14px 18px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                Select Sheet to Import ({sheetNames.length} sheets in workbook)
              </label>
              <select
                value={selectedSheet}
                onChange={e => handleSheetChange(e.target.value)}
                disabled={importing || loadingPreview}
                style={{ width: '100%', height: 34, fontSize: 12, padding: '4px 8px' }}
              >
                {sheetNames.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                Period Label
              </label>
              <input
                type="text"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="e.g. September 2026"
                disabled={importing}
                style={{ width: '100%', height: 34, fontSize: 12 }}
              />
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                Snapshot As-Of Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                disabled={importing}
                style={{ width: '100%', height: 34, fontSize: 12 }}
              />
            </div>
          </div>
        )}

        {/* Loading Spinner for Preview */}
        {loadingPreview && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            <RefreshCw size={14} className="spin" style={{ display: 'inline', marginRight: 6 }} />
            Analyzing sheet columns and structure...
          </div>
        )}

        {/* Preview Error */}
        {previewError && (
          <div style={{ marginTop: 16, color: '#ff6673', background: 'rgba(255,102,115,0.1)', padding: 12, borderRadius: 8, fontSize: 12 }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
            <b>Analysis Error:</b> {previewError}
          </div>
        )}

        {/* Import Progress Bar */}
        {importing && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--teal)', fontWeight: 700 }}>
                Normalizing, Auto-matching &amp; Flagging...
              </span>
              <span>{importProgress}%</span>
            </div>
            <div className="dh-progress-bar" style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                className="dh-progress-bar-fill"
                style={{ width: `${importProgress}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.3s ease' }}
              />
            </div>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div style={{ marginTop: 16, color: '#ff6673', background: 'rgba(255,102,115,0.1)', padding: 12, borderRadius: 8, fontSize: 12 }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
            <b>Import Failed:</b> {importError}
          </div>
        )}

        {/* Success Banner */}
        {importResult && (
          <div
            style={{
              marginTop: 18,
              background: 'rgba(68,209,122,.1)',
              border: '1px solid rgba(68,209,122,.3)',
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
              <CheckCircle2 size={18} />
              Import &amp; Ingestion Successful!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 12 }}>
              <div>Target Sheet: <b>{importResult.targetSheetName}</b></div>
              <div>Period: <b>{importResult.period_label}</b></div>
              <div>Rows Parsed: <b>{importResult.total_rows_parsed}</b></div>
              <div>Total Catalog Items: <b>{importResult.total_catalog_items}</b></div>
              <div>New Items Added: <b>{importResult.new_items_added}</b></div>
              <div>Auto-matched to Master: <b style={{ color: 'var(--teal)' }}>{importResult.auto_matched_new}</b></div>
              <div>Stock Snapshots Created: <b>{importResult.stock_records_inserted}</b></div>
              <div>Automated Flags Generated: <b style={{ color: '#ffbf4b' }}>{importResult.flags_generated}</b></div>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
          <button
            type="button"
            className="primary"
            disabled={!file || importing || loadingPreview}
            onClick={handleRunImport}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontSize: 13 }}
          >
            <UploadCloud size={16} />
            {importing ? 'Processing Feed...' : `Run ${accountName} Ingest`}
          </button>
        </div>
      </div>

      {/* 2. Detected Columns & Sample Preview Table */}
      {previewData && (
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, margin: '0 0 2px', fontWeight: 800, color: 'var(--teal)' }}>
                Detected Header Mapping &amp; Data Preview
              </h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Sheet: <b>{previewData.targetSheetName}</b> · Total Rows: <b>{previewData.totalRows}</b> · Showing first 10 rows
              </span>
            </div>
            <span className="count-pill">Columns Resolved</span>
          </div>

          {/* Column Resolution Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {Object.entries(previewData.columnMap || {}).map(([key, mappedCol]: [string, any]) => (
              <span
                key={key}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: mappedCol ? 'rgba(0, 212, 180, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: mappedCol ? 'var(--teal)' : 'var(--muted)',
                  border: mappedCol ? '1px solid rgba(0, 212, 180, 0.3)' : '1px solid var(--border)',
                }}
              >
                {key} → <b>{mappedCol || 'not found'}</b>
              </span>
            ))}
          </div>

          {/* Sample Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Current Stock</th>
                  <th>Sold Units</th>
                  <th>Run Rate</th>
                  <th>MRP</th>
                  <th>TP</th>
                  <th>Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {previewData.sampleRows?.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td><code>{r.source_product_id}</code></td>
                    <td>{r.sku || '—'}</td>
                    <td style={{ fontWeight: 600, color: '#fff', maxWidth: 280 }}>{r.name}</td>
                    <td><b style={{ color: r.current_stock === 0 ? '#ff6673' : 'var(--text)' }}>{r.current_stock}</b></td>
                    <td>{r.sold_qty}</td>
                    <td>{r.run_rate ? Number(r.run_rate).toFixed(2) : '—'}</td>
                    <td>৳{r.mrp || '—'}</td>
                    <td>৳{r.tp || '—'}</td>
                    <td>৳{r.stock_value ? Math.round(r.stock_value).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Collector CLI Helper Box */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--teal)' }}>
          <Terminal size={16} />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Python Collector CLI Terminal Command</h4>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--muted)' }}>
          Prefer running batch imports from the local workstation shell? Use the integrated collector CLI:
        </p>
        <div style={{ background: '#091120', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <code style={{ fontSize: 11, color: '#88b6ff' }}>
            collector\.venv\Scripts\python.exe -m ubl_collector.cli {accountCode}-import &quot;Copy of Unilever Sales &amp; Stock Tracker.xlsx&quot;
          </code>
        </div>
      </div>
    </div>
  )
}
