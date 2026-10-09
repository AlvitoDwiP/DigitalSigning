import { IconSearch, IconFilter, IconRefresh } from '../icons/Icons';

interface AuditLogsToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  action: string;
  onActionChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  onReset: () => void;
  isFiltered: boolean;
  disabled?: boolean;
}

export const AUDIT_ACTIONS = [
  { value: '', label: 'Semua Aksi' },
  { value: 'USER_CREATED', label: 'USER_CREATED' },
  { value: 'USER_DELETED', label: 'USER_DELETED' },
  { value: 'CERTIFICATE_GENERATED', label: 'CERTIFICATE_GENERATED' },
  { value: 'CERTIFICATE_REGENERATED', label: 'CERTIFICATE_REGENERATED' },
  { value: 'PFX_PASSWORD_CHANGED', label: 'PFX_PASSWORD_CHANGED' },
  { value: 'ADMIN_ASSIGNED', label: 'ADMIN_ASSIGNED' },
  { value: 'ADMIN_REMOVED', label: 'ADMIN_REMOVED' },
];

export function AuditLogsToolbar({
  search,
  onSearchChange,
  action,
  onActionChange,
  status,
  onStatusChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onReset,
  isFiltered,
  disabled = false,
}: AuditLogsToolbarProps) {
  return (
    <div className="users-toolbar-container audit-toolbar-container">
      <div className="users-toolbar audit-toolbar">
        {/* Search Input */}
        <div className="users-search-field">
          <span className="search-icon" aria-hidden="true">
            <IconSearch size={18} />
          </span>
          <input
            type="search"
            className="users-search-input"
            placeholder="Cari aksi, target, atau status..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            aria-label="Cari entri audit log"
          />
        </div>

        {/* Filters Group */}
        <div className="users-filters-group audit-filters-group">
          {/* Action Filter */}
          <div className="filter-select-wrapper">
            <label htmlFor="audit-action-filter" className="filter-label">
              <IconFilter size={14} aria-hidden="true" />
              <span>Aksi:</span>
            </label>
            <select
              id="audit-action-filter"
              className="users-filter-select"
              value={action}
              onChange={(e) => onActionChange(e.target.value)}
              disabled={disabled}
            >
              {AUDIT_ACTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-select-wrapper">
            <label htmlFor="audit-status-filter" className="filter-label">
              <span>Status:</span>
            </label>
            <select
              id="audit-status-filter"
              className="users-filter-select"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={disabled}
            >
              <option value="">Semua Status</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div className="filter-select-wrapper date-filter-wrapper">
            <label htmlFor="audit-start-date" className="filter-label">
              <span>Dari:</span>
            </label>
            <input
              type="date"
              id="audit-start-date"
              className="users-filter-select date-input"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              disabled={disabled}
              aria-label="Filter tanggal mulai"
            />
          </div>

          {/* Date Range End */}
          <div className="filter-select-wrapper date-filter-wrapper">
            <label htmlFor="audit-end-date" className="filter-label">
              <span>Sampai:</span>
            </label>
            <input
              type="date"
              id="audit-end-date"
              className="users-filter-select date-input"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              disabled={disabled}
              aria-label="Filter tanggal selesai"
            />
          </div>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              className="btn btn-ghost btn-sm reset-filter-btn"
              onClick={onReset}
              disabled={disabled}
              aria-label="Reset semua filter audit log"
            >
              <IconRefresh size={14} aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
