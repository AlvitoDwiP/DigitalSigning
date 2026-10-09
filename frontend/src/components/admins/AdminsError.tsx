import { IconAlertTriangle, IconRefresh } from '../icons/Icons';

interface AdminsErrorProps {
  message: string;
  onRetry: () => void;
}

export function AdminsError({ message, onRetry }: AdminsErrorProps) {
  return (
    <div className="users-error-card" role="alert">
      <div className="error-icon" aria-hidden="true">
        <IconAlertTriangle size={32} />
      </div>
      <div className="error-body">
        <h2 className="error-title">Gagal Memuat Daftar Administrator</h2>
        <p className="error-description">{message}</p>
      </div>
      <button
        type="button"
        className="btn btn-ghost error-retry-btn"
        onClick={onRetry}
      >
        <IconRefresh size={16} aria-hidden="true" />
        <span>Muat Ulang</span>
      </button>
    </div>
  );
}
