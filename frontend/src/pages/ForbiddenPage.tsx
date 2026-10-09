import { IconAlertTriangle } from '../components/icons/Icons';

interface ForbiddenPageProps {
  onNavigate: (path: string) => void;
  message?: string;
}

export function ForbiddenPage({
  onNavigate,
  message = 'Anda tidak memiliki hak akses (Role) untuk membuka halaman ini.',
}: ForbiddenPageProps) {
  return (
    <div className="users-page-container forbidden-page-container">
      <div className="users-empty-state-card forbidden-card" role="alert">
        <div className="empty-state-icon forbidden-icon" aria-hidden="true">
          <IconAlertTriangle size={36} />
        </div>
        <h1 className="empty-state-title">Akses Ditolak (403 Forbidden)</h1>
        <p className="empty-state-description">{message}</p>
        <div className="empty-state-actions">
          <button
            type="button"
            className="btn btn-primary empty-state-action-btn"
            onClick={() => onNavigate('/dashboard')}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
