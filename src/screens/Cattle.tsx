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
import { proxiedBlobUrl } from '../utils/blobUrl';

// ── Shared config ──────────────────────────────────────────────────────────
const ANIMAL_CONFIG: Record<string, { emoji: string; label: string }> = {
  bull:    { emoji: '🐂', label: 'Bull'    },
  cow:     { emoji: '🐄', label: 'Cow'     },
  goat:    { emoji: '🐐', label: 'Goat'    },
  sheep:   { emoji: '🐑', label: 'Sheep'   },
  chicken: { emoji: '🐓', label: 'Chicken' },
};

// Expense weight per animal type (chicken = 0 = excluded)
const EXPENSE_WEIGHT: Record<string, number> = {
  bull: 3, cow: 3, goat: 1, sheep: 1, chicken: 0,
};

function animalEmoji(type: string) { return ANIMAL_CONFIG[type]?.emoji ?? '🐾'; }
function animalLabel(type: string) { return ANIMAL_CONFIG[type]?.label ?? type; }

function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / msPerDay));
}

// ── Icons ──────────────────────────────────────────────────────────────────
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 13.5 9" fill="currentColor" aria-hidden="true">
      <path d="M0 0h13.5v1.5H0zM2.25 3.75h9v1.5h-9zM4.5 7.5h4.5V9H4.5z" />
    </svg>
  );
}

// ── Animal Card ────────────────────────────────────────────────────────────
interface AnimalCardProps {
  id: string;
  animal_type: string;
  purchase_price: string;
  purchase_date: string;
  is_sold: boolean;
  sale_price?: string;
  sale_date?: string;
  profit_loss?: string;
  description?: string;
  image_url?: string;
  tag_id?: string;
}

function AnimalCard({ animal, onClick }: { animal: AnimalCardProps; onClick: () => void }) {
  const isSold = animal.is_sold;
  const profitLoss = parseFloat(animal.profit_loss || '0');

  return (
    <button
      onClick={onClick}
      className="w-full text-left card p-0 overflow-hidden hover:shadow-md transition-shadow"
      aria-label={`${animal.animal_type} ${animal.tag_id ?? ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded flex items-center justify-center shrink-0 text-2xl"
            style={{ background: isSold ? 'rgba(65,72,68,0.1)' : 'rgba(27,67,50,0.1)' }}
          >
            {animalEmoji(animal.animal_type)}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-wider uppercase text-ink-brand">
              {animalLabel(animal.animal_type).toUpperCase()}
              {animal.tag_id ? ` • ID: ${animal.tag_id}` : ''}
            </span>
            <span className="text-xl font-semibold text-ink leading-tight">
              {animal.description || animalLabel(animal.animal_type)}
            </span>
          </div>
        </div>
        <span className={`badge mt-1 ${isSold ? 'badge-sold' : 'badge-available'}`}>
          {isSold ? 'SOLD' : 'AVAILABLE'}
        </span>
      </div>

      {/* Photo — full width */}
      <div className="mx-0 overflow-hidden bg-surface-input" style={{ aspectRatio: '16/9' }}>
        {animal.image_url ? (
          <img
            src={proxiedBlobUrl(animal.image_url)!}
            alt={animalLabel(animal.animal_type)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
            {animalEmoji(animal.animal_type)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-surface-border mx-0">
        {isSold ? (
          <div className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold tracking-wider text-ink-secondary">Sale Price</span>
              <span className="text-lg font-bold text-ink">
                PKR {parseFloat(animal.sale_price || '0').toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold tracking-wider text-ink-secondary">Sale Date</span>
              <span className="text-base font-semibold text-ink">
                {animal.sale_date ? formatDate(animal.sale_date) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-surface-border pt-2">
              <span className="text-xs font-bold tracking-wider text-ink">PROFIT/LOSS</span>
              <span className={`text-lg font-bold ${profitLoss >= 0 ? 'text-status-profit' : 'text-status-loss'}`}>
                {profitLoss >= 0 ? '+ ' : '- '}PKR {Math.abs(Math.round(profitLoss)).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs italic text-ink-secondary">
              Purchased for PKR {parseFloat(animal.purchase_price).toLocaleString('en-IN')} on {formatDate(animal.purchase_date)}
            </p>
          </div>
        ) : (
          <div className="flex p-4 gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-wider text-ink-secondary mb-1">Purchase Date</p>
              <p className="text-base font-semibold text-ink">{formatDate(animal.purchase_date)}</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs font-semibold tracking-wider text-right text-ink-secondary mb-1">Purchase Price</p>
              <CurrencyDisplay
                farmValue={parseFloat(animal.purchase_price)}
                className="text-[22px] font-bold text-primary-950 block text-right"
              />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Cost Calculator ────────────────────────────────────────────────────────
// Formula: each animal earns "animal-day units" = weight × days_owned
// Expense share = (animal's animal-days / total animal-days) × total expenses
// This accounts for both size (bull eats more) and time (longer stay = more cost)

function CostCalculator({ cattle, totalExpenses }: {
  cattle: AnimalCardProps[];
  totalExpenses: number;
}) {
  const today = todayISO();

  // Only non-chicken animals (active or sold)
  const eligible = cattle.filter(c => EXPENSE_WEIGHT[c.animal_type] > 0);

  if (eligible.length === 0) {
    return (
      <div className="text-center py-10 text-ink-muted">
        No animals to calculate costs for.
      </div>
    );
  }

  // Compute animal-day units for each
  const withUnits = eligible.map(animal => {
    const endDate = animal.is_sold ? (animal.sale_date ?? today) : today;
    const days    = daysBetween(animal.purchase_date, endDate);
    const weight  = EXPENSE_WEIGHT[animal.animal_type] ?? 0;
    const units   = weight * days;
    return { animal, days, weight, units };
  });

  const totalUnits = withUnits.reduce((s, r) => s + r.units, 0);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="card-muted space-y-2">
        <p className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
          Time-Weighted Cost Formula
        </p>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Share = <span className="font-semibold text-ink">(weight × days) ÷ total animal-days</span> × animal expenses only
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-ink-secondary pt-1">
          <span>🐂 Bull = 3×</span>
          <span>🐄 Cow = 3×</span>
          <span>🐐 Goat = 1×</span>
          <span>🐑 Sheep = 1×</span>
          <span className="text-ink-muted">🐓 Chicken = excluded</span>
          <span className="text-ink-muted">🏚️ Farm costs = excluded</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-surface-border">
          <span className="text-xs text-ink-secondary">Total Expenses Pool</span>
          <span className="text-sm font-bold text-ink">
            PKR {Math.round(totalExpenses).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-secondary">Total Animal-Day Units</span>
          <span className="text-sm font-bold text-ink">{Math.round(totalUnits).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Per-animal cards */}
      <div className="space-y-3">
        {withUnits.map(({ animal, days, weight, units }) => {
          const expenseShare  = totalUnits > 0 ? (units / totalUnits) * totalExpenses : 0;
          const purchasePrice = parseFloat(animal.purchase_price);
          const totalCost     = purchasePrice + expenseShare;

          return (
            <div key={animal.id} className="card p-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-3 bg-surface-subtle border-b border-surface-border">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-xl shrink-0"
                  style={{ background: 'rgba(27,67,50,0.1)' }}
                >
                  {animalEmoji(animal.animal_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold tracking-wider uppercase text-ink-brand">
                    {animalLabel(animal.animal_type)}
                    {animal.is_sold && <span className="ml-1 text-status-sold-text">(sold)</span>}
                  </p>
                  <p className="text-sm font-semibold text-ink truncate">
                    {animal.description || animalLabel(animal.animal_type)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-ink-muted">{weight}× · {days}d</p>
                  <p className="text-[10px] text-ink-muted">{Math.round(units)} units</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-secondary">Purchase Price</span>
                  <span className="font-medium text-ink">
                    PKR {Math.round(purchasePrice).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-secondary">
                    Expense Share ({Math.round(units)}/{Math.round(totalUnits)} units)
                  </span>
                  <span className="font-medium text-ink">
                    PKR {Math.round(expenseShare).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-surface-border pt-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-ink">
                    Total Cost
                  </span>
                  <span className="text-lg font-bold text-primary-950">
                    PKR {Math.round(totalCost).toLocaleString('en-IN')}
                  </span>
                </div>
                {animal.is_sold && animal.sale_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold tracking-wider uppercase text-ink">
                      Net Profit
                    </span>
                    <span className={`text-base font-bold ${
                      parseFloat(animal.sale_price) - totalCost >= 0
                        ? 'text-status-profit' : 'text-status-loss'
                    }`}>
                      {parseFloat(animal.sale_price) - totalCost >= 0 ? '+ ' : '- '}PKR{' '}
                      {Math.abs(Math.round(parseFloat(animal.sale_price) - totalCost)).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Cattle() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'inventory' | 'cost'>('inventory');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bull' | 'cow' | 'goat' | 'sheep' | 'chicken'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sold'>('all');

  const { data: summary } = useQuery({
    queryKey: ['cattle-summary'],
    queryFn: () => api.get('/cattle/summary').then(r => r.data),
  });

  const { data: cattle, isLoading } = useQuery({
    queryKey: ['cattle', typeFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('animal_type', typeFilter);
      if (statusFilter === 'active') params.set('is_sold', 'false');
      if (statusFilter === 'sold') params.set('is_sold', 'true');
      return api.get(`/cattle?${params}`).then(r => r.data);
    },
  });

  // Cost tab: fetch ALL cattle (active + sold) and animal-cost-only expenses
  const { data: allCattle } = useQuery({
    queryKey: ['cattle-all-for-cost'],
    queryFn: () => api.get('/cattle').then(r => r.data),
    enabled: activeTab === 'cost',
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses-animal-cost-total'],
    queryFn: () => api.get('/expenses?limit=1&is_animal_cost=true').then(r => r.data),
    enabled: activeTab === 'cost',
  });

  const totalExpenses: number = expensesData?.total_amount ?? 0;

  return (
    <Layout title="">
      <div className="p-4 space-y-4">
        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-primary-950">Inventory</h1>
          <p className="text-base text-ink-secondary">
            {summary ? (() => {
              const parts = [
                { key: 'bulls',    label: 'Bull'    },
                { key: 'cows',     label: 'Cow'     },
                { key: 'goats',    label: 'Goat'    },
                { key: 'sheep',    label: 'Sheep'   },
                { key: 'chickens', label: 'Chicken' },
              ]
                .filter(a => parseInt(summary[a.key] ?? '0') > 0)
                .map(a => { const n = parseInt(summary[a.key]); return `${n} ${a.label}${n !== 1 ? 's' : ''}`; });
              const total = parseInt(summary.total_active ?? '0');
              return `Total Inventory: ${total} Animal${total !== 1 ? 's' : ''}${parts.length ? ` (${parts.join(', ')})` : ''}`;
            })() : 'Loading...'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-surface-subtle rounded-lg p-1">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-2 rounded text-xs font-semibold tracking-wider uppercase transition-colors ${
              activeTab === 'inventory'
                ? 'bg-surface-card text-ink shadow-card border border-surface-border'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            🐄 Inventory
          </button>
          <button
            onClick={() => setActiveTab('cost')}
            className={`flex-1 py-2 rounded text-xs font-semibold tracking-wider uppercase transition-colors ${
              activeTab === 'cost'
                ? 'bg-surface-card text-ink shadow-card border border-surface-border'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            💰 Cost Per Animal
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <button onClick={() => router.push('/cattle/new')} className="btn-cta">
              <PlusIcon className="w-3.5 h-3.5" />
              Register Purchase
            </button>

            {/* Filters */}
            <div className="bg-surface-subtle rounded-lg p-2 space-y-2">
              <FilterScroll>
                {(['all', 'bull', 'cow', 'goat', 'sheep', 'chicken'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`filter-pill ${typeFilter === t ? 'filter-pill-active' : 'filter-pill-inactive'}`}
                  >
                    {t === 'all' ? 'All Cattle' : `${animalEmoji(t)} ${animalLabel(t)}s`}
                  </button>
                ))}
              </FilterScroll>
              <FilterScroll>
                {(['all', 'active', 'sold'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`filter-pill flex items-center gap-1.5 ${statusFilter === s ? 'filter-pill-active' : 'filter-pill-inactive'}`}
                  >
                    <FilterIcon className="w-3 h-2" />
                    Status: {s === 'all' ? 'All' : s === 'active' ? 'Available' : 'Sold'}
                  </button>
                ))}
              </FilterScroll>
            </div>

            {/* Cards */}
            {isLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
            ) : cattle?.length === 0 ? (
              <div className="text-center py-10 text-ink-muted">No cattle records found</div>
            ) : (
              <div className="space-y-4">
                {cattle?.map((c: AnimalCardProps) => (
                  <AnimalCard key={c.id} animal={c} onClick={() => router.push(`/cattle/${c.id}`)} />
                ))}
              </div>
            )}
          </>
        ) : (
          !allCattle ? (
            <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
          ) : (
            <CostCalculator cattle={allCattle} totalExpenses={totalExpenses} />
          )
        )}
      </div>

      {activeTab === 'inventory' && (
        <button
          onClick={() => router.push('/cattle/new')}
          className="fixed bottom-6 right-4 w-14 h-14 bg-primary-950 hover:bg-primary-900 rounded-xl shadow-fab flex items-center justify-center text-white z-30"
          aria-label="Register new cattle purchase"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      )}
    </Layout>
  );
}
