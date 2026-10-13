import { useState, useEffect, useCallback } from 'react';
import type { AuditLogItem } from '../../../types/auditLogs';
import { fetchAuditLogs } from '../../../services/auditLogs';
import { StatusChip } from '../../ui/StatusChip';
import {
  IconAudit,
  IconRefresh,
  IconAlertTriangle,
  IconClock,
} from '../../icons/Icons';
import {
  labelAktivitas,
  formatWaktuIndonesia,
  hasilAktivitas,
  deskripsiAktivitas,
} from '../../../lib/labels';

interface UserActivityTabProps {
  userId: string;
}

export function UserActivityTab({ userId }: UserActivityTabProps) {
  const [activities, setActivities] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Query audit logs strictly related to this userId (actor, target, or cert owner)
      const res = await fetchAuditLogs({ user_id: userId, limit: 50 });
      if (res.success && res.data) {
        setActivities(res.data.items || []);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat riwayat aktivitas.');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat log audit aktivitas.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return (
    <div className="user-activity-tab-container">
      <section className="detail-card activity-card" aria-labelledby="activity-heading">
        <div className="detail-card-header">
          <div className="card-title-group">
            <IconAudit size={20} className="card-title-icon" aria-hidden="true" />
            <h2 id="activity-heading" className="detail-card-title">
              Riwayat Aktivitas Pengguna
            </h2>
            {!isLoading && !error && (
              <span className="history-count-badge">
                {activities.length} catatan
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm activity-refresh-btn"
            onClick={loadActivities}
            disabled={isLoading}
            aria-label="Segarkan riwayat aktivitas"
          >
            <IconRefresh size={15} className={isLoading ? 'spin-animation' : ''} aria-hidden="true" />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="detail-card-body no-padding">
          {/* Loading State */}
          {isLoading && (
            <div className="activity-loading-container" aria-busy="true" aria-label="Memuat riwayat aktivitas...">
              <div className="activity-skeleton-row" />
              <div className="activity-skeleton-row" />
              <div className="activity-skeleton-row" />
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="activity-error-container" role="alert">
              <IconAlertTriangle size={24} className="activity-error-icon" aria-hidden="true" />
              <div className="activity-error-text">
                <p className="activity-error-message">{error}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={loadActivities}
                >
                  Coba lagi
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && activities.length === 0 && (
            <div className="empty-activity-notice">
              <div className="empty-activity-icon" aria-hidden="true">
                <IconClock size={32} />
              </div>
              <h3 className="empty-activity-title">Belum Ada Riwayat Aktivitas</h3>
              <p className="empty-activity-desc">
                Tidak ada catatan audit sistem atau aktivitas yang tercatat untuk akun pengguna ini.
              </p>
            </div>
          )}

          {/* Data Table */}
          {!isLoading && !error && activities.length > 0 && (
            <div className="activity-table-wrapper" tabIndex={0} aria-label="Tabel Riwayat Aktivitas">
              <table className="cert-history-table activity-table">
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Aktivitas</th>
                    <th scope="col">Status</th>
                    <th scope="col">Pelaku (Aktor)</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((item) => {
                    const actorDisplay = item.actor_name || item.actor_email || 'Sistem';
                    const actLabel = labelAktivitas(item.action);
                    const actDesc = deskripsiAktivitas(item.action, item.status);

                    return (
                      <tr key={item.id} className="history-table-row">
                        <td className="activity-time-cell">
                          <span className="activity-time-text font-mono">
                            {formatWaktuIndonesia(item.created_at)}
                          </span>
                        </td>
                        <td className="activity-action-cell">
                          <div className="activity-action-group">
                            <span className="activity-action-title">{actLabel}</span>
                            <span className="activity-action-desc">{actDesc}</span>
                          </div>
                        </td>
                        <td className="activity-status-cell">
                          <StatusChip
                            status={item.status}
                            label={hasilAktivitas[item.status] || item.status}
                          />
                        </td>
                        <td className="activity-actor-cell">
                          <span className="activity-actor-name">{actorDisplay}</span>
                          {item.actor_role && (
                            <span className="activity-actor-role">({item.actor_role})</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
