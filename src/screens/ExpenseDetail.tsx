'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import ReceiptImageViewer from '../components/ReceiptImageViewer';
import api from '../api/axios';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { proxiedBlobUrl } from '../utils/blobUrl';

export default function ExpenseDetail() {
  const id = useParams()?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      router.push('/expenses');
    },
  });

  if (isLoading) return (
    <Layout title="Expense" showBack showViewToggle={false}>
      <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
    </Layout>
  );

  if (!expense) return (
    <Layout title="Expense" showBack showViewToggle={false}>
      <div className="p-4 text-ink-muted">Expense not found.</div>
    </Layout>
  );

  const hoursSince = (Date.now() - new Date(expense.created_at).getTime()) / 3600000;
  const canEdit = user?.role === 'super_admin' || hoursSince <= 24;
  const canDelete = user?.role === 'super_admin';
  const receiptUrl = expense.receipt_image_path
    ? proxiedBlobUrl(expense.receipt_image_path)
    : null;
  const isPdf = receiptUrl?.endsWith('.pdf');
  const isAnimalCost: boolean = expense.is_animal_cost !== false;

  return (
    <Layout title="Expense Detail" showBack showViewToggle={false}>
      <div className="p-4 space-y-4">

        {/* ── Amount header ──────────────────────────────────── */}
        <div className="card text-center py-6 space-y-1">
          <CurrencyDisplay farmValue={parseFloat(expense.amount)} className="text-3xl font-bold text-primary-950 block" />
          <p className="text-ink-secondary text-sm">{formatDate(expense.expense_date)}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
            isAnimalCost ? 'bg-primary-100 text-primary-800' : 'bg-surface-input text-ink-muted'
          }`}>
            {isAnimalCost ? '🐄 Animal Cost' : '🏚️ Farm Cost'}
          </span>
        </div>

        {/* ── Details ────────────────────────────────────────── */}
        <div className="card space-y-3">
          <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">Details</p>
          <Row label="Category" value={expense.category_name} />
          <Row label="Sub-Category" value={expense.sub_category} />
          {expense.description && <Row label="Description" value={expense.description} />}
          <Row label="Recorded by" value={expense.recorded_by_name} />
          <Row label="Added on" value={formatDate(expense.created_at)} />
        </div>

        {/* ── Partner Shares ─────────────────────────────────── */}
        {expense.partner_shares?.length > 0 && (
          <div className="card space-y-3">
            <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">Partner Shares (1/3 each)</p>
            <div className="space-y-2">
              {expense.partner_shares.map((s: { partner_id: string; partner_name: string; share_amount: string }) => (
                <div key={s.partner_id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center text-primary-300 text-xs font-bold">
                      {s.partner_name[0]}
                    </div>
                    <span className="text-sm text-ink">{s.partner_name}</span>
                  </div>
                  <span className="text-primary-950 font-semibold text-sm">
                    PKR {Math.round(parseFloat(s.share_amount)).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Receipt ────────────────────────────────────────── */}
        {receiptUrl && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold tracking-wider uppercase text-ink-secondary">Receipt / Invoice</p>
            {isPdf ? (
              <button onClick={() => setShowReceipt(true)} className="flex items-center gap-2 text-primary-800 hover:text-primary-950 min-h-[44px]">
                <span className="text-2xl">📄</span> View PDF Receipt
              </button>
            ) : (
              <button onClick={() => setShowReceipt(true)} className="block w-full">
                <img src={receiptUrl} alt="Receipt" className="w-full rounded-lg object-contain bg-surface-muted max-h-64" />
                <p className="text-ink-muted text-xs mt-1 text-center">Tap to zoom</p>
              </button>
            )}
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="space-y-2">
          {canEdit && (
            <button onClick={() => router.push(`/expenses/${id}/edit`)} className="btn-secondary">
              ✏️ Edit Expense
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDelete(true)}
              className="w-full py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 font-medium min-h-[44px]"
            >
              🗑 Delete Expense
            </button>
          )}
        </div>
      </div>

      {showDelete && (
        <ConfirmDialog
          title="Delete Expense"
          message={`Delete this expense of PKR ${Math.round(parseFloat(expense.amount)).toLocaleString('en-IN')}? This will reverse the bank balance deduction.`}
          confirmLabel="Delete"
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDelete(false)}
          danger
        />
      )}

      {showReceipt && receiptUrl && (
        <ReceiptImageViewer url={receiptUrl} isPdf={isPdf} onClose={() => setShowReceipt(false)} />
      )}
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-ink-secondary shrink-0">{label}</span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  );
}
