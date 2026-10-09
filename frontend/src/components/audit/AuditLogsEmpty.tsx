import { IconAudit } from '../icons/Icons';

interface AuditLogsEmptyProps {
  isFiltered: boolean;
  onResetFilters: () => void;
}

export function AuditLogsEmpty({ isFiltered, onResetFilters }: AuditLogsEmptyProps) {
  return (
    <div className="users-empty-state-card" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <IconAudit size={32} />
      </div>
      <h2 className="empty-state-title">
        {isFiltered ? 'Tidak Ada Catatan Audit Ditemukan' : 'Belum Ada Aktivitas Tercatat'}
      </h2>
      <p className="empty-state-description">
        {isFiltered
          ? 'Tidak ada log aktivitas sistem yang sesuai dengan filter atau kata kunci yang Anda masukkan.'
          : 'Belum ada rekaman log audit keamanan dalam sistem. Semua aktivitas penting akan dicatat secara otomatis.'}
      </p>
      {isFiltered && (
        <div className="empty-state-actions">
          <button
            type="button"
            className="btn btn-ghost empty-state-action-btn"
            onClick={onResetFilters}
          >
            Reset Semua Filter
          </button>
        </div>
      )}
    </div>
  );
}
