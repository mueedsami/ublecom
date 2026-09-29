'use client'

import React, { useEffect, useRef } from 'react'
import { EnlistmentProduct } from '@/lib/enlistmentData'
import {
  CheckCircle2,
  AlertTriangle,
  Check,
  X,
  Radio,
  ArrowRight,
  Package,
  Barcode,
  Loader2,
} from 'lucide-react'

export interface PlatformConfirmTarget {
  product: EnlistmentProduct
  platform: string
  isCurrentlyLive: boolean
}

interface EnlistmentLiveConfirmModalProps {
  target: PlatformConfirmTarget | null
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function EnlistmentLiveConfirmModal({
  target,
  isBusy = false,
  onConfirm,
  onCancel,
}: EnlistmentLiveConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Focus confirm button when modal opens
  useEffect(() => {
    if (target) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [target])

  // Handle ESC and Enter keys
  useEffect(() => {
    if (!target) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter' && !isBusy) {
        // Prevent default form submits if any
        e.preventDefault()
        onConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [target, isBusy, onCancel, onConfirm])

  if (!target) return null

  const { product, platform, isCurrentlyLive } = target

  return (
    <div
      className="confirm-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onCancel()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className={`confirm-modal-card ${isCurrentlyLive ? 'revert-mode' : 'live-mode'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="confirm-modal-head">
          <div className="confirm-modal-title-group">
            <div className={`confirm-icon-badge ${isCurrentlyLive ? 'badge-amber' : 'badge-emerald'}`}>
              {isCurrentlyLive ? (
                <AlertTriangle size={20} className="text-amber" />
              ) : (
                <CheckCircle2 size={20} className="text-green" />
              )}
            </div>
            <div>
              <div className="confirm-eyebrow">
                {isCurrentlyLive ? 'Digital Shelf Status Update' : 'Digital Shelf Verification'}
              </div>
              <h3 id="confirm-modal-title" className="confirm-modal-title">
                {isCurrentlyLive ? 'Revert Platform Live Status' : 'Confirm Product Live Enlistment'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Close confirmation dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="confirm-modal-body">
          {/* Main Question */}
          <p className="confirm-question">
            {isCurrentlyLive ? (
              <>
                Are you sure you want to revert <strong>{product.name}</strong> from <strong>Live</strong> back to{' '}
                <span className="text-amber font-semibold">Pending</span> on <strong>{platform}</strong>?
              </>
            ) : (
              <>
                Are you sure you want to mark <strong>{product.name}</strong> as{' '}
                <span className="text-green font-semibold">Live on Shelf</span> for <strong>{platform}</strong>?
              </>
            )}
          </p>

          {/* Product Summary Card */}
          <div className="confirm-product-card">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="confirm-product-thumb"
                onError={(e) => {
                  ;(e.target as any).style.display = 'none'
                }}
              />
            )}
            <div className="confirm-product-info">
              <div className="confirm-product-name-row">
                <Package size={15} className="text-teal" />
                <span className="confirm-product-name">{product.name}</span>
              </div>
              <div className="confirm-meta-row">
                <span className="confirm-pill brand">{product.brand || 'Unilever'}</span>
                <span className="confirm-pill barcode">
                  <Barcode size={12} /> {product.barcode || '—'}
                </span>
                <span className="confirm-pill price">
                  MRP ৳{product.mrp != null ? Number(product.mrp).toFixed(2) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Transition Visualizer */}
          <div className="confirm-status-flow">
            <div className="status-node">
              <span className="status-label">Current Status</span>
              <span className={`status-val ${isCurrentlyLive ? 'is-live' : 'is-pending'}`}>
                {isCurrentlyLive ? '✓ Confirmed Live' : '○ Pending Enlistment'}
              </span>
            </div>

            <div className="status-flow-arrow">
              <ArrowRight size={16} />
            </div>

            <div className="status-node">
              <span className="status-label">New Status on {platform}</span>
              <span className={`status-val highlighted ${!isCurrentlyLive ? 'is-live' : 'is-pending'}`}>
                {!isCurrentlyLive ? '✓ Confirmed Live' : '○ Pending Enlistment'}
              </span>
            </div>
          </div>

          <div className="confirm-help-note">
            <Radio size={13} className="confirm-pulse-dot" />
            <span>
              {isCurrentlyLive
                ? `This will remove the live flag for ${platform}. Partner sync and analytics will register this SKU as pending.`
                : `This confirms that ${platform} has verified and published this SKU live for consumer orders on their digital shelf.`}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="confirm-modal-footer">
          <button
            type="button"
            className="ghost-btn confirm-cancel-btn"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>

          {isCurrentlyLive ? (
            <button
              ref={confirmBtnRef}
              type="button"
              className="confirm-action-btn btn-revert"
              onClick={onConfirm}
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Yes, Set to Pending</span>
                </>
              )}
            </button>
          ) : (
            <button
              ref={confirmBtnRef}
              type="button"
              className="confirm-action-btn btn-confirm-live"
              onClick={onConfirm}
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  <span>Marking Live...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Yes, Mark Live</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
