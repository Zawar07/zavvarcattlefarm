'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

interface BankLogEntry {
  id: string;
  previous_amount: string;
  new_amount: string;
  changed_at: string;
  changed_by_name: string;
}

export default function Settings() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [showBankHistory, setShowBankHistory] = useState(false);
  const [restoreEntry, setRestoreEntry] = useState<BankLogEntry | null>(null);
  const [settlePartnerId, setSettlePartnerId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [contributionPartnerId, setContributionPartnerId] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [editContribution, setEditContribution] = useState<{ id: string; amount: string; note: string } | null>(null);
  const [deleteContributionId, setDeleteContributionId] = useState<string | null>(null);
  const [showContributionHistory, setShowContributionHistory] = useState(false);

  const isAdmin = user?.role === 'super_admin';
  const isOwner = user?.phone_number === '03485157554';

  useEffect(() => {
    if (user && !isOwner) router.replace('/');
  }, [user, isOwner, router]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isAdmin,
  });

  const { data: shares } = useQuery({
    queryKey: ['partner-shares'],
    queryFn: () => api.get('/partners/shares').then(r => r.data),
    enabled: isAdmin,
  });

  const { data: balance } = useQuery({
    queryKey: ['bank-balance'],
    queryFn: () => api.get('/bank/balance').then(r => r.data),
    enabled: isAdmin,
  });

  const { data: bankLog } = useQuery({
    queryKey: ['bank-log'],
    queryFn: () => api.get('/bank/log').then(r => r.data),
    enabled: isAdmin && showBankHistory,
  });

  const { data: contributions } = useQuery({
    queryKey: ['partner-contributions'],
    queryFn: () => api.get('/partners/contributions').then(r => r.data),
    enabled: isAdmin,
  });

  // Add to balance (PATCH = adjust by amount)
  const bankAddMutation = useMutation({
    mutationFn: (amount: number) => api.patch('/bank/balance', { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      queryClient.invalidateQueries({ queryKey: ['bank-log'] });
      setShowBankForm(false);
      setBankAmount('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to add balance.');
    },
  });

  // Restore balance (POST = set exact amount)
  const bankRestoreMutation = useMutation({
    mutationFn: (amount: number) => api.post('/bank/balance', { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      queryClient.invalidateQueries({ queryKey: ['bank-log'] });
      setRestoreEntry(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to restore balance.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to update user.');
    },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/users/${id}/reset-password`, { new_password: password }),
    onSuccess: () => { setResetUserId(null); setNewPassword(''); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to reset password.');
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/partners/${id}/settle`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-shares'] });
      setSettlePartnerId(null);
      setSettleAmount('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to settle.');
    },
  });

  const addContributionMutation = useMutation({
    mutationFn: () => api.post('/partners/contributions', {
      partner_id: contributionPartnerId,
      amount: parseFloat(contributionAmount),
      note: contributionNote || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-contributions'] });
      setShowAddContribution(false);
      setContributionPartnerId('');
      setContributionAmount('');
      setContributionNote('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to record contribution.');
    },
  });

  const editContributionMutation = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      api.patch(`/partners/contributions/${id}`, { amount, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-contributions'] });
      setEditContribution(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to update contribution.');
    },
  });

  const deleteContributionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partners/contributions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-contributions'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to delete contribution.');
    },
  });

  if (!isOwner) return null;

  const currentBalance = parseFloat(balance?.amount || '0');
  const contributionTotals = contributions?.totals as { id: string; name: string; total_contributed: string }[] | undefined;
  const contributionSummary = contributions?.summary as {
    total_injected: number;
    total_contributed: number;
    unallocated: number;
    needs_backfill: boolean;
  } | undefined;
  const contributionEntries = contributions?.contributions as {
    id: string;
    partner_id: string;
    partner_name: string;
    amount: string;
    note: string | null;
    contributed_at: string;
    recorded_by_name: string;
  }[] | undefined;

  const openAddContribution = (partnerId?: string, suggestedAmount?: number) => {
    setContributionPartnerId(partnerId || '');
    setContributionAmount(suggestedAmount ? String(Math.round(suggestedAmount)) : '');
    setContributionNote('');
    setShowAddContribution(true);
  };

  return (
    <Layout title="Settings" showViewToggle={false}>
      <div className="p-4 space-y-5">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* ── Bank Balance ──────────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">💳 Bank Balance</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowBankHistory(v => !v); setShowBankForm(false); }}
                className="text-xs font-semibold text-ink-secondary hover:text-ink min-h-[36px] px-2"
              >
                {showBankHistory ? 'Hide History' : 'History'}
              </button>
              <button
                onClick={() => {
                  setBankAmount(String(Math.round(currentBalance)));
                  setShowBankForm(v => !v);
                  setShowBankHistory(false);
                }}
                className="text-xs font-semibold text-primary-800 hover:text-primary-950 min-h-[36px] px-2"
              >
                {showBankForm ? 'Cancel' : 'Update'}
              </button>
            </div>
          </div>

          <p className={`text-2xl font-bold ${currentBalance < 0 ? 'text-status-loss' : 'text-primary-950'}`}>
            {currentBalance < 0 ? '− ' : ''}PKR {Math.abs(Math.round(currentBalance)).toLocaleString('en-IN')}
          </p>

          {/* Update form — adds to balance */}
          {showBankForm && (
            <div className="space-y-2 border-t border-surface-border pt-3">
              <label className="label">Amount to Add (PKR)</label>
              {bankAmount && !isNaN(parseFloat(bankAmount)) && (
                <p className="text-xs text-ink-muted">
                  {Math.round(currentBalance).toLocaleString('en-IN')} + {parseFloat(bankAmount).toLocaleString('en-IN')} ={' '}
                  <span className={`font-bold ${currentBalance + parseFloat(bankAmount) < 0 ? 'text-status-loss' : 'text-status-profit'}`}>
                    PKR {Math.round(currentBalance + parseFloat(bankAmount)).toLocaleString('en-IN')}
                  </span>
                </p>
              )}
              <input
                type="number"
                value={bankAmount}
                onChange={e => setBankAmount(e.target.value)}
                placeholder="Enter amount (use negative to subtract)"
                className="input-field"
                inputMode="numeric"
                autoFocus
              />
              <button
                onClick={() => {
                  const amt = parseFloat(bankAmount);
                  if (!isNaN(amt)) bankAddMutation.mutate(amt);
                }}
                className="btn-primary"
                disabled={bankAddMutation.isPending || !bankAmount || isNaN(parseFloat(bankAmount))}
              >
                {bankAddMutation.isPending ? <LoadingSpinner size="sm" /> : 'Add to Balance'}
              </button>
            </div>
          )}

          {/* Balance history with restore */}
          {showBankHistory && (
            <div className="border-t border-surface-border pt-3 space-y-2">
              <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">
                Balance History — tap to restore
              </p>
              {!bankLog ? (
                <LoadingSpinner />
              ) : bankLog.length === 0 ? (
                <p className="text-sm text-ink-muted">No history yet.</p>
              ) : (
                <div className="space-y-2">
                  {bankLog.map((entry: BankLogEntry) => (
                    <button
                      key={entry.id}
                      onClick={() => setRestoreEntry(entry)}
                      className="w-full text-left rounded-lg border border-surface-border bg-surface-muted hover:bg-surface-subtle hover:border-ink-muted transition-colors p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-ink-muted mb-0.5">
                            Before → After
                          </p>
                          <p className="text-sm font-semibold text-ink">
                            PKR {Math.round(parseFloat(entry.previous_amount)).toLocaleString('en-IN')}
                            {' → '}
                            PKR {Math.round(parseFloat(entry.new_amount)).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-ink-secondary">{formatDate(entry.changed_at)}</p>
                          <p className="text-xs text-ink-muted">{entry.changed_by_name}</p>
                          <span className="text-[10px] font-bold text-primary-800 uppercase">↩ Restore</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Partner Contributions ─────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">🤝 Partner Contributions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowContributionHistory(v => !v)}
                className="text-xs font-semibold text-ink-secondary hover:text-ink min-h-[36px] px-2"
              >
                {showContributionHistory ? 'Hide History' : 'History'}
              </button>
              <button
                onClick={() => openAddContribution()}
                className="text-xs font-semibold text-primary-800 hover:text-primary-950 min-h-[36px] px-2"
              >
                Add
              </button>
            </div>
          </div>

          {!contributions ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-muted p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Total Added</p>
                  <p className="text-sm font-bold text-primary-950">
                    PKR {Math.round(contributionSummary?.total_injected || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-muted p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Recorded</p>
                  <p className="text-sm font-bold text-status-profit">
                    PKR {Math.round(contributionSummary?.total_contributed || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-muted p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Remaining</p>
                  <p className={`text-sm font-bold ${(contributionSummary?.unallocated || 0) > 0 ? 'text-orange-600' : 'text-ink-muted'}`}>
                    PKR {Math.round(contributionSummary?.unallocated || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {(contributionSummary?.needs_backfill || (
                (contributionSummary?.total_contributed || 0) === 0 && (contributionTotals?.length || 0) > 0
              )) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-orange-800">
                    Record each partner&apos;s share
                  </p>
                  <p className="text-xs text-orange-700">
                    {contributionSummary?.needs_backfill
                      ? `PKR ${Math.round(contributionSummary.unallocated).toLocaleString('en-IN')} was added to the bank but not yet assigned to partners. Add a contribution for each partner below.`
                      : 'No partner contributions recorded yet. Add how much each partner has contributed to the bank.'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {contributionTotals?.map(t => {
                  const contributed = parseFloat(t.total_contributed || '0');
                  const needsEntry = contributed === 0 && (
                    contributionSummary?.needs_backfill ||
                    (contributionSummary?.total_contributed || 0) === 0
                  );
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between py-2 border-b border-surface-border last:border-0 ${
                        needsEntry ? 'bg-orange-50/60 -mx-2 px-2 rounded-lg' : ''
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-ink">{t.name}</span>
                        <p className={`text-xs mt-0.5 ${contributed > 0 ? 'text-primary-950' : 'text-orange-600'}`}>
                          {contributed > 0
                            ? `Contributed PKR ${Math.round(contributed).toLocaleString('en-IN')}`
                            : 'No contribution recorded yet'}
                        </p>
                      </div>
                      <button
                        onClick={() => openAddContribution(t.id)}
                        className="text-xs font-semibold text-primary-800 hover:text-primary-950 min-h-[44px] px-2"
                      >
                        {contributed > 0 ? 'Add More' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {showContributionHistory && (
                <div className="border-t border-surface-border pt-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">
                    Contribution History
                  </p>
                  {!contributionEntries?.length ? (
                    <p className="text-sm text-ink-muted">No contributions recorded yet.</p>
                  ) : (
                    contributionEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-surface-border bg-surface-muted p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{entry.partner_name}</p>
                            <p className="text-sm text-primary-950 font-bold">
                              PKR {Math.round(parseFloat(entry.amount)).toLocaleString('en-IN')}
                            </p>
                            {entry.note && (
                              <p className="text-xs text-ink-muted mt-0.5">{entry.note}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-ink-secondary">{formatDate(entry.contributed_at)}</p>
                            <p className="text-xs text-ink-muted">{entry.recorded_by_name}</p>
                            <div className="flex gap-2 mt-1 justify-end">
                              <button
                                onClick={() => setEditContribution({
                                  id: entry.id,
                                  amount: String(Math.round(parseFloat(entry.amount))),
                                  note: entry.note || '',
                                })}
                                className="text-[10px] font-bold text-primary-800 uppercase"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteContributionId(entry.id)}
                                className="text-[10px] font-bold text-red-600 uppercase"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Partner Settlements ───────────────────────────── */}
        <div className="card space-y-3">
          <h3 className="text-base font-semibold text-ink">💰 Partner Settlements</h3>
          <div className="space-y-3">
            {shares?.map((s: { id: string; name: string; outstanding: number }) => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <div>
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <p className={`text-xs mt-0.5 ${s.outstanding > 0 ? 'text-orange-600' : s.outstanding < 0 ? 'text-status-profit' : 'text-ink-muted'}`}>
                    {s.outstanding > 0
                      ? `Owes PKR ${Math.round(s.outstanding).toLocaleString('en-IN')}`
                      : s.outstanding < 0
                      ? `Credit PKR ${Math.round(Math.abs(s.outstanding)).toLocaleString('en-IN')}`
                      : 'Settled ✓'}
                  </p>
                </div>
                {s.outstanding > 0 && (
                  <button
                    onClick={() => { setSettlePartnerId(s.id); setSettleAmount(String(Math.round(s.outstanding))); }}
                    className="text-xs font-semibold text-primary-800 hover:text-primary-950 min-h-[44px] px-2"
                  >
                    Settle
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── User Management ───────────────────────────────── */}
        <div className="card space-y-3">
          <h3 className="text-base font-semibold text-ink">👥 User Accounts</h3>
          <div className="space-y-3">
            {users?.map((u: { id: string; name: string; phone_number: string; role: string; is_active: boolean }) => (
              <div key={u.id} className="py-2 border-b border-surface-border last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink">{u.name}</span>
                      <span className={`badge text-xs ${u.role === 'super_admin' ? 'bg-primary-100 text-primary-800' : 'bg-surface-input text-ink-secondary'}`}>
                        {u.role === 'super_admin' ? 'Admin' : 'Partner'}
                      </span>
                      {!u.is_active && (
                        <span className="badge bg-surface-input text-ink-muted text-xs">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{u.phone_number}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`text-xs px-2 py-1 rounded min-h-[36px] font-medium ${
                          u.is_active
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-green-50 text-green-700 border border-green-200'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="text-xs px-2 py-1 rounded bg-surface-muted text-ink-secondary border border-surface-border min-h-[36px] font-medium"
                    >
                      Reset PW
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => router.push('/audit')} className="btn-secondary">
          📋 View Audit Log
        </button>
      </div>

      {/* ── Restore balance confirm ───────────────────────── */}
      {restoreEntry && (
        <ConfirmDialog
          title="Restore Balance"
          message={`Restore bank balance to PKR ${Math.round(parseFloat(restoreEntry.previous_amount)).toLocaleString('en-IN')}? This was the balance before the change on ${formatDate(restoreEntry.changed_at)}.`}
          confirmLabel="Restore"
          onConfirm={() => bankRestoreMutation.mutate(parseFloat(restoreEntry.previous_amount))}
          onCancel={() => setRestoreEntry(null)}
        />
      )}

      {/* ── Reset Password sheet ──────────────────────────── */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="bg-surface-card border-t border-surface-border rounded-t-2xl p-6 w-full">
            <h3 className="text-base font-semibold text-ink mb-4">Reset Password</h3>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="input-field mb-3"
            />
            <div className="flex gap-3">
              <button onClick={() => { setResetUserId(null); setNewPassword(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => resetMutation.mutate({ id: resetUserId, password: newPassword })}
                className="btn-primary flex-1"
                disabled={resetMutation.isPending || !newPassword}
              >
                {resetMutation.isPending ? <LoadingSpinner size="sm" /> : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Dialog ─────────────────────────────────── */}
      {settlePartnerId && (
        <ConfirmDialog
          title="Mark as Settled"
          message={`Mark PKR ${parseInt(settleAmount).toLocaleString('en-IN')} as settled for this partner?`}
          confirmLabel="Settle"
          onConfirm={() => settleMutation.mutate({ id: settlePartnerId, amount: parseFloat(settleAmount) })}
          onCancel={() => setSettlePartnerId(null)}
        />
      )}

      {/* ── Add Contribution sheet ────────────────────────── */}
      {showAddContribution && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="bg-surface-card border-t border-surface-border rounded-t-2xl p-6 w-full space-y-3">
            <h3 className="text-base font-semibold text-ink">Record Contribution</h3>
            {contributionSummary?.needs_backfill && (
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2">
                PKR {Math.round(contributionSummary.unallocated).toLocaleString('en-IN')} still needs to be assigned across partners.
              </p>
            )}
            <div>
              <label className="label">Partner</label>
              <select
                value={contributionPartnerId}
                onChange={e => setContributionPartnerId(e.target.value)}
                className="input-field"
              >
                <option value="">Select partner</option>
                {contributionTotals?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (PKR)</label>
              <input
                type="number"
                value={contributionAmount}
                onChange={e => setContributionAmount(e.target.value)}
                placeholder="Enter amount contributed"
                className="input-field"
                inputMode="numeric"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                type="text"
                value={contributionNote}
                onChange={e => setContributionNote(e.target.value)}
                placeholder="e.g. Initial capital, March deposit"
                className="input-field"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddContribution(false);
                  setContributionPartnerId('');
                  setContributionAmount('');
                  setContributionNote('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => addContributionMutation.mutate()}
                className="btn-primary flex-1"
                disabled={
                  addContributionMutation.isPending ||
                  !contributionPartnerId ||
                  !contributionAmount ||
                  isNaN(parseFloat(contributionAmount)) ||
                  parseFloat(contributionAmount) <= 0
                }
              >
                {addContributionMutation.isPending ? <LoadingSpinner size="sm" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Contribution sheet ─────────────────────────── */}
      {editContribution && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="bg-surface-card border-t border-surface-border rounded-t-2xl p-6 w-full space-y-3">
            <h3 className="text-base font-semibold text-ink">Edit Contribution</h3>
            <div>
              <label className="label">Amount (PKR)</label>
              <input
                type="number"
                value={editContribution.amount}
                onChange={e => setEditContribution({ ...editContribution, amount: e.target.value })}
                className="input-field"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                type="text"
                value={editContribution.note}
                onChange={e => setEditContribution({ ...editContribution, note: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditContribution(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => editContributionMutation.mutate({
                  id: editContribution.id,
                  amount: parseFloat(editContribution.amount),
                  note: editContribution.note,
                })}
                className="btn-primary flex-1"
                disabled={
                  editContributionMutation.isPending ||
                  !editContribution.amount ||
                  isNaN(parseFloat(editContribution.amount)) ||
                  parseFloat(editContribution.amount) <= 0
                }
              >
                {editContributionMutation.isPending ? <LoadingSpinner size="sm" /> : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Contribution confirm ───────────────────── */}
      {deleteContributionId && (
        <ConfirmDialog
          title="Delete Contribution"
          message="Remove this contribution record? This does not change the bank balance."
          confirmLabel="Delete"
          onConfirm={() => {
            deleteContributionMutation.mutate(deleteContributionId);
            setDeleteContributionId(null);
          }}
          onCancel={() => setDeleteContributionId(null)}
          danger
        />
      )}
    </Layout>
  );
}
