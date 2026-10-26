import { IconUsers, IconCertificate, IconAlertTriangle } from '../icons/Icons';
import type { DashboardStatistics } from '../../types/dashboard';

interface StatsSectionProps {
  statistics: DashboardStatistics;
  onCardClick?: (type: 'total' | 'active' | 'expired') => void;
}

export function StatsSection({ statistics, onCardClick }: StatsSectionProps) {
  const isInteractive = Boolean(onCardClick);

  return (
    <section className="dashboard-stats-grid" aria-label="Statistik Utama">
      {/* 1. Total User (Informasi Umum - Biru Muda) */}
      <div
        className={`card stat-card stat-blue ${isInteractive ? 'card-interactive' : 'card-static'}`}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={() => onCardClick?.('total')}
        onKeyDown={(e) => {
          if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick?.('total');
          }
        }}
        aria-label={isInteractive ? 'Lihat semua pengguna' : undefined}
      >
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

      {/* 2. Active - Largest/Primary Statistic (Keberhasilan - Hijau Muda) */}
      <div
        className={`card stat-card stat-primary stat-green ${isInteractive ? 'card-interactive' : 'card-static'}`}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={() => onCardClick?.('active')}
        onKeyDown={(e) => {
          if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick?.('active');
          }
        }}
        aria-label={isInteractive ? 'Lihat pengguna dengan sertifikat aktif' : undefined}
      >
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

      {/* 3. Expired (Peringatan / Bahaya - Jingga/Merah Muda) */}
      <div
        className={`card stat-card stat-amber ${isInteractive ? 'card-interactive' : 'card-static'}`}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={() => onCardClick?.('expired')}
        onKeyDown={(e) => {
          if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick?.('expired');
          }
        }}
        aria-label={isInteractive ? 'Lihat pengguna dengan sertifikat kedaluwarsa' : undefined}
      >
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
