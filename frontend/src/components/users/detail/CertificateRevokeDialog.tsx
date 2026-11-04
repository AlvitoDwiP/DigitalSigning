import { useState, useEffect, useRef } from 'react';
import type { UserDetailData } from '../../../types/users';
import { IconAlertTriangle, IconClose, IconInfo } from '../../icons/Icons';
import { PasswordInput } from '../../ui/PasswordInput';

interface CertificateRevokeDialogProps {
  user: UserDetailData | null;
  isOpen: boolean;
  isRevoking: boolean;
  error: string | null;
  onConfirm: (reason: string, adminPassword: string) => void;
  onClose: () => void;
}

export function CertificateRevokeDialog({
  user,
  isOpen,
  isRevoking,
  error,
  onConfirm,
  onClose,
}: CertificateRevokeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setAdminPassword('');
      setLocalError(null);
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
      if (!isRevoking) {
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
  }, [isRevoking, onClose]);

  if (!isOpen || !user || !user.active_certificate) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setLocalError('Kata sandi admin wajib diisi untuk konfirmasi.');
      return;
    }
    setLocalError(null);
    onConfirm('unspecified', adminPassword.trim());
  };

  const displayError = localError || error;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog danger-alert-modal"
      aria-labelledby="revoke-cert-title"
      aria-describedby="revoke-cert-desc"
    >
      <form onSubmit={handleSubmit} className="dialog-content-wrapper">
        <div className="dialog-header danger-header">
          <div className="dialog-header-title-group">
            <div className="dialog-danger-icon" aria-hidden="true">
              <IconAlertTriangle size={22} />
            </div>
            <h2 id="revoke-cert-title" className="dialog-title text-danger">
              Cabut Sertifikat
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isRevoking}
            aria-label="Tutup dialog konfirmasi cabut sertifikat"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-danger-box" role="alert">
            <div className="danger-box-icon" aria-hidden="true">
              <IconAlertTriangle size={20} />
            </div>
            <div className="danger-box-content">
              <p id="revoke-cert-desc" className="dialog-danger-box-desc">
                Apakah Anda yakin ingin mencabut sertifikat aktif milik <strong>{user.name}</strong>? Tindakan ini bersifat permanen.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label htmlFor="revoke-admin-password" className="form-label font-semibold text-sm">
              Kata Sandi Admin <span className="text-danger">*</span>:
            </label>
            <div style={{ marginTop: '6px' }}>
              <PasswordInput
                id="revoke-admin-password"
                placeholder="Masukkan kata sandi admin Anda"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  if (localError) setLocalError(null);
                }}
                disabled={isRevoking}
                required
              />
            </div>
          </div>

          <div className="dialog-info-box-blue" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <IconInfo size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Informasi Pencabutan:</strong>
                <span>
                  Sertifikat yang telah dicabut tidak dapat lagi digunakan untuk menandatangani dokumen baru dan akan otomatis ditandai tidak valid oleh aplikasi pembaca PDF. Seluruh berkas sertifikat dan riwayat dokumen tetap tersimpan secara aman sebagai bukti keabsahan historis.
                </span>
              </div>
            </div>
          </div>

          {displayError && (
            <div className="dialog-error-banner" role="alert" style={{ marginTop: '14px' }}>
              <IconAlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{displayError}</span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-secondary dialog-btn-cancel"
            onClick={onClose}
            disabled={isRevoking}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-danger-solid dialog-btn-confirm"
            disabled={isRevoking || !adminPassword.trim()}
          >
            {isRevoking ? 'Mencabut...' : 'Ya, Cabut Sertifikat'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
