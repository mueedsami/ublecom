'use client'
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { DhItem, searchBasepacks, tagDhItem } from '@/lib/dhData'
import { Search, CheckCircle2, XCircle, Ban, Sparkles } from 'lucide-react'

export default function DhTagModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DhItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [search, setSearch] = useState('')
  const [basepacks, setBasepacks] = useState<Array<{ id: string; name: string; brand: string | null; category: string | null }>>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(item.basepack_id || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed initial search with words from item name to offer instant smart recommendations
  useEffect(() => {
    async function loadInitial() {
      setLoading(true)
      try {
        // Extract key words from item name
        const words = item.dh_name.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)
        const initialQuery = words[0] || ''
        setSearch(initialQuery)
        const res = await searchBasepacks(initialQuery)
        setBasepacks(res)
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [item])

  async function handleSearch(term: string) {
    setSearch(term)
    setLoading(true)
    try {
      const res = await searchBasepacks(term)
      setBasepacks(res)
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(status: 'matched' | 'unmatched' | 'ignored') {
    if (status === 'matched' && !selectedId) {
      setError('Please select a basepack from the list.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await tagDhItem(item.id, status === 'matched' ? selectedId : null, status)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save tag')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Tag DH Product to Basepack" onClose={onClose} width={580}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Item context banner */}
        <div
          style={{
            background: '#0c1425',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--teal)', letterSpacing: '.05em' }}>
              PANDAMART DH FEED SKU
            </span>
            <span className="count-pill">SKU: {item.dh_sku}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{item.dh_name}</div>
          {item.sold_qty_30d != null && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              30-Day Sales Volume: <b style={{ color: 'var(--text)' }}>{item.sold_qty_30d.toLocaleString()} units</b>
              {item.gfv_30d ? ` (৳${Number(item.gfv_30d).toLocaleString()} GFV)` : ''}
            </div>
          )}
        </div>

        {error && <div className="field-error" style={{ padding: '8px 12px', background: 'rgba(255,102,115,.1)', borderRadius: 8 }}>{error}</div>}

        {/* Basepack Search */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 6 }}>
            Search Master Basepack:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              placeholder="Search by basepack name, brand, format..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#0e1628',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px 10px 36px',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          </div>
        </div>

        {/* Basepack Candidates List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>
            <span>Available Master Basepacks ({basepacks.length})</span>
            {loading && <span>Searching...</span>}
          </div>
          <div
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: '#0c1425',
              display: 'grid',
              gap: 2,
              padding: 4,
            }}
          >
            {basepacks.length === 0 && !loading && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No basepack matches found for &quot;{search}&quot;. Try typing a different keyword or brand.
              </div>
            )}
            {basepacks.map((bp) => {
              const isSelected = selectedId === bp.id
              return (
                <div
                  key={bp.id}
                  onClick={() => setSelectedId(bp.id)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(47,125,255,.18)' : 'transparent',
                    border: isSelected ? '1px solid var(--blue)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#fff' : '#d2deef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bp.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      Brand: <span style={{ color: 'var(--teal)' }}>{bp.brand || 'Unilever'}</span>
                      {bp.category ? ` • ${bp.category}` : ''}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color="var(--blue)" style={{ flexShrink: 0 }} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Modal actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 11, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => handleSave('ignored')}
              disabled={saving}
              title="Mark item as ignored (non-UBL or promo bundle)"
            >
              <Ban size={13} />
              Ignore Item
            </button>
            {item.match_status === 'matched' && (
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: 11, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--amber)' }}
                onClick={() => handleSave('unmatched')}
                disabled={saving}
              >
                <XCircle size={13} />
                Unlink
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => handleSave('matched')}
              disabled={saving || !selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={14} />
              {saving ? 'Saving...' : 'Link to Basepack'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
