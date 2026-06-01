'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ViewMode = 'farm' | 'partner';

interface ViewModeContextValue {
  mode: ViewMode;
  selectedPartnerId: string | null;
  selectedPartnerName: string | null;
  setMode: (mode: ViewMode) => void;
  setSelectedPartner: (id: string, name: string) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = 'zcf_view_mode';

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('farm');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'partner') setModeState('partner');
    setSelectedPartnerId(sessionStorage.getItem('zcf_partner_id'));
    setSelectedPartnerName(sessionStorage.getItem('zcf_partner_name'));
  }, []);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, m);
  };

  const setSelectedPartner = (id: string, name: string) => {
    setSelectedPartnerId(id);
    setSelectedPartnerName(name);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('zcf_partner_id', id);
      sessionStorage.setItem('zcf_partner_name', name);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        setModeState('farm');
        setSelectedPartnerId(null);
        setSelectedPartnerName(null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <ViewModeContext.Provider
      value={{ mode, selectedPartnerId, selectedPartnerName, setMode, setSelectedPartner }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}
