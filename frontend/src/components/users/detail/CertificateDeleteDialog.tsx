import { useEffect, useRef } from 'react';
import type { UserDetailData } from '../../../types/users';
import { IconAlertTriangle, IconClose } from '../../icons/Icons';

interface CertificateDeleteDialogProps {
  user: UserDetailData | null;
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function CertificateDeleteDialog({
  user,
  isOpen,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: CertificateDeleteDialogProps) {
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

  if (!isOpen || !user || !user.active_certificate) return null;

  const cert = user.active_certificate;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="delete-cert-title"
      aria-describedby="delete-cert-desc"
    >
      <div className="dialog-content-wrapper">
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-icon-danger" aria-hidden="true">
              <IconAlertTriangle size={24} />
            </div>
            <h2 id="delete-cert-title" className="dialog-title">
              Hapus Sertifikat Aktif
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup dialog konfirmasi hapus"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="dialog-body">
          <p id="delete-cert-desc" className="dialog-description">
            Apakah Anda yakin ingin menghapus sertifikat aktif milik <strong>{user.name}</strong>?
          </p>

          <div className="delete-target-preview-box">
            <div className="preview-row">
              <span className="preview-label">Nomor Sertifikat:</span>
              <span className="preview-value font-mono">{cert.certificate_number || cert.serial_number}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">NIK:</span>
              <span className="preview-value font-mono">{user.nik}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Nomor Seri:</span>
              <span className="preview-value font-mono">{cert.serial_number}</span>
            </div>
          </div>

          <div className="delete-warning-box">
            <p className="warning-text">
              <strong>Peringatan:</strong> Tindakan ini akan menghapus data sertifikat dari database serta menghapus berkas fisik kriptografi (.p12, .crt, .key) dari server backend secara permanen. Pengguna tidak akan dapat menandatangani dokumen sampai sertifikat baru diterbitkan.
            </p>
          </div>

          {error && (
            <div className="dialog-error-banner" role="alert">
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-secondary dialog-btn-cancel"
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
            {isDeleting ? 'Menghapus...' : 'Ya, Hapus Sertifikat'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
