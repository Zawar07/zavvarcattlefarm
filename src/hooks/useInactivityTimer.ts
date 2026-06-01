import { useEffect, useRef } from 'react';
import api from '../api/axios';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useInactivityTimer(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await api.post('/auth/logout').catch(() => {});
        sessionStorage.clear();
        window.location.href = '/login';
      }, TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled]);
}
