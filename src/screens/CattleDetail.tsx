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

export default function CattleDetail() {
  const id = useParams()?.id as string;
  const queryClient = useQueryClient();
  const [showSellForm, setShowSellForm] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(todayISO());
  const [error, setError] = useState('');

  const { data: cattle, isLoading } = useQuery({
    queryKey: ['cattle', id],
    queryFn: () => api.get(`/cattle/${id}`).then(r => r.data),
  });

  const sellMutation = useMutation({
    mutationFn: () => api.patch(`/cattle/${id}/sell`, {
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
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to record sale.');
    },
  });

  const handleSell = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!salePrice || parseFloat(salePrice) <= 0) { setError('Valid sale price required.'); return; }
    sellMutation.mutate();
  };

  if (isLoading) return (
    <Layout title="Cattle" showBack><div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div></Layout>
  );

  if (!cattle) return (
    <Layout title="Cattle" showBack><div className="p-4 text-gray-500">Record not found.</div></Layout>
  );

  const profitLoss = cattle.is_sold ? parseFloat(cattle.sale_price) - parseFloat(cattle.purchase_price) : null;

  return (
    <Layout title="Cattle Detail" showBack>
      <div className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Header */}
        <div className="card text-center py-6">
          <div className="text-5xl mb-3">{cattle.animal_type === 'bull' ? '🐂' : '🐄'}</div>
          <h2 className="text-xl font-bold text-white capitalize">{cattle.animal_type}</h2>
          <span className={`badge mt-2 ${cattle.is_sold ? 'bg-gray-700 text-gray-400' : 'bg-green-900/50 text-green-400'}`}>
            {cattle.is_sold ? 'Sold' : 'Active'}
          </span>
        </div>

        {/* Details */}
        <div className="card space-y-3">
          <Row label="Purchase Price">
            <CurrencyDisplay farmValue={parseFloat(cattle.purchase_price)} className="text-white font-medium" />
          </Row>
          <Row label="Purchase Date" value={formatDate(cattle.purchase_date)} />
          {cattle.description && <Row label="Description" value={cattle.description} />}
          <Row label="Recorded by" value={cattle.recorded_by_name} />
        </div>

        {/* Sale Info */}
        {cattle.is_sold && (
          <div className="card space-y-3">
            <h3 className="text-gray-400 text-sm font-medium">Sale Details</h3>
            <Row label="Sale Price">
              <CurrencyDisplay farmValue={parseFloat(cattle.sale_price)} className="text-white font-medium" />
            </Row>
            <Row label="Sale Date" value={formatDate(cattle.sale_date)} />
            <Row label="Profit / Loss">
              <span className={`font-semibold ${profitLoss! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profitLoss! >= 0 ? '+' : ''}PKR {Math.round(profitLoss!).toLocaleString('en-IN')}
              </span>
            </Row>
          </div>
        )}

        {/* Sell Form */}
        {!cattle.is_sold && (
          <div>
            {!showSellForm ? (
              <button onClick={() => setShowSellForm(true)} className="btn-primary">
                💰 Record Sale
              </button>
            ) : (
              <form onSubmit={handleSell} className="card space-y-4">
                <h3 className="text-white font-semibold">Record Sale</h3>
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
                  <button type="button" onClick={() => setShowSellForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={sellMutation.isPending}>
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

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-sm">{label}</span>
      {children || <span className="text-white text-sm">{value}</span>}
    </div>
  );
}
