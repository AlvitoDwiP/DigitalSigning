import { IconClock, IconArrowRight, IconCertificate } from '../icons/Icons';
import { Button } from '../ui/Button';
import type { ExpiringCertificateUser } from '../../types/dashboard';

interface NearestExpiryCardProps {
  expiringUsers: ExpiringCertificateUser[];
  onViewUsers: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function calculateDaysRemaining(isoString: string): number {
  try {
    const target = new Date(isoString).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}

export function NearestExpiryCard({
  expiringUsers,
  onViewUsers,
}: NearestExpiryCardProps) {
  const displayedUsers = expiringUsers.slice(0, 5);

  return (
    <div className="card expiry-card nearest-expiry-card">
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Paling cepat berakhir</h2>
          <p className="card-subheading">5 sertifikat dengan sisa waktu paling sedikit</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewUsers}
          icon={<IconArrowRight size={16} />}
          aria-label="Lihat seluruh daftar pengguna"
        >
          Lihat semua
        </Button>
      </div>

      {displayedUsers.length === 0 ? (
        <div className="card-empty-state">
          <div className="empty-icon-badge" aria-hidden="true">
            <IconCertificate size={24} />
          </div>
          <p className="empty-title">Belum ada sertifikat yang akan berakhir dalam 30 hari.</p>
        </div>
      ) : (
        <ul className="expiry-user-list">
          {displayedUsers.map((item) => {
            const daysLeft = calculateDaysRemaining(item.expires_at);
            const initials = getInitials(item.name);

            let urgencyClass = 'urgency-safe';
            let urgencyLabel = 'Aman';
            if (daysLeft <= 30) {
              urgencyClass = 'urgency-critical';
              urgencyLabel = 'Mendesak';
            } else if (daysLeft <= 90) {
              urgencyClass = 'urgency-warning';
              urgencyLabel = 'Perlu Perhatian';
            }

            return (
              <li key={item.user_id} className="expiry-user-item">
                <div className="user-avatar-initials" aria-hidden="true">
                  <span>{initials}</span>
                </div>

                <div className="expiry-user-details">
                  <span className="user-name">{item.name}</span>
                  <div className="expiry-date-row">
                    <IconClock size={13} className="text-muted" aria-hidden="true" />
                    <span className="expiry-date">
                      Berlaku sampai: <strong>{formatDate(item.expires_at)}</strong>
                    </span>
                  </div>
                </div>

                <div className={`expiry-countdown-pill ${urgencyClass}`} title={`Status: ${urgencyLabel}`}>
                  <span className="days-number tabular-nums">{daysLeft}</span>
                  <span className="days-label">hari lagi</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
