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
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AppShell } from './components/layout/AppShell';
import { getAuthToken, getAuthUser, clearAuthSession } from './services/api';

export default function App() {
  // Path state initialized from browser window.location.pathname
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const p = window.location.pathname;
      return p === '/' ? '/dashboard' : p;
    }
    return '/dashboard';
  });

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return false;
    }
    const token = getAuthToken();
    return !!token;
  });

  // Handle browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/dashboard';
      if (path === '/login') {
        setIsAuthenticated(false);
      } else {
        const token = getAuthToken();
        setIsAuthenticated(!!token);
      }
      setCurrentPath(path === '/' ? '/dashboard' : path);
    };

    const handleUnauthorized = () => {
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
    if (path === '/login') {
      setIsAuthenticated(false);
    }
  };

  const handleLoginSuccess = (_email: string) => {
    setIsAuthenticated(true);
    navigateTo('/dashboard');
  };

  const handleLogout = () => {
    clearAuthSession();
    setIsAuthenticated(false);
    navigateTo('/login');
  };

  if (!isAuthenticated || currentPath === '/login') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const authUser = getAuthUser();
  const currentRole = authUser?.role || 'USER';

  const renderContent = () => {
    if (currentPath === '/dashboard') {
      return <DashboardPage onNavigate={navigateTo} />;
    }

    if (currentPath === '/users') {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return (
          <ForbiddenPage
            onNavigate={navigateTo}
            message="Halaman Pengguna hanya dapat diakses oleh Administrator."
          />
        );
      }
      return <UsersPage onNavigate={navigateTo} />;
    }

    if (currentPath.startsWith('/users/')) {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return (
          <ForbiddenPage
            onNavigate={navigateTo}
            message="Halaman Detail Pengguna hanya dapat diakses oleh Administrator."
          />
        );
      }
      const userId = currentPath.replace('/users/', '').split('?')[0].split('#')[0];
      return <UserDetailPage userId={userId} onNavigate={navigateTo} />;
    }

    if (currentPath === '/generate') {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return (
          <ForbiddenPage
            onNavigate={navigateTo}
            message="Halaman Generate User & Sertifikat hanya dapat diakses oleh Administrator."
          />
        );
      }
      return <GeneratePage onNavigate={navigateTo} />;
    }

    if (currentPath === '/admins') {
      if (currentRole !== 'SUPER_ADMIN') {
        return (
          <ForbiddenPage
            onNavigate={navigateTo}
            message="Halaman Management Admin hanya dapat diakses oleh Super Admin."
          />
        );
      }
      return <AdminsPage onNavigate={navigateTo} />;
    }

    if (currentPath === '/audit-log' || currentPath === '/audit-logs') {
      if (currentRole !== 'SUPER_ADMIN' && currentRole !== 'ADMIN') {
        return (
          <ForbiddenPage
            onNavigate={navigateTo}
            message="Halaman Audit Log hanya dapat diakses oleh Administrator."
          />
        );
      }
      return <AuditLogsPage onNavigate={navigateTo} />;
    }

    if (currentPath === '/account') {
      return <AccountPage onNavigate={navigateTo} />;
    }

    if (currentPath === '/signing') {
      return (
        <PlaceholderPage
          title="Penandatanganan"
          subtitle="Modul penandatanganan dokumen PDF digital (Reserved for Phase 2)."
          iconName="signing"
          isReserved={true}
        />
      );
    }

    // Fallback default
    return <DashboardPage onNavigate={navigateTo} />;
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
