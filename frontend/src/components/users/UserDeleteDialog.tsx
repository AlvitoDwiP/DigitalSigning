import { useEffect, useRef } from 'react';
import type { UserItem } from '../../types/users';
import { IconAlertTriangle, IconClose } from '../icons/Icons';

interface UserDeleteDialogProps {
  user: UserItem | null;
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function UserDeleteDialog({
  user,
  isOpen,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: UserDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!isDeleting) {
        onClose();
      }
    };

    const dialog = dialogRef.current;
    if (dialog) {
      dialog.addEventListener('cancel', handleCancel);
    }
    return () => {
      if (dialog) {
        dialog.removeEventListener('cancel', handleCancel);
      }
    };
  }, [isDeleting, onClose]);

  if (!isOpen || !user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-warning-icon" aria-hidden="true">
              <IconAlertTriangle size={22} />
            </div>
            <h2 id="delete-dialog-title" className="dialog-title">
              Hapus pengguna?
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          <div className="dialog-danger-box" role="alert">
            <div className="danger-box-icon" aria-hidden="true">
              <IconAlertTriangle size={20} />
            </div>
            <div className="danger-box-content">
              <p id="delete-dialog-description" className="dialog-danger-box-desc">
                Hapus <strong>{user.name}</strong>? Akun beserta sertifikatnya akan dihapus dan tidak bisa dikembalikan.
              </p>
            </div>
          </div>

          {error && (
            <div className="dialog-error-banner" role="alert">
              <IconAlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-ghost dialog-btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger dialog-btn-confirm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
