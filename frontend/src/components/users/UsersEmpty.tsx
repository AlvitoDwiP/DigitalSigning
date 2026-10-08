import { IconUsers, IconFilter } from '../icons/Icons';

interface UsersEmptyProps {
  isFiltered: boolean;
  onResetFilters: () => void;
  onNavigateGenerate?: () => void;
}

export function UsersEmpty({ isFiltered, onResetFilters, onNavigateGenerate }: UsersEmptyProps) {
  if (isFiltered) {
    return (
      <div className="users-empty-state-card" role="status">
        <div className="empty-state-icon" aria-hidden="true">
          <IconFilter size={32} />
        </div>
        <h3 className="empty-state-title">Tidak Ada Hasil yang Cocok</h3>
        <p className="empty-state-description">
          Tidak ditemukan pengguna yang sesuai dengan kriteria pencarian atau filter yang Anda pilih.
        </p>
        <button
          type="button"
          className="btn btn-ghost empty-state-action-btn"
          onClick={onResetFilters}
        >
          Reset Filter dan Pencarian
        </button>
      </div>
    );
  }

  return (
    <div className="users-empty-state-card" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <IconUsers size={32} />
      </div>
      <h3 className="empty-state-title">Belum Ada Pengguna</h3>
      <p className="empty-state-description">
        Sistem belum memiliki data pengguna. Pengguna baru dapat diterbitkan melalui modul Generate.
      </p>
      {onNavigateGenerate && (
        <button
          type="button"
          className="btn btn-primary empty-state-action-btn"
          onClick={onNavigateGenerate}
        >
          Buka Halaman Generate
        </button>
      )}
    </div>
  );
}
