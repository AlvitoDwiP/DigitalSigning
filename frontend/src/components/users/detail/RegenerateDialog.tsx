import { useEffect, useRef } from 'react';
import type { UserDetailData } from '../../../types/users';
import { IconRefresh, IconClose, IconAlertTriangle } from '../../icons/Icons';

interface RegenerateDialogProps {
  user: UserDetailData | null;
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function RegenerateDialog({
  user,
  isOpen,
  isProcessing,
  error,
  onConfirm,
  onClose,
}: RegenerateDialogProps) {
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
      if (!isProcessing) {
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
  }, [isProcessing, onClose]);

  if (!isOpen || !user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="regenerate-dialog-title"
      aria-describedby="regenerate-dialog-description"
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconRefresh size={22} />
            </div>
            <h2 id="regenerate-dialog-title" className="dialog-title">
              Regenerate Sertifikat Digital
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Tutup dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          <p id="regenerate-dialog-description" className="dialog-main-text">
            Apakah Anda yakin ingin menerbitkan ulang sertifikat digital X.509 untuk <strong>{user.name}</strong>?
          </p>

          <div className="regenerate-explanation-box">
            <div className="explanation-item">
              <strong>Penerbitan Baru:</strong>
              <span>Pasangan kunci kriptografi baru dan sertifikat baru akan digenerate melalui PKI Service.</span>
            </div>
            <div className="explanation-item">
              <strong>Sertifikat Lama:</strong>
              <span>Setelah sertifikat baru berhasil diterbitkan dan divalidasi, sertifikat lama otomatis berubah status menjadi <strong>REPLACED</strong>.</span>
            </div>
            <div className="explanation-item">
              <strong>Ketahanan Kegagalan:</strong>
              <span>Jika proses penerbitan gagal, sertifikat lama akan <strong>tetap berstatus ACTIVE</strong> tanpa perubahan.</span>
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
            disabled={isProcessing}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary dialog-btn-confirm"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Menerbitkan...' : 'Terbitkan Sertifikat Baru'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
