'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import FilterScroll from '../components/FilterScroll';
import api from '../api/axios';
import { formatDate, todayISO } from '../utils/format';
import { useViewMode } from '../context/ViewModeContext';

// ── Icons ──────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18.67" height="18.67" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function TrendUpIcon() {
  return (
    <svg width="15" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

// ── Category icon background colors ───────────────────────────────────────
const CATEGORY_BG: Record<string, string> = {
  'Farm General': '#E7E8E9',
  'Feed':         '#C1ECD4',
  'Payroll':      '#E7E8E9',
  'Electricity':  '#FFDEA9',
  'Rent':         '#FFD1AC',
  'Veterinary Visit': '#C1ECD4',
  'Vaccination':  '#C1ECD4',
  'Medicine & Treatment': '#C1ECD4',
  'Other':        '#E7E8E9',
};

// Group expenses by month label
function groupByMonth(expenses: ExpenseItem[]) {
  const groups: Record<string, ExpenseItem[]> = {};
  for (const e of expenses) {
    const d = new Date(e.expense_date);
    const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

interface ExpenseItem {
  id: string;
  expense_date: string;
  category_name: string;
  sub_category: string;
  amount: string;
  receipt_image_path?: string;
  recorded_by_name: string;
  partner_share?: number;
}

export default function Expenses() {
  const router = useRouter();
  const { mode, selectedPartnerName } = useViewMode();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [fromDate] = useState('');
  const [toDate] = useState(todayISO());

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () =>
      api.get('/expenses/categories').then(
        (r) => r.data as { id: number; name: string }[],
      ),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', category, fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      params.set('limit', '100');
      return api.get(`/expenses?${params}`).then(r => r.data);
    },
  });

  const allExpenses: ExpenseItem[] = data?.expenses ?? [];
  const filtered = allExpenses.filter(e =>
    !search ||
    e.sub_category.toLowerCase().includes(search.toLowerCase()) ||
    e.category_name.toLowerCase().includes(search.toLowerCase()),
  );
  const grouped = groupByMonth(filtered);

  const partnerLabel = selectedPartnerName
    ? `${selectedPartnerName.split(' ')[0]}'s 1/3 Share`
    : "Partner's Share";

  return (
    <Layout title="">
      <div className="p-4 space-y-4">

        {/* ── View Mode Toggle ───────────────────────────────── */}
        {/* Rendered by Layout via ViewModeToggle compact in header */}

        {/* ── Search & Filter ────────────────────────────────── */}
        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses (e.g. Fuel, Vet, Feed)..."
              className="input-field pl-10"
              aria-label="Search expenses"
            />
          </div>

          <FilterScroll>
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`filter-pill ${!category ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              All Categories
            </button>
            {expenseCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.name === category ? '' : c.name)}
                className={`filter-pill ${category === c.name ? 'filter-pill-active' : 'filter-pill-inactive'}`}
              >
                {c.name}
              </button>
            ))}
          </FilterScroll>
        </div>

        {/* ── Bento: Audit Status + Filtered Total ──────────── */}
        <div className="space-y-3">
          {/* Filtered Total card (green — matches Figma "PKR 12,450" card) */}
          <div className="rounded-2xl p-6 bg-primary-900 relative overflow-hidden">
            {/* Decorative bg icon */}
            <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
              <svg width="95" height="90" viewBox="0 0 24 24" fill="#86AF99" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="text-xs font-semibold tracking-wider text-primary-300 opacity-80 mb-2">
              {mode === 'partner' ? partnerLabel : 'Filtered Total'}
            </p>
            <CurrencyDisplay
              farmValue={data?.total_amount || 0}
              className="text-[30px] font-bold text-primary-300 block leading-tight"
            />
            <div className="flex items-center gap-2 mt-3 text-primary-300">
              <TrendUpIcon />
              <span className="text-xs">{filtered.length} expenses shown</span>
            </div>
          </div>
        </div>

        {/* ── Expense List ───────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-ink-muted">No expenses found</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month} className="space-y-2">
                {/* Month heading */}
                <p className="section-label">{month}</p>

                {items.map(e => (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/expenses/${e.id}`)}
                    className="w-full text-left card hover:shadow-md transition-shadow active:bg-surface-muted"
                    style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: icon + details */}
                      <div className="flex items-center gap-4">
                        {/* Category icon */}
                        <div
                          className="w-12 h-12 rounded flex items-center justify-center shrink-0"
                          style={{ background: CATEGORY_BG[e.category_name] ?? '#E7E8E9' }}
                        >
                          <svg width="16.5" height="18" viewBox="0 0 24 24" fill="none" stroke="#012D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>

                        {/* Text */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-ink truncate">{e.sub_category}</p>
                            <ChevronRightIcon />
                          </div>
                          <p className="text-xs text-ink-secondary mt-0.5">
                            {e.category_name} • {formatDate(e.expense_date)}
                          </p>
                        </div>
                      </div>

                      {/* Right: share label + amount */}
                      <div className="text-right shrink-0">
                        {mode === 'partner' && (
                          <p className="text-[10px] text-ink-muted mb-0.5">{partnerLabel}</p>
                        )}
                        <CurrencyDisplay
                          farmValue={parseFloat(e.amount)}
                          className="text-[22px] font-bold text-primary-950 block"
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FAB ────────────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/expenses/new')}
        className="fixed bottom-6 right-4 w-14 h-14 bg-primary-950 hover:bg-primary-900 rounded-xl shadow-fab flex items-center justify-center text-white z-30"
        aria-label="Add new expense"
      >
        <PlusIcon />
      </button>
    </Layout>
  );
}
