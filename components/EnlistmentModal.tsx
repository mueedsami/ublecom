'use client'

import React, { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { EnlistmentProduct, EnlistmentInput, calculateMargin } from '@/lib/enlistmentData'
import { Sparkles, Image as ImageIcon, Calculator, Check, AlertCircle } from 'lucide-react'

interface EnlistmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (productData: EnlistmentInput, id?: string) => Promise<void>
  initialData?: EnlistmentProduct | null
  nextSl?: number
}

const PLATFORMS_LIST = ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart', 'MeenaClick', 'Pickaboo']

export default function EnlistmentModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  nextSl = 1,
}: EnlistmentModalProps) {
  const [form, setForm] = useState<EnlistmentInput>({
    sl: nextSl,
    barcode: '',
    dim_length_cm: 5.0,
    dim_depth_cm: 4.0,
    dim_height_cm: 10.0,
    shelf_life_days: 1095,
    name: '',
    image_url: '',
    description: '',
    dept: 'Beauty & Wellbeing',
    category: 'Skin Care',
    subcategory: '',
    pcs_per_crm: 50,
    tp: 0,
    mrp: 0,
    margin: 0,
    cert_license: 'BSTI',
    brand: '',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'open',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno'],
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'pricing' | 'content'>('info')

  useEffect(() => {
    if (initialData) {
      setForm({
        sl: initialData.sl,
        barcode: initialData.barcode || '',
        dim_length_cm: initialData.dim_length_cm || 0,
        dim_depth_cm: initialData.dim_depth_cm || 0,
        dim_height_cm: initialData.dim_height_cm || 0,
        shelf_life_days: initialData.shelf_life_days || 1095,
        name: initialData.name || '',
        image_url: initialData.image_url || '',
        description: initialData.description || '',
        dept: initialData.dept || 'Personal Care',
        category: initialData.category || 'Skin Care',
        subcategory: initialData.subcategory || '',
        pcs_per_crm: initialData.pcs_per_crm || 50,
        tp: initialData.tp || 0,
        mrp: initialData.mrp || 0,
        margin: initialData.margin || 0,
        cert_license: initialData.cert_license || 'BSTI',
        brand: initialData.brand || '',
        supplier_name: initialData.supplier_name || 'UNILEVER BANGLADESH LIMITED',
        country_of_origin: initialData.country_of_origin || 'Bangladesh',
        enlistment_status: initialData.enlistment_status || 'open',
        target_platforms: initialData.target_platforms || ['Chaldal', 'Daraz'],
        notes: initialData.notes || '',
      })
    } else {
      setForm({
        sl: nextSl,
        barcode: '',
        dim_length_cm: 5.0,
        dim_depth_cm: 4.0,
        dim_height_cm: 10.0,
        shelf_life_days: 1095,
        name: '',
        image_url: '',
        description: '',
        dept: 'Personal Care',
        category: 'Skin Care',
        subcategory: '',
        pcs_per_crm: 50,
        tp: 0,
        mrp: 0,
        margin: 0,
        cert_license: 'BSTI',
        brand: '',
        supplier_name: 'UNILEVER BANGLADESH LIMITED',
        country_of_origin: 'Bangladesh',
        enlistment_status: 'open',
        target_platforms: ['Chaldal', 'Daraz', 'Shwapno'],
        notes: '',
      })
    }
    setError(null)
  }, [initialData, nextSl, isOpen])

  function handlePriceChange(field: 'tp' | 'mrp', val: number) {
    const nextTp = field === 'tp' ? val : form.tp
    const nextMrp = field === 'mrp' ? val : form.mrp
    const calcMargin = calculateMargin(nextTp, nextMrp)
    setForm((prev) => ({
      ...prev,
      [field]: val,
      margin: calcMargin,
    }))
  }

  function togglePlatform(p: string) {
    setForm((prev) => {
      const exists = prev.target_platforms.includes(p)
      return {
        ...prev,
        target_platforms: exists
          ? prev.target_platforms.filter((item) => item !== p)
          : [...prev.target_platforms, p],
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Product Name is required')
      setActiveTab('info')
      return
    }
    if (!form.barcode.trim()) {
      setError('Barcode / EAN is required')
      setActiveTab('info')
      return
    }
    if (!form.brand.trim()) {
      setError('Brand is required')
      setActiveTab('info')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(form, initialData?.id)
      onClose()
    } catch (err: any) {
      console.error('Error saving product enlistment:', err)
      setError(err?.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      title={initialData ? `Edit Enlistment: ${initialData.name}` : 'Add Product to Enlistment Pipeline'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="enlistment-form">
        {error && (
          <div className="form-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="enlist-tab-strip">
          <button
            type="button"
            className={activeTab === 'info' ? 'active' : ''}
            onClick={() => setActiveTab('info')}
          >
            1. Core Info
          </button>
          <button
            type="button"
            className={activeTab === 'specs' ? 'active' : ''}
            onClick={() => setActiveTab('specs')}
          >
            2. Specs & Dimensions
          </button>
          <button
            type="button"
            className={activeTab === 'pricing' ? 'active' : ''}
            onClick={() => setActiveTab('pricing')}
          >
            3. Pricing & Margins
          </button>
          <button
            type="button"
            className={activeTab === 'content' ? 'active' : ''}
            onClick={() => setActiveTab('content')}
          >
            4. Assets & Copy
          </button>
        </div>

        {/* Tab 1: Core Info */}
        {activeTab === 'info' && (
          <div className="form-grid-section">
            <div className="form-row">
              <div className="form-field span2">
                <label>Product Name (Full Commercial Title) *</label>
                <input
                  type="text"
                  placeholder="e.g. Ponds Bright Miracle Serum Night 30g"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row three-col">
              <div className="form-field">
                <label>Barcode / EAN-13 *</label>
                <input
                  type="text"
                  placeholder="8941100511261"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. PONDS, Dove, Sunsilk"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>SL Sequence #</label>
                <input
                  type="number"
                  value={form.sl}
                  onChange={(e) => setForm({ ...form, sl: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="form-row three-col">
              <div className="form-field">
                <label>Department</label>
                <select
                  value={form.dept}
                  onChange={(e) => setForm({ ...form, dept: e.target.value })}
                >
                  <option value="Personal Care">Personal Care</option>
                  <option value="Beauty & Wellbeing">Beauty & Wellbeing</option>
                  <option value="Home Care">Home Care</option>
                  <option value="Nutrition">Nutrition</option>
                </select>
              </div>

              <div className="form-field">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="e.g. Skin Care, Hair Care"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>SubCategory</label>
                <input
                  type="text"
                  placeholder="e.g. Serum, Face Wash, Shampoo"
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row two-col">
              <div className="form-field">
                <label>Supplier Name</label>
                <input
                  type="text"
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Country of Origin</label>
                <input
                  type="text"
                  value={form.country_of_origin}
                  onChange={(e) => setForm({ ...form, country_of_origin: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Specs & Dimensions */}
        {activeTab === 'specs' && (
          <div className="form-grid-section">
            <div className="section-instruction">
              Enter product packaging dimensions for warehouse cubing & partner shelf logistics.
            </div>

            <div className="form-row three-col">
              <div className="form-field">
                <label>Length (Left-Right) in cm</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.dim_length_cm}
                  onChange={(e) => setForm({ ...form, dim_length_cm: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-field">
                <label>Depth (Front-Back) in cm</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.dim_depth_cm}
                  onChange={(e) => setForm({ ...form, dim_depth_cm: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-field">
                <label>Height (Top-Bottom) in cm</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.dim_height_cm}
                  onChange={(e) => setForm({ ...form, dim_height_cm: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-row three-col">
              <div className="form-field">
                <label>Shelf Life (Days)</label>
                <input
                  type="number"
                  value={form.shelf_life_days}
                  onChange={(e) => setForm({ ...form, shelf_life_days: parseInt(e.target.value) || 0 })}
                />
                <small className="field-hint">e.g. 1095 days = 3 years</small>
              </div>

              <div className="form-field">
                <label>Pcs Per CRM / Shipper Case</label>
                <input
                  type="number"
                  value={form.pcs_per_crm}
                  onChange={(e) => setForm({ ...form, pcs_per_crm: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="form-field">
                <label>Cert / License</label>
                <input
                  type="text"
                  placeholder="e.g. BSTI, Halal"
                  value={form.cert_license}
                  onChange={(e) => setForm({ ...form, cert_license: e.target.value })}
                />
              </div>
            </div>

            <div className="dimensions-preview-box">
              <div className="dim-cube-icon">📦</div>
              <div>
                <strong>Packaging Volume Summary:</strong>
                <div>
                  {form.dim_length_cm} cm (L) × {form.dim_depth_cm} cm (D) × {form.dim_height_cm} cm (H)
                  {' = '}
                  <span className="text-teal">
                    {((form.dim_length_cm * form.dim_depth_cm * form.dim_height_cm) / 1000).toFixed(2)} Liters / CBM Unit
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Pricing & Margins */}
        {activeTab === 'pricing' && (
          <div className="form-grid-section">
            <div className="pricing-grid-card">
              <div className="form-row three-col">
                <div className="form-field">
                  <label>Trade Price (TP) in ৳</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="50.83"
                    value={form.tp || ''}
                    onChange={(e) => handlePriceChange('tp', parseFloat(e.target.value) || 0)}
                  />
                  <small className="field-hint">Unilever invoice price to platform</small>
                </div>

                <div className="form-field">
                  <label>Maximum Retail Price (MRP) in ৳</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="55.00"
                    value={form.mrp || ''}
                    onChange={(e) => handlePriceChange('mrp', parseFloat(e.target.value) || 0)}
                  />
                  <small className="field-hint">Printed pack price</small>
                </div>

                <div className="form-field">
                  <label>Platform Margin (%)</label>
                  <div className="margin-result-box">
                    <span className="margin-value">{form.margin.toFixed(2)}%</span>
                    <small className="margin-auto-tag">Auto-Calculated</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-row two-col" style={{ marginTop: 14 }}>
              <div className="form-field">
                <label>Enlistment Status</label>
                <select
                  value={form.enlistment_status}
                  onChange={(e) => setForm({ ...form, enlistment_status: e.target.value as any })}
                >
                  <option value="open">Open for Enlistment (Pipeline)</option>
                  <option value="in_review">Under Review / Verification</option>
                  <option value="enlisted">Enlisted & Live</option>
                  <option value="paused">Paused / Delisted</option>
                </select>
              </div>

              <div className="form-field">
                <label>Target E-Commerce Platforms</label>
                <div className="platform-checkbox-strip">
                  {PLATFORMS_LIST.map((plat) => {
                    const checked = form.target_platforms.includes(plat)
                    return (
                      <button
                        type="button"
                        key={plat}
                        className={`platform-toggle-chip ${checked ? 'selected' : ''}`}
                        onClick={() => togglePlatform(plat)}
                      >
                        {checked && <Check size={12} />}
                        {plat}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Assets & Copy */}
        {activeTab === 'content' && (
          <div className="form-grid-section">
            <div className="form-field">
              <label>High-Res Packshot Image Link (URL)</label>
              <input
                type="url"
                placeholder="https://.../product.jpg"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              <small className="field-hint">Direct link used by e-commerce platforms to fetch catalog imagery</small>
            </div>

            {form.image_url ? (
              <div className="image-live-preview">
                <img
                  src={form.image_url}
                  alt="Packshot preview"
                  onError={(e) => {
                    ;(e.target as any).src = 'https://placehold.co/400x400/101a2d/75a9ff?text=Invalid+Image+URL'
                  }}
                />
                <div>
                  <div className="preview-label">Live Packshot Preview</div>
                  <div className="preview-sub">{form.name || 'Product pack preview'}</div>
                </div>
              </div>
            ) : null}

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Product Description & Key Features</label>
              <textarea
                rows={4}
                placeholder="Key claims, active ingredients, usage instructions and customer benefits..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Internal Account Manager Notes</label>
              <input
                type="text"
                placeholder="e.g. Priority launch for Ramadan campaign, Daraz Super Brand Day exclusive..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving...' : initialData ? 'Update Product' : 'Add to Pipeline'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
