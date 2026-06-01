'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import logo1 from '../assets/ZCF1.png';
import logo2 from '../assets/ZCF2.png';

const PHONE_REGEX = /^03\d{9}$/;

function ArrowRightIcon() {
  return (
    <svg width="14.17" height="14.17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!PHONE_REGEX.test(phone)) {
      setError('Phone number must be in format 03XXXXXXXXX (11 digits)');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      await login(phone, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Invalid phone number or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-page flex flex-col items-center justify-between px-4 py-8 max-w-[480px] mx-auto">

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-12 flex-1 justify-center">

        {/* Logo — contained inside rounded box */}
        <div className="flex justify-center">
          <div className="rounded-2xl overflow-hidden shadow-lg" style={{ width: 256, height: 163 }}>
            <img
              src={logo1.src}
              alt="Zavvar Cattle Farm"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Login Form Card */}
        <div className="w-full card border border-surface-border shadow-lg px-8 py-10 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div
                className="rounded px-4 py-3 text-sm text-center border"
                style={{ background: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' }}
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Username / Phone */}
            <div className="space-y-2">
              <label htmlFor="phone" className="label">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Enter your farm ID"
                className="input-field"
                inputMode="numeric"
                maxLength={11}
                autoComplete="username"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-12"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink min-w-[44px] min-h-[44px] flex items-center justify-center"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="btn-primary shadow-btn text-xl font-semibold"
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Log In
                  <ArrowRightIcon />
                </>
              )}
            </button>

            {/* Forgot password */}
            <div className="text-center">
              <button
                type="button"
                className="text-xs font-semibold tracking-wider text-ink-brand hover:underline min-h-[44px]"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>

        {/* Decorative farm image */}
        <div className="w-full rounded-lg overflow-hidden relative shadow-card border border-surface-border" style={{ height: 200 }}>
          <img
            src={logo2.src}
            alt="Zavvar Cattle Farm"
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(0deg, rgba(1,45,29,0.4) 0%, rgba(1,45,29,0) 100%)' }}
          />
          {/* Text overlay */}
          <div className="absolute bottom-4 left-4">
            <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">Farm Status</p>
            <p className="text-xl font-semibold text-white">Optimal Growth</p>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="w-full border-t border-surface-border mt-8 pt-6 space-y-2 text-center bg-surface-subtle rounded-t-lg px-4 pb-4">
        <p className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
          Personalized Farm Management for Pakistan
        </p>
        <p className="text-[10px] tracking-widest text-ink-muted uppercase">
          © {new Date().getFullYear()} Zavvar Cattle Farm Solutions
        </p>
      </footer>
    </div>
  );
}
