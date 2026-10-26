import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StatsSection } from '../components/dashboard/StatsSection';
import { NearestExpiryCard } from '../components/dashboard/NearestExpiryCard';
import { ExpiryBucketsCard } from '../components/dashboard/ExpiryBucketsCard';
import { RecentActivitiesCard } from '../components/dashboard/RecentActivitiesCard';
import { UserDashboardView } from '../components/dashboard/UserDashboardView';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardError } from '../components/dashboard/DashboardError';
import { IconRefresh, IconShield, IconCertificate, IconUser } from '../components/icons/Icons';
import { Button } from '../components/ui/Button';
import { fetchAdminDashboard, fetchUserDashboard } from '../services/dashboard';
import { getAuthUser } from '../services/api';
import type { DashboardAdminData, DashboardUserData } from '../types/dashboard';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  viewMode?: 'admin' | 'user';
}

export function DashboardPage({ onNavigate, viewMode = 'admin' }: DashboardPageProps) {
  const authUser = getAuthUser();
  const isUserView = authUser?.role === 'USER' || (authUser?.role === 'ADMIN' && viewMode === 'user');

  const [adminData, setAdminData] = useState<DashboardAdminData | null>(null);
  const [userData, setUserData] = useState<DashboardUserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const startTime = Date.now();
    try {
      if (isUserView) {
        const result = await fetchUserDashboard();
        setUserData(result);
      } else {
        const result = await fetchAdminDashboard();
        setAdminData(result);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data dashboard.');
    } finally {
      if (isManualRefresh) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 700 - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
        }, delay);
      } else {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isUserView]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const currentRole = authUser?.role;
  const dashboardTitle = isUserView
    ? 'DASHBOARD USER'
    : currentRole === 'SUPER_ADMIN'
    ? 'DASHBOARD SUPER ADMIN'
    : 'DASHBOARD ADMIN';

  // Konfigurasi animasi dan dialog refresh sesuai role
  let refreshRoleConfig = {
    title: 'Menyegarkan Dashboard Pengguna',
    subtitle: 'Memperbarui status sertifikat dan informasi akun Anda...',
    iconWrapClass: 'refresh-icon-user',
    progressClass: 'refresh-progress-user',
    icon: <IconCertificate size={28} aria-hidden="true" />,
  };

  if (currentRole === 'SUPER_ADMIN') {
    refreshRoleConfig = {
      title: 'Menyegarkan Dashboard Super Admin',
      subtitle: 'Memperbarui ringkasan sistem, sertifikat, dan data pengguna...',
      iconWrapClass: 'refresh-icon-superadmin',
      progressClass: 'refresh-progress-superadmin',
      icon: <IconShield size={28} aria-hidden="true" />,
    };
  } else if (currentRole === 'ADMIN') {
    if (viewMode === 'admin') {
      refreshRoleConfig = {
        title: 'Menyegarkan Dashboard Admin',
        subtitle: 'Memperbarui ringkasan sertifikat dan status pengguna aktif...',
        iconWrapClass: 'refresh-icon-admin',
        progressClass: 'refresh-progress-admin',
        icon: <IconShield size={28} aria-hidden="true" />,
      };
    } else {
      refreshRoleConfig = {
        title: 'Menyegarkan Dashboard Pengguna',
        subtitle: 'Memperbarui informasi sertifikat dalam mode pratinjau...',
        iconWrapClass: 'refresh-icon-user',
        progressClass: 'refresh-progress-user',
        icon: <IconUser size={28} aria-hidden="true" />,
      };
    }
  }

  if (error || (isUserView ? !userData : !adminData)) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <h1 className="page-title">{dashboardTitle}</h1>
          <p className="page-subtitle">
            {isUserView ? 'Ringkasan sertifikat dan informasi akun.' : 'Ringkasan sertifikat dan pengguna.'}
          </p>
        </div>
        <DashboardError
          message={error || 'Data dashboard tidak tersedia.'}
          onRetry={() => loadDashboard(true)}
          isRetrying={loading || isRefreshing}
        />
      </div>
    );
  }

  const data = adminData;

  return (
    <>
      {isUserView && userData ? (
        <UserDashboardView
          data={userData}
          onNavigate={onNavigate}
          onRefresh={() => loadDashboard(true)}
          isRefreshing={isRefreshing}
        />
      ) : data ? (
        <div className={`dashboard-page ${isRefreshing ? 'dashboard-refreshing-content' : 'dashboard-revealed'}`}>
          {/* Page Header */}
          <div className="page-header-row">
            <div className="page-header">
              <h1 className="page-title">{dashboardTitle}</h1>
              <p className="page-subtitle">Ringkasan sertifikat dan pengguna.</p>
            </div>
            <div className="page-header-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadDashboard(true)}
                disabled={isRefreshing}
                icon={<IconRefresh size={16} className={isRefreshing ? 'spin-animation' : ''} />}
                aria-label="Segarkan data dashboard"
              >
                {isRefreshing ? 'Menyegarkan...' : 'Segarkan'}
              </Button>
            </div>
          </div>

          {/* 1. Statistics Cards (Total User, Active, Expired) */}
          <StatsSection
            statistics={data.statistics}
            onCardClick={() => onNavigate('/users')}
          />

          {/* 2. Expiry Section (Nearest Expiry & Buckets Side-by-Side) */}
          <section className="dashboard-expiry-grid" aria-label="Informasi Masa Berlaku Sertifikat">
            <NearestExpiryCard
              expiringUsers={data.expiring_certificates}
              onViewUsers={() => onNavigate('/users')}
              onSelectUser={(userId) => onNavigate(`/users/${userId}?tab=certificate`)}
            />
            <ExpiryBucketsCard buckets={data.expiry_buckets} />
          </section>

          {/* 3. Recent Activities (Max 6 from API) */}
          <section className="dashboard-activities-section" aria-label="Riwayat Aktivitas Terbaru">
            <RecentActivitiesCard
              activities={data.recent_activities}
              onViewAll={() => onNavigate('/audit-log')}
            />
          </section>
        </div>
      ) : null}

      {/* Role-tailored Refresh Transition Overlay */}
      {isRefreshing &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="mode-switch-overlay refresh-transition-overlay" role="status" aria-live="polite">
            <div className="mode-switch-card refresh-transition-card">
              <div className={`mode-switch-icon-wrap ${refreshRoleConfig.iconWrapClass}`}>
                {refreshRoleConfig.icon}
              </div>
              <div className="mode-switch-texts">
                <h3 className="mode-switch-title">{refreshRoleConfig.title}</h3>
                <p className="mode-switch-subtext">{refreshRoleConfig.subtitle}</p>
              </div>
              <div className="mode-switch-progress-bar">
                <div className={`mode-switch-progress-fill refresh-progress-fill ${refreshRoleConfig.progressClass}`} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
