'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import ViewModeToggle from './ViewModeToggle';
import logo1 from '../assets/ZCF1.png';

// Figma bottom nav: Dashboard | Expenses | Inventory | Ledger
const NAV_TABS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: '/expenses',
    label: 'Expenses',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    path: '/cattle',
    label: 'Inventory',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/ledger',
    label: 'Ledger',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

const FINANCIAL_ROUTES = ['/', '/expenses', '/cattle', '/employees', '/ledger', '/reports'];

interface Props {
  children: React.ReactNode;
  title?: string;
  showViewToggle?: boolean;
  showBack?: boolean;
  /** Extra content rendered in the header right slot */
  headerRight?: React.ReactNode;
}

export default function Layout({ children, title, showViewToggle, showBack, headerRight }: Props) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isFinancial = FINANCIAL_ROUTES.some(
    (r) => pathname === r || (pathname?.startsWith(r + '/') ?? false),
  );
  const shouldShowToggle = showViewToggle !== undefined ? showViewToggle : isFinancial;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto bg-surface-page overflow-hidden">
      {/* ── Top AppBar ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-surface-page border-b border-surface-border safe-top z-40">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-secondary hover:text-ink -ml-2"
                aria-label="Go back"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : (
              <img src={logo1.src} alt="ZCF" className="h-12 object-contain" style={{ width: 75 }} />
            )}
            {title && (
              <span className="font-bold text-ink text-xl ml-1">{title}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {headerRight}
            {!headerRight && shouldShowToggle && <ViewModeToggle compact />}
            {!showBack && (
              <button
                onClick={handleLogout}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-secondary hover:text-status-loss transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Top Navigation Tabs ──────────────────────────────── */}
        {!showBack && (
          <nav
            className="flex items-center justify-around px-2 border-t border-surface-border"
            aria-label="Main navigation"
          >
            {NAV_TABS.map(tab => {
              const isActive = tab.path === '/'
                ? pathname === '/'
                : (pathname?.startsWith(tab.path) ?? false);
              return (
                <button
                  key={tab.path}
                  onClick={() => router.push(tab.path)}
                  className={`nav-tab flex-1 py-2 ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.icon(isActive)}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content — scrollable area below header */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </main>
    </div>
  );
}
