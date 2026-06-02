'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { todayISO } from '../utils/format';

// Categories that default to animal cost
const ANIMAL_COST_CATEGORIES = ['Feed'];

export default function NewExpense() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isAnimalCost, setIsAnimalCost] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories').then(r => r.data),
  });

  const selectedCategoryName = (categories as { id: number; name: string }[])
    .find(c => String(c.id) === categoryId)?.name || '';

  // Auto-set toggle based on category — Feed = animal cost, everything else = farm cost
  useEffect(() => {
    if (selectedCategoryName) {
      setIsAnimalCost(ANIMAL_COST_CATEGORIES.includes(selectedCategoryName));
    }
  }, [selectedCategoryName]);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('category_id', categoryId);
      formData.append('sub_category', subCategory);
      formData.append('expense_date', date);
      formData.append('is_animal_cost', isAnimalCost ? '1' : '0');
      if (description) formData.append('description', description);
      if (receipt) formData.append('receipt', receipt);
      return api.post('/expenses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary-month'] });
      if (res.data.warning === 'LOW_BALANCE') {
        setWarning('⚠️ Bank balance is now negative. Please update the balance.');
        return;
      }
      router.push('/expenses');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Failed to save expense. Please try again.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!categoryId || !subCategory.trim() || !amount || !date) {
      setError('Category, sub-category, amount, and date are required.');
      return;
    }
    if (selectedCategoryName === 'Other' && !description.trim()) {
      setError('Description is required for "Other" category.');
      return;
    }
    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Layout title="New Expense" showBack showViewToggle={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        {warning && <ErrorBanner message={warning} onDismiss={() => setWarning('')} />}

        <div>
          <label className="label">Category *</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="input-field"
            required
          >
            <option value="">Select category</option>
            {(categories as { id: number; name: string }[]).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Sub-Category / Item Name *</label>
          <input
            value={subCategory}
            onChange={e => setSubCategory(e.target.value)}
            placeholder="e.g. Generator Fuel, Water Motor, WAPDA Bill"
            className="input-field"
            required
          />
        </div>

        <div>
          <label className="label">Amount (PKR) *</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="input-field"
            inputMode="numeric"
            min="1"
            required
          />
        </div>

        <div>
          <label className="label">Date *</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-field"
            required
          />
        </div>

        {/* ── Animal Cost Toggle ──────────────────────────────── */}
        <div
          className={`rounded-lg border-2 p-4 transition-all cursor-pointer ${
            isAnimalCost
              ? 'border-primary-700 bg-primary-50'
              : 'border-surface-border bg-surface-subtle'
          }`}
          onClick={() => setIsAnimalCost(v => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isAnimalCost ? 'text-primary-900' : 'text-ink'}`}>
                {isAnimalCost ? '🐄 Animal Cost' : '🏚️ Farm Cost'}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {isAnimalCost
                  ? 'Split across animals by weight & time'
                  : 'Farm overhead — not allocated to animals'}
              </p>
            </div>
            {/* Toggle pill */}
            <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 ml-3 flex-shrink-0 ${
              isAnimalCost ? 'bg-primary-800' : 'bg-surface-input'
            }`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                isAnimalCost ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </div>
          </div>
        </div>

        <div>
          <label className="label">
            Description {selectedCategoryName === 'Other' ? '*' : '(optional)'}
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add details..."
            className="input-field resize-none"
            rows={3}
            required={selectedCategoryName === 'Other'}
          />
        </div>

        <div>
          <label className="label">Receipt / Invoice (optional)</label>
          <label className="flex items-center gap-3 cursor-pointer border border-dashed border-surface-border rounded-lg px-4 py-3 hover:border-ink-muted hover:bg-surface-muted transition-colors">
            <span className="text-2xl">📎</span>
            <div className="flex-1">
              {receipt ? (
                <span className="text-ink text-sm font-medium">{receipt.name}</span>
              ) : (
                <span className="text-ink-muted text-sm">Attach image or PDF (max 10MB)</span>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  setError('File must be under 10MB');
                  return;
                }
                setReceipt(file);
              }}
            />
          </label>
          {receipt && (
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="text-status-loss text-xs mt-1 hover:opacity-80"
            >
              Remove file
            </button>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : 'Save Expense'}
        </button>
      </form>
    </Layout>
  );
}
