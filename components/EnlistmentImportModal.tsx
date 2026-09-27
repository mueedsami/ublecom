'use client'

import React, { useState, useRef, useMemo, useEffect } from 'react'
import Modal from '@/components/Modal'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  Check,
  X,
  RefreshCw,
} from 'lucide-react'
import { STANDARD_PLATFORMS, EnlistmentStatus } from '@/lib/enlistmentData'

interface EnlistmentImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  availableAccounts?: string[]
}

interface PreviewRow {
  rowNum: number
  isExisting: boolean
  existingId: string | null
  barcode: string
  name: string
  brand: string
  category: string
  dept: string
  tp: number
  mrp: number
  margin: number
  target_platforms: string[]
  enlisted_platforms: string[]
  enlistment_status: EnlistmentStatus
}

export default function EnlistmentImportModal({
  isOpen,
  onClose,
  onSuccess,
  availableAccounts = [],
}: EnlistmentImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePlatformList = useMemo(() => {
    return availableAccounts.length > 0 ? availableAccounts : Array.from(STANDARD_PLATFORMS)
  }, [availableAccounts])

  // Default target platforms for the batch
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(activePlatformList)

  useEffect(() => {
    if (activePlatformList.length > 0) {
      setDefaultPlatforms(activePlatformList)
    }
  }, [activePlatformList])

  // Preview data
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set())
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; barcode: string; name: string; reason: string }>>([])
  const [stats, setStats] = useState({
    totalFound: 0,
    validCount: 0,
    newCount: 0,
    updateCount: 0,
    errorCount: 0,
  })

  // Commit result
  const [commitResult, setCommitResult] = useState<{
    inserted: number
    updated: number
    errors: Array<{ row: number; barcode: string; reason: string }>
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function resetState() {
    setStep('upload')
    setSelectedFile(null)
    setLoading(false)
    setError(null)
    setPreviewRows([])
    setSelectedRowIndices(new Set())
    setValidationErrors([])
    setCommitResult(null)
    setDefaultPlatforms(activePlatformList)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function toggleDefaultPlatform(plat: string) {
    setDefaultPlatforms((prev) =>
      prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
    )
  }

  // Handle file drop & selection
  function handleFileSelected(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Please select an Excel (.xlsx, .xls) or CSV file.')
      return
    }
    setError(null)
    setSelectedFile(file)
  }

  // Step 1: Send file to API in 'preview' mode
  async function handleAnalyzeFile() {
    if (!selectedFile) {
      setError('Please choose a file to analyze')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mode', 'preview')
      formData.append('default_target_platforms', JSON.stringify(defaultPlatforms))

      const res = await fetch('/api/enlistment/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse file.')
      }

      setStats({
        totalFound: data.totalFound || 0,
        validCount: data.validCount || 0,
        newCount: data.newCount || 0,
        updateCount: data.updateCount || 0,
        errorCount: data.errorCount || 0,
      })

      const rows: PreviewRow[] = data.previewRows || []
      setPreviewRows(rows)
      setValidationErrors(data.errors || [])

      // By default select all valid rows
      setSelectedRowIndices(new Set(rows.map((_, i) => i)))
      setStep('preview')
    } catch (err: any) {
      console.error('File parsing failed:', err)
      setError(err?.message || 'Failed to parse and validate spreadsheet.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Toggle select individual preview row
  function toggleRowSelected(idx: number) {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  function toggleSelectAllRows() {
    if (selectedRowIndices.size === previewRows.length) {
      setSelectedRowIndices(new Set())
    } else {
      setSelectedRowIndices(new Set(previewRows.map((_, i) => i)))
    }
  }

  // Step 2 -> Step 3: Commit selected rows to database
  async function handleCommitImport() {
    if (selectedRowIndices.size === 0) {
      setError('Please select at least one product row to import.')
      return
    }

    if (!selectedFile) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mode', 'commit')
      formData.append('default_target_platforms', JSON.stringify(defaultPlatforms))

      const res = await fetch('/api/enlistment/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to commit import to database.')
      }

      setCommitResult({
        inserted: data.inserted || 0,
        updated: data.updated || 0,
        errors: data.commitErrors || [],
      })

      setStep('complete')
      await onSuccess()
    } catch (err: any) {
      console.error('Import commit error:', err)
      setError(err?.message || 'Database error during bulk commit.')
    } finally {
      setLoading(false)
    }
  }

  // Download sample CSV template
  function downloadTemplate() {
    const headers = [
      'SL',
      'Barcode',
      'Product Dimensions Length (Left to Right) in cm',
      'Product Dimensions Depth (Front to Back) in cm',
      'Product Dimensions Height (Top to Bottom) in cm',
      'Shelf Life Time (Day)',
      'Name',
      'Image link',
      'Product Description (Features)',
      'Dept',
      'Category',
      'SubCategory',
      'Pcs Per CRM',
      'TP',
      'MRP',
      'Margin',
      'Cert/Licns',
      'Brand',
      'Supplier Name',
      'Country of Origin',
      'Status',
      'Target Platforms',
      'Enlisted Platforms',
    ]

    const sampleRow = [
      '1',
      '8941100511999',
      '5.5',
      '4.2',
      '12.0',
      '1095',
      '"Vaseline Gluta-Hya Dewy Radiance Serum Lotion 200ml"',
      '"https://images.unsplash.com/photo-1620916566398-39f1143ab7be"',
      '"10X more powerful than Vitamin C for glowing dewy skin"',
      '"Beauty & Wellbeing"',
      '"Skin Care"',
      '"Body Lotion"',
      '36',
      '320.00',
      '380.00',
      '15.79%',
      '"BSTI"',
      '"VASELINE"',
      '"UNILEVER BANGLADESH LIMITED"',
      '"Bangladesh"',
      'open',
      '"Chaldal, Daraz, Shwapno, PandaMart"',
      '""',
    ]

    const csvText = [headers.join(','), sampleRow.join(',')].join('\n')
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'UBL_Product_Enlistment_Template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Modal
      title={
        step === 'upload'
          ? 'Bulk Upload Enlistment Products'
          : step === 'preview'
          ? 'Review & Verify Pipeline Batch'
          : 'Bulk Import Complete'
      }
      onClose={handleClose}
    >
      <div className="enlist-import-modal-content">
        {/* Step 1: Upload & Initial Options */}
        {step === 'upload' && (
          <div className="import-step-container">
            <div className="import-intro-strip">
              <div>
                <h4>Upload Master Spreadsheet (Excel / CSV)</h4>
                <p>
                  Bulk ingest new product specifications or update existing barcodes in the
                  enlistment pipeline. Existing barcodes will be updated in-place without losing
                  history.
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn template-btn"
                onClick={downloadTemplate}
                title="Download CSV spreadsheet template with standard columns"
              >
                <Download size={14} /> Download Sample Template
              </button>
            </div>

            {/* Drag & Drop File Box */}
            <div
              className={`dropzone-box ${isDragging ? 'dragging' : ''} ${
                selectedFile ? 'has-file' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelected(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0])
                  }
                }}
              />

              {selectedFile ? (
                <div className="dropzone-file-info">
                  <FileSpreadsheet size={36} className="text-teal" />
                  <div className="file-details">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to replace
                    </span>
                  </div>
                  <span className="badge-ok">Ready to Parse</span>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <Upload size={36} className="text-muted" />
                  <div className="prompt-text">
                    <strong>Click to browse</strong> or drag & drop your Excel (.xlsx, .xls) or CSV
                    sheet here
                  </div>
                  <div className="prompt-sub">
                    Supports 20-column enlistment specification sheets
                  </div>
                </div>
              )}
            </div>

            {/* Target Platforms Preset */}
            <div className="import-config-section">
              <label className="section-label">
                Default Target Platforms for This Batch
              </label>
              <span className="section-desc">
                Products without specific platform columns will automatically target the selected
                retail accounts:
              </span>
              <div className="platform-checkbox-strip">
                {activePlatformList.map((plat) => {
                  const active = defaultPlatforms.includes(plat)
                  return (
                    <button
                      type="button"
                      key={plat}
                      className={`platform-toggle-chip ${active ? 'selected' : ''}`}
                      onClick={() => toggleDefaultPlatform(plat)}
                    >
                      {active && <Check size={12} />}
                      {plat}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="import-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-actions-bar">
              <button type="button" className="secondary-btn" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedFile || loading}
                onClick={handleAnalyzeFile}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" /> Analyzing Spreadsheet...
                  </>
                ) : (
                  <>
                    Parse & Review Products <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Preview & Validation */}
        {step === 'preview' && (
          <div className="import-step-container">
            {/* Stats Summary Strip */}
            <div className="preview-summary-grid">
              <div className="stat-card">
                <div className="stat-label">Total Found</div>
                <div className="stat-num">{stats.totalFound}</div>
              </div>
              <div className="stat-card new">
                <div className="stat-label">New to Pipeline</div>
                <div className="stat-num text-teal">+{stats.newCount}</div>
              </div>
              <div className="stat-card update">
                <div className="stat-label">Updates in Place</div>
                <div className="stat-num text-blue">{stats.updateCount}</div>
              </div>
              <div className="stat-card error">
                <div className="stat-label">Skipped / Errors</div>
                <div className="stat-num text-red">{stats.errorCount}</div>
              </div>
            </div>

            {/* Validation errors callout if any */}
            {validationErrors.length > 0 && (
              <div className="validation-warning-box">
                <div className="vw-header">
                  <AlertTriangle size={15} className="text-warning" />
                  <strong>
                    {validationErrors.length} invalid row(s) will be skipped:
                  </strong>
                </div>
                <ul className="vw-list">
                  {validationErrors.slice(0, 4).map((err, i) => (
                    <li key={i}>
                      Row #{err.row}: {err.reason} ({err.name || err.barcode || 'Empty'})
                    </li>
                  ))}
                  {validationErrors.length > 4 && (
                    <li>...and {validationErrors.length - 4} more invalid rows.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Interactive Preview Table */}
            <div className="preview-table-container">
              <div className="preview-table-header">
                <div>
                  <span>
                    Selected <strong>{selectedRowIndices.size}</strong> of{' '}
                    <strong>{previewRows.length}</strong> valid products to commit
                  </span>
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={toggleSelectAllRows}
                >
                  {selectedRowIndices.size === previewRows.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              <div className="table-wrap preview-table-wrap">
                <table className="table preview-sheet-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            previewRows.length > 0 &&
                            selectedRowIndices.size === previewRows.length
                          }
                          onChange={toggleSelectAllRows}
                        />
                      </th>
                      <th style={{ width: 85 }}>Action</th>
                      <th style={{ width: 140 }}>Barcode</th>
                      <th style={{ minWidth: 220 }}>Product Name</th>
                      <th style={{ width: 110 }}>Brand</th>
                      <th style={{ width: 110 }}>Category</th>
                      <th style={{ width: 85, textAlign: 'right' }}>TP (৳)</th>
                      <th style={{ width: 85, textAlign: 'right' }}>MRP (৳)</th>
                      <th style={{ width: 75, textAlign: 'center' }}>Margin</th>
                      <th style={{ minWidth: 150 }}>Target Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => {
                      const isSelected = selectedRowIndices.has(idx)
                      return (
                        <tr
                          key={r.barcode + idx}
                          className={isSelected ? '' : 'row-deselected'}
                          onClick={() => toggleRowSelected(idx)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td
                            style={{ textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRowSelected(idx)}
                            />
                          </td>
                          <td>
                            {r.isExisting ? (
                              <span className="badge-update" title="Barcode already in database; will update specs">
                                Update
                              </span>
                            ) : (
                              <span className="badge-new" title="New SKU; will be added to pipeline">
                                + New
                              </span>
                            )}
                          </td>
                          <td>
                            <code className="font-mono text-teal">{r.barcode}</code>
                          </td>
                          <td>
                            <strong>{r.name}</strong>
                          </td>
                          <td>{r.brand}</td>
                          <td>{r.category}</td>
                          <td style={{ textAlign: 'right' }}>৳{r.tp.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>৳{r.mrp.toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="margin-pill-sm">{r.margin.toFixed(1)}%</span>
                          </td>
                          <td>
                            <div className="preview-targets-strip">
                              {(r.target_platforms || defaultPlatforms).map((plat) => (
                                <span key={plat} className="mini-tag">
                                  {plat}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div className="import-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-actions-bar">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setStep('upload')}
                disabled={loading}
              >
                <RotateCcw size={14} /> Back to File
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={selectedRowIndices.size === 0 || loading}
                onClick={handleCommitImport}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" /> Saving to Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Confirm & Ingest{' '}
                    {selectedRowIndices.size} Products
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete / Summary */}
        {step === 'complete' && commitResult && (
          <div className="import-step-container complete-view">
            <div className="success-badge-circle">
              <CheckCircle2 size={48} className="text-teal" />
            </div>

            <h3>Pipeline Enlistment Sheet Ingested!</h3>
            <p className="success-desc">
              Your product catalog updates and new SKUs have been safely written to the database.
            </p>

            <div className="commit-stats-grid">
              <div className="commit-stat">
                <div className="cs-num text-teal">+{commitResult.inserted}</div>
                <div className="cs-label">New Products Inserted</div>
              </div>
              <div className="commit-stat">
                <div className="cs-num text-blue">{commitResult.updated}</div>
                <div className="cs-label">Existing Products Updated</div>
              </div>
            </div>

            {commitResult.errors && commitResult.errors.length > 0 && (
              <div className="commit-errors-notice">
                <AlertTriangle size={15} className="text-warning" />
                <span>
                  {commitResult.errors.length} products encountered errors during save.
                </span>
              </div>
            )}

            <div className="modal-actions-bar center">
              <button type="button" className="btn-primary" onClick={handleClose}>
                Done & View Pipeline
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
