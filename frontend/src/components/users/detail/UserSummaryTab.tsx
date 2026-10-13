import type { UserDetailData } from '../../../types/users';
import { maskNik, formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { calculateExpiryDays } from './ActiveCertificateCard';
import {
  IconUser,
  IconCertificate,
  IconClock,
} from '../../icons/Icons';
import { statusAkun, statusSertifikat, peran, parseCommonName } from '../../../lib/labels';

interface UserSummaryTabProps {
  user: UserDetailData;
  onSwitchTab: (tab: 'account' | 'certificate' | 'activity') => void;
}

export function UserSummaryTab({ user, onSwitchTab }: UserSummaryTabProps) {
  const activeCert = user.active_certificate;
  const historyCount = user.certificate_history ? user.certificate_history.length : 0;
  const expiryInfo = activeCert ? calculateExpiryDays(activeCert.expires_at) : null;

  return (
    <div className="user-summary-tab-container">
      {/* Metrics Row */}
      <div className="summary-metrics-grid">
        <div className="summary-metric-card">
          <div className="summary-metric-icon summary-metric-icon-account" aria-hidden="true">
            <IconUser size={20} />
          </div>
          <div className="summary-metric-content">
            <span className="summary-metric-label">Status Akun</span>
            <div className="summary-metric-value-row">
              <span className="summary-metric-value">{statusAkun[user.status] || user.status}</span>
              <StatusChip status={user.status} label={statusAkun[user.status] || user.status} />
            </div>
          </div>
        </div>

        <div className="summary-metric-card">
          <div className="summary-metric-icon summary-metric-icon-cert" aria-hidden="true">
            <IconCertificate size={20} />
          </div>
          <div className="summary-metric-content">
            <span className="summary-metric-label">Sertifikat Digital</span>
            <div className="summary-metric-value-row">
              <span className="summary-metric-value">
                {activeCert ? 'Tersedia' : 'Belum Ada'}
              </span>
              {activeCert ? (
                <StatusChip
                  status={activeCert.status}
                  label={statusSertifikat[activeCert.status] || activeCert.status}
                />
              ) : (
                <span className="cert-status-none">Belum diterbitkan</span>
              )}
            </div>
          </div>
        </div>

        <div className="summary-metric-card">
          <div className="summary-metric-icon summary-metric-icon-history" aria-hidden="true">
            <IconClock size={20} />
          </div>
          <div className="summary-metric-content">
            <span className="summary-metric-label">Riwayat Kredensial</span>
            <div className="summary-metric-value-row">
              <span className="summary-metric-value">{historyCount} Sertifikat</span>
              <span className="summary-metric-subtext">Total pernah terbit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Highlights Grid */}
      <div className="summary-sections-grid">
        {/* Section 1: Ringkasan Akun */}
        <section className="detail-card summary-card" aria-labelledby="summary-account-heading">
          <div className="detail-card-header">
            <div className="card-title-group">
              <IconUser size={20} className="card-title-icon" aria-hidden="true" />
              <h2 id="summary-account-heading" className="detail-card-title">
                Profil & Identitas Akun
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm summary-card-link"
              onClick={() => onSwitchTab('account')}
            >
              Lihat di Tab Akun →
            </button>
          </div>

          <div className="detail-card-body">
            <dl className="user-details-grid">
              <div className="user-detail-item">
                <dt className="user-detail-label">Nama Lengkap</dt>
                <dd className="user-detail-value">{user.name}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">NIK</dt>
                <dd className="user-detail-value font-mono">{maskNik(user.nik)}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Email</dt>
                <dd className="user-detail-value">{user.email}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Peran</dt>
                <dd className="user-detail-value">{peran[user.role] || user.role}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Instansi / Organisasi</dt>
                <dd className="user-detail-value">{user.organization || '-'}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Unit Kerja</dt>
                <dd className="user-detail-value">{user.ou || '-'}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Section 2: Ringkasan Sertifikat */}
        <section className="detail-card summary-card" aria-labelledby="summary-cert-heading">
          <div className="detail-card-header">
            <div className="card-title-group">
              <IconCertificate size={20} className="card-title-icon" aria-hidden="true" />
              <h2 id="summary-cert-heading" className="detail-card-title">
                Sertifikat Digital Aktif
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm summary-card-link"
              onClick={() => onSwitchTab('certificate')}
            >
              Kelola di Tab Sertifikat →
            </button>
          </div>

          <div className="detail-card-body">
            {activeCert ? (
              <dl className="user-details-grid">
                <div className="user-detail-item">
                  <dt className="user-detail-label">Nomor Seri Sertifikat</dt>
                  <dd className="user-detail-value font-mono text-break">{activeCert.serial_number}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Status Sertifikat</dt>
                  <dd className="user-detail-value">
                    <StatusChip
                      status={activeCert.status}
                      label={statusSertifikat[activeCert.status] || activeCert.status}
                    />
                  </dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Subjek Pemilik</dt>
                  <dd className="user-detail-value">{parseCommonName(activeCert.subject)}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Penerbit (CA)</dt>
                  <dd className="user-detail-value">{activeCert.issuer}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Berlaku Sampai</dt>
                  <dd className="user-detail-value">{formatDate(activeCert.expires_at)}</dd>
                </div>

                <div className="user-detail-item">
                  <dt className="user-detail-label">Masa Sisa</dt>
                  <dd className="user-detail-value">
                    {expiryInfo && expiryInfo.days > 0 ? (
                      <span className={`expiry-remaining-badge expiry-badge-${expiryInfo.urgency}`}>
                        {expiryInfo.days} hari tersisa
                      </span>
                    ) : (
                      <span className="expiry-remaining-badge expiry-badge-critical">
                        Kedaluwarsa
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="summary-empty-cert-state">
                <div className="summary-empty-cert-icon" aria-hidden="true">
                  <IconCertificate size={32} />
                </div>
                <div className="summary-empty-cert-text">
                  <h3 className="summary-empty-cert-title">Belum Ada Sertifikat Digital</h3>
                  <p className="summary-empty-cert-desc">
                    Akun ini berstatus valid dan aktif di sistem, namun sertifikat digital penandatanganan belum diterbitkan.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
