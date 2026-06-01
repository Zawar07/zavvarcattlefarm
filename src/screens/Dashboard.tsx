'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../api/axios';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

// ── Icons ──────────────────────────────────────────────────────────────────
function ClockIcon() {
  return (
    <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function CattleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function LedgerIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['bank-balance'],
    queryFn: () => api.get('/bank/balance').then(r => r.data),
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses-summary-month'],
    queryFn: () => {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const to = now.toISOString().split('T')[0];
      return api.get(`/expenses?from_date=${from}&to_date=${to}&limit=1`).then(r => r.data);
    },
  });

  const { data: cattle } = useQuery({
    queryKey: ['cattle-summary'],
    queryFn: () => api.get('/cattle/summary').then(r => r.data),
  });

  const { data: shares } = useQuery({
    queryKey: ['partner-shares'],
    queryFn: () => api.get('/partners/shares').then(r => r.data),
    staleTime: 0,
  });

  return (
    <Layout title="">
      <div className="p-4 space-y-4">

        {/* ── View Mode Toggle (full-width segmented) ─────────── */}
        {/* Rendered inline here so it sits below the header */}

        {/* ── Bank Balance Card ──────────────────────────────── */}
        <div
          className="relative rounded-lg p-6 overflow-hidden border border-surface-border shadow-card"
          style={{ background: 'linear-gradient(166deg, #fff 0%, #F3F4F5 100%)' }}
        >
          <p className="section-label mb-2">Bank Balance</p>
          {balLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <CurrencyDisplay
                farmValue={parseFloat(balance?.amount || '0')}
                className="text-[30px] font-bold text-primary-950 block leading-tight"
              />
              {balance?.updated_at && (
                <div className="flex items-center gap-1.5 mt-3 text-ink-secondary text-xs">
                  <ClockIcon />
                  <span>Last updated: {formatDate(balance.updated_at)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <div className="space-y-2">
          <button
            onClick={() => router.push('/expenses/new')}
            className="w-full card flex items-center gap-3 hover:shadow-md transition-shadow active:bg-surface-muted"
          >
            <div className="w-10 h-10 rounded-xl bg-[#FFD1AC] flex items-center justify-center shrink-0">
              <PlusIcon />
            </div>
            <span className="text-xl font-semibold text-ink">Add Expense</span>
          </button>

          <button
            onClick={() => router.push('/cattle/new')}
            className="w-full card flex items-center gap-3 hover:shadow-md transition-shadow active:bg-surface-muted"
          >
            <div className="w-10 h-10 rounded-xl bg-[#C1ECD4] flex items-center justify-center shrink-0">
              <CattleIcon />
            </div>
            <span className="text-xl font-semibold text-ink">Buy Cattle</span>
          </button>

          <button
            onClick={() => router.push('/ledger')}
            className="w-full card flex items-center gap-3 hover:shadow-md transition-shadow active:bg-surface-muted"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-input flex items-center justify-center shrink-0">
              <LedgerIcon />
            </div>
            <span className="text-xl font-semibold text-ink">View Ledger</span>
          </button>
        </div>

        {/* ── Stats Row ─────────────────────────────────────── */}
        <div
          className="card border-l-4 border-l-ink-brand"
          style={{ borderLeftColor: '#79573A' }}
        >
          <p className="text-xs font-semibold tracking-wider text-ink-secondary mb-1">Monthly Expenses</p>
          <CurrencyDisplay
            farmValue={expenses?.total_amount || 0}
            className="text-[22px] font-bold text-ink-brand block"
          />
        </div>

        <div className="card border-l-4 border-l-primary-950">
          <p className="text-xs font-semibold tracking-wider text-ink-secondary mb-1">Inventory Value</p>
          <CurrencyDisplay
            farmValue={parseFloat(cattle?.total_inventory_value || '0')}
            className="text-[22px] font-bold text-primary-950 block"
          />
        </div>

        {/* ── Inventory Summary ─────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-ink-secondary">Inventory Summary</p>
            <button onClick={() => router.push('/cattle')} className="text-xs text-primary-950 font-semibold min-h-[36px]">
              View All
            </button>
          </div>

          {[
            { key: 'bulls',    emoji: '🐂', label: 'Bulls'    },
            { key: 'cows',     emoji: '🐄', label: 'Cows'     },
            { key: 'goats',    emoji: '🐐', label: 'Goats'    },
            { key: 'sheep',    emoji: '🐑', label: 'Sheep'    },
            { key: 'chickens', emoji: '🐓', label: 'Chickens' },
          ].filter(a => parseInt(cattle?.[a.key] ?? '0') > 0).map((a, i, arr) => (
            <div key={a.key} className={`flex justify-between items-center ${i < arr.length - 1 ? 'border-b border-surface-border pb-3' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{a.emoji}</span>
                <span className="text-base font-medium text-ink">{a.label}</span>
              </div>
              <span className="text-xl font-semibold text-ink">{cattle?.[a.key] ?? 0}</span>
            </div>
          ))}

          {parseInt(cattle?.total_active ?? '0') === 0 && (
            <p className="text-sm text-ink-muted text-center py-2">No active animals</p>
          )}
        </div>

        {/* ── Partner Shares ────────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-primary-950">Partner Share</h3>
            <span className="text-xs font-semibold tracking-wider text-ink-brand bg-[#FFD1AC] px-2 py-0.5 rounded">
              Current Cycle
            </span>
          </div>

          <div className="space-y-2">
            {shares?.map((s: { id: string; name: string; outstanding: number }) => {
              const owes = s.outstanding > 0;   // partner owes farm
              const credit = s.outstanding < 0; // farm owes partner
              const absAmount = Math.round(Math.abs(s.outstanding));
              return (
                <div
                  key={s.id}
                  className={`border rounded p-4 space-y-1 ${
                    owes
                      ? 'bg-orange-50 border-orange-200'
                      : credit
                      ? 'bg-green-50 border-green-200'
                      : 'bg-surface-subtle border-surface-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wider uppercase text-ink-secondary">
                      {s.name}
                      {s.id === user?.id && (
                        <span className="ml-1 normal-case text-ink-muted">(You)</span>
                      )}
                    </p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      owes
                        ? 'bg-orange-100 text-orange-700'
                        : credit
                        ? 'bg-green-100 text-green-700'
                        : 'bg-surface-input text-ink-muted'
                    }`}>
                      {owes ? 'Owes Farm' : credit ? 'Credit' : 'Settled'}
                    </span>
                  </div>
                  <p className={`text-xl font-bold ${
                    owes ? 'text-orange-700' : credit ? 'text-status-profit' : 'text-ink-muted'
                  }`}>
                    {owes ? '− ' : credit ? '+ ' : ''}PKR {absAmount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-ink-muted">
                    {owes
                      ? 'This partner needs to contribute this amount'
                      : credit
                      ? 'Farm owes this partner'
                      : 'All settled up'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
