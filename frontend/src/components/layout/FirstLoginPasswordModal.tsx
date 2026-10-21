import { useEffect, useRef } from 'react';
import { IconShield, IconClose } from '../icons/Icons';

interface FirstLoginPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function FirstLoginPasswordModal({
  isOpen,
  onClose,
  onConfirm,
}: FirstLoginPasswordModalProps) {
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
      onClose();
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
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="first-login-alert-title"
      aria-describedby="first-login-alert-description"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconShield size={22} />
            </div>
            <h2 id="first-login-alert-title" className="dialog-title">
              Pengingat Ganti Password
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Tutup dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          <p id="first-login-alert-description" className="dialog-main-text">
            Akun Anda terindikasi masih menggunakan kata sandi awal/bawaan sistem. Demi menjaga keamanan akun dan privasi data Anda, disarankan untuk segera mengganti kata sandi Anda.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-ghost dialog-btn-cancel"
            onClick={onClose}
          >
            Nanti Saja
          </button>
          <button
            type="button"
            className="btn btn-primary dialog-btn-confirm"
            onClick={onConfirm}
            autoFocus
          >
            Ganti Password
          </button>
        </div>
      </div>
    </dialog>
  );
}
