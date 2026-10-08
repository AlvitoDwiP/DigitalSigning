import { IconAlertTriangle, IconRefresh } from '../icons/Icons';

interface UsersErrorProps {
  message: string;
  onRetry: () => void;
}

export function UsersError({ message, onRetry }: UsersErrorProps) {
  return (
    <div className="users-error-card" role="alert">
      <div className="error-icon" aria-hidden="true">
        <IconAlertTriangle size={32} />
      </div>
      <div className="error-body">
        <h3 className="error-title">Gagal Memuat Daftar Pengguna</h3>
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
