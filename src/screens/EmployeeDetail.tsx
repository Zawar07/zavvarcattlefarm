'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatDate, formatPKR, currentMonth, todayISO } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const EXP_CATEGORIES = ['food', 'transport', 'other'];

export default function EmployeeDetail() {
  const id = useParams()?.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [showExpForm, setShowExpForm] = useState(false);
  const [expCategory, setExpCategory] = useState('food');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(todayISO());
  const [expDesc, setExpDesc] = useState('');
  const [error, setError] = useState('');

  const { data: payroll, isLoading } = useQuery({
    queryKey: ['payroll', id, month],
    queryFn: () => api.get(`/employees/${id}/payroll?month=${month}`).then(r => r.data),
  });

  const addExpMutation = useMutation({
    mutationFn: () => api.post(`/employees/${id}/expenses`, {
      category: expCategory,
      amount: parseFloat(expAmount),
      expense_date: expDate,
      description: expDesc || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', id, month] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      setShowExpForm(false);
      setExpAmount('');
      setExpDesc('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to add expense.');
    },
  });

  const payrollMutation = useMutation({
    mutationFn: () => api.post(`/employees/${id}/payroll`, { month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', id, month] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to process payroll.');
    },
  });

  const handleAddExp = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!expAmount || parseFloat(expAmount) <= 0) { setError('Valid amount required.'); return; }
    addExpMutation.mutate();
  };

  if (isLoading) return (
    <Layout title="Employee" showBack><div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div></Layout>
  );

  const emp = payroll?.employee;

  return (
    <Layout title={emp?.name || 'Employee'} showBack>
      <div className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Month Selector */}
        <div>
          <label className="label">Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Payroll Summary */}
        <div className="card space-y-3">
          <h3 className="text-gray-400 text-sm font-medium">Monthly Summary</h3>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Base Salary</span>
            <CurrencyDisplay farmValue={payroll?.base_salary || 0} className="text-white font-medium" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Additional Expenses</span>
            <CurrencyDisplay farmValue={payroll?.total_expenses || 0} className="text-orange-400 font-medium" />
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
            <span className="text-white font-semibold">Total Cost</span>
            <CurrencyDisplay farmValue={payroll?.total_cost || 0} className="text-primary-400 font-bold text-lg" />
          </div>
          {payroll?.payroll_processed && (
            <div className="bg-green-900/30 border border-green-800 rounded-xl px-3 py-2 text-green-400 text-sm text-center">
              ✅ Payroll processed on {formatDate(payroll.payroll_processed.processed_at)}
            </div>
          )}
        </div>

        {/* Expenses List */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-400 text-sm font-medium">Expenses ({payroll?.expenses?.length || 0})</h3>
            <button
              onClick={() => setShowExpForm(v => !v)}
              className="text-primary-400 text-sm min-h-[44px] min-w-[44px] flex items-center justify-end"
            >
              + Add
            </button>
          </div>

          {showExpForm && (
            <form onSubmit={handleAddExp} className="space-y-3 mb-4 pb-4 border-b border-gray-700">
              <div>
                <label className="label">Category</label>
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="input-field">
                  {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount (PKR) *</label>
                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" className="input-field" inputMode="numeric" min="1" required />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Details..." className="input-field" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowExpForm(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm" disabled={addExpMutation.isPending}>
                  {addExpMutation.isPending ? <LoadingSpinner size="sm" /> : 'Save'}
                </button>
              </div>
            </form>
          )}

          {payroll?.expenses?.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-2">No expenses this month</p>
          ) : (
            <div className="space-y-2">
              {payroll?.expenses?.map((exp: { id: string; category: string; amount: string; expense_date: string; description?: string }) => (
                <div key={exp.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="badge bg-gray-700 text-gray-300 capitalize">{exp.category}</span>
                    {exp.description && <p className="text-gray-400 text-xs mt-0.5">{exp.description}</p>}
                    <p className="text-gray-500 text-xs">{formatDate(exp.expense_date)}</p>
                  </div>
                  <span className="text-white font-medium text-sm">{formatPKR(parseFloat(exp.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Process Payroll */}
        {user?.role === 'super_admin' && !payroll?.payroll_processed && (
          <button
            onClick={() => payrollMutation.mutate()}
            disabled={payrollMutation.isPending}
            className="btn-primary"
          >
            {payrollMutation.isPending ? <LoadingSpinner size="sm" /> : `Process Payroll for ${month}`}
          </button>
        )}
      </div>
    </Layout>
  );
}
