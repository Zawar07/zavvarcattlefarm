'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import ViewModeToggle from './ViewModeToggle';
import logo1 from '../assets/ZCF1.png';

// Figma bottom nav: Dashboard | Expenses | Inventory | Ledger
const NAV_TABS = [
  { path: '/',         label: 'Dashboard' },
  { path: '/expenses', label: 'Expenses'  },
  { path: '/cattle',   label: 'Inventory' },
  { path: '/ledger',   label: 'Ledger'    },
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
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-surface-page border-b border-surface-border safe-top z-40">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={() => router.back()}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-secondary hover:text-ink -ml-2"
              aria-label="Go back"
            >
              {/* chevron-left */}
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
          {/* View-mode toggle button shown in header when no custom right slot */}
          {!headerRight && shouldShowToggle && <ViewModeToggle compact />}
          {/* Logout — only show when no back button */}
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
      </header>

      {/* Main Content — scrollable area between header and nav */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: '4rem' }}
      >
        {children}
      </main>

      {/* ── Bottom Navigation Bar ──────────────────────────────── */}
      <nav
        className="flex-shrink-0 w-full bg-surface-page border-t border-surface-border safe-bottom z-40"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around px-4 h-11">
          {NAV_TABS.map(tab => {
            const isActive = tab.path === '/'
              ? pathname === '/'
              : (pathname?.startsWith(tab.path) ?? false);
            return (
              <button
                key={tab.path}
                onClick={() => router.push(tab.path)}
                className={`nav-tab flex-1 py-1 ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
