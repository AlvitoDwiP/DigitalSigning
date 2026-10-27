import type { UserDetailData } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { calculateExpiryDays } from './ActiveCertificateCard';
import {
  IconCertificate,
  IconShield,
  IconArrowRight,
} from '../../icons/Icons';
import { statusSertifikat, peran } from '../../../lib/labels';

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
      <div className="summary-cards-layout">
        {/* Kartu 1: Status Sertifikat Digital & Masa Berlaku */}
        <section className="detail-card summary-action-card" aria-labelledby="summary-cert-title">
          <div className="detail-card-header">
            <div className="card-title-group">
              <IconCertificate size={20} className="card-title-icon" aria-hidden="true" />
              <h2 id="summary-cert-title" className="detail-card-title">
                Status Kredensial & Masa Berlaku
              </h2>
            </div>
            {activeCert && (
              <StatusChip
                status={activeCert.status}
                label={statusSertifikat[activeCert.status] || activeCert.status}
              />
            )}
          </div>

          <div className="detail-card-body">
            {activeCert ? (
              <div className="summary-cert-details">
                <div className="summary-expiry-banner">
                  <div className="summary-expiry-text">
                    <span className="summary-expiry-label">Masa Sisa Sertifikat</span>
                    <span className="summary-expiry-date">
                      Berlaku hingga {formatDate(activeCert.expires_at)}
                    </span>
                  </div>
                  {expiryInfo && expiryInfo.days > 0 ? (
                    <span className={`expiry-remaining-badge expiry-badge-${expiryInfo.urgency}`}>
                      {expiryInfo.days} hari tersisa
                    </span>
                  ) : (
                    <span className="expiry-remaining-badge expiry-badge-critical">
                      Kedaluwarsa
                    </span>
                  )}
                </div>

                <dl className="user-details-grid">
                  <div className="user-detail-item">
                    <dt className="user-detail-label">Nomor Sertifikat</dt>
                    <dd className="user-detail-value">
                      <div className="cert-number-pill">
                        <span className="cert-number-pill-code">{activeCert.certificate_number || activeCert.serial_number}</span>
                      </div>
                    </dd>
                  </div>

                  <div className="user-detail-item">
                    <dt className="user-detail-label">Penerbit (CA)</dt>
                    <dd className="user-detail-value font-medium">{(activeCert.issuer === 'Intermediate CA' || !activeCert.issuer) ? 'Pustik CA' : activeCert.issuer}</dd>
                  </div>
                </dl>

                <div className="summary-card-footer">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm summary-nav-btn"
                    onClick={() => onSwitchTab('certificate')}
                  >
                    <span>Kelola di Tab Sertifikat</span>
                    <IconArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="summary-empty-cert-state">
                <div className="summary-empty-cert-icon" aria-hidden="true">
                  <IconCertificate size={32} />
                </div>
                <div className="summary-empty-cert-text">
                  <h3 className="summary-empty-cert-title">Belum Ada Sertifikat Digital</h3>
                  <p className="summary-empty-cert-desc">
                    Akun ini aktif di sistem, namun sertifikat digital penandatanganan belum diterbitkan.
                  </p>
                </div>
                <div className="summary-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm summary-nav-btn"
                    onClick={() => onSwitchTab('certificate')}
                  >
                    <span>Buka Tab Sertifikat</span>
                    <IconArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Kartu 2: Penugasan & Otorisasi Pengguna */}
        <section className="detail-card summary-action-card" aria-labelledby="summary-assign-title">
          <div className="detail-card-header">
            <div className="card-title-group">
              <IconShield size={20} className="card-title-icon" aria-hidden="true" />
              <h2 id="summary-assign-title" className="detail-card-title">
                Penugasan & Otorisasi Akun
              </h2>
            </div>
            <span className="summary-role-tag font-mono">
              {peran[user.role] || user.role}
            </span>
          </div>

          <div className="detail-card-body">
            <dl className="user-details-grid">
              <div className="user-detail-item">
                <dt className="user-detail-label">Instansi / Lembaga</dt>
                <dd className="user-detail-value">{user.organization || '-'}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Unit Kerja</dt>
                <dd className="user-detail-value">{user.ou || '-'}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Terdaftar Sejak</dt>
                <dd className="user-detail-value">{formatDate(user.created_at)}</dd>
              </div>

              <div className="user-detail-item">
                <dt className="user-detail-label">Riwayat Kredensial</dt>
                <dd className="user-detail-value">
                  {historyCount > 0 ? `${historyCount} sertifikat tercatat` : 'Belum ada riwayat'}
                </dd>
              </div>
            </dl>

            <div className="summary-operational-note">
              <p>
                Data identitas, hak akses, dan status operasional akun dapat dikelola melalui tab Akun.
              </p>
            </div>

            <div className="summary-card-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm summary-nav-btn"
                onClick={() => onSwitchTab('account')}
              >
                <span>Lihat Detail di Tab Akun</span>
                <IconArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
