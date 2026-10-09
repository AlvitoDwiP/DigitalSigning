interface AuditLogsSkeletonProps {
  rows?: number;
}

export function AuditLogsSkeleton({ rows = 10 }: AuditLogsSkeletonProps) {
  return (
    <div className="users-table-skeleton" aria-busy="true" aria-label="Memuat catatan audit log...">
      <div className="skeleton-table-header" />
      <div className="skeleton-table-rows">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="skeleton-row">
            <div className="skeleton-cell cell-date" />
            <div className="skeleton-cell cell-avatar-name" />
            <div className="skeleton-cell cell-chip" />
            <div className="skeleton-cell cell-chip" />
            <div className="skeleton-cell cell-nik" />
            <div className="skeleton-cell cell-email" />
          </div>
        ))}
      </div>
    </div>
  );
}
