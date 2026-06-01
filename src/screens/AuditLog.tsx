'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../api/axios';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-400',
  UPDATE: 'text-blue-400',
  DELETE: 'text-red-400',
  SELL: 'text-yellow-400',
  SETTLE: 'text-purple-400',
  PROCESS_PAYROLL: 'text-orange-400',
};

export default function AuditLog() {
  const { user } = useAuth();
  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (user && user.role !== 'super_admin') router.replace('/');
  }, [user, router]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      params.set('limit', '100');
      return api.get(`/audit?${params}`).then(r => r.data);
    },
  });

  return (
    <Layout title="Audit Log" showBack showViewToggle={false}>
      <div className="p-4 space-y-4">
        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Log Entries */}
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
        ) : logs?.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No audit entries found</div>
        ) : (
          <div className="space-y-2">
            {logs?.map((log: {
              id: string; action: string; entity_type: string;
              user_name: string; performed_at: string; entity_id?: string;
            }) => (
              <div key={log.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${ACTION_COLORS[log.action] || 'text-gray-300'}`}>
                        {log.action}
                      </span>
                      <span className="badge bg-gray-700 text-gray-400 text-xs">{log.entity_type}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">by {log.user_name}</p>
                  </div>
                  <span className="text-gray-600 text-xs whitespace-nowrap">{formatDate(log.performed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
