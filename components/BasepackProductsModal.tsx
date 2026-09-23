'use client'
import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import {
  Account, AccountProduct, AccountProductInput, Basepack, Location,
  listAccountProducts, listAccounts, listLocationsForAccount,
  addAccountProduct, updateAccountProduct, setAccountProductActive, setAccountProductScrapeEnabled,
} from '@/lib/masterData'

const emptyForm: AccountProductInput = { account_id: '', location_id: '', account_sku: '', product_name: '', product_url: '', slug: '' }

export default function BasepackProductsModal({ basepack, onClose }: { basepack: Basepack; onClose: () => void }) {
  const [rows, setRows] = useState<AccountProduct[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AccountProductInput>(emptyForm)
  const [branches, setBranches] = useState<Location[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AccountProductInput>(emptyForm)

  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const [mappings, accts] = await Promise.all([listAccountProducts(basepack.id), listAccounts()])
      setRows(mappings); setAccounts(accts); setError(undefined)
    } catch (e: any) {
      setError(e.message || 'Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [basepack.id])

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === form.account_id), [accounts, form.account_id])
  const isPandamart = selectedAccount?.code === 'pandamart'

  useEffect(() => {
    if (isPandamart && form.account_id) {
      listLocationsForAccount(form.account_id).then(setBranches).catch(() => setBranches([]))
    } else {
      setBranches([]); setForm((f) => ({ ...f, location_id: '' }))
    }
  }, [form.account_id, isPandamart])

  const coverage = useMemo(() => {
    const active = new Set(rows.filter((r) => r.active).map((r) => r.account?.code))
    return accounts.map((a) => ({ ...a, covered: active.has(a.code) }))
  }, [rows, accounts])

  async function submitAdd() {
    if (!form.account_id) { setFormError('Pick an account'); return }
    if (isPandamart && !form.location_id) { setFormError('Pick a Pandamart branch'); return }
    if (!form.account_sku.trim()) { setFormError('SKU / product code is required'); return }
    setSaving(true); setFormError(undefined)
    try {
      await addAccountProduct(basepack.id, form)
      setForm(emptyForm); setShowAdd(false)
      await reload()
    } catch (e: any) {
      setFormError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(r: AccountProduct) {
    setEditingId(r.id)
    setEditForm({ account_id: r.account_id, location_id: r.location_id || '', account_sku: r.account_sku, product_name: r.product_name || '', product_url: r.product_url || '', slug: r.slug || '' })
  }

  async function submitEdit(id: string) {
    setBusyId(id)
    try {
      await updateAccountProduct(id, editForm)
      setEditingId(null)
      await reload()
    } catch (e: any) {
      setError(e.message || 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(r: AccountProduct) {
    setBusyId(r.id)
    try { await setAccountProductActive(r.id, !r.active); await reload() }
    catch (e: any) { setError(e.message || 'Update failed') }
    finally { setBusyId(null) }
  }

  async function toggleScrape(r: AccountProduct) {
    setBusyId(r.id)
    try { await setAccountProductScrapeEnabled(r.id, !r.scrape_enabled); await reload() }
    catch (e: any) { setError(e.message || 'Update failed') }
    finally { setBusyId(null) }
  }

  return (
    <Modal title={'Mapped products — ' + basepack.name} onClose={onClose} width={860}>
      {loading ? <div className="empty">Loading…</div> : (
        <>
          <p className="subtitle" style={{ margin: '0 0 8px' }}>Account coverage</p>
          <div className="coverage-chips">
            {coverage.map((a) => <span key={a.id} className={'coverage-chip ' + (a.covered ? 'on' : 'off')}>{a.covered ? '✓' : '—'} {a.name}</span>)}
            {!coverage.length && <span className="subtitle">No accounts configured yet.</span>}
          </div>

          {error && <div className="field-error" style={{ marginBottom: 10 }}>{error}</div>}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Account</th><th>Branch</th><th>SKU</th><th>URL</th><th>Scrape</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => editingId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={7}>
                      <div className="add-mapping-form" style={{ marginTop: 0 }}>
                        <div className="form-field"><label>SKU / product code</label><input value={editForm.account_sku} onChange={(e) => setEditForm({ ...editForm, account_sku: e.target.value })} /></div>
                        <div className="form-field"><label>Product name</label><input value={editForm.product_name || ''} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })} /></div>
                        <div className="form-field span2"><label>Product URL</label><input value={editForm.product_url || ''} onChange={(e) => setEditForm({ ...editForm, product_url: e.target.value })} /></div>
                        <div className="form-field span2"><label>Slug (optional)</label><input value={editForm.slug || ''} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} /></div>
                        <div className="form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}>
                          <button className="ghost-btn" onClick={() => setEditingId(null)}>Cancel</button>
                          <button className="primary" disabled={busyId === r.id} onClick={() => submitEdit(r.id)}>{busyId === r.id ? 'Saving…' : 'Save'}</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{r.account?.name || '—'}</td>
                    <td>{r.location?.name || '—'}</td>
                    <td>{r.account_sku}</td>
                    <td>{r.product_url ? <a className="mapping-url" href={r.product_url} target="_blank" rel="noreferrer">{r.product_url}</a> : '—'}</td>
                    <td><button className={'toggle-pill ' + (r.scrape_enabled ? 'on' : 'off')} disabled={busyId === r.id} onClick={() => toggleScrape(r)}>{r.scrape_enabled ? 'ON' : 'OFF'}</button></td>
                    <td><span className={'status ' + (r.active ? 'ok' : 'bad')}><i className="dot" />{r.active ? 'Active' : 'Removed'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => startEdit(r)}>Edit</button>
                        <button disabled={busyId === r.id} onClick={() => toggleActive(r)}>{r.active ? 'Remove' : 'Restore'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="empty">No accounts mapped to this basepack yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {!showAdd ? (
            <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
              <button className="primary" onClick={() => { setShowAdd(true); setForm(emptyForm); setFormError(undefined) }}>+ Add account mapping</button>
            </div>
          ) : (
            <div className="add-mapping-form">
              <div className="form-field">
                <label>Account</label>
                <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {isPandamart && (
                <div className="form-field">
                  <label>Branch</label>
                  <select value={form.location_id || ''} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                    <option value="">Select branch…</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-field"><label>SKU / product code</label><input value={form.account_sku} onChange={(e) => setForm({ ...form, account_sku: e.target.value })} /></div>
              <div className="form-field"><label>Product name</label><input value={form.product_name || ''} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
              <div className="form-field span2"><label>Product URL</label><input value={form.product_url || ''} onChange={(e) => setForm({ ...form, product_url: e.target.value })} placeholder="https://…" /></div>
              <div className="form-field span2"><label>Slug (optional)</label><input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              {formError && <div className="field-error" style={{ gridColumn: '1/-1' }}>{formError}</div>}
              <div className="form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}>
                <button className="ghost-btn" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="primary" disabled={saving} onClick={submitAdd}>{saving ? 'Adding…' : 'Add mapping'}</button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
