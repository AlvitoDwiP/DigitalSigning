import { IconUsers } from '../icons/Icons';

interface AdminsEmptyProps {
  isFiltered: boolean;
  onResetFilters: () => void;
  onOpenAddModal: () => void;
}

export function AdminsEmpty({
  isFiltered,
  onResetFilters,
  onOpenAddModal,
}: AdminsEmptyProps) {
  return (
    <div className="users-empty-state-card" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <IconUsers size={32} />
      </div>
      <h2 className="empty-state-title">
        {isFiltered ? 'Tidak Ada Administrator Ditemukan' : 'Belum Ada Administrator'}
      </h2>
      <p className="empty-state-description">
        {isFiltered
          ? 'Tidak ada akun administrator yang sesuai dengan kriteria pencarian Anda.'
          : 'Belum ada akun pengguna dengan hak akses Administrator. Tetapkan Admin dari daftar pengguna terdaftar.'}
      </p>
      <div className="empty-state-actions">
        {isFiltered ? (
          <button
            type="button"
            className="btn btn-ghost empty-state-action-btn"
            onClick={onResetFilters}
          >
            Reset Pencarian
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary empty-state-action-btn"
            onClick={onOpenAddModal}
          >
            Tambah Admin
          </button>
        )}
      </div>
    </div>
  );
}
