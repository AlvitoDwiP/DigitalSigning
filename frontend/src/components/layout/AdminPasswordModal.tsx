import { useState, useEffect, useRef } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import { IconLock, IconClose, IconAlertTriangle } from '../icons/Icons';
import { verifyCurrentPassword } from '../../services/api';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminPasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: AdminPasswordModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

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
      if (!isSubmitting) {
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
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMsg('Password akun Admin wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await verifyCurrentPassword(trimmed);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Password yang Anda masukkan salah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="admin-mode-dialog-title"
      aria-describedby="admin-mode-dialog-description"
      onClick={(e) => {
        if (e.target === dialogRef.current && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconLock size={22} />
            </div>
            <h2 id="admin-mode-dialog-title" className="dialog-title">
              Verifikasi Masuk Mode Admin
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div className="dialog-body">
            <p id="admin-mode-dialog-description" className="dialog-main-text">
              Masukkan password akun Anda untuk mengonfirmasi akses kembali ke <strong>Mode Admin</strong>.
            </p>

            {errorMsg && (
              <div className="dialog-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
                <IconAlertTriangle size={16} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <PasswordInput
                id="admin-mode-verify-password"
                label="Password Admin"
                placeholder="Masukkan password akun Anda"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="dialog-footer">
            <button
              type="button"
              className="btn btn-ghost dialog-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary dialog-btn-confirm"
              disabled={isSubmitting || !password.trim()}
            >
              {isSubmitting ? 'Memverifikasi...' : 'Konfirmasi & Masuk'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
