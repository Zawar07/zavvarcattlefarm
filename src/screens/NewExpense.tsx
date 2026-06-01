'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { todayISO } from '../utils/format';

export default function NewExpense() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories').then(r => r.data),
  });

  const selectedCategoryName = (categories as { id: number; name: string }[])
    .find(c => String(c.id) === categoryId)?.name || '';

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('category_id', categoryId);
      formData.append('sub_category', subCategory);
      formData.append('expense_date', date);
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
          <label className="flex items-center gap-3 cursor-pointer bg-gray-800 border border-gray-700 border-dashed rounded-xl px-4 py-3 hover:border-primary-600 transition-colors">
            <span className="text-2xl">📎</span>
            <div className="flex-1">
              {receipt ? (
                <span className="text-white text-sm">{receipt.name}</span>
              ) : (
                <span className="text-gray-500 text-sm">Attach image or PDF (max 10MB)</span>
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
              className="text-red-400 text-xs mt-1 hover:text-red-300"
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
