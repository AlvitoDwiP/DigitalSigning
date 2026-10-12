import type { UserDetailData } from '../../../types/users';
import { maskNik, formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { IconUser, IconTrash } from '../../icons/Icons';
import { statusAkun, peran } from '../../../lib/labels';

interface UserInfoCardProps {
  user: UserDetailData;
  onDeleteUser: () => void;
}

export function UserInfoCard({ user, onDeleteUser }: UserInfoCardProps) {
  const initial = user.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <section className="detail-card user-info-card" aria-labelledby="user-info-title">
      <div className="detail-card-header">
        <div className="user-profile-header">
          <div className="user-profile-avatar" aria-hidden="true">
            <span>{initial}</span>
          </div>
          <div className="user-profile-titles">
            <div className="user-profile-name-row">
              <h2 id="user-info-title" className="user-profile-name">
                {user.name}
              </h2>
              <StatusChip
                status={user.status}
                label={statusAkun[user.status] || 'Aktif'}
              />
            </div>
            <span className="user-profile-meta">
              Bergabung {formatDate(user.created_at)}
            </span>
          </div>
        </div>

        <div className="user-profile-actions">
          <button
            type="button"
            className="btn btn-danger user-delete-btn"
            onClick={onDeleteUser}
            aria-label={`Hapus akun pengguna ${user.name}`}
          >
            <IconTrash size={16} aria-hidden="true" />
            <span>Hapus pengguna</span>
          </button>
        </div>
      </div>

      <div className="detail-card-body">
        <h3 className="section-subheading">
          <IconUser size={16} aria-hidden="true" />
          <span>Data pengguna</span>
        </h3>
        <dl className="user-details-grid">
          <div className="user-detail-item">
            <dt className="user-detail-label">NIK</dt>
            <dd className="user-detail-value font-mono">{maskNik(user.nik)}</dd>
          </div>

          <div className="user-detail-item">
            <dt className="user-detail-label">Email</dt>
            <dd className="user-detail-value">{user.email}</dd>
          </div>

          <div className="user-detail-item">
            <dt className="user-detail-label">Instansi</dt>
            <dd className="user-detail-value">{user.organization || '-'}</dd>
          </div>

          <div className="user-detail-item">
            <dt className="user-detail-label">Unit kerja</dt>
            <dd className="user-detail-value">{user.ou || '-'}</dd>
          </div>

          <div className="user-detail-item">
            <dt className="user-detail-label">Peran</dt>
            <dd className="user-detail-value">{peran[user.role] || user.role}</dd>
          </div>

          <div className="user-detail-item">
            <dt className="user-detail-label">Status akun</dt>
            <dd className="user-detail-value">{statusAkun[user.status] || user.status}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
