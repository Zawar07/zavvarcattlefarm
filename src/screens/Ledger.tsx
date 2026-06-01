'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import ScrollableTable from '../components/ScrollableTable';
import api from '../api/axios';
import { formatDate } from '../utils/format';
import {
  buildLedgerCategoryOptions,
  matchesLedgerCategoryFilter,
} from '../utils/ledgerFilters';

// ── Icons ──────────────────────────────────────────────────────────────────
function FilterIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ── Category badge ─────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  'CATTLE SELL': { bg: '#C1ECD4', text: '#002114' },
  'CATTLE BUY':  { bg: '#FFDEA9', text: '#271900' },
  'EXPENSE':     { bg: '#FFDCC1', text: '#2D1601' },
  'UTILITY':     { bg: '#FFDCC1', text: '#2D1601' },
  'FEED':        { bg: '#FFDCC1', text: '#2D1601' },
  'HEALTHCARE':  { bg: '#FFDCC1', text: '#2D1601' },
  'PAYROLL':     { bg: '#E7E8E9', text: '#414844' },
};

function categoryBadge(type: string) {
  const label =
    type === 'cattle_sale'     ? 'CATTLE SELL' :
    type === 'cattle_purchase' ? 'CATTLE BUY'  :
    type === 'expense'         ? 'EXPENSE'      :
    type.toUpperCase().replace(/_/g, ' ');
  const style = BADGE_STYLES[label] ?? { bg: '#FFDCC1', text: '#2D1601' };
  return { label, ...style };
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  entry_date: string;
  category: string;
  description: string;
  amount: string;
  running_balance?: string;
  recorded_by_name: string;
}

const PAGE_SIZE = 10;

export default function Ledger() {
  const [view, setView]               = useState<'farm' | 'partner'>('farm');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage]               = useState(1);

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () =>
      api.get('/expenses/categories').then(
        (r) => r.data as { id: number; name: string }[],
      ),
  });

  const categoryOptions = buildLedgerCategoryOptions(
    expenseCategories.map((c) => c.name),
  );

  const { data: entries, isLoading } = useQuery({
    queryKey: ['ledger', fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate)   params.set('to_date',   toDate);
      return api.get(`/ledger?${params}`).then(r => r.data);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['bank-balance'],
    queryFn: () => api.get('/bank/balance').then(r => r.data),
  });

  const allEntries: LedgerEntry[] = entries ?? [];
  const filtered = allEntries.filter((e) =>
    matchesLedgerCategoryFilter(e, categoryFilter),
  );

  const totalIn  = allEntries.filter(e => parseFloat(e.amount) > 0).reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalOut = allEntries.filter(e => parseFloat(e.amount) < 0).reduce((s, e) => s + Math.abs(parseFloat(e.amount)), 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // page numbers to show (max 5, centred around current)
  const pageNums = (() => {
    const half = 2;
    let start = Math.max(1, page - half);
    const end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  return (
    <Layout title="">
      <div className="p-4 space-y-4">

        {/* ── View toggle ───────────────────────────────────── */}
        <div className="flex bg-surface-input rounded-lg p-1 relative">
          <div
            className="absolute top-1 bottom-1 bg-surface-card rounded shadow-card transition-transform duration-200"
            style={{ width: 'calc(50% - 4px)', left: 4, transform: view === 'partner' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {(['farm', 'partner'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`relative flex-1 py-2 text-xs font-bold tracking-wider transition-colors min-h-[36px] rounded ${view === v ? 'text-primary-950' : 'text-ink-secondary'}`}>
              {v === 'farm' ? 'Farm View' : 'Partner View'}
            </button>
          ))}
        </div>

        {/* ── Summary bento ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card col-span-3 sm:col-span-1 flex justify-between items-center">
            <div>
              <p className="section-label mb-1">Bank Balance</p>
              <CurrencyDisplay farmValue={parseFloat(summary?.amount || '0')} className="text-xl font-bold text-primary-950 block" />
            </div>
          </div>
          <div className="card">
            <p className="section-label mb-1">Total In</p>
            <CurrencyDisplay farmValue={totalIn}  className="text-lg font-bold text-status-profit block" />
          </div>
          <div className="card">
            <p className="section-label mb-1">Total Out</p>
            <CurrencyDisplay farmValue={totalOut} className="text-lg font-bold text-status-loss block" />
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────── */}
        <div className="card-muted space-y-3">
          {/* Date range */}
          <div>
            <p className="label">Date Range</p>
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="input-field flex-1" aria-label="From date" />
              <span className="text-ink-secondary text-sm font-medium shrink-0">to</span>
              <input type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} className="input-field flex-1" aria-label="To date" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ledger-category">
              Category
            </label>
            <select
              id="ledger-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button onClick={() => { setFromDate(''); setToDate(''); setCategoryFilter(''); setPage(1); }} className="btn-primary">
            <FilterIcon /> Clear Filters
          </button>
        </div>

        {/* ── Ledger Table ──────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-ink-muted">No transactions found</div>
          ) : (
            <>
              <ScrollableTable minWidth={640}>
                  <thead>
                    <tr className="bg-surface-muted border-b border-surface-border">
                      <th className="p-4 text-left text-xs font-semibold tracking-wider text-ink-secondary whitespace-nowrap w-28">DATE &amp; USER</th>
                      <th className="p-4 text-left text-xs font-semibold tracking-wider text-ink-secondary">TRANSACTION DETAIL</th>
                      <th className="p-4 text-left text-xs font-semibold tracking-wider text-ink-secondary whitespace-nowrap w-28">CATEGORY</th>
                      <th className="p-4 text-right text-xs font-semibold tracking-wider text-ink-secondary whitespace-nowrap w-32">AMOUNT (PKR)</th>
                      <th className="p-4 text-right text-xs font-semibold tracking-wider text-ink-secondary whitespace-nowrap w-32">BALANCE (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((entry, idx) => {
                      const amount   = parseFloat(entry.amount);
                      const isCredit = amount > 0;
                      const badge    = categoryBadge(entry.entry_type);
                      return (
                        <tr key={`${entry.id}-${idx}`}
                          className={`border-b border-surface-border last:border-0 ${idx % 2 === 1 ? 'bg-surface-page' : 'bg-surface-card'}`}>

                          {/* Date + user */}
                          <td className="p-4 align-top whitespace-nowrap">
                            <p className="text-sm font-bold text-ink leading-snug">{formatDate(entry.entry_date)}</p>
                            <div className="flex items-center gap-1 text-ink-muted mt-1">
                              <UserIcon />
                              <span className="text-xs">{entry.recorded_by_name}</span>
                            </div>
                          </td>

                          {/* Description */}
                          <td className="p-4 align-top">
                            <p className="text-sm font-semibold text-ink">{entry.description}</p>
                            <p className="text-xs text-ink-secondary mt-0.5">{entry.category}</p>
                          </td>

                          {/* Badge */}
                          <td className="p-4 align-top">
                            <span className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{ background: badge.bg, color: badge.text }}>
                              {badge.label}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="p-4 align-top text-right whitespace-nowrap">
                            <span className={`text-base font-bold ${isCredit ? 'text-status-profit' : 'text-status-loss'}`}>
                              {isCredit ? '+' : '-'}&nbsp;{Math.abs(amount).toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* Running balance */}
                          <td className="p-4 align-top text-right whitespace-nowrap">
                            <span className="text-sm text-ink-secondary">
                              {entry.running_balance ? parseFloat(entry.running_balance).toLocaleString('en-IN') : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </ScrollableTable>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-muted border-t border-surface-border flex-wrap gap-3">
                <p className="text-xs text-ink-secondary">
                  Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} transactions
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 flex items-center justify-center border border-surface-border rounded bg-surface-card disabled:opacity-40 hover:bg-surface-subtle"
                    aria-label="Previous page">
                    <ChevronLeftIcon />
                  </button>

                  {pageNums.map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 flex items-center justify-center border rounded text-xs font-bold transition-colors ${
                        page === n
                          ? 'bg-primary-950 text-white border-primary-950'
                          : 'border-surface-border bg-surface-card text-ink hover:bg-surface-subtle'
                      }`}
                      aria-current={page === n ? 'page' : undefined}>
                      {n}
                    </button>
                  ))}

                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-8 h-8 flex items-center justify-center border border-surface-border rounded bg-surface-card disabled:opacity-40 hover:bg-surface-subtle"
                    aria-label="Next page">
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </Layout>
  );
}
