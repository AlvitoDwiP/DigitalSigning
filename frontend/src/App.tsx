import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { AppShell } from './components/layout/AppShell';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { getAuthToken, clearAuthSession } from './services/api';

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

  const renderContent = () => {
    if (currentPath === '/dashboard') {
      return <DashboardPage onNavigate={navigateTo} />;
    }
    if (currentPath === '/users') {
      return <UsersPage onNavigate={navigateTo} />;
    }
    if (currentPath.startsWith('/users/')) {
      return (
        <PlaceholderPage
          title="Detail Pengguna"
          subtitle="Informasi akun pengguna dan riwayat sertifikat X.509."
          iconName="users"
        />
      );
    }
    switch (currentPath) {
      case '/generate':
        return (
          <PlaceholderPage
            title="Generate"
            subtitle="Penerbitan single user certificate dan batch generate via CSV import."
            iconName="generate"
          />
        );
      case '/audit-logs':
        return (
          <PlaceholderPage
            title="Audit Log"
            subtitle="Riwayat aktivitas sistem yang aman dan append-only untuk kepatuhan keamanan."
            iconName="audit-logs"
          />
        );
      case '/signing':
        return (
          <PlaceholderPage
            title="Penandatanganan"
            subtitle="Modul penandatanganan dokumen PDF digital (Reserved)."
            iconName="signing"
            isReserved={true}
          />
        );
      default:
        return <DashboardPage onNavigate={navigateTo} />;
    }
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
