'use client'

import React, { useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import {
  EnlistmentAccount,
  EnlistmentProduct,
  createEnlistmentAccount,
  toggleAccountActive,
  deleteEnlistmentAccount,
} from '@/lib/enlistmentData'
import {
  Store,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Zap,
  Globe,
  Check,
  Power,
  RefreshCw,
  Info,
} from 'lucide-react'

interface EnlistmentAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: EnlistmentAccount[]
  onAccountsChange: (accounts: EnlistmentAccount[]) => void
  products?: EnlistmentProduct[]
}

export default function EnlistmentAccountsModal({
  isOpen,
  onClose,
  accounts,
  onAccountsChange,
  products = [],
}: EnlistmentAccountsModalProps) {
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'retailer' | 'marketplace' | 'quick_commerce'>('retailer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Account usage stats across products
  const usageStats = useMemo(() => {
    const targetedMap: Record<string, number> = {}
    const liveMap: Record<string, number> = {}

    for (const p of products) {
      for (const t of p.target_platforms || []) {
        const key = t.toLowerCase()
        targetedMap[key] = (targetedMap[key] || 0) + 1
      }
      for (const l of p.enlisted_platforms || []) {
        const key = l.toLowerCase()
        liveMap[key] = (liveMap[key] || 0) + 1
      }
    }

    return { targetedMap, liveMap }
  }, [products])

  if (!isOpen) return null

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return

    // Check duplicate
    const exists = accounts.some(
      (a) => a.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (exists) {
      setError(`An account named "${trimmed}" already exists.`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await createEnlistmentAccount({
        name: trimmed,
        account_type: newType,
      })

      onAccountsChange([...accounts, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      showSuccess(`Account "${trimmed}" added successfully!`)
    } catch (err: any) {
      setError(err?.message || 'Failed to add account')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleActive(account: EnlistmentAccount) {
    setActionBusyId(account.id)
    setError(null)

    const nextState = !account.active
    try {
      const updated = await toggleAccountActive(account.id, nextState)
      onAccountsChange(
        accounts.map((a) => (a.id === account.id ? { ...a, active: updated.active } : a))
      )
      showSuccess(
        `Account "${account.name}" marked as ${nextState ? 'Active' : 'Inactive'}.`
      )
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle account status')
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleDeleteAccount(account: EnlistmentAccount) {
    const targetedCount = usageStats.targetedMap[account.name.toLowerCase()] || 0

    const confirmPrompt = targetedCount > 0
      ? `Are you sure you want to remove account "${account.name}"?\nNote: ${targetedCount} product(s) currently target this account.`
      : `Are you sure you want to remove account "${account.name}"?`

    if (!confirm(confirmPrompt)) return

    setActionBusyId(account.id)
    setError(null)

    try {
      await deleteEnlistmentAccount(account.id)
      onAccountsChange(accounts.filter((a) => a.id !== account.id))
      showSuccess(`Account "${account.name}" removed successfully.`)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete account')
    } finally {
      setActionBusyId(null)
    }
  }

  const activeCount = accounts.filter((a) => a.active).length
  const inactiveCount = accounts.length - activeCount

  return (
    <Modal title="Manage Enlistment Accounts & Retailers" onClose={onClose} width={720}>
      <div className="accounts-modal-body">
        {/* Header Intro */}
        <div className="accounts-intro">
          <p>
            Configure the vendors, e-commerce platforms, and retail accounts tracked in the Enlistment
            Hub. Active accounts appear in product targets, live shelf tracking, and filter bars.
          </p>
          <div className="accounts-stats-chips">
            <span className="acc-chip active-chip">
              <CheckCircle2 size={13} /> {activeCount} Active
            </span>
            {inactiveCount > 0 && (
              <span className="acc-chip inactive-chip">
                <Power size={13} /> {inactiveCount} Inactive
              </span>
            )}
            <span className="acc-chip total-chip">
              <Store size={13} /> {accounts.length} Total Registered
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="accounts-alert error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button type="button" className="close-alert-btn" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="accounts-alert success">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add Account Card */}
        <form onSubmit={handleAddAccount} className="add-account-card">
          <div className="add-acc-header">
            <Plus size={16} className="text-accent" />
            <strong>Add New Account / Retailer</strong>
          </div>
          <div className="add-acc-fields">
            <div className="acc-input-wrap">
              <label>Account Name</label>
              <input
                type="text"
                placeholder="e.g. Shajgoj, Pickaboo, Khaas Food, Daily Shopping"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="acc-select-wrap">
              <label>Account Channel</label>
              <select
                value={newType}
                onChange={(e: any) => setNewType(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="retailer">Retailer / Superstore</option>
                <option value="quick_commerce">Quick Commerce (Instant)</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </div>
            <button
              type="submit"
              className="btn-primary add-acc-btn"
              disabled={isSubmitting || !newName.trim()}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Add Account
                </>
              )}
            </button>
          </div>
        </form>

        {/* Accounts List */}
        <div className="accounts-list-container">
          <div className="accounts-list-header">
            <span>Configured Accounts ({accounts.length})</span>
            <span className="hint-text">
              <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
              Toggle Active to pause an account without losing existing product data.
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-accounts-state">
              <Store size={32} className="text-muted" />
              <p>No accounts configured yet. Add your first retail account above.</p>
            </div>
          ) : (
            <div className="accounts-table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Account / Vendor</th>
                    <th>Channel Type</th>
                    <th style={{ textAlign: 'center' }}>Targeted Products</th>
                    <th style={{ textAlign: 'center' }}>Live on Shelf</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => {
                    const isBusy = actionBusyId === acc.id
                    const targetedCount = usageStats.targetedMap[acc.name.toLowerCase()] || 0
                    const liveCount = usageStats.liveMap[acc.name.toLowerCase()] || 0

                    return (
                      <tr key={acc.id} className={!acc.active ? 'acc-row-inactive' : ''}>
                        <td>
                          <div className="acc-name-cell">
                            <div className="acc-icon-wrap">
                              {acc.account_type === 'quick_commerce' ? (
                                <Zap size={14} className="text-amber" />
                              ) : acc.account_type === 'marketplace' ? (
                                <ShoppingBag size={14} className="text-purple" />
                              ) : (
                                <Store size={14} className="text-blue" />
                              )}
                            </div>
                            <div>
                              <strong className="acc-title">{acc.name}</strong>
                              <span className="acc-code font-mono">code: {acc.code}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`acc-type-badge type-${acc.account_type || 'retailer'}`}
                          >
                            {acc.account_type === 'quick_commerce'
                              ? 'Quick Commerce'
                              : acc.account_type === 'marketplace'
                              ? 'Marketplace'
                              : 'Retailer'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-count">{targetedCount}</span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge-count ${liveCount > 0 ? 'text-green' : 'text-muted'}`}>
                            {liveCount}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`acc-status-pill ${acc.active ? 'active' : 'inactive'}`}
                            onClick={() => handleToggleActive(acc)}
                            disabled={isBusy}
                            title={acc.active ? 'Click to deactivate' : 'Click to activate'}
                          >
                            {isBusy ? (
                              'Updating...'
                            ) : acc.active ? (
                              <>
                                <CheckCircle2 size={12} /> Active
                              </>
                            ) : (
                              <>
                                <Power size={12} /> Inactive
                              </>
                            )}
                          </button>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-danger-ghost"
                            onClick={() => handleDeleteAccount(acc)}
                            disabled={isBusy}
                            title="Remove account"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-actions-bar" style={{ marginTop: 20 }}>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        .accounts-modal-body {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .accounts-intro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .accounts-stats-chips {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .acc-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }
        .active-chip {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        .inactive-chip {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .total-chip {
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .accounts-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }
        .accounts-alert.error {
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .accounts-alert.success {
          background: rgba(34, 197, 94, 0.12);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .close-alert-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
        }

        .add-account-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .add-acc-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--foreground);
        }
        .add-acc-fields {
          display: grid;
          grid-template-columns: 1fr 180px auto;
          gap: 12px;
          align-items: flex-end;
        }
        .acc-input-wrap,
        .acc-select-wrap {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .acc-input-wrap label,
        .acc-select-wrap label {
          font-size: 11px;
          font-weight: 500;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .add-acc-fields input,
        .add-acc-fields select {
          padding: 8px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--foreground);
          font-size: 13px;
          height: 38px;
        }
        .add-acc-btn {
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          padding: 0 16px;
        }

        .accounts-list-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .accounts-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }
        .hint-text {
          font-size: 11px;
          font-weight: 400;
          color: var(--muted);
        }

        .accounts-table-wrap {
          max-height: 320px;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .accounts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .accounts-table th {
          background: var(--surface);
          color: var(--muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .accounts-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          vertical-align: middle;
        }
        .accounts-table tr:last-child td {
          border-bottom: none;
        }
        .acc-row-inactive td {
          opacity: 0.6;
        }

        .acc-name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .acc-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .acc-title {
          display: block;
          color: var(--foreground);
        }
        .acc-code {
          display: block;
          font-size: 11px;
          color: var(--muted);
        }

        .acc-type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .type-retailer {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }
        .type-quick_commerce {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }
        .type-marketplace {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }

        .badge-count {
          font-weight: 600;
          font-size: 13px;
        }

        .acc-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
        }
        .acc-status-pill.active {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.3);
        }
        .acc-status-pill.active:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .acc-status-pill.inactive {
          background: rgba(100, 116, 139, 0.15);
          color: #94a3b8;
          border-color: rgba(100, 116, 139, 0.3);
        }
        .acc-status-pill.inactive:hover {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.3);
        }

        .btn-danger-ghost {
          background: transparent;
          border: none;
          color: var(--muted);
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .btn-danger-ghost:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .empty-accounts-state {
          padding: 32px;
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: 8px;
          color: var(--muted);
          font-size: 13px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Modal>
  )
}
