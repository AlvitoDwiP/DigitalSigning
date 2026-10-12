import { IconUsers, IconCertificate, IconAlertTriangle } from '../icons/Icons';
import type { DashboardStatistics } from '../../types/dashboard';

interface StatsSectionProps {
  statistics: DashboardStatistics;
}

export function StatsSection({ statistics }: StatsSectionProps) {
  return (
    <section className="dashboard-stats-grid" aria-label="Statistik Utama">
      {/* 1. Total User (Blue Accent) */}
      <div className="card stat-card stat-blue">
        <div className="stat-header">
          <div className="stat-icon-badge badge-blue" aria-hidden="true">
            <IconUsers size={22} />
          </div>
          <span className="stat-label">Total pengguna</span>
        </div>
        <div className="stat-value-wrapper">
          <span className="stat-number tabular-nums">{statistics.total_user.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* 2. Active - Largest/Primary Statistic (Green Accent) */}
      <div className="card stat-card stat-primary stat-green">
        <div className="stat-header">
          <div className="stat-icon-badge badge-green" aria-hidden="true">
            <IconCertificate size={26} />
          </div>
          <span className="stat-label">Sertifikat aktif</span>
        </div>
        <div className="stat-value-wrapper">
          <span className="stat-number stat-number-lg tabular-nums">{statistics.active.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* 3. Expired (Amber Accent) */}
      <div className="card stat-card stat-amber">
        <div className="stat-header">
          <div className="stat-icon-badge badge-amber" aria-hidden="true">
            <IconAlertTriangle size={22} />
          </div>
          <span className="stat-label">Sertifikat kedaluwarsa</span>
        </div>
        <div className="stat-value-wrapper">
          <span className="stat-number tabular-nums">{statistics.expired.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </section>
  );
}
