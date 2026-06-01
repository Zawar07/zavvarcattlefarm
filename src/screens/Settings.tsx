'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { formatPKR } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Settings() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [settlePartnerId, setSettlePartnerId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');

  const isAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: shares } = useQuery({
    queryKey: ['partner-shares'],
    queryFn: () => api.get('/partners/shares').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: balance } = useQuery({
    queryKey: ['bank-balance'],
    queryFn: () => api.get('/bank/balance').then((r) => r.data),
    enabled: isAdmin,
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

  const bankMutation = useMutation({
    mutationFn: () => api.post('/bank/balance', { amount: parseFloat(bankAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      setShowBankForm(false);
      setBankAmount('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to update balance.');
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
      setError(msg || 'Failed to settle balance.');
    },
  });

  if (!isAdmin) return null;

  return (
    <Layout title="Settings" showViewToggle={false}>
      <div className="p-4 space-y-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Bank Balance */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">💳 Bank Balance</h3>
            <button onClick={() => setShowBankForm(v => !v)} className="text-primary-400 text-sm min-h-[44px] min-w-[44px] flex items-center justify-end">
              Update
            </button>
          </div>
          <p className="text-2xl font-bold text-primary-400">{formatPKR(parseFloat(balance?.amount || '0'))}</p>
          {showBankForm && (
            <div className="mt-3 space-y-2">
              <input
                type="number"
                value={bankAmount}
                onChange={e => setBankAmount(e.target.value)}
                placeholder="New balance amount"
                className="input-field"
                inputMode="numeric"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowBankForm(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button onClick={() => bankMutation.mutate()} className="btn-primary flex-1 py-2 text-sm" disabled={bankMutation.isPending}>
                  {bankMutation.isPending ? <LoadingSpinner size="sm" /> : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Partner Settlements */}
        <div className="card">
          <h3 className="text-white font-semibold mb-3">💰 Partner Settlements</h3>
          <div className="space-y-3">
            {shares?.map((s: { id: string; name: string; outstanding: number }) => (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <span className="text-white text-sm font-medium">{s.name}</span>
                  <p className={`text-xs ${s.outstanding > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {s.outstanding > 0 ? `Owes PKR ${Math.round(s.outstanding).toLocaleString('en-IN')}` : 'Settled ✓'}
                  </p>
                </div>
                {s.outstanding > 0 && (
                  <button
                    onClick={() => { setSettlePartnerId(s.id); setSettleAmount(String(Math.round(s.outstanding))); }}
                    className="text-primary-400 text-sm min-h-[44px] min-w-[44px] flex items-center justify-end"
                  >
                    Settle
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User Management */}
        <div className="card">
          <h3 className="text-white font-semibold mb-3">👥 User Accounts</h3>
          <div className="space-y-3">
            {users?.map((u: { id: string; name: string; phone_number: string; role: string; is_active: boolean }) => (
              <div key={u.id} className="py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{u.name}</span>
                      <span className={`badge text-xs ${u.role === 'super_admin' ? 'bg-primary-900/50 text-primary-400' : 'bg-gray-700 text-gray-400'}`}>
                        {u.role === 'super_admin' ? 'Admin' : 'Partner'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">{u.phone_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`text-xs px-2 py-1 rounded-lg min-h-[36px] ${u.is_active ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 min-h-[36px]"
                    >
                      Reset PW
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Link */}
        <button onClick={() => router.push('/audit')} className="btn-secondary">
          📋 View Audit Log
        </button>
      </div>

      {/* Reset Password Dialog */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70">
          <div className="bg-gray-900 border-t border-gray-700 rounded-t-2xl p-6 w-full">
            <h3 className="text-white font-semibold mb-4">Reset Password</h3>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="input-field mb-3"
            />
            <div className="flex gap-3">
              <button onClick={() => { setResetUserId(null); setNewPassword(''); }} className="btn-secondary flex-1">Cancel</button>
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

      {/* Settle Dialog */}
      {settlePartnerId && (
        <ConfirmDialog
          title="Mark as Settled"
          message={`Mark PKR ${parseInt(settleAmount).toLocaleString('en-IN')} as settled for this partner?`}
          confirmLabel="Settle"
          onConfirm={() => settleMutation.mutate({ id: settlePartnerId, amount: parseFloat(settleAmount) })}
          onCancel={() => setSettlePartnerId(null)}
        />
      )}
    </Layout>
  );
}
