import { IconChevronLeft, IconChevronRight } from '../icons/Icons';

interface AuditLogsPaginationProps {
  currentPage: number;
  limit: number;
  total: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function AuditLogsPagination({
  currentPage,
  limit,
  total,
  onPageChange,
  disabled = false,
}: AuditLogsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Sembunyikan pagination bila total tidak melebihi satu halaman
  if (total <= limit) {
    if (total === 0) return null;
    return (
      <div className="users-pagination-container" style={{ justifyContent: 'flex-start' }}>
        <div className="pagination-info">
          <span>{total} aktivitas</span>
        </div>
      </div>
    );
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav className="users-pagination-container" aria-label="Navigasi Halaman Audit Log">
      <div className="pagination-info">
        <span>{total} aktivitas</span>
        <span className="pagination-page-indicator">
          (Halaman {currentPage} dari {totalPages})
        </span>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="btn-pagination"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev || disabled}
          aria-label="Halaman sebelumnya"
        >
          <IconChevronLeft size={16} aria-hidden="true" />
          <span>Sebelumnya</span>
        </button>

        <div className="pagination-pages-list" aria-hidden="true">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = i + 1;
            if (totalPages > 5) {
              if (currentPage > 3) {
                p = currentPage - 3 + i;
              }
              if (p + (4 - i) > totalPages) {
                p = totalPages - 4 + i;
              }
            }
            if (p < 1 || p > totalPages) return null;

            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                className={`btn-pagination-number ${isCurrent ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
                disabled={disabled}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn-pagination"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext || disabled}
          aria-label="Halaman berikutnya"
        >
          <span>Berikutnya</span>
          <IconChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
