'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-surface-border border-t-primary-500 animate-spin" />
          <p className="text-ink-muted text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
