'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import CurrencyDisplay from '../components/CurrencyDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../api/axios';
import { currentMonth } from '../utils/format';

export default function Reports() {
  const [type, setType] = useState<'monthly' | 'weekly'>('monthly');
  const [month, setMonth] = useState(currentMonth());
  const [week, setWeek] = useState('');

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['report', type, month, week],
    queryFn: () => {
      const params = type === 'monthly' ? `type=monthly&month=${month}` : `type=weekly&week=${week}`;
      return api.get(`/reports?${params}`).then((r) => r.data);
    },
    enabled: false,
  });

  const handleDownloadPDF = () => {
    const params =
      type === 'monthly'
        ? `type=monthly&month=${month}&pdf=1`
        : `type=weekly&week=${week}&pdf=1`;
    window.open(`/api/reports?${params}`, '_blank');
  };

  return (
    <Layout title="Reports">
      <div className="p-4 space-y-4">
        {/* Type Toggle */}
        <div className="flex gap-2">
          {(['monthly', 'weekly'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium min-h-[36px] transition-colors ${
                type === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t === 'monthly' ? '📅 Monthly' : '📆 Weekly'}
            </button>
          ))}
        </div>

        {/* Period Selector */}
        {type === 'monthly' ? (
          <div>
            <label className="label">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          </div>
        ) : (
          <div>
            <label className="label">Week (YYYY-WNN)</label>
            <input type="week" value={week} onChange={e => setWeek(e.target.value)} className="input-field" />
          </div>
        )}

        <button onClick={() => refetch()} className="btn-primary">
          {isLoading ? <LoadingSpinner size="sm" /> : '📊 Generate Report'}
        </button>

        {/* Report Data */}
        {report && (
          <div className="space-y-4">
            {/* Bank Balance */}
            <div className="card">
              <h3 className="text-primary-400 font-semibold mb-3">💳 Bank Balance</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Opening</span>
                <CurrencyDisplay farmValue={report.bank_balance?.opening || 0} className="text-white font-medium" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Closing</span>
                <CurrencyDisplay farmValue={report.bank_balance?.closing || 0} className="text-white font-medium" />
              </div>
            </div>

            {/* Expenses by Category */}
            <div className="card">
              <h3 className="text-primary-400 font-semibold mb-3">💸 Expenses by Category</h3>
              {report.expenses_by_category?.length === 0 ? (
                <p className="text-gray-500 text-sm">No expenses</p>
              ) : (
                <div className="space-y-2">
                  {report.expenses_by_category?.map((e: { category: string; total: string }) => (
                    <div key={e.category} className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">{e.category}</span>
                      <CurrencyDisplay farmValue={parseFloat(e.total)} className="text-white font-medium text-sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cattle */}
            <div className="card">
              <h3 className="text-primary-400 font-semibold mb-3">🐄 Cattle Transactions</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Purchases ({report.cattle?.purchases?.count})</span>
                  <CurrencyDisplay farmValue={report.cattle?.purchases?.total || 0} className="text-red-400 text-sm font-medium" />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Sales ({report.cattle?.sales?.count})</span>
                  <CurrencyDisplay farmValue={report.cattle?.sales?.total || 0} className="text-green-400 text-sm font-medium" />
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-gray-400 text-sm">Net Profit/Loss</span>
                  <span className={`text-sm font-semibold ${(report.cattle?.sales?.net_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <CurrencyDisplay farmValue={Math.abs(report.cattle?.sales?.net_profit || 0)} />
                  </span>
                </div>
              </div>
            </div>

            {/* Partner Shares */}
            <div className="card">
              <h3 className="text-primary-400 font-semibold mb-3">👥 Partner Shares</h3>
              <div className="space-y-2">
                {report.partner_shares?.map((p: { name: string; total_share: string }) => (
                  <div key={p.name} className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">{p.name}</span>
                    <CurrencyDisplay farmValue={parseFloat(p.total_share)} className="text-white font-medium text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Payroll */}
            {report.payroll?.length > 0 && (
              <div className="card">
                <h3 className="text-primary-400 font-semibold mb-3">👷 Payroll</h3>
                <div className="space-y-2">
                  {report.payroll?.map((p: { name: string; base_salary: string; total_expenses: string; total_cost: string }) => (
                    <div key={p.name} className="py-2 border-b border-gray-800 last:border-0">
                      <div className="flex justify-between">
                        <span className="text-white text-sm font-medium">{p.name}</span>
                        <CurrencyDisplay farmValue={parseFloat(p.total_cost)} className="text-primary-400 font-semibold text-sm" />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-500 text-xs">Salary + Expenses</span>
                        <span className="text-gray-500 text-xs">
                          PKR {Math.round(parseFloat(p.base_salary)).toLocaleString('en-IN')} + PKR {Math.round(parseFloat(p.total_expenses)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download PDF */}
            <button onClick={handleDownloadPDF} className="btn-secondary">
              📥 Download PDF Report
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
