export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-container" aria-busy="true" aria-label="Memuat data dashboard">
      {/* Header Skeleton */}
      <div className="skeleton-page-header">
        <div className="skeleton-line skeleton-title" style={{ width: '220px', height: '32px' }} />
        <div className="skeleton-line skeleton-subtitle" style={{ width: '360px', height: '18px', marginTop: '8px' }} />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="dashboard-stats-grid">
        <div className="card stat-card skeleton-card">
          <div className="skeleton-line" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <div className="skeleton-line" style={{ width: '80px', height: '14px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '100px', height: '44px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '140px', height: '12px', marginTop: '8px' }} />
        </div>
        <div className="card stat-card skeleton-card">
          <div className="skeleton-line" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <div className="skeleton-line" style={{ width: '90px', height: '14px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '120px', height: '56px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '160px', height: '12px', marginTop: '8px' }} />
        </div>
        <div className="card stat-card skeleton-card">
          <div className="skeleton-line" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <div className="skeleton-line" style={{ width: '70px', height: '14px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '90px', height: '44px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '150px', height: '12px', marginTop: '8px' }} />
        </div>
      </div>

      {/* Expiry Cards Skeleton */}
      <div className="dashboard-expiry-grid">
        <div className="card skeleton-card" style={{ minHeight: '260px' }}>
          <div className="skeleton-line" style={{ width: '180px', height: '20px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '48px', marginTop: '20px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '48px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '48px', marginTop: '12px' }} />
        </div>
        <div className="card skeleton-card" style={{ minHeight: '260px' }}>
          <div className="skeleton-line" style={{ width: '180px', height: '20px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '54px', marginTop: '20px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '54px', marginTop: '12px' }} />
          <div className="skeleton-line" style={{ width: '100%', height: '54px', marginTop: '12px' }} />
        </div>
      </div>

      {/* Activities Skeleton */}
      <div className="card skeleton-card" style={{ minHeight: '220px' }}>
        <div className="skeleton-line" style={{ width: '160px', height: '20px' }} />
        <div className="skeleton-line" style={{ width: '100%', height: '40px', marginTop: '20px' }} />
        <div className="skeleton-line" style={{ width: '100%', height: '40px', marginTop: '12px' }} />
        <div className="skeleton-line" style={{ width: '100%', height: '40px', marginTop: '12px' }} />
      </div>
    </div>
  );
}
