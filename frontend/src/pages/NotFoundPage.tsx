import { ErrorStateCard } from '../components/common/ErrorStateCard';
import { IconFileQuestion, IconArrowLeft, IconDashboard } from '../components/icons/Icons';

export interface NotFoundPageProps {
  onNavigate?: (path: string) => void;
  isStandalone?: boolean;
}

export function NotFoundPage({ onNavigate, isStandalone = false }: NotFoundPageProps) {
  const hasHistory = typeof window !== 'undefined' && window.history && window.history.length > 1;

  const handleGoDashboard = () => {
    if (onNavigate) {
      onNavigate('/dashboard');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  };

  return (
    <ErrorStateCard
      code="404"
      title="Halaman Tidak Ditemukan"
      description="Halaman yang Anda cari tidak ditemukan atau mungkin sudah dipindahkan."
      icon={<IconFileQuestion size={36} />}
      badgeVariant="muted"
      isStandalone={isStandalone}
      primaryAction={{
        label: 'Kembali ke Dashboard',
        onClick: handleGoDashboard,
        icon: <IconDashboard size={16} />,
        variant: 'primary',
      }}
      secondaryAction={
        hasHistory
          ? {
              label: 'Kembali ke Halaman Sebelumnya',
              onClick: handleGoBack,
              icon: <IconArrowLeft size={16} />,
              variant: 'secondary',
            }
          : undefined
      }
    />
  );
}
