import { useEffect, useRef } from 'react';
import { IconAlertTriangle, IconClose, IconKey } from '../icons/Icons';

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
      className="custom-modal-dialog danger-alert-modal"
      aria-labelledby="first-login-alert-title"
      aria-describedby="first-login-alert-description"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="dialog-content-wrapper">
        {/* Header - Danger Styling */}
        <div className="dialog-header danger-header">
          <div className="dialog-header-title-group">
            <div className="dialog-danger-icon" aria-hidden="true">
              <IconAlertTriangle size={22} />
            </div>
            <div>
              <h2 id="first-login-alert-title" className="dialog-title text-danger">
                Peringatan Keamanan Akun
              </h2>
              <span className="badge-danger-tag">Penting</span>
            </div>
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

        {/* Body - Danger Alert Box */}
        <div className="dialog-body">
          <div className="dialog-danger-box" role="alert">
            <IconAlertTriangle size={24} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div className="dialog-danger-box-title">Wajib Perbarui Password Anda Segera!</div>
              <p id="first-login-alert-description" className="dialog-danger-box-desc">
                Akun Anda terindikasi masih menggunakan kata sandi awal atau belum diperbarui. Demi menjaga keamanan akun dan melindungi data dokumen tanda tangan elektronik (TTE), Anda sangat disarankan untuk segera memperbarui kata sandi Anda.
              </p>
            </div>
          </div>

          <div className="dialog-danger-advice" style={{ marginTop: '12px' }}>
            <p>Ketentuan kata sandi yang aman:</p>
            <ul>
              <li>Minimal 8 karakter</li>
              <li>Kombinasi huruf besar (A-Z) dan huruf kecil (a-z)</li>
              <li>Mengandung angka (0-9) dan simbol khusus (!@#$%^&*)</li>
            </ul>
          </div>
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
            className="btn btn-danger-solid dialog-btn-confirm"
            onClick={onConfirm}
            autoFocus
          >
            <IconKey size={15} style={{ marginRight: '6px' }} />
            Perbarui Password
          </button>
        </div>
      </div>
    </dialog>
  );
}

