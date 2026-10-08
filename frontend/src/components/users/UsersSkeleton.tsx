export function UsersSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="users-skeleton-wrapper" aria-busy="true" aria-label="Memuat data pengguna...">
      <div className="users-skeleton-table">
        <div className="skeleton-table-header">
          <div className="skeleton-cell w-25" />
          <div className="skeleton-cell w-20" />
          <div className="skeleton-cell w-20" />
          <div className="skeleton-cell w-10" />
          <div className="skeleton-cell w-10" />
          <div className="skeleton-cell w-15" />
        </div>
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="skeleton-table-row">
            <div className="skeleton-cell w-25">
              <div className="skeleton-avatar" />
              <div className="skeleton-text-block" />
            </div>
            <div className="skeleton-cell w-20">
              <div className="skeleton-text-mono" />
            </div>
            <div className="skeleton-cell w-20">
              <div className="skeleton-text-line" />
            </div>
            <div className="skeleton-cell w-10">
              <div className="skeleton-chip" />
            </div>
            <div className="skeleton-cell w-10">
              <div className="skeleton-chip" />
            </div>
            <div className="skeleton-cell w-15">
              <div className="skeleton-btn" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
