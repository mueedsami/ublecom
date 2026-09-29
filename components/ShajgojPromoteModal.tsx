'use client'
import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { ShajgojExtraItem } from '@/lib/shajgojOlaData'
import { supabase } from '@/lib/supabase'
import { Search, CheckCircle2, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'

interface BasepackOption {
  id: string
  name: string
  brand: string | null
  category: string | null
  business_unit: string | null
}

export default function ShajgojPromoteModal({
  item,
  onClose,
  onSuccess,
}: {
  item: ShajgojExtraItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [search, setSearch] = useState('')
  const [basepacks, setBasepacks] = useState<BasepackOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed search with words from SKU name
  useEffect(() => {
    async function loadInitial() {
      setLoading(true)
      try {
        const words = item.name.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)
        const initialQuery = words[0] || ''
        setSearch(initialQuery)
        await searchBasepacks(initialQuery)
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [item])

  async function searchBasepacks(term: string) {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('basepacks').select('id, name, brand, category, business_unit').eq('active', true).limit(20)
      if (term.trim()) {
        query = query.ilike('name', `%${term.trim()}%`)
      }
      const { data, error } = await query
      if (error) throw error
      setBasepacks(data || [])
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePromote() {
    if (!selectedId) {
      setError('Please select a master basepack to link this SKU to.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/shajgoj/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, basepackId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to promote SKU to Core')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Promotion failed')
    } finally {
      setSaving(false)
    }
  }

  const selectedBasepack = basepacks.find(b => b.id === selectedId)

  return (
    <Modal title="Promote Extra SKU to Core Master" onClose={onClose} width={620}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Item context banner */}
        <div
          style={{
            background: '#0c1425',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber)', letterSpacing: '.05em' }}>
              EXTRA TIER SKU (CURRENTLY EXCLUDED FROM OLA)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="count-pill">SKU: {item.sku}</span>
              <span className="count-pill" style={{ background: 'rgba(255,255,255,0.06)' }}>
                Stock: {item.currentStock}
              </span>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 14 }}>
            <span>Sold this period: <b>{item.soldQty}</b></span>
            {item.tp && <span>TP: <b>৳{item.tp}</b></span>}
            {item.mrp && <span>MRP: <b>৳{item.mrp}</b></span>}
          </div>
        </div>

        {/* Promotion Explainer */}
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(47,125,255,0.08)', borderRadius: 10, border: '1px solid rgba(47,125,255,0.2)' }}>
          <ShieldCheck size={18} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#c7d8f5', lineHeight: 1.45 }}>
            Promoting this SKU maps it to a master Basepack and adds it to Shajgoj Core Scope.
            Starting from your next upload, its stock will automatically count towards <b>Shajgoj OLA %</b>.
          </div>
        </div>

        {/* Search Input */}
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.05em' }}>
            Select Master Basepack to Map To
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search master catalog by basepack name, brand..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                searchBasepacks(e.target.value)
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: '#0c1425',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Results list */}
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: '#090e1a',
            padding: 4,
            display: 'grid',
            gap: 2,
          }}
        >
          {loading && (
            <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
              Searching master catalog...
            </div>
          )}
          {!loading && basepacks.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
              No master basepacks matched &quot;{search}&quot;. Try another search keyword.
            </div>
          )}
          {!loading &&
            basepacks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(47,125,255,0.18)' : 'transparent',
                    border: isSelected ? '1px solid var(--blue)' : '1px solid transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'white' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                      {b.brand && <span>Brand: <b style={{ color: 'var(--teal)' }}>{b.brand}</b></span>}
                      {b.category && <span>Category: {b.category}</span>}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color="var(--blue)" style={{ flexShrink: 0 }} />}
                </div>
              )
            })}
        </div>

        {/* Selected Confirmation */}
        {selectedBasepack && (
          <div style={{ padding: '8px 12px', background: 'rgba(68,209,122,0.1)', borderRadius: 8, border: '1px solid rgba(68,209,122,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} color="var(--green)" />
            <span style={{ fontSize: 12, color: '#97f1bb' }}>
              Target: <b>{selectedBasepack.name}</b>
            </span>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, padding: '6px 0' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handlePromote}
            disabled={saving || !selectedId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? 'Promoting...' : 'Promote to Core Master'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
