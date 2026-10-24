import { useState } from 'react';
import type { UserCertificate } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { IconClock, IconCopy, IconCheckCircle } from '../../icons/Icons';
import { statusSertifikat } from '../../../lib/labels';

interface CertificateHistoryCardProps {
  history: UserCertificate[] | undefined;
}

export function CertificateHistoryCard({ history }: CertificateHistoryCardProps) {
  const items = history || [];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyFingerprint = (id: string, text: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  return (
    <section className="detail-card cert-history-card" aria-labelledby="cert-history-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconClock size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="cert-history-title" className="detail-card-title">
            Riwayat sertifikat
          </h2>
          <span className="history-count-badge">
            {items.length} sertifikat
          </span>
        </div>
      </div>

      <div className="detail-card-body no-padding">
        {items.length === 0 ? (
          <div className="empty-history-notice">
            <p>Belum ada riwayat sertifikat untuk pengguna ini.</p>
          </div>
        ) : (
          <div className="cert-history-table-wrapper" tabIndex={0} aria-label="Tabel Riwayat Sertifikat">
            <table className="cert-history-table">
              <thead>
                <tr>
                  <th scope="col">Nomor sertifikat</th>
                  <th scope="col">Status</th>
                  <th scope="col">Diterbitkan pada</th>
                  <th scope="col">Berlaku sampai</th>
                  <th scope="col">Sidik jari digital</th>
                </tr>
              </thead>
              <tbody>
                {items.map((cert) => (
                  <tr key={cert.id} className="history-table-row">
                    <td className="font-mono text-nowrap">{cert.certificate_number || cert.serial_number}</td>
                    <td>
                      <StatusChip
                        status={cert.status}
                        label={statusSertifikat[cert.status] || cert.status}
                      />
                    </td>
                    <td className="text-nowrap">{formatDate(cert.issued_at)}</td>
                    <td className="text-nowrap">{formatDate(cert.expires_at)}</td>
                    <td className="fingerprint-cell">
                      <div className="fingerprint-table-inline">
                        <span className="fingerprint-table-code font-mono">
                          {cert.fingerprint_sha256}
                        </span>
                        <button
                          type="button"
                          className="btn-copy-fingerprint-sm"
                          onClick={() => handleCopyFingerprint(cert.id, cert.fingerprint_sha256)}
                          title="Salin sidik jari digital"
                          aria-label={`Salin sidik jari digital untuk sertifikat ${cert.serial_number}`}
                        >
                          {copiedId === cert.id ? (
                            <IconCheckCircle size={13} aria-hidden="true" />
                          ) : (
                            <IconCopy size={13} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
