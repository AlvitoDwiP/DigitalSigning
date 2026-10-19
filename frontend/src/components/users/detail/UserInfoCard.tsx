import type { UserDetailData } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { NikDisplay } from '../../ui/NikDisplay';
import { StatusChip } from '../../ui/StatusChip';
import { IconUser, IconTrash, IconAlertTriangle } from '../../icons/Icons';
import { statusAkun, peran } from '../../../lib/labels';

interface UserInfoCardProps {
  user: UserDetailData;
  onDeleteUser: () => void;
}

export function UserInfoCard({ user, onDeleteUser }: UserInfoCardProps) {
  return (
    <div className="user-account-tab-layout">
      <section className="detail-card user-info-card" aria-labelledby="user-info-title">
        <div className="detail-card-header">
          <div className="card-title-group">
            <IconUser size={20} className="card-title-icon" aria-hidden="true" />
            <h2 id="user-info-title" className="detail-card-title">
              Informasi Akun & Otorisasi
            </h2>
          </div>
        </div>

        <div className="detail-card-body">
          <div className="user-info-sections">
            {/* Kelompok 1: Identitas & Kontak */}
            <div className="user-info-group">
              <h3 className="section-subheading">Identitas & Kontak</h3>
              <dl className="user-details-grid">
                <div className="user-detail-item">
                  <dt className="user-detail-label">Nama Lengkap</dt>
                  <dd className="user-detail-value">{user.name}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">NIK</dt>
                  <dd className="user-detail-value">
                    <NikDisplay nik={user.nik} />
                  </dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Email</dt>
                  <dd className="user-detail-value">{user.email}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Terdaftar Pada</dt>
                  <dd className="user-detail-value">{formatDate(user.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Kelompok 2: Organisasi & Otorisasi */}
            <div className="user-info-group">
              <h3 className="section-subheading">Organisasi & Otorisasi</h3>
              <dl className="user-details-grid">
                <div className="user-detail-item">
                  <dt className="user-detail-label">Instansi / Organisasi</dt>
                  <dd className="user-detail-value">{user.organization || '-'}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Unit Kerja</dt>
                  <dd className="user-detail-value">{user.ou || '-'}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Peran</dt>
                  <dd className="user-detail-value">{peran[user.role] || user.role}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Status Akun</dt>
                  <dd className="user-detail-value">
                    <StatusChip
                      status={user.status}
                      label={statusAkun[user.status] || user.status}
                    />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Zona Bahaya / Tindakan Berisiko */}
      <section className="detail-card account-danger-card" aria-labelledby="danger-zone-title">
        <div className="detail-card-body danger-zone-body">
          <div className="danger-zone-info">
            <div className="danger-zone-icon" aria-hidden="true">
              <IconAlertTriangle size={20} />
            </div>
            <div className="danger-zone-texts">
              <h3 id="danger-zone-title" className="danger-zone-title">
                Hapus Akun Pengguna
              </h3>
              <p className="danger-zone-desc">
                Tindakan ini akan menghapus akun secara permanen dari sistem. Seluruh sertifikat terkait tidak akan dapat digunakan lagi.
              </p>
            </div>
          </div>
          <div className="danger-zone-action">
            <button
              type="button"
              className="btn btn-danger user-delete-btn"
              onClick={onDeleteUser}
              aria-label={`Hapus akun pengguna ${user.name}`}
            >
              <IconTrash size={16} aria-hidden="true" />
              <span>Hapus Pengguna</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
