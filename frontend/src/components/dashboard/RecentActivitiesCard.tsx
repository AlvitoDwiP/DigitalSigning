import {
  IconGenerate,
  IconUsers,
  IconShield,
  IconAlertTriangle,
  IconAudit,
  IconArrowRight,
} from '../icons/Icons';
import { StatusChip } from '../ui/StatusChip';
import { Button } from '../ui/Button';
import type { RecentActivity } from '../../types/dashboard';
import { labelAktivitas, jenisTarget } from '../../lib/labels';

interface RecentActivitiesCardProps {
  activities: RecentActivity[];
  onViewAll?: () => void;
}

function getActionMeta(action: string) {
  const norm = action.toUpperCase();

  if (norm.includes('DELETE') || norm.includes('HAPUS')) {
    return {
      icon: IconAlertTriangle,
      badgeClass: 'badge-red',
    };
  }
  if (norm.includes('REGENERATE')) {
    return {
      icon: IconShield,
      badgeClass: 'badge-amber',
    };
  }
  if (norm.includes('USER')) {
    return {
      icon: IconUsers,
      badgeClass: 'badge-blue',
    };
  }
  if (norm.includes('CERTIFICATE') || norm.includes('PFX') || norm.includes('PASSWORD')) {
    return {
      icon: IconGenerate,
      badgeClass: 'badge-blue',
    };
  }

  return {
    icon: IconAudit,
    badgeClass: 'badge-neutral',
  };
}

function formatActivityTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSeconds < 60) {
      return 'Baru saja';
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} menit yang lalu`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} jam yang lalu`;
    }

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function RecentActivitiesCard({ activities, onViewAll }: RecentActivitiesCardProps) {
  const displayedActivities = activities.slice(0, 6);

  return (
    <div className="card activities-card">
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Aktivitas terbaru</h2>
        </div>
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            icon={<IconArrowRight size={16} />}
            aria-label="Lihat seluruh riwayat aktivitas"
          >
            Lihat semua
          </Button>
        )}
      </div>

      {displayedActivities.length === 0 ? (
        <div className="card-empty-state">
          <div className="empty-icon-badge" aria-hidden="true">
            <IconAudit size={24} />
          </div>
          <p className="empty-title">Belum ada aktivitas tercatat</p>
          <p className="empty-subtitle">Seluruh aktivitas administratif dan perubahan data akan tercatat secara otomatis di sini.</p>
        </div>
      ) : (
        <ul className="activity-list">
          {displayedActivities.map((act) => {
            const meta = getActionMeta(act.action);
            const Icon = meta.icon;
            const title = labelAktivitas(act.action);
            const isFailed = act.status === 'FAILED';
            const targetLabel = jenisTarget[act.target_type] || act.target_type;

            return (
              <li key={act.id} className="activity-item">
                <div className={`activity-icon-badge ${meta.badgeClass}`} aria-hidden="true">
                  <Icon size={20} />
                </div>

                <div className="activity-content">
                  <div className="activity-title-row">
                    <span className="activity-title">{title}</span>
                    <span className="activity-time">{formatActivityTime(act.created_at)}</span>
                  </div>
                  <div className="activity-target-row">
                    <span className="activity-target-type">{targetLabel}</span>
                  </div>
                </div>

                <div className="activity-status-col">
                  {isFailed && (
                    <StatusChip status="FAILED" label="Gagal" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
