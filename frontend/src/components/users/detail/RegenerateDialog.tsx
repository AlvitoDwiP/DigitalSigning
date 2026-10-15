import { useState, useEffect, useRef } from 'react';
import type { UserDetailData } from '../../../types/users';
import { PasswordInput } from '../../ui/PasswordInput';
import { IconLock, IconClose, IconAlertTriangle } from '../../icons/Icons';

interface RegenerateDialogProps {
  user: UserDetailData | null;
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  onConfirm: (password: string) => void;
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
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Bersihkan input password saat modal dibuka atau ditutup
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setValidationError(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmed = password.trim();
    if (!trimmed) {
      setValidationError('Password akun Admin wajib diisi.');
      return;
    }

    onConfirm(trimmed);
  };

  if (!isOpen || !user) return null;

  const activeError = validationError || error;

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
              <IconLock size={22} />
            </div>
            <h2 id="regenerate-dialog-title" className="dialog-title">
              Verifikasi Password Admin
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

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div className="dialog-body">
            <p id="regenerate-dialog-description" className="dialog-main-text">
              Masukkan password akun Anda untuk mengonfirmasi penerbitan ulang sertifikat bagi <strong>{user.name}</strong>.
            </p>

            {activeError && (
              <div className="dialog-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
                <IconAlertTriangle size={16} aria-hidden="true" />
                <span>{activeError}</span>
              </div>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <PasswordInput
                id="admin-verify-password"
                label="Password Admin"
                placeholder="Masukkan password akun Anda"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isProcessing}
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
              disabled={isProcessing}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary dialog-btn-confirm"
              disabled={isProcessing || !password.trim()}
            >
              {isProcessing ? 'Memverifikasi...' : 'Verifikasi & Terbitkan Ulang'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
