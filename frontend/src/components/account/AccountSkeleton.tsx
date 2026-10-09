export function AccountSkeleton() {
  return (
    <div className="detail-skeleton-container" aria-busy="true" aria-label="Memuat data akun...">
      <div className="skeleton-card skeleton-card-user" />
      <div className="skeleton-card skeleton-card-cert" />
    </div>
  );
}
