import { useState, useEffect, useCallback } from 'react';
import { StatsSection } from '../components/dashboard/StatsSection';
import { NearestExpiryCard } from '../components/dashboard/NearestExpiryCard';
import { ExpiryBucketsCard } from '../components/dashboard/ExpiryBucketsCard';
import { RecentActivitiesCard } from '../components/dashboard/RecentActivitiesCard';
import { UserDashboardView } from '../components/dashboard/UserDashboardView';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardError } from '../components/dashboard/DashboardError';
import { IconRefresh } from '../components/icons/Icons';
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
        const delay = Math.max(0, 650 - elapsed);
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

  const dashboardTitle = isUserView
    ? 'Dashboard User'
    : authUser?.role === 'SUPER_ADMIN'
    ? 'Dashboard Super Admin'
    : 'Dashboard Admin';

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
          onRetry={() => loadDashboard()}
          isRetrying={loading}
        />
      </div>
    );
  }

  // 1. User View (Role USER atau ADMIN pada Mode Pengguna)
  if (isUserView && userData) {
    return (
      <UserDashboardView
        data={userData}
        onNavigate={onNavigate}
        onRefresh={() => loadDashboard(true)}
        isRefreshing={isRefreshing}
      />
    );
  }

  // 2. Role ADMIN & SUPER_ADMIN View
  const data = adminData!;

  return (
    <div className="dashboard-page">
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
            Segarkan
          </Button>
        </div>
      </div>

      {/* 1. Statistics Cards (Total User, Active, Expired) */}
      <StatsSection statistics={data.statistics} />

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
  );
}
