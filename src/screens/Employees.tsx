'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatPKR } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function Employees() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [salary, setSalary] = useState('');
  const [error, setError] = useState('');

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/employees', { name, base_salary: parseFloat(salary) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowAdd(false);
      setName('');
      setSalary('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to add employee.');
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !salary) { setError('Name and salary are required.'); return; }
    addMutation.mutate();
  };

  return (
    <Layout title="Staff & Payroll">
      <div className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Add Employee Form (Super Admin only) */}
        {user?.role === 'super_admin' && (
          <div>
            {!showAdd ? (
              <button onClick={() => setShowAdd(true)} className="btn-secondary">
                + Add Employee
              </button>
            ) : (
              <form onSubmit={handleAdd} className="card space-y-3">
                <h3 className="text-white font-semibold">New Employee</h3>
                <div>
                  <label className="label">Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Employee name" className="input-field" required />
                </div>
                <div>
                  <label className="label">Monthly Salary (PKR) *</label>
                  <input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0" className="input-field" inputMode="numeric" min="0" required />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={addMutation.isPending}>
                    {addMutation.isPending ? <LoadingSpinner size="sm" /> : 'Add'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Employee List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
        ) : employees?.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No employees yet</div>
        ) : (
          <div className="space-y-2">
            {employees?.map((emp: { id: string; name: string; base_salary: string; is_active: boolean }) => (
              <button
                key={emp.id}
                onClick={() => router.push(`/employees/${emp.id}`)}
                className="card w-full text-left hover:border-gray-700 active:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center text-primary-300 font-bold text-lg">
                      {emp.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{emp.name}</span>
                        {!emp.is_active && <span className="badge bg-gray-700 text-gray-400 text-xs">Inactive</span>}
                      </div>
                      <p className="text-gray-500 text-xs">Monthly Salary</p>
                    </div>
                  </div>
                  <span className="text-primary-400 font-semibold">{formatPKR(parseFloat(emp.base_salary))}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
