import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { GeneratePage } from './pages/GeneratePage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AccountPage } from './pages/AccountPage';
import type { AccountTab } from './pages/AccountPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SigningPage } from './pages/SigningPage';
import { AppShell } from './components/layout/AppShell';
import { FirstLoginPasswordModal } from './components/layout/FirstLoginPasswordModal';
import { getAuthToken, getAuthUser, clearAuthSession } from './services/api';

function normalizePath(rawPath: string): string {
  const clean = rawPath.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean || '/dashboard';
}

const KNOWN_PATHS = [
  '/',
  '/login',
  '/dashboard',
  '/users',
  '/generate',
  '/admins',
  '/audit-log',
  '/audit-logs',
  '/account',
  '/signing',
];

export default function App() {
  // Path state initialized from browser window.location.pathname
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const p = normalizePath(window.location.pathname);
      return p === '/' ? '/dashboard' : p;
    }
    return '/dashboard';
  });

  // Session expired notice banner state
  const [sessionNotice, setSessionNotice] = useState<{ title: string; message: string } | null>(null);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && normalizePath(window.location.pathname) === '/login') {
      return false;
    }
    const token = getAuthToken();
    return !!token;
  });

  // Mode state for Admin accounts ('admin' | 'user')
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ds_admin_view_mode');
      if (saved === 'user' || saved === 'admin') return saved;
    }
    return 'admin';
  });

  // Target tab when navigating to /account (e.g. 'password')
  const [accountInitialTab, setAccountInitialTab] = useState<AccountTab | undefined>(undefined);

  // Danger Alert pop up to update password when logging in
  const [showPasswordAlertModal, setShowPasswordAlertModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const user = getAuthUser();
      if (user && user.must_change_password && sessionStorage.getItem('ds_pwd_alert_dismissed') !== 'true') {
        return true;
      }
    }
    return false;
  });

  // Handle browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const path = normalizePath(window.location.pathname || '/dashboard');
      if (path === '/login') {
        setIsAuthenticated(false);
      } else {
        const token = getAuthToken();
        setIsAuthenticated(!!token);
      }
      setCurrentPath(path === '/' ? '/dashboard' : path);
    };

    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {
        title: 'Sesi Berakhir',
        message: 'Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.',
      };
      setSessionNotice(detail);
      setIsAuthenticated(false);
      navigateTo('/login');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const navigateTo = (path: string) => {
    if (normalizePath(path) !== '/account') {
      setAccountInitialTab(undefined);
    }
    setCurrentPath(path);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
    }
    if (normalizePath(path) === '/login') {
      setIsAuthenticated(false);
    }
  };

  const handleLoginSuccess = (_email: string) => {
    setSessionNotice(null);
    setIsAuthenticated(true);
    const user = getAuthUser();
    if (user && user.must_change_password) {
      setShowPasswordAlertModal(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ds_show_pwd_alert', 'true');
        sessionStorage.removeItem('ds_pwd_alert_dismissed');
      }
    } else {
      setShowPasswordAlertModal(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('ds_show_pwd_alert');
      }
    }
    navigateTo('/dashboard');
  };

  const handleLogout = () => {
    setSessionNotice(null);
    clearAuthSession();
    setIsAuthenticated(false);
    setShowPasswordAlertModal(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ds_show_pwd_alert');
      sessionStorage.removeItem('ds_pwd_alert_dismissed');
    }
    navigateTo('/login');
  };

  const isKnownRoute = (path: string): boolean => {
    const normalized = normalizePath(path);
    if (KNOWN_PATHS.includes(normalized)) return true;
    if (normalized.startsWith('/users/') && normalized.length > 7) return true;
    return false;
  };

  const activeNormalizedPath = normalizePath(currentPath);

  // If unauthenticated:
  if (!isAuthenticated) {
    // If accessing an unregistered/unknown route, show 404 Standalone Page
    if (!isKnownRoute(currentPath)) {
      return (
        <NotFoundPage
          isStandalone={true}
          onNavigate={(path) => {
            if (normalizePath(path) === '/dashboard') {
              navigateTo('/login');
            } else {
              navigateTo(path);
            }
          }}
        />
      );
    }

    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        sessionExpiredNotice={sessionNotice}
        onClearSessionNotice={() => setSessionNotice(null)}
      />
    );
  }

  // If authenticated but path is '/login', redirect to dashboard
  if (activeNormalizedPath === '/login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        sessionExpiredNotice={sessionNotice}
        onClearSessionNotice={() => setSessionNotice(null)}
      />
    );
  }

  const authUser = getAuthUser();
  const currentRole = authUser?.role || 'USER';

  // Effective view mode: SUPER_ADMIN is always 'admin', USER is always 'user', ADMIN follows state
  const effectiveViewMode: 'admin' | 'user' =
    currentRole === 'ADMIN' ? adminViewMode : currentRole === 'SUPER_ADMIN' ? 'admin' : 'user';

  const handleToggleViewMode = () => {
    if (currentRole !== 'ADMIN') return;
    const nextMode = effectiveViewMode === 'admin' ? 'user' : 'admin';
    setAdminViewMode(nextMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ds_admin_view_mode', nextMode);
    }
    // If switching to user mode and on an administrative page, route to /dashboard
    const p = normalizePath(currentPath);
    if (
      nextMode === 'user' &&
      (p === '/users' ||
        p.startsWith('/users/') ||
        p === '/generate' ||
        p === '/admins' ||
        p === '/audit-log' ||
        p === '/audit-logs')
    ) {
      navigateTo('/dashboard');
    }
    // If switching to admin mode and on /signing or /account, route to /dashboard
    if (nextMode === 'admin' && (p === '/signing' || p === '/account')) {
      navigateTo('/dashboard');
    }
  };

  const renderContent = () => {
    const path = normalizePath(currentPath);

    if (path === '/dashboard') {
      return <DashboardPage onNavigate={navigateTo} viewMode={effectiveViewMode} />;
    }

    if (path === '/users') {
      if (effectiveViewMode === 'user' || (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN')) {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <UsersPage onNavigate={navigateTo} />;
    }

    if (path.startsWith('/users/')) {
      const userId = path.slice(7);
      if (!userId) {
        return <UsersPage onNavigate={navigateTo} />;
      }
      if (effectiveViewMode === 'user' || (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN')) {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <UserDetailPage userId={userId} onNavigate={navigateTo} />;
    }

    if (path === '/generate') {
      if (effectiveViewMode === 'user' || (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN')) {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <GeneratePage onNavigate={navigateTo} />;
    }

    if (path === '/admins') {
      if (currentRole !== 'SUPER_ADMIN') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <AdminsPage onNavigate={navigateTo} />;
    }

    if (path === '/audit-log' || path === '/audit-logs') {
      if (effectiveViewMode === 'user' || (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN')) {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <AuditLogsPage onNavigate={navigateTo} />;
    }

    if (path === '/account') {
      if (currentRole === 'ADMIN' && effectiveViewMode === 'admin') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <AccountPage onNavigate={navigateTo} initialTab={accountInitialTab} />;
    }

    if (path === '/signing') {
      if (currentRole === 'SUPER_ADMIN' || effectiveViewMode === 'admin') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <SigningPage onNavigate={navigateTo} viewMode={effectiveViewMode} />;
    }

    // Fallback 404 for unknown authenticated routes, preserving sidebar & topbar
    return <NotFoundPage onNavigate={navigateTo} />;
  };

  const handleClosePasswordAlert = () => {
    setShowPasswordAlertModal(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ds_show_pwd_alert');
      sessionStorage.setItem('ds_pwd_alert_dismissed', 'true');
    }
  };

  const handleConfirmPasswordAlert = () => {
    setShowPasswordAlertModal(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ds_show_pwd_alert');
      sessionStorage.setItem('ds_pwd_alert_dismissed', 'true');
    }
    // Jika role ADMIN berada di Mode Admin, beralih ke Mode Pengguna karena Kelola Akun berada di Mode Pengguna
    if (currentRole === 'ADMIN' && effectiveViewMode === 'admin') {
      setAdminViewMode('user');
      if (typeof window !== 'undefined') {
        localStorage.setItem('ds_admin_view_mode', 'user');
      }
    }
    setAccountInitialTab('password');
    navigateTo('/account');
  };

  return (
    <>
      <AppShell
        currentPath={currentPath}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        viewMode={effectiveViewMode}
        onToggleViewMode={handleToggleViewMode}
      >
        {renderContent()}
      </AppShell>

      <FirstLoginPasswordModal
        isOpen={showPasswordAlertModal}
        onClose={handleClosePasswordAlert}
        onConfirm={handleConfirmPasswordAlert}
      />
    </>
  );
}
