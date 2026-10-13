import { IconFilter, IconRefresh } from '../icons/Icons';
import { labelAktivitas, hasilAktivitas } from '../../lib/labels';

interface AuditLogsToolbarProps {
  action: string;
  onActionChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  onReset: () => void;
  isFiltered: boolean;
  disabled?: boolean;
}

export const AUDIT_ACTIONS = [
  { value: '', label: 'Semua jenis aktivitas' },
  { value: 'CERTIFICATE_GENERATED', label: labelAktivitas('CERTIFICATE_GENERATED') },
  { value: 'CERTIFICATE_REGENERATED', label: labelAktivitas('CERTIFICATE_REGENERATED') },
  { value: 'USER_CREATED', label: labelAktivitas('USER_CREATED') },
  { value: 'USER_DELETED', label: labelAktivitas('USER_DELETED') },
  { value: 'PFX_PASSWORD_CHANGED', label: labelAktivitas('PFX_PASSWORD_CHANGED') },
  { value: 'ADMIN_ASSIGNED', label: labelAktivitas('ADMIN_ASSIGNED') },
  { value: 'ADMIN_REMOVED', label: labelAktivitas('ADMIN_REMOVED') },
];

export function AuditLogsToolbar({
  action,
  onActionChange,
  status,
  onStatusChange,
  onReset,
  isFiltered,
  disabled = false,
}: AuditLogsToolbarProps) {
  return (
    <div className="audit-toolbar-container">
      <div className="audit-filters-group">
        {/* Filter Jenis Aktivitas */}
        <div className="filter-select-wrapper">
          <label htmlFor="audit-action-filter" className="filter-label">
            <IconFilter size={14} className="filter-icon" aria-hidden="true" />
            <span>Jenis Aktivitas:</span>
          </label>
          <select
            id="audit-action-filter"
            className="users-filter-select"
            value={action}
            onChange={(e) => onActionChange(e.target.value)}
            disabled={disabled}
            aria-label="Filter jenis aktivitas"
          >
            {AUDIT_ACTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Hasil */}
        <div className="filter-select-wrapper">
          <label htmlFor="audit-status-filter" className="filter-label">
            <IconFilter size={14} className="filter-icon" aria-hidden="true" />
            <span>Hasil:</span>
          </label>
          <select
            id="audit-status-filter"
            className="users-filter-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={disabled}
            aria-label="Filter hasil aktivitas"
          >
            <option value="">Semua hasil</option>
            <option value="SUCCESS">{hasilAktivitas.SUCCESS || 'Berhasil'}</option>
            <option value="FAILED">{hasilAktivitas.FAILED || 'Gagal'}</option>
          </select>
        </div>

        {/* Tombol Reset Filter */}
        {isFiltered && (
          <button
            type="button"
            className="btn-audit-reset-filter"
            onClick={onReset}
            disabled={disabled}
            title="Reset semua filter"
            aria-label="Reset semua filter"
          >
            <IconRefresh size={13} aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

