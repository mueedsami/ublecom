'use client'

import React, { useState } from 'react'
import Modal from '@/components/Modal'
import { EnlistmentProduct } from '@/lib/enlistmentData'
import {
  Copy,
  Check,
  ExternalLink,
  Tag,
  Package,
  Calendar,
  Layers,
  ShieldCheck,
  Building,
  Globe,
  Edit2
} from 'lucide-react'

interface EnlistmentDetailModalProps {
  product: EnlistmentProduct | null
  onClose: () => void
  isReadOnly?: boolean
  onEdit?: (product: EnlistmentProduct) => void
}

export default function EnlistmentDetailModal({
  product,
  onClose,
  isReadOnly = false,
  onEdit,
}: EnlistmentDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!product) return null

  function copyToClipboard(text: string, fieldKey: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2000)
  }

  function copyListingBundle() {
    if (!product) return
    const bundleText = [
      `PRODUCT TITLE: ${product.name}`,
      `BARCODE / EAN: ${product.barcode}`,
      `BRAND: ${product.brand}`,
      `DEPARTMENT: ${product.dept}`,
      `CATEGORY: ${product.category} > ${product.subcategory || 'General'}`,
      `MRP: BDT ${product.mrp}`,
      `TRADE PRICE (TP): BDT ${product.tp}`,
      `MARGIN: ${product.margin}%`,
      `PACKAGING DIMENSIONS (L x D x H): ${product.dim_length_cm}cm x ${product.dim_depth_cm}cm x ${product.dim_height_cm}cm`,
      `PCS PER SHIPPER CASE: ${product.pcs_per_crm}`,
      `SHELF LIFE: ${product.shelf_life_days} Days`,
      `CERTIFICATION: ${product.cert_license}`,
      `ORIGIN: ${product.country_of_origin}`,
      `SUPPLIER: ${product.supplier_name}`,
      `IMAGE URL: ${product.image_url}`,
      `FEATURES & CLAIMS:\n${product.description}`,
    ].join('\n')

    copyToClipboard(bundleText, 'bundle')
  }

  const volumeLiters = (
    ((product.dim_length_cm || 0) * (product.dim_depth_cm || 0) * (product.dim_height_cm || 0)) /
    1000
  ).toFixed(2)

  return (
    <Modal title={`Enlistment Dossier: ${product.name}`} onClose={onClose}>
      <div className="detail-modal-body">
        {/* Top Header Strip */}
        <div className="detail-top-strip">
          <div className="detail-status-pill">
            <span
              className={`status-chip ${
                product.enlistment_status === 'enlisted'
                  ? 'status-available'
                  : product.enlistment_status === 'in_review'
                  ? 'status-mixed'
                  : 'status-unavailable'
              }`}
            >
              {product.enlistment_status === 'enlisted'
                ? 'Enlisted & Live'
                : product.enlistment_status === 'in_review'
                ? 'Under Review'
                : 'Open for Enlistment'}
            </span>
            <span className="sl-badge">SL #{product.sl}</span>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="copy-bundle-btn"
              onClick={copyListingBundle}
              title="Copy formatted enlistment data bundle to paste directly into seller center"
            >
              {copiedField === 'bundle' ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === 'bundle' ? 'Copied Full Bundle!' : 'Copy Seller Center Bundle'}
            </button>

            {!isReadOnly && onEdit && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  onClose()
                  onEdit(product)
                }}
              >
                <Edit2 size={13} />
                Edit Specs
              </button>
            )}
          </div>
        </div>

        {/* Hero Section: Packshot + Commercial Card */}
        <div className="detail-hero-grid">
          <div className="packshot-container">
            <img
              src={product.image_url || 'https://placehold.co/400x400/101a2d/75a9ff?text=No+Packshot'}
              alt={product.name}
              className="packshot-large"
              onError={(e) => {
                ;(e.target as any).src =
                  'https://placehold.co/400x400/101a2d/75a9ff?text=Packshot+Preview'
              }}
            />
            {product.image_url && (
              <div className="image-url-strip">
                <button
                  type="button"
                  className="copy-url-btn"
                  onClick={() => copyToClipboard(product.image_url, 'image_url')}
                >
                  {copiedField === 'image_url' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedField === 'image_url' ? 'Image Link Copied' : 'Copy Image Link'}
                </button>
                <a
                  href={product.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="open-url-btn"
                  title="Open high-res image in new tab"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>

          <div className="detail-summary-pane">
            <div className="brand-category-line">
              <span className="brand-highlight">{product.brand}</span>
              <span className="sep">•</span>
              <span>{product.dept}</span>
              <span className="sep">/</span>
              <span>{product.category}</span>
              {product.subcategory && (
                <>
                  <span className="sep">/</span>
                  <span>{product.subcategory}</span>
                </>
              )}
            </div>

            <h3 className="product-headline">{product.name}</h3>

            <div className="barcode-row">
              <span className="barcode-label">Barcode / EAN:</span>
              <code className="barcode-code">{product.barcode}</code>
              <button
                type="button"
                className="copy-mini-btn"
                onClick={() => copyToClipboard(product.barcode, 'barcode')}
                title="Copy Barcode"
              >
                {copiedField === 'barcode' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            {/* Commercial Terms Strip */}
            <div className="commercial-cards-row">
              <div className="comm-card">
                <div className="comm-label">Trade Price (TP)</div>
                <div className="comm-value">৳ {product.tp.toFixed(2)}</div>
              </div>
              <div className="comm-card">
                <div className="comm-label">Max Retail (MRP)</div>
                <div className="comm-value highlight">৳ {product.mrp.toFixed(2)}</div>
              </div>
              <div className="comm-card">
                <div className="comm-label">Platform Margin</div>
                <div className="comm-value margin-pill">{product.margin.toFixed(2)}%</div>
              </div>
            </div>

            {/* Target Platforms */}
            <div className="target-platforms-box">
              <span className="tp-title">Platform Enlistment Scope:</span>
              <div className="platform-badges">
                {product.target_platforms && product.target_platforms.length > 0 ? (
                  product.target_platforms.map((plat) => (
                    <span key={plat} className="platform-badge">
                      {plat}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">All partner platforms</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description & Feature Copy */}
        <div className="detail-section">
          <div className="section-title-sm">
            <Tag size={14} /> Product Description & Shelf Copy
          </div>
          <div className="description-box">
            {product.description || 'No marketing claims or description recorded for this product.'}
          </div>
        </div>

        {/* Detailed Logistics & Physical Specifications */}
        <div className="detail-section">
          <div className="section-title-sm">
            <Package size={14} /> Logistics & Regulatory Specifications
          </div>
          <div className="spec-table-grid">
            <div className="spec-item">
              <span className="spec-name">Length (Left to Right)</span>
              <span className="spec-val">{product.dim_length_cm} cm</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Depth (Front to Back)</span>
              <span className="spec-val">{product.dim_depth_cm} cm</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Height (Top to Bottom)</span>
              <span className="spec-val">{product.dim_height_cm} cm</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Calculated Unit Volume</span>
              <span className="spec-val text-teal">{volumeLiters} Liters</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Shelf Life</span>
              <span className="spec-val">
                {product.shelf_life_days} Days (~{(product.shelf_life_days / 365).toFixed(1)} Yrs)
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Pcs Per Shipper / CRM</span>
              <span className="spec-val">{product.pcs_per_crm} Units</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Regulatory Certification</span>
              <span className="spec-val">{product.cert_license || 'BSTI'}</span>
            </div>
            <div className="spec-item">
              <span className="spec-name">Country of Origin</span>
              <span className="spec-val">{product.country_of_origin}</span>
            </div>
            <div className="spec-item span2">
              <span className="spec-name">Manufacturer / Supplier</span>
              <span className="spec-val">{product.supplier_name}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
