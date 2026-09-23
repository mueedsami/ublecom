'use client'
import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import Modal from '@/components/Modal'
import BasepackProductsModal from '@/components/BasepackProductsModal'
import { demoMode } from '@/lib/supabase'
import {
  Basepack, BasepackInput, BasepackUsage,
  listBasepacks, createBasepack, updateBasepack, setBasepackActive, getBasepackUsage,
} from '@/lib/masterData'

const emptyForm: BasepackInput = { name: '', business_unit: '', category: '', format: '', brand: '' }

export default function Page() {
  const [rows, setRows] = useState<Basepack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [editing, setEditing] = useState<Basepack | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BasepackInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()

  const [managingProducts, setManagingProducts] = useState<Basepack | null>(null)

  const [confirming, setConfirming] = useState<Basepack | null>(null)
  const [usage, setUsage] = useState<BasepackUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      setRows(await listBasepacks())
      setError(undefined)
    } catch (e: any) {
      setError(e.message || 'Failed to load basepacks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter === 'active' && !r.active) return false
      if (statusFilter === 'inactive' && r.active) return false
      if (!needle) return true
      return [r.name, r.brand, r.category, r.format, r.business_unit]
        .filter(Boolean).some((v) => (v as string).toLowerCase().includes(needle))
    })
  }, [rows, q, statusFilter])

  function openAdd() {
    setEditing(null); setForm(emptyForm); setFormError(undefined); setShowForm(true)
  }
  function openEdit(bp: Basepack) {
    setEditing(bp)
    setForm({ name: bp.name, business_unit: bp.business_unit || '', category: bp.category || '', format: bp.format || '', brand: bp.brand || '' })
    setFormError(undefined); setShowForm(true)
  }

  async function submitForm() {
    if (!form.name.trim()) { setFormError('Basepack name is required'); return }
    setSaving(true); setFormError(undefined)
    try {
      if (editing) await updateBasepack(editing.id, form)
      else await createBasepack(form)
      setShowForm(false)
      await reload()
    } catch (e: any) {
      setFormError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function openConfirm(bp: Basepack) {
    setConfirming(bp); setUsage(null); setUsageLoading(true)
    try { setUsage(await getBasepackUsage(bp.id)) } finally { setUsageLoading(false) }
  }

  async function confirmToggle() {
    if (!confirming) return
    setToggling(true)
    try {
      await setBasepackActive(confirming.id, !confirming.active)
      setConfirming(null)
      await reload()
    } catch (e: any) {
      setError(e.message || 'Update failed')
    } finally {
      setToggling(false)
    }
  }

  if (demoMode) {
    return <>
      <Header eyebrow="Master Data" title="Basepacks" subtitle="Add, edit and activate/deactivate basepacks without touching the collector config." />
      <div className="card empty">Connect Supabase (set the env vars) to manage basepacks — this page needs write access, so it's disabled in demo mode.</div>
    </>
  }

  return (
    <>
      <Header eyebrow="Master Data" title="Basepacks" subtitle="Add, edit and activate/deactivate basepacks without touching the collector config." />

      <div className="master-toolbar">
        <input type="search" placeholder="Search by basepack, brand, category…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="count-pill">{filtered.length} of {rows.length}</span>
        <button className="primary" onClick={openAdd}>+ Add basepack</button>
      </div>

      <div className="card">
        {loading || error ? <Loading error={error} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Basepack</th><th>Business unit</th><th>Category</th><th>Format</th><th>Brand</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.business_unit || '—'}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.format || '—'}</td>
                    <td>{r.brand || '—'}</td>
                    <td><span className={'status ' + (r.active ? 'ok' : 'bad')}><i className="dot" />{r.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => openEdit(r)}>Edit</button>
                        <button onClick={() => setManagingProducts(r)}>Products</button>
                        <button onClick={() => openConfirm(r)}>{r.active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={7} className="empty">No basepacks match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit basepack' : 'Add basepack'} onClose={() => setShowForm(false)}>
          <div className="form-grid">
            <div className="form-field">
              <label>Basepack name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DOVE SHAMPOO INTENSIVE REPAIR 340ML" />
            </div>
            <div className="form-field">
              <label>Business unit</label>
              <input value={form.business_unit || ''} onChange={(e) => setForm({ ...form, business_unit: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Category</label>
              <input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Format</label>
              <input value={form.format || ''} onChange={(e) => setForm({ ...form, format: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Brand</label>
              <input value={form.brand || ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
          </div>
          {formError && <div className="field-error">{formError}</div>}
          <div className="form-actions">
            <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="primary" disabled={saving} onClick={submitForm}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add basepack'}</button>
          </div>
        </Modal>
      )}

      {managingProducts && (
        <BasepackProductsModal basepack={managingProducts} onClose={() => setManagingProducts(null)} />
      )}

      {confirming && (
        <Modal title={(confirming.active ? 'Deactivate ' : 'Activate ') + confirming.name} onClose={() => setConfirming(null)}>
          {confirming.active ? (
            <>
              <p className="subtitle" style={{ margin: '0 0 4px' }}>This basepack is currently used in:</p>
              {usageLoading ? <div className="empty">Checking usage…</div> : (
                <div className="usage-list">
                  <div className="usage-row"><span>Active account/SKU mappings</span><b>{usage?.active_mappings ?? 0}</b></div>
                  <div className="usage-row"><span>OLA scopes</span><b>{usage?.ola_scopes ?? 0}</b></div>
                  <div className="usage-row"><span>CPP scopes</span><b>{usage?.cpp_scopes ?? 0}</b></div>
                  <div className="usage-row"><span>Historical OLA snapshots</span><b>{usage?.historical_snapshots ?? 0}</b></div>
                  <div className="usage-row"><span>Historical observations</span><b>{usage?.historical_observations ?? 0}</b></div>
                </div>
              )}
              <p className="subtitle" style={{ margin: '0 0 4px' }}>
                Deactivating stops future scraping for this basepack and hides it from Master Data pickers.
                History is preserved — nothing is deleted.
              </p>
            </>
          ) : (
            <p className="subtitle">Reactivating makes this basepack available again in Master Data and eligible for scraping wherever it's still scoped.</p>
          )}
          <div className="form-actions">
            <button className="ghost-btn" onClick={() => setConfirming(null)}>Cancel</button>
            <button className={confirming.active ? 'danger-btn' : 'primary'} disabled={toggling} onClick={confirmToggle}>
              {toggling ? 'Working…' : confirming.active ? 'Confirm deactivate' : 'Confirm activate'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
