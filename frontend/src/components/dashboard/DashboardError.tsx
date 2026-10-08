import { IconAlertTriangle, IconRefresh } from '../icons/Icons';
import { Button } from '../ui/Button';

interface DashboardErrorProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function DashboardError({
  message = 'Gagal memuat data dashboard operasional.',
  onRetry,
  isRetrying = false,
}: DashboardErrorProps) {
  return (
    <div className="card dashboard-error-card" role="alert" aria-live="assertive">
      <div className="error-icon-badge" aria-hidden="true">
        <IconAlertTriangle size={32} />
      </div>

      <h2 className="error-title">Halaman gagal dimuat</h2>
      <p className="error-description">
        {message}
      </p>

      <div className="error-actions">
        <Button
          variant="primary"
          onClick={onRetry}
          loading={isRetrying}
          icon={<IconRefresh size={18} />}
        >
          Muat Ulang
        </Button>
      </div>
    </div>
  );
}
