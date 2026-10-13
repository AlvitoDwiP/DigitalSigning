import { useState } from 'react';
import type { UserCertificate } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { IconCertificate, IconRefresh, IconLock, IconCopy, IconCheckCircle } from '../../icons/Icons';
import { parseCommonName, statusSertifikat } from '../../../lib/labels';

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
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const handleCopyFingerprint = (text: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  if (!certificate) {
    return (
      <section className="detail-card active-certificate-card" aria-labelledby="active-cert-title">
        <div className="detail-card-header">
          <div className="card-title-group">
            <IconCertificate size={20} className="card-title-icon" aria-hidden="true" />
            <h2 id="active-cert-title" className="detail-card-title">
              Sertifikat Aktif
            </h2>
            <span className="cert-status-none">Belum diterbitkan</span>
          </div>
        </div>
        <div className="detail-card-body empty-cert-body">
          <div className="empty-cert-notice">
            <p>Pengguna ini belum memiliki sertifikat digital aktif. Kredensial penandatanganan belum diterbitkan untuk akun ini.</p>
          </div>
        </div>
      </section>
    );
  }

  const { days, urgency } = calculateExpiryDays(certificate.expires_at);

  let remainingDaysBadgeClass = 'expiry-badge-normal';
  let remainingDaysText = `Sisa ${days} hari`;

  if (urgency === 'expired') {
    remainingDaysBadgeClass = 'expiry-badge-critical';
    remainingDaysText = 'Kedaluwarsa';
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
            Sertifikat Aktif
          </h2>
          <StatusChip
            status={certificate.status}
            label={statusSertifikat[certificate.status] || certificate.status}
          />
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
            aria-label="Ubah passphrase berkas sertifikat"
          >
            <IconLock size={16} aria-hidden="true" />
            <span>Ubah passphrase</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-cert-action"
            onClick={onRegenerate}
            disabled={disabled}
            aria-label="Terbitkan ulang sertifikat"
          >
            <IconRefresh size={16} aria-hidden="true" />
            <span>Terbitkan ulang</span>
          </button>
        </div>
      </div>

      <div className="detail-card-body">
        <dl className="cert-details-grid">
          <div className="cert-detail-item">
            <dt className="cert-detail-label">Nomor sertifikat</dt>
            <dd className="cert-detail-value font-mono">{certificate.serial_number}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Diterbitkan oleh</dt>
            <dd className="cert-detail-value">{certificate.issuer}</dd>
          </div>

          <div className="cert-detail-item col-span-2">
            <dt className="cert-detail-label">Atas nama</dt>
            <dd className="cert-detail-value font-mono text-break">{parseCommonName(certificate.subject)}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Diterbitkan pada</dt>
            <dd className="cert-detail-value">{formatDate(certificate.issued_at)}</dd>
          </div>

          <div className="cert-detail-item">
            <dt className="cert-detail-label">Berlaku sampai</dt>
            <dd className="cert-detail-value">{formatDate(certificate.expires_at)}</dd>
          </div>

          {/* Technical Section: Full SHA-256 Fingerprint with Copy Button */}
          <div className="cert-detail-item col-span-2 cert-tech-fingerprint-box">
            <div className="fingerprint-header-row">
              <dt className="cert-detail-label">Sidik jari digital (SHA-256)</dt>
              <button
                type="button"
                className="btn-copy-fingerprint"
                onClick={() => handleCopyFingerprint(certificate.fingerprint_sha256)}
                aria-label="Salin sidik jari digital ke clipboard"
              >
                {copiedFingerprint ? (
                  <>
                    <IconCheckCircle size={14} aria-hidden="true" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={14} aria-hidden="true" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <dd className="fingerprint-display font-mono">
              {certificate.fingerprint_sha256}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

