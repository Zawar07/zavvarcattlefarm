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
      <div className="p-4 text-gray-500">Expense not found.</div>
    </Layout>
  );

  const hoursSince = (Date.now() - new Date(expense.created_at).getTime()) / 3600000;
  const canEdit = user?.role === 'super_admin' || hoursSince <= 24;
  const canDelete = user?.role === 'super_admin';
  const receiptUrl = expense.receipt_image_path
    ? expense.receipt_image_path.startsWith('http')
      ? expense.receipt_image_path
      : `/uploads/receipts/${expense.receipt_image_path}`
    : null;
  const isPdf = receiptUrl?.endsWith('.pdf');

  return (
    <Layout title="Expense Detail" showBack showViewToggle={false}>
      <div className="p-4 space-y-4">
        {/* Amount */}
        <div className="card bg-gradient-to-br from-gray-900 to-gray-950 text-center py-6">
          <CurrencyDisplay farmValue={parseFloat(expense.amount)} className="text-3xl font-bold text-white" />
          <p className="text-gray-400 text-sm mt-1">{formatDate(expense.expense_date)}</p>
        </div>

        {/* Details */}
        <div className="card space-y-3">
          <Row label="Category" value={expense.category_name} />
          <Row label="Sub-Category" value={expense.sub_category} />
          {expense.description && <Row label="Description" value={expense.description} />}
          <Row label="Recorded by" value={expense.recorded_by_name} />
          <Row label="Added on" value={formatDate(expense.created_at)} />
        </div>

        {/* Partner Shares */}
        {expense.partner_shares?.length > 0 && (
          <div className="card">
            <h3 className="text-gray-400 text-sm mb-3">Partner Shares (1/3 each)</h3>
            <div className="space-y-2">
              {expense.partner_shares.map((s: { partner_id: string; partner_name: string; share_amount: string }) => (
                <div key={s.partner_id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-primary-300 text-xs font-bold">
                      {s.partner_name[0]}
                    </div>
                    <span className="text-white text-sm">{s.partner_name}</span>
                  </div>
                  <span className="text-primary-400 font-medium text-sm">
                    PKR {Math.round(parseFloat(s.share_amount)).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipt */}
        {receiptUrl && (
          <div className="card">
            <h3 className="text-gray-400 text-sm mb-3">Receipt / Invoice</h3>
            {isPdf ? (
              <button onClick={() => setShowReceipt(true)} className="flex items-center gap-2 text-primary-400 hover:text-primary-300 min-h-[44px]">
                <span className="text-2xl">📄</span> View PDF Receipt
              </button>
            ) : (
              <button onClick={() => setShowReceipt(true)} className="block w-full">
                <img src={receiptUrl} alt="Receipt" className="w-full rounded-xl object-cover max-h-48" />
                <p className="text-gray-500 text-xs mt-1 text-center">Tap to zoom</p>
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {canEdit && (
            <button onClick={() => router.push(`/expenses/${id}/edit`)} className="btn-secondary">
              ✏️ Edit Expense
            </button>
          )}
          {canDelete && (
            <button onClick={() => setShowDelete(true)} className="w-full py-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 font-medium min-h-[44px]">
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
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}
