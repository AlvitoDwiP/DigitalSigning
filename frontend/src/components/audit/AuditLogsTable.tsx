import { useState } from 'react';
import type { AuditLogItem } from '../../types/auditLogs';
import {
  labelAktivitas,
  hasilAktivitas,
  jenisTarget,
  formatWaktuIndonesia,
  deskripsiAktivitas,
  formatPelaku,
} from '../../lib/labels';

interface AuditLogsTableProps {
  logs: AuditLogItem[];
  onSelectLog?: (log: AuditLogItem) => void;
}

export function AuditLogsTable({ logs, onSelectLog }: AuditLogsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyTargetId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="users-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Catatan Audit Log">
      <table className="users-table audit-table">
        <thead>
          <tr>
            <th scope="col" className="col-time">Waktu</th>
            <th scope="col" className="col-action">Aktivitas</th>
            <th scope="col" className="col-target">Terkait</th>
            <th scope="col" className="col-status">Hasil</th>
            <th scope="col" className="col-actor">Dilakukan oleh</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const isCertAction = log.action === 'CERTIFICATE_REGENERATED' || log.action === 'CERTIFICATE_GENERATED';
            const targetTypeLabel = isCertAction ? 'Pengguna' : (jenisTarget[log.target_type] || log.target_type);
            const statusLabel = hasilAktivitas[log.status] || log.status;
            const isSuccess = log.status === 'SUCCESS';
            const actorDisplay = formatPelaku(log.actor_name, log.actor_role);
            const targetDisplay = log.target_name || (log.target_id ? `${targetTypeLabel} (${log.target_id.slice(0, 8)}...)` : targetTypeLabel);
            const copyId = log.target_id || log.id;
            const isCopied = copiedId === copyId;

            return (
              <tr
                key={log.id}
                className="users-table-row audit-table-row"
                onClick={() => onSelectLog?.(log)}
                style={{ cursor: 'pointer' }}
                title="Klik baris untuk melihat rincian aktivitas"
              >
                {/* Waktu */}
                <td className="col-time">
                  <span className="audit-time-text">{formatWaktuIndonesia(log.created_at)}</span>
                </td>

                {/* Aktivitas */}
                <td className="col-action">
                  <div className="audit-activity-cell">
                    <span className="audit-activity-title font-semibold">
                      {labelAktivitas(log.action)}
                    </span>
                    {/* Mobile-only info: Waktu & Pelaku */}
                    <div className="audit-mobile-meta">
                      <span className="audit-mobile-time">
                        {formatWaktuIndonesia(log.created_at)}
                      </span>
                      <span className="audit-mobile-dot">&bull;</span>
                      <span className="audit-mobile-actor">
                        oleh {actorDisplay}
                      </span>
                    </div>
                    <span className="audit-activity-desc text-muted text-xs">
                      {deskripsiAktivitas(log.action, log.status)}
                    </span>
                  </div>
                </td>

                {/* Terkait */}
                <td className="col-target">
                  <div className="audit-target-two-line">
                    <span className="audit-target-primary-name">
                      {targetDisplay}
                    </span>
                    <div className="audit-target-sub-line">
                      <span className="audit-target-type-muted">{targetTypeLabel}</span>
                      <span className="audit-target-dot">&middot;</span>
                      <button
                        type="button"
                        className={`btn-salin-id ${isCopied ? 'copied' : ''}`}
                        onClick={(e) => handleCopyTargetId(copyId, e)}
                        title={`Salin ID: ${copyId}`}
                      >
                        {isCopied ? 'Tersalin' : 'Salin ID'}
                      </button>
                    </div>
                  </div>
                </td>

                {/* Hasil */}
                <td className="col-status">
                  <div className="audit-status-dot-indicator">
                    <span
                      className={`audit-status-dot ${isSuccess ? 'dot-success' : 'dot-failed'}`}
                      aria-hidden="true"
                    />
                    <span className="audit-status-text-bold">
                      {statusLabel}
                    </span>
                  </div>
                </td>

                {/* Dilakukan oleh */}
                <td className="col-actor">
                  <span className="audit-actor-text">
                    {actorDisplay}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
