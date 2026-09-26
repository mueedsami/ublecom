'use client'
import React, { useState, useRef, useEffect } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { DhFlagSeverity, DhFlagStatus, DhFlagType } from '@/lib/dhFlags'

export interface FlagsDownloadMenuProps {
  severity: DhFlagSeverity | 'all'
  flagType: DhFlagType | 'all'
  status: DhFlagStatus | 'all'
  store: string | null
  searchQuery: string
  totalCount: number
}

const TYPE_NAMES: Record<string, string> = {
  stockout_risk: 'Stockout Risk',
  distribution_imbalance: 'Distribution Imbalance',
  dc_stuck: 'DC-Stuck Stock',
  dead_stock: 'Dead Stock',
  sales_decline: 'Sales Decline',
  store_health: 'Store Health',
}

export default function FlagsDownloadMenu({
  severity,
  flagType,
  status,
  store,
  searchQuery,
  totalCount,
}: FlagsDownloadMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Build human-friendly scope summary for the menu header
  const scopeSummary = React.useMemo(() => {
    const parts: string[] = []
    if (severity !== 'all') {
      parts.push(`${severity.charAt(0).toUpperCase() + severity.slice(1)}`)
    }
    if (flagType !== 'all') {
      parts.push(TYPE_NAMES[flagType] || flagType)
    }
    if (store) {
      parts.push(store)
    }
    if (status !== 'all' && status !== 'open') {
      parts.push(status.toUpperCase())
    }
    if (searchQuery.trim()) {
      parts.push(`"${searchQuery.trim().slice(0, 15)}"`)
    }
    return parts.length > 0 ? parts.join(' · ') : 'All Active Flags'
  }, [severity, flagType, store, status, searchQuery])

  function buildExportUrl(format: 'xlsx' | 'pdf'): string {
    const params = new URLSearchParams()
    if (severity !== 'all') params.set('severity', severity)
    if (flagType !== 'all') params.set('type', flagType)
    if (status !== 'all') params.set('status', status)
    if (store) params.set('store', store)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    return `/api/dh/flags/export/${format}?${params.toString()}`
  }

  async function handleDownload(format: 'xlsx' | 'pdf') {
    if (exportingFormat) return
    setExportingFormat(format)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const url = buildExportUrl(format)
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to generate ${format.toUpperCase()} export`)
      }

      const blob = await res.blob()

      // Derive filename from Content-Disposition header if available
      let filename = `dh-flags_${severity !== 'all' ? severity : 'all'}_${new Date().toISOString().slice(0, 10)}.${format}`
      const disposition = res.headers.get('content-disposition')
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      // Trigger standard browser download
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      setSuccessMsg(`Exported ${filename}`)
      setTimeout(() => {
        setSuccessMsg(null)
        setIsOpen(false)
      }, 1800)
    } catch (err: any) {
      console.error('Download error:', err)
      setErrorMsg(err.message || 'Export error occurred')
    } finally {
      setExportingFormat(null)
    }
  }

  const isLoading = exportingFormat !== null

  return (
    <div className="dh-download-container" ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Download Main Button */}
      <button
        type="button"
        className="secondary-btn dh-download-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: '6px 12px',
          background: isOpen ? 'rgba(47,125,255,0.22)' : undefined,
          borderColor: isOpen ? 'var(--blue)' : undefined,
          cursor: isLoading ? 'wait' : 'pointer',
        }}
      >
        {isLoading ? (
          <Loader2 size={13} className="spin" color="var(--blue)" />
        ) : (
          <Download size={13} />
        )}
        <span>
          {isLoading
            ? exportingFormat === 'xlsx'
              ? 'Exporting Excel...'
              : 'Generating PDF...'
            : 'Download'}
        </span>
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="dh-download-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 310,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
            padding: 8,
          }}
        >
          {/* Menu Scope Header */}
          <div
            style={{
              padding: '8px 10px 10px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Filtered Scope
              </span>
              <span
                className="count-pill"
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  background: 'rgba(47,125,255,0.15)',
                  color: 'var(--blue)',
                }}
              >
                {totalCount} flag{totalCount === 1 ? '' : 's'}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={scopeSummary}
            >
              {scopeSummary}
            </div>
          </div>

          {/* Option 1: Excel */}
          <button
            type="button"
            className="dh-download-menu-item"
            onClick={() => handleDownload('xlsx')}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 10px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: isLoading ? 'wait' : 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(46, 213, 115, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {exportingFormat === 'xlsx' ? (
                <Loader2 size={16} className="spin text-green" />
              ) : (
                <FileSpreadsheet size={16} color="var(--green)" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  Excel Spreadsheet
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--green)',
                    background: 'rgba(46,213,115,0.12)',
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}
                >
                  .XLSX
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                Clean, flat spreadsheet with unpacked metrics &amp; summary tab
              </div>
            </div>
          </button>

          {/* Option 2: PDF */}
          <button
            type="button"
            className="dh-download-menu-item"
            onClick={() => handleDownload('pdf')}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 10px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: isLoading ? 'wait' : 'pointer',
              textAlign: 'left',
              marginTop: 4,
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(255, 71, 87, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {exportingFormat === 'pdf' ? (
                <Loader2 size={16} className="spin text-red" />
              ) : (
                <FileText size={16} color="var(--red)" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  PDF Cyber Dossier
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--red)',
                    background: 'rgba(255,71,87,0.12)',
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}
                >
                  .PDF
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                Dark command-center styled report with sparkline velocity cards
              </div>
            </div>
          </button>

          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 4,
                background: 'rgba(255, 71, 87, 0.12)',
                border: '1px solid rgba(255, 71, 87, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10.5,
                color: 'var(--red)',
              }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Notification */}
          {successMsg && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 4,
                background: 'rgba(46, 213, 115, 0.12)',
                border: '1px solid rgba(46, 213, 115, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10.5,
                color: 'var(--green)',
              }}
            >
              <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
