import type { UserCertificate } from '../../../types/users';
import { formatDate } from '../UsersTable';
import { StatusChip } from '../../ui/StatusChip';
import { IconClock } from '../../icons/Icons';
import { statusSertifikat } from '../../../lib/labels';

interface CertificateHistoryCardProps {
  history: UserCertificate[] | undefined;
}

export function CertificateHistoryCard({ history }: CertificateHistoryCardProps) {
  const items = history || [];

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
                    <td className="font-mono">{cert.serial_number}</td>
                    <td>
                      <StatusChip
                        status={cert.status}
                        label={statusSertifikat[cert.status] || cert.status}
                      />
                    </td>
                    <td>{formatDate(cert.issued_at)}</td>
                    <td>{formatDate(cert.expires_at)}</td>
                    <td className="font-mono text-break fingerprint-cell">
                      {cert.fingerprint_sha256}
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
