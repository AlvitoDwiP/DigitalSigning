import { useState, Fragment } from 'react';
import type { AuditLogItem } from '../../types/auditLogs';
import { StatusChip } from '../ui/StatusChip';
import { IconClock } from '../icons/Icons';
import {
  labelAktivitas,
  hasilAktivitas,
  jenisTarget,
  formatWaktuIndonesia,
} from '../../lib/labels';

interface AuditLogsTableProps {
  logs: AuditLogItem[];
}

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
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
            <th scope="col" className="col-status">Hasil</th>
            <th scope="col" className="col-target">Terkait</th>
            <th scope="col" className="col-actor">Dilakukan oleh</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const targetLabel = jenisTarget[log.target_type] || log.target_type;
            const statusLabel = hasilAktivitas[log.status] || log.status;
            const actorDisplay = log.user_id ? log.user_id : 'Tidak tercatat';

            return (
              <Fragment key={log.id}>
                <tr
                  className="users-table-row audit-table-row"
                  onClick={() => toggleRow(log.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Waktu */}
                  <td className="col-time">
                    <div className="audit-time-cell">
                      <IconClock size={15} className="audit-clock-icon" aria-hidden="true" />
                      <span>{formatWaktuIndonesia(log.created_at)}</span>
                    </div>
                  </td>

                  {/* Aktivitas */}
                  <td className="col-action">
                    <div className="audit-action-cell">
                      <span className="audit-action-main">{labelAktivitas(log.action)}</span>
                    </div>
                  </td>

                  {/* Hasil */}
                  <td className="col-status">
                    <StatusChip status={log.status} label={statusLabel} />
                  </td>

                  {/* Terkait */}
                  <td className="col-target">
                    <span className="text-secondary">{targetLabel}</span>
                  </td>

                  {/* Dilakukan oleh */}
                  <td className="col-actor text-muted text-xs">
                    {actorDisplay}
                  </td>
                </tr>

                {/* Expandable Details for ID Target */}
                {isExpanded && (
                  <tr className="audit-expand-row">
                    <td
                      colSpan={5}
                      style={{
                        padding: '10px 16px 14px 16px',
                        backgroundColor: 'var(--bg-muted, rgba(0, 0, 0, 0.03))',
                        borderTop: '1px dashed var(--border-color, #e2e8f0)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary, #64748b)' }}>ID Target:</span>
                        <code className="font-mono text-xs" style={{ background: 'var(--bg-card, #fff)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                          {log.target_id || '-'}
                        </code>
                        {log.target_id && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                            onClick={(e) => handleCopy(e, log.target_id!, log.id)}
                          >
                            {copiedId === log.id ? 'Tersalin' : 'Salin ID'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
