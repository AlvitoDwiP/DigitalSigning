import { ErrorStateCard } from '../components/common/ErrorStateCard';
import { IconWifiOff, IconRefresh, IconDashboard } from '../components/icons/Icons';

export interface ServiceUnavailablePageProps {
  onRetry?: () => void;
  onNavigate?: (path: string) => void;
  isStandalone?: boolean;
}

export function ServiceUnavailablePage({
  onRetry,
  onNavigate,
  isStandalone = false,
}: ServiceUnavailablePageProps) {
  const handleGoDashboard = () => {
    if (onNavigate) {
      onNavigate('/dashboard');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <ErrorStateCard
      code="503"
      title="Layanan Tidak Tersedia"
      description="Layanan sedang tidak dapat dihubungi. Periksa koneksi Anda atau coba kembali beberapa saat lagi."
      icon={<IconWifiOff size={36} />}
      badgeVariant="amber"
      isStandalone={isStandalone}
      primaryAction={{
        label: 'Coba Lagi',
        onClick: handleRetry,
        icon: <IconRefresh size={16} />,
        variant: 'primary',
      }}
      secondaryAction={
        onNavigate
          ? {
              label: 'Kembali ke Dashboard',
              onClick: handleGoDashboard,
              icon: <IconDashboard size={16} />,
              variant: 'secondary',
            }
          : undefined
      }
    />
  );
}
