import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { GeneratePage } from './pages/GeneratePage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AccountPage } from './pages/AccountPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SigningPage } from './pages/SigningPage';
import { AppShell } from './components/layout/AppShell';
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
    navigateTo('/dashboard');
  };

  const handleLogout = () => {
    setSessionNotice(null);
    clearAuthSession();
    setIsAuthenticated(false);
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

  const renderContent = () => {
    const path = normalizePath(currentPath);

    if (path === '/dashboard') {
      return <DashboardPage onNavigate={navigateTo} />;
    }

    if (path === '/users') {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <UsersPage onNavigate={navigateTo} />;
    }

    if (path.startsWith('/users/')) {
      const userId = path.slice(7);
      if (!userId) {
        return <UsersPage onNavigate={navigateTo} />;
      }
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <UserDetailPage userId={userId} onNavigate={navigateTo} />;
    }

    if (path === '/generate') {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
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
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <AuditLogsPage onNavigate={navigateTo} />;
    }

    if (path === '/account') {
      return <AccountPage onNavigate={navigateTo} />;
    }

    if (path === '/signing') {
      if (currentRole === 'SUPER_ADMIN') {
        return <ForbiddenPage onNavigate={navigateTo} />;
      }
      return <SigningPage onNavigate={navigateTo} />;
    }

    // Fallback 404 for unknown authenticated routes, preserving sidebar & topbar
    return <NotFoundPage onNavigate={navigateTo} />;
  };

  return (
    <AppShell
      currentPath={currentPath}
      onNavigate={navigateTo}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AppShell>
  );
}
