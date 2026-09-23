'use client'

import React, { useState } from 'react'
import Modal from '@/components/Modal'
import { Copy, Check, ExternalLink, ShieldCheck, Lock, Globe, Share2 } from 'lucide-react'

interface EnlistmentShareModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToPartnerView: () => void
}

const PLATFORMS = [
  { id: 'all', name: 'All Partners (General View)' },
  { id: 'Chaldal', name: 'Chaldal Account Team' },
  { id: 'Daraz', name: 'Daraz Brand Team' },
  { id: 'Shwapno', name: 'Shwapno E-Com' },
  { id: 'PandaMart', name: 'Foodpanda / PandaMart' },
  { id: 'MeenaClick', name: 'Meena Click' },
]

export default function EnlistmentShareModal({
  isOpen,
  onClose,
  onSwitchToPartnerView,
}: EnlistmentShareModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const sharePath = '/enlistment'
  const queryParams = new URLSearchParams()
  queryParams.set('view', 'partner')
  if (selectedPlatform !== 'all') {
    queryParams.set('platform', selectedPlatform)
  }

  const fullShareUrl = `${origin}${sharePath}?${queryParams.toString()}`

  function handleCopy() {
    navigator.clipboard.writeText(fullShareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <Modal title="Share Enlistment Portal with External Partners" onClose={onClose}>
      <div className="share-modal-body">
        <div className="share-banner">
          <div className="share-banner-icon">
            <Lock size={20} />
          </div>
          <div>
            <strong>Secured View-Only Access</strong>
            <p>
              People from external retail businesses and e-commerce platforms can view product
              packaging, copy barcodes, extract specs, and download enlistment sheets.
              <strong> They cannot add, modify, or delete any products.</strong>
            </p>
          </div>
        </div>

        <div className="share-field-group">
          <label>Target Partner Platform</label>
          <div className="share-platform-selector">
            {PLATFORMS.map((plat) => (
              <button
                type="button"
                key={plat.id}
                className={`share-platform-btn ${selectedPlatform === plat.id ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(plat.id)}
              >
                {plat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="share-field-group">
          <label>Generated Shareable URL</label>
          <div className="share-url-box">
            <input type="text" readOnly value={fullShareUrl} />
            <button type="button" className="copy-link-btn" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <small className="field-hint">
            Send this URL to the e-commerce account manager or listing team.
          </small>
        </div>

        <div className="share-features-list">
          <div className="share-feat-item">
            <ShieldCheck size={15} className="text-green" />
            <span>Full 20-column specification sheet (Dimensions, MRP, TP, Margin %, BSTI)</span>
          </div>
          <div className="share-feat-item">
            <ShieldCheck size={15} className="text-green" />
            <span>Direct high-resolution packshot image links & 1-click barcode copy</span>
          </div>
          <div className="share-feat-item">
            <ShieldCheck size={15} className="text-green" />
            <span>Export to CSV / Excel formatted for Chaldal & Daraz listing templates</span>
          </div>
          <div className="share-feat-item">
            <Lock size={15} className="text-amber" />
            <span>Editing, adding, deleting, and pricing override disabled for recipients</span>
          </div>
        </div>

        <div className="share-modal-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              onClose()
              onSwitchToPartnerView()
            }}
          >
            <Globe size={14} />
            Preview Partner View Now
          </button>
          <button type="button" className="primary" onClick={handleCopy}>
            {copied ? 'Link Copied to Clipboard!' : 'Copy Share Link'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
