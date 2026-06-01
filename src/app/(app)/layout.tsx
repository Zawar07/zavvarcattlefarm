'use client';

export const dynamic = 'force-dynamic';

import AuthGuard from '@/components/AuthGuard';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { useAuth } from '@/context/AuthContext';

function InactivityWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useInactivityTimer(!!user);
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <InactivityWrapper>{children}</InactivityWrapper>
    </AuthGuard>
  );
}
