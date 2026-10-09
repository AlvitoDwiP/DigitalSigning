import type { UserCertificate } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { IconCertificate, IconRefresh, IconLock } from '../../icons/Icons';

interface ActiveCertificateCardProps {
  certificate: UserCertificate | null;
  onRegenerate: () => void;
  onChangePfx: () => void;
  disabled?: boolean;
}

export function calculateExpiryDays(expiresAt: string | null | undefined): { days: number; urgency: 'critical' | 'warning' | 'normal' | 'expired' } {
  if (!expiresAt) return { days: 0, urgency: 'expired' };
  try {
    const exp = new Date(expiresAt).getTime();
    const now = new Date().getTime();
    const diffMs = exp - now;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return { days: 0, urgency: 'expired' };
    }
    if (days <= 30) {
      return { days, urgency: 'critical' };
    }
    if (days <= 90) {
      return { days, urgency: 'warning' };
    }
    return { days, urgency: 'normal' };
  } catch {
    return { days: 0, urgency: 'expired' };
  }
}

export function ActiveCertificateCard({
  certificate,
  onRegenerate,
  onChangePfx,
  disabled = false,
}: ActiveCertificateCardProps) {
  if (!certificate) {
    return (
      <section className="detail-card active-certificate-card" aria-labelledby="active-cert-title">
        <div className="detail-card-header">
          <div className="card-title-group">
            <IconCertificate size={20} className="card-title-icon" aria-hidden="true" />
            <h2 id="active-cert-title" className="detail-card-title">
              Sertifikat Digital Aktif
            </h2>
          </div>
        </div>
        <div className="detail-card-body empty-cert-body">
          <div className="empty-cert-notice">
            <p>Pengguna saat ini tidak memiliki sertifikat X.509 aktif.</p>
          </div>
        </div>
      </section>
    );
  }

  const { days, urgency } = calculateExpiryDays(certificate.expires_at);

  let remainingDaysBadgeClass = 'expiry-badge-normal';
  let remainingDaysText = `${days} hari tersisa`;

  if (urgency === 'expired') {
    remainingDaysBadgeClass = 'expiry-badge-critical';
    remainingDaysText = 'Telah Kedaluwarsa';
  } else if (urgency === 'critical') {
    remainingDaysBadgeClass = 'expiry-badge-critical';
  } else if (urgency === 'warning') {
    remainingDaysBadgeClass = 'expiry-badge-warning';
  }

  return (
    <section className="detail-card active-certificate-card" aria-labelledby="active-cert-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconCertificate size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="active-cert-title" className="detail-card-title">
            Sertifikat Digital Aktif
          </h2>
          <StatusChip status={certificate.status} label={certificate.status} />
          <span className={`expiry-remaining-badge ${remainingDaysBadgeClass}`}>
            {remainingDaysText}
          </span>
        </div>

        <div className="cert-actions-group">
          <button
            type="button"
            className="btn btn-ghost btn-cert-action"
            onClick={onChangePfx}
            disabled={disabled}
            aria-label="Ubah passphrase berkas PFX"
          >
            <IconLock size={16} aria-hidden="true" />
            <span>Ubah Passphrase</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-cert-action"
            onClick={onRegenerate}
            disabled={disabled}
            aria-label="Terbitkan ulang sertifikat digital"
          >
            <IconRefresh size={16} aria-hidden="true" />
            <span>Regenerate Sertifikat</span>
          </button>
        </div>
      </div>

      <div className="detail-card-body">
        <dl className="cert-details-grid">
          <div className="cert-detail-item">
            <dt className="cert-detail-label">Nomor Seri (Serial Number)</dt>
            <dd className="cert-detail-value font-mono">{certificate.serial_number}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Penerbit Sertifikat (Issuer)</dt>
            <dd className="cert-detail-value">{certificate.issuer}</dd>
          </div>

          <div className="cert-detail-item col-span-2">
            <dt className="cert-detail-label">Subjek Sertifikat (Subject DN)</dt>
            <dd className="cert-detail-value font-mono text-break">{certificate.subject}</dd>
          </div>

          <div className="cert-detail-item col-span-2">
            <dt className="cert-detail-label">Fingerprint (SHA-256)</dt>
            <dd className="cert-detail-value font-mono text-break">{certificate.fingerprint_sha256}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Tanggal Diterbitkan</dt>
            <dd className="cert-detail-value">{formatDate(certificate.issued_at)}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Masa Berlaku Sampai</dt>
            <dd className="cert-detail-value">{formatDate(certificate.expires_at)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
