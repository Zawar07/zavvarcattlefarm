'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatDate } from '../utils/format';

const ANIMAL_COST_CATEGORIES = ['Feed'];

export default function EditExpense() {
  const id = useParams()?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [isAnimalCost, setIsAnimalCost] = useState(true);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories').then(r => r.data),
  });

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (expense) {
      setCategoryId(String(expense.category_id));
      setSubCategory(expense.sub_category);
      setAmount(String(Math.round(parseFloat(expense.amount))));
      setDate(expense.expense_date?.split('T')[0] || expense.expense_date);
      setDescription(expense.description || '');
      setIsAnimalCost(expense.is_animal_cost !== false);
    }
  }, [expense]);

  // Auto-update toggle when category changes
  const selectedCategoryName = (categories as { id: number; name: string }[])
    .find(c => String(c.id) === categoryId)?.name || '';

  useEffect(() => {
    if (selectedCategoryName && expense) {
      setIsAnimalCost(ANIMAL_COST_CATEGORIES.includes(selectedCategoryName));
    }
  }, [selectedCategoryName]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () => api.patch(`/expenses/${id}`, {
      category_id: parseInt(categoryId),
      sub_category: subCategory,
      amount: parseFloat(amount),
      expense_date: date,
      description: description || undefined,
      is_animal_cost: isAnimalCost,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      router.replace(`/expenses/${id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Failed to update expense.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!categoryId || !subCategory.trim() || !amount || !date) {
      setError('All required fields must be filled.');
      return;
    }
    mutation.mutate();
  };

  if (isLoading) return (
    <Layout title="Edit Expense" showBack showViewToggle={false}>
      <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
    </Layout>
  );

  return (
    <Layout title="Edit Expense" showBack showViewToggle={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {expense && (
          <div className="card-muted text-xs text-ink-muted">
            Originally added {formatDate(expense.created_at)} by {expense.recorded_by_name}
          </div>
        )}

        <div>
          <label className="label">Category *</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-field" required>
            <option value="">Select category</option>
            {(categories as { id: number; name: string }[]).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Sub-Category / Item Name *</label>
          <input value={subCategory} onChange={e => setSubCategory(e.target.value)} placeholder="e.g. Generator Fuel" className="input-field" required />
        </div>

        <div>
          <label className="label">Amount (PKR) *</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" inputMode="numeric" min="1" required />
        </div>

        <div>
          <label className="label">Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" required />
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field resize-none" rows={3} />
        </div>

        {/* ── Animal / Farm cost toggle ──────────────────────── */}
        <div
          className={`rounded-lg border-2 p-4 transition-all cursor-pointer ${
            isAnimalCost ? 'border-primary-700 bg-primary-50' : 'border-surface-border bg-surface-subtle'
          }`}
          onClick={() => setIsAnimalCost(v => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isAnimalCost ? 'text-primary-900' : 'text-ink'}`}>
                {isAnimalCost ? '🐄 Animal Cost' : '🏚️ Farm Cost'}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {isAnimalCost ? 'Split across animals by weight & time' : 'Farm overhead — not allocated to animals'}
              </p>
            </div>
            <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 ml-3 flex-shrink-0 ${isAnimalCost ? 'bg-primary-800' : 'bg-surface-input'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isAnimalCost ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : 'Save Changes'}
        </button>
      </form>
    </Layout>
  );
}
