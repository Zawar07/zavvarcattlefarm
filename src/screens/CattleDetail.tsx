'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatDate, todayISO } from '../utils/format';
import { proxiedBlobUrl } from '../utils/blobUrl';
import { useRouter } from 'next/navigation';

// ── Config ─────────────────────────────────────────────────────────────────
const ANIMAL_CONFIG: Record<string, { emoji: string; label: string }> = {
  bull:    { emoji: '🐂', label: 'Bull'    },
  cow:     { emoji: '🐄', label: 'Cow'     },
  goat:    { emoji: '🐐', label: 'Goat'    },
  sheep:   { emoji: '🐑', label: 'Sheep'   },
  chicken: { emoji: '🐓', label: 'Chicken' },
};

const EXPENSE_WEIGHT: Record<string, number> = {
  bull: 3, cow: 3, goat: 1, sheep: 1, chicken: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / msPerDay));
}

/** Human-readable duration between two dates, e.g. "2 months, 14 days" */
function formatDuration(from: string, to: string): string {
  const start = new Date(from);
  const end   = new Date(to);
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerDay));

  if (totalDays === 0) return 'Less than a day';

  const years  = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days   = totalDays % 30;

  const parts: string[] = [];
  if (years  > 0) parts.push(`${years} year${years  !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days   > 0) parts.push(`${days} day${days   !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CattleDetail() {
  const id = useParams()?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSellForm, setShowSellForm] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(todayISO());
  const [error, setError] = useState('');

  // ── Main cattle record ──────────────────────────────────────────────────
  const { data: cattle, isLoading } = useQuery({
    queryKey: ['cattle', id],
    queryFn: () => api.get(`/cattle/${id}`).then(r => r.data),
  });

  // ── Cost estimation data ───────────────────────────────────────────────
  const { data: expensesData } = useQuery({
    queryKey: ['expenses-animal-cost-total'],
    queryFn: () => api.get('/expenses?limit=1&is_animal_cost=true').then(r => r.data),
    enabled: !!cattle,
  });

  // All cattle (active + sold) to build the full time-weighted pool
  const { data: allCattleData } = useQuery({
    queryKey: ['cattle-all-for-detail-cost'],
    queryFn: () => api.get('/cattle').then(r => r.data),
    enabled: !!cattle,
  });

  // ── Sell mutation ───────────────────────────────────────────────────────
  const sellMutation = useMutation({
    mutationFn: () =>
      api.patch(`/cattle/${id}/sell`, {
        sale_price: parseFloat(salePrice),
        sale_date: saleDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cattle'] });
      queryClient.invalidateQueries({ queryKey: ['cattle-summary'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      setShowSellForm(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Failed to record sale.');
    },
  });

  const handleSell = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!salePrice || parseFloat(salePrice) <= 0) {
      setError('Valid sale price required.');
      return;
    }
    sellMutation.mutate();
  };

  // ── Loading / not found ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout title="Cattle Detail" showBack>
        <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
      </Layout>
    );
  }

  if (!cattle) {
    return (
      <Layout title="Cattle Detail" showBack>
        <div className="p-4 text-ink-muted">Record not found.</div>
      </Layout>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const config     = ANIMAL_CONFIG[cattle.animal_type] ?? { emoji: '🐾', label: cattle.animal_type };
  const imageUrl   = proxiedBlobUrl(cattle.image_url);
  const profitLoss = cattle.is_sold
    ? parseFloat(cattle.sale_price) - parseFloat(cattle.purchase_price)
    : null;

  // Time with us
  const today      = todayISO();
  const endDate    = cattle.is_sold ? cattle.sale_date : today;
  const timeWithUs = formatDuration(cattle.purchase_date, endDate);

  // ── Time-weighted cost: weight × days ──────────────────────────────────
  // Each animal's share = (weight × days) / Σ(weight × days for all) × total expenses
  const totalExpenses: number = expensesData?.total_amount ?? 0;
  const myWeight  = EXPENSE_WEIGHT[cattle.animal_type] ?? 0;
  const myDays    = daysBetween(cattle.purchase_date, endDate);
  const myUnits   = myWeight * myDays;

  const allCattle: Array<{
    id: string; animal_type: string; is_sold: boolean;
    purchase_date: string; sale_date?: string;
  }> = allCattleData ?? [];

  // Build pool: all non-chicken animals (active + sold)
  const totalUnits = allCattle
    .filter(c => EXPENSE_WEIGHT[c.animal_type] > 0)
    .reduce((sum, c) => {
      const end  = c.is_sold ? (c.sale_date ?? today) : today;
      const days = daysBetween(c.purchase_date, end);
      return sum + (EXPENSE_WEIGHT[c.animal_type] ?? 0) * days;
    }, 0);

  const expenseShare  = myUnits > 0 && totalUnits > 0
    ? (myUnits / totalUnits) * totalExpenses
    : 0;
  const purchasePrice = parseFloat(cattle.purchase_price);
  const estTotalCost  = purchasePrice + expenseShare;
  const showCostCard  = myWeight > 0;

  return (
    <Layout title="Cattle Detail" showBack>
      <div className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* ── Hero image + title ───────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={config.label}
              className="w-full object-contain bg-surface-muted"
              style={{ aspectRatio: '16/9' }}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center text-7xl bg-surface-muted"
              style={{ aspectRatio: '16/9' }}
            >
              {config.emoji}
            </div>
          )}
          <div className="p-4 text-center space-y-1">
            <h2 className="text-2xl font-bold text-ink capitalize">{config.label}</h2>
            <span className={`badge ${cattle.is_sold ? 'badge-sold' : 'badge-available'}`}>
              {cattle.is_sold ? 'SOLD' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* ── Time with us ─────────────────────────────────────── */}
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 text-xl">
            🕐
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">
              {cattle.is_sold ? 'Time Owned' : 'With Us For'}
            </p>
            <p className="text-base font-bold text-ink">{timeWithUs}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-muted">
              {formatDate(cattle.purchase_date)}
            </p>
            <p className="text-xs text-ink-muted">
              → {cattle.is_sold ? formatDate(cattle.sale_date) : 'Today'}
            </p>
          </div>
        </div>

        {/* ── Purchase details ─────────────────────────────────── */}
        <div className="card space-y-3">
          <p className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
            Purchase Details
          </p>
          <Row label="Purchase Price">
            <CurrencyDisplay
              farmValue={purchasePrice}
              className="text-base font-semibold text-ink"
            />
          </Row>
          <Row label="Purchase Date" value={formatDate(cattle.purchase_date)} />
          {cattle.description && (
            <Row label="Description" value={cattle.description} />
          )}
          <Row label="Recorded by" value={cattle.recorded_by_name} />
        </div>

        {/* ── Estimated cost card ──────────────────────────────── */}
        {showCostCard && (
          <div className="card space-y-3 border-l-4 border-l-primary-700">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
                Est. Cost of Ownership
              </p>
              <span className="text-[10px] text-ink-muted bg-surface-subtle px-2 py-0.5 rounded">
                {cattle.is_sold ? 'Final' : 'Live'}
              </span>
            </div>

            <Row label="Purchase Price">
              <span className="text-sm font-medium text-ink">
                PKR {Math.round(purchasePrice).toLocaleString('en-IN')}
              </span>
            </Row>

            <Row label={`Expense Share (${Math.round(myUnits)}/${Math.round(totalUnits)} units)`}>
              <span className="text-sm font-medium text-ink">
                PKR {Math.round(expenseShare).toLocaleString('en-IN')}
              </span>
            </Row>

            <div className="flex justify-between items-center border-t border-surface-border pt-3">
              <span className="text-xs font-bold tracking-wider uppercase text-ink">
                Total Est. Cost
              </span>
              <span className="text-xl font-bold text-primary-950">
                PKR {Math.round(estTotalCost).toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-[10px] text-ink-muted leading-relaxed">
              {myWeight}× weight × {myDays} days = {Math.round(myUnits)} units out of {Math.round(totalUnits)} total.
              Only Feed/animal expenses included. Bull/Cow = 3×, Goat/Sheep = 1×.
            </p>
          </div>
        )}

        {/* ── Sale details (if sold) ───────────────────────────── */}
        {cattle.is_sold && (
          <div className="card space-y-3">
            <p className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
              Sale Details
            </p>
            <Row label="Sale Price">
              <CurrencyDisplay
                farmValue={parseFloat(cattle.sale_price)}
                className="text-base font-semibold text-ink"
              />
            </Row>
            <Row label="Sale Date" value={formatDate(cattle.sale_date)} />
            <div className="flex justify-between items-center border-t border-surface-border pt-3">
              <span className="text-xs font-bold tracking-wider text-ink uppercase">
                Profit / Loss
              </span>
              <span
                className={`text-lg font-bold ${
                  profitLoss! >= 0 ? 'text-status-profit' : 'text-status-loss'
                }`}
              >
                {profitLoss! >= 0 ? '+ ' : '- '}PKR{' '}
                {Math.abs(Math.round(profitLoss!)).toLocaleString('en-IN')}
              </span>
            </div>
            {showCostCard && (
              <div className="flex justify-between items-center border-t border-surface-border pt-3">
                <span className="text-xs font-bold tracking-wider text-ink uppercase">
                  Net Profit (after costs)
                </span>
                <span
                  className={`text-lg font-bold ${
                    parseFloat(cattle.sale_price) - estTotalCost >= 0
                      ? 'text-status-profit'
                      : 'text-status-loss'
                  }`}
                >
                  {parseFloat(cattle.sale_price) - estTotalCost >= 0 ? '+ ' : '- '}PKR{' '}
                  {Math.abs(
                    Math.round(parseFloat(cattle.sale_price) - estTotalCost),
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Edit action ──────────────────────────────────────── */}
        {!cattle.is_sold && (
          <button
            onClick={() => router.push(`/cattle/${id}/edit`)}
            className="btn-secondary"
          >
            ✏️ Edit Animal
          </button>
        )}

        {/* ── Sell action ──────────────────────────────────────── */}
        {!cattle.is_sold && (
          <div>
            {!showSellForm ? (
              <button onClick={() => setShowSellForm(true)} className="btn-primary">
                💰 Record Sale
              </button>
            ) : (
              <form onSubmit={handleSell} className="card space-y-4">
                <h3 className="text-base font-semibold text-ink">Record Sale</h3>
                <div>
                  <label className="label">Sale Price (PKR) *</label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="0"
                    className="input-field"
                    inputMode="numeric"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="label">Sale Date *</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={e => setSaleDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSellForm(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={sellMutation.isPending}
                  >
                    {sellMutation.isPending ? <LoadingSpinner size="sm" /> : 'Confirm Sale'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-sm text-ink-secondary shrink-0">{label}</span>
      {children ?? <span className="text-sm font-medium text-ink text-right">{value}</span>}
    </div>
  );
}
