import { ErrorStateCard } from '../components/common/ErrorStateCard';
import { IconAlertTriangle, IconDashboard } from '../components/icons/Icons';

export interface ForbiddenPageProps {
  onNavigate?: (path: string) => void;
  isStandalone?: boolean;
}

export function ForbiddenPage({ onNavigate, isStandalone = false }: ForbiddenPageProps) {
  const handleGoDashboard = () => {
    if (onNavigate) {
      onNavigate('/dashboard');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  return (
    <ErrorStateCard
      code="403"
      title="Akses Tidak Diizinkan"
      description="Anda tidak memiliki izin untuk mengakses halaman ini."
      icon={<IconAlertTriangle size={36} />}
      badgeVariant="red"
      isStandalone={isStandalone}
      primaryAction={{
        label: 'Kembali ke Dashboard',
        onClick: handleGoDashboard,
        icon: <IconDashboard size={16} />,
        variant: 'primary',
      }}
    />
  );
}
