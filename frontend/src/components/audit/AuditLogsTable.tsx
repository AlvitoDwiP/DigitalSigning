import type { AuditLogItem } from '../../types/auditLogs';
import { StatusChip } from '../ui/StatusChip';
import { IconClock } from '../icons/Icons';

interface AuditLogsTableProps {
  logs: AuditLogItem[];
}

export function formatDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '-';
  }
}

export function formatActionLabel(action: string): string {
  switch (action) {
    case 'USER_CREATED':
      return 'Generate User';
    case 'USER_DELETED':
      return 'Delete User';
    case 'CERTIFICATE_GENERATED':
      return 'Generate Certificate';
    case 'CERTIFICATE_REGENERATED':
      return 'Regenerate Certificate';
    case 'PFX_PASSWORD_CHANGED':
      return 'Ubah Passphrase';
    case 'ADMIN_ASSIGNED':
      return 'Tetapkan Admin';
    case 'ADMIN_REMOVED':
      return 'Hapus Admin';
    default:
      return action;
  }
}

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  return (
    <div className="users-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Catatan Audit Log">
      <table className="users-table audit-table">
        <thead>
          <tr>
            <th scope="col" className="col-time">Waktu & Tanggal</th>
            <th scope="col" className="col-action">Aksi Sistem</th>
            <th scope="col" className="col-status">Status</th>
            <th scope="col" className="col-target">Tipe Target</th>
            <th scope="col" className="col-target-id">ID Target</th>
            <th scope="col" className="col-actor">Pelaku (User ID)</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            return (
              <tr key={log.id} className="users-table-row audit-table-row">
                {/* Timestamp */}
                <td className="col-time">
                  <div className="audit-time-cell">
                    <IconClock size={15} className="audit-clock-icon" aria-hidden="true" />
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>
                </td>

                {/* Action */}
                <td className="col-action">
                  <div className="audit-action-cell">
                    <span className="audit-action-main">{formatActionLabel(log.action)}</span>
                    <span className="audit-action-code font-mono">{log.action}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="col-status">
                  <StatusChip status={log.status} label={log.status} />
                </td>

                {/* Target Type */}
                <td className="col-target">
                  <span className="target-type-badge">{log.target_type}</span>
                </td>

                {/* Target ID */}
                <td className="col-target-id font-mono text-muted text-xs">
                  {log.target_id || '-'}
                </td>

                {/* Actor User ID */}
                <td className="col-actor font-mono text-muted text-xs">
                  {log.user_id || 'Sistem / Anonim'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
