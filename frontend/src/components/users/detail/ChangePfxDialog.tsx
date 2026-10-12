import { useState, useEffect, useRef } from 'react';
import type { UserDetailData } from '../../../types/users';
import { PasswordInput } from '../../ui/PasswordInput';
import { IconLock, IconClose, IconAlertTriangle } from '../../icons/Icons';

interface ChangePfxDialogProps {
  user: UserDetailData | null;
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  onConfirm: (newPassword: string, confirmPassword: string) => void;
  onClose: () => void;
}

export function ChangePfxDialog({
  user,
  isOpen,
  isProcessing,
  error,
  onConfirm,
  onClose,
}: ChangePfxDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clear inputs whenever dialog opens or closes
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
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

    if (!newPassword) {
      setValidationError('Passphrase baru wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setValidationError('Passphrase baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError('Passphrase tidak cocok.');
      return;
    }

    onConfirm(newPassword, confirmPassword);
  };

  if (!isOpen || !user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="change-pfx-dialog-title"
      aria-describedby="change-pfx-dialog-description"
    >
      <form onSubmit={handleSubmit} className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconLock size={22} />
            </div>
            <h2 id="change-pfx-dialog-title" className="dialog-title">
              Ubah passphrase
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
          <p id="change-pfx-dialog-description" className="dialog-main-text">
            Ganti passphrase untuk membuka berkas sertifikat milik <strong>{user.name}</strong>.
          </p>

          <p className="dialog-plain-hint text-muted" style={{ margin: '8px 0 16px 0', fontSize: '13px' }}>
            Hanya passphrase yang berganti. Sertifikat dan masa berlakunya tetap sama.
          </p>

          <div className="pfx-inputs-stack">
            <PasswordInput
              id="new-pfx-password"
              name="new_pfx_password"
              label="Passphrase baru"
              helperText="Minimal 8 karakter"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setValidationError(null);
              }}
              disabled={isProcessing}
              autoComplete="new-password"
            />

            <PasswordInput
              id="confirm-pfx-password"
              name="confirm_pfx_password"
              label="Ulangi passphrase baru"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setValidationError(null);
              }}
              disabled={isProcessing}
              autoComplete="new-password"
            />
          </div>

          {(validationError || error) && (
            <div className="dialog-error-banner" role="alert">
              <IconAlertTriangle size={16} aria-hidden="true" />
              <span>{validationError || error}</span>
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
            type="submit"
            className="btn btn-primary dialog-btn-confirm"
            disabled={isProcessing}
          >
            {isProcessing ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
