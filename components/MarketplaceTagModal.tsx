'use client'
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { MarketplaceItem, searchBasepacks, tagMarketplaceItem } from '@/lib/marketplaceData'
import { Search, CheckCircle2, XCircle, Ban, Sparkles } from 'lucide-react'

export default function MarketplaceTagModal({
  item,
  accountName,
  onClose,
  onSuccess,
}: {
  item: MarketplaceItem
  accountName?: string
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
        const words = item.name.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)
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
      await tagMarketplaceItem(item.id, status === 'matched' ? selectedId : null, status)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save tag')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Tag ${accountName || 'Marketplace'} Product to Master Basepack`} onClose={onClose} width={580}>
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
              {(accountName || 'MARKETPLACE').toUpperCase()} FEED SKU
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {item.sku && <span className="count-pill">SKU: {item.sku}</span>}
              <span className="count-pill" style={{ background: 'rgba(255,255,255,0.06)' }}>
                ID: {item.source_product_id}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {item.current_stock != null && (
              <div>
                Current Stock: <b style={{ color: 'var(--text)' }}>{item.current_stock} units</b>
              </div>
            )}
            {item.sold_qty != null && (
              <div>
                Period Sales: <b style={{ color: 'var(--text)' }}>{item.sold_qty} units</b>
              </div>
            )}
            {item.tp != null && (
              <div>
                TP: <b style={{ color: 'var(--text)' }}>৳{item.tp}</b>
              </div>
            )}
          </div>
        </div>

        {/* Search input with live suggestion hint */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            Search Master Catalog Basepacks
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by brand, category or basepack title..."
              style={{ width: '100%', paddingLeft: 36, height: 38 }}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, background: 'rgba(255,75,75,0.1)', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Results List */}
        <div
          style={{
            maxHeight: 250,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              Searching Basepacks...
            </div>
          ) : basepacks.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No master basepacks found matching &quot;{search}&quot;.
            </div>
          ) : (
            basepacks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isSelected ? 'rgba(74, 158, 255, 0.15)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--blue)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#fff' : 'var(--text)' }}>
                      {b.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                      <span style={{ color: 'var(--teal)' }}>{b.brand}</span>
                      {b.category && <span>• {b.category}</span>}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color="var(--blue)" />}
                </div>
              )
            })
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {item.match_status === 'matched' && (
              <button
                type="button"
                className="ghost-btn"
                disabled={saving}
                onClick={() => handleSave('unmatched')}
                style={{ fontSize: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <XCircle size={14} />
                Unlink Tag
              </button>
            )}
            <button
              type="button"
              className="ghost-btn"
              disabled={saving}
              onClick={() => handleSave('ignored')}
              style={{
                fontSize: 12,
                padding: '7px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: item.match_status === 'ignored' ? 'var(--red)' : 'var(--muted)',
              }}
            >
              <Ban size={14} />
              {item.match_status === 'ignored' ? 'Ignored' : 'Ignore SKU'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={saving || !selectedId}
              onClick={() => handleSave('matched')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={14} />
              {saving ? 'Linking...' : 'Save & Link'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
