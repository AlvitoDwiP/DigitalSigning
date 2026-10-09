import {
  IconDashboard,
  IconUsers,
  IconGenerate,
  IconAudit,
  IconSignature
} from '../components/icons/Icons';
import { StatusChip } from '../components/ui/StatusChip';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  iconName?: string;
  isReserved?: boolean;
  roleAccess?: string;
}

export function PlaceholderPage({
  title,
  subtitle = 'Fitur ini akan diimplementasikan pada tahap frontend berikutnya.',
  iconName,
  isReserved = false,
  roleAccess = 'ADMIN, USER',
}: PlaceholderPageProps) {
  const getIcon = () => {
    switch (iconName) {
      case 'dashboard':
        return <IconDashboard size={32} />;
      case 'users':
        return <IconUsers size={32} />;
      case 'generate':
        return <IconGenerate size={32} />;
      case 'audit-logs':
        return <IconAudit size={32} />;
      case 'signing':
        return <IconSignature size={32} />;
      default:
        return <IconDashboard size={32} />;
    }
  };

  return (
    <div className="placeholder-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title-group">
          <h1 className="page-title">{title}</h1>
          {isReserved && (
            <StatusChip status="RESERVED" label="Segera Hadir" />
          )}
        </div>
        <p className="page-subtitle">Portal Administrasi Digital Signature Platform</p>
      </div>

      {/* Placeholder Container Card */}
      <div className="card placeholder-card">
        <div className="placeholder-icon-badge" aria-hidden="true">
          {getIcon()}
        </div>
        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-description">{subtitle}</p>

        <div className="placeholder-details">
          <div className="detail-item">
            <span className="detail-label">Status Modul</span>
            <span className="detail-value">
              {isReserved ? 'Reserved for Future Phase' : 'Foundation Ready (FE-1A Shell Active)'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Role Akses</span>
            <span className="detail-value">{roleAccess}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
