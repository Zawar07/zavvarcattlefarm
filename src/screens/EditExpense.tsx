'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatDate } from '../utils/format';

export default function EditExpense() {
  const id = useParams()?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
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
      setAmount(String(expense.amount));
      setDate(expense.expense_date?.split('T')[0] || expense.expense_date);
      setDescription(expense.description || '');
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/expenses/${id}`, {
      category_id: parseInt(categoryId),
      sub_category: subCategory,
      amount: parseFloat(amount),
      expense_date: date,
      description: description || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      router.push(`/expenses/${id}`);
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
          <div className="card bg-gray-800/50 text-xs text-gray-500">
            Originally added {formatDate(expense.created_at)} by {expense.recorded_by_name}
          </div>
        )}

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
            placeholder="e.g. Generator Fuel"
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

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input-field resize-none"
            rows={3}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : 'Save Changes'}
        </button>
      </form>
    </Layout>
  );
}
