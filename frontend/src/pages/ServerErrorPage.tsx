import { ErrorStateCard } from '../components/common/ErrorStateCard';
import { IconServer, IconRefresh, IconDashboard } from '../components/icons/Icons';

export interface ServerErrorPageProps {
  onRetry?: () => void;
  onNavigate?: (path: string) => void;
  isStandalone?: boolean;
}

export function ServerErrorPage({
  onRetry,
  onNavigate,
  isStandalone = false,
}: ServerErrorPageProps) {
  const handleGoDashboard = () => {
    if (onNavigate) {
      onNavigate('/dashboard');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  return (
    <ErrorStateCard
      code="500"
      title="Terjadi Kesalahan"
      description="Terjadi kesalahan saat memproses permintaan. Silakan coba kembali beberapa saat lagi."
      icon={<IconServer size={36} />}
      badgeVariant="red"
      isStandalone={isStandalone}
      primaryAction={
        onRetry
          ? {
              label: 'Coba Lagi',
              onClick: onRetry,
              icon: <IconRefresh size={16} />,
              variant: 'primary',
            }
          : {
              label: 'Kembali ke Dashboard',
              onClick: handleGoDashboard,
              icon: <IconDashboard size={16} />,
              variant: 'primary',
            }
      }
      secondaryAction={
        onRetry
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
