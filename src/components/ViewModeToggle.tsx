'use client';

import { useEffect, useState } from 'react';
import { useViewMode } from '../context/ViewModeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

interface Partner { id: string; name: string; }

interface Props {
  /** When true, renders as a compact inline button (used in header) */
  compact?: boolean;
}

export default function ViewModeToggle({ compact }: Props) {
  const { mode, setMode, selectedPartnerId, setSelectedPartner } = useViewMode();
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (user?.role === 'super_admin' && mode === 'partner') {
      api.get('/users').then(r => setPartners(r.data)).catch(() => {});
    }
  }, [user, mode]);

  // Auto-select self for non-admin partners
  useEffect(() => {
    if (user && user.role !== 'super_admin' && mode === 'partner' && !selectedPartnerId) {
      setSelectedPartner(user.id, user.name);
    }
  }, [user, mode, selectedPartnerId, setSelectedPartner]);

  const partnerLabel = user?.role === 'super_admin'
    ? 'Partner View'
    : `Partner View (${user?.name?.split(' ')[0] ?? 'Me'})`;

  if (compact) {
    // Compact version shown in the header right slot
    return (
      <div className="flex items-center bg-surface-subtle rounded-xl p-1 gap-0.5">
        <button
          onClick={() => setMode('farm')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold tracking-wide transition-colors min-h-[32px] ${
            mode === 'farm'
              ? 'bg-surface-card text-ink shadow-card'
              : 'text-ink-secondary hover:text-ink'
          }`}
        >
          Farm View
        </button>
        <button
          onClick={() => setMode('partner')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold tracking-wide transition-colors min-h-[32px] ${
            mode === 'partner'
              ? 'bg-surface-card text-ink shadow-card'
              : 'text-ink-secondary hover:text-ink'
          }`}
        >
          {partnerLabel}
        </button>
      </div>
    );
  }

  // Full-width segmented control (used standalone)
  return (
    <div className="px-4 py-2 bg-surface-page border-b border-surface-border">
      <div className="flex bg-surface-subtle rounded-xl p-1 relative">
        {/* Sliding background */}
        <div
          className={`absolute top-1 bottom-1 w-1/2 bg-surface-card rounded-xl shadow-card transition-transform duration-200 ${
            mode === 'partner' ? 'translate-x-full' : 'translate-x-0'
          }`}
          style={{ width: 'calc(50% - 4px)', left: 4 }}
        />
        <button
          onClick={() => setMode('farm')}
          className={`relative flex-1 py-2 text-xs font-semibold tracking-wide transition-colors min-h-[36px] rounded-xl ${
            mode === 'farm' ? 'text-ink' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          Farm View
        </button>
        <button
          onClick={() => setMode('partner')}
          className={`relative flex-1 py-2 text-xs font-semibold tracking-wide transition-colors min-h-[36px] rounded-xl ${
            mode === 'partner' ? 'text-ink' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          {partnerLabel}
        </button>
      </div>

      {/* Super Admin partner selector */}
      {mode === 'partner' && user?.role === 'super_admin' && (
        <select
          value={selectedPartnerId || ''}
          onChange={e => {
            const p = partners.find(p => p.id === e.target.value);
            if (p) setSelectedPartner(p.id, p.name);
          }}
          className="mt-2 w-full bg-surface-card border border-surface-border text-ink text-sm rounded px-3 py-2 min-h-[40px]"
        >
          <option value="">Select partner</option>
          {partners.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
