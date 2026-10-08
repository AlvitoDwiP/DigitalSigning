import {
  IconGenerate,
  IconUsers,
  IconShield,
  IconAlertTriangle,
  IconAudit
} from '../icons/Icons';
import { StatusChip } from '../ui/StatusChip';
import type { RecentActivity } from '../../types/dashboard';

interface RecentActivitiesCardProps {
  activities: RecentActivity[];
}

function getActionInfo(action: string) {
  const norm = action.toUpperCase();

  if (norm.includes('BULK')) {
    return {
      title: 'Generate Bulk User',
      icon: IconUsers,
      badgeClass: 'badge-blue',
      desc: 'Penerbitan massal sertifikat pengguna via CSV',
    };
  }
  if (norm.includes('GENERATE_USER') || norm.includes('GENERATE_CERTIFICATE') || norm.includes('GENERATE')) {
    return {
      title: 'Generate User & Sertifikat',
      icon: IconGenerate,
      badgeClass: 'badge-blue',
      desc: 'Penerbitan user baru dan sertifikat digital',
    };
  }
  if (norm.includes('REGENERATE')) {
    return {
      title: 'Regenerate Certificate',
      icon: IconShield,
      badgeClass: 'badge-amber',
      desc: 'Pembaruan masa berlaku sertifikat digital',
    };
  }
  if (norm.includes('PFX') || norm.includes('PASSWORD')) {
    return {
      title: 'Ubah Password PFX',
      icon: IconShield,
      badgeClass: 'badge-blue',
      desc: 'Pembaruan kredensial proteksi berkas PFX',
    };
  }
  if (norm.includes('DELETE') || norm.includes('HAPUS')) {
    return {
      title: 'Hapus Entitas / Pengguna',
      icon: IconAlertTriangle,
      badgeClass: 'badge-red',
      desc: 'Penghapusan data pengguna dan sertifikat',
    };
  }

  return {
    title: action,
    icon: IconAudit,
    badgeClass: 'badge-neutral',
    desc: 'Aktivitas sistem tercatat di audit trail',
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

export function RecentActivitiesCard({ activities }: RecentActivitiesCardProps) {
  const displayedActivities = activities.slice(0, 6);

  return (
    <div className="card activities-card">
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Aktivitas Terbaru</h2>
          <p className="card-subheading">Enam riwayat operasional terakhir yang tercatat dalam audit trail</p>
        </div>
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
            const actionInfo = getActionInfo(act.action);
            const Icon = actionInfo.icon;
            const isSuccess = act.status === 'SUCCESS';

            return (
              <li key={act.id} className="activity-item">
                <div className={`activity-icon-badge ${actionInfo.badgeClass}`} aria-hidden="true">
                  <Icon size={20} />
                </div>

                <div className="activity-content">
                  <div className="activity-title-row">
                    <span className="activity-title">{actionInfo.title}</span>
                    <span className="activity-time">{formatActivityTime(act.created_at)}</span>
                  </div>
                  <div className="activity-target-row">
                    <span className="activity-target-type">
                      {act.target_type}: <code className="target-id">{act.target_id || '-'}</code>
                    </span>
                  </div>
                </div>

                <div className="activity-status-col">
                  {isSuccess ? (
                    <StatusChip status="SUCCESS" label="SUCCESS" />
                  ) : (
                    <StatusChip status="FAILED" label="FAILED" />
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
