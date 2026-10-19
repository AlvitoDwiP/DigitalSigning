import { useEffect, useRef } from 'react';
import type { AdminItem } from '../../types/admins';
import { NikDisplay } from '../ui/NikDisplay';
import {
  IconAlertTriangle,
  IconClose,
} from '../icons/Icons';

interface AdminRemoveDialogProps {
  admin: AdminItem | null;
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function AdminRemoveDialog({
  admin,
  isOpen,
  isProcessing,
  error,
  onConfirm,
  onClose,
}: AdminRemoveDialogProps) {
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

  if (!isOpen || !admin) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="remove-admin-title"
      aria-describedby="remove-admin-desc"
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-danger-icon" aria-hidden="true">
              <IconAlertTriangle size={22} />
            </div>
            <h2 id="remove-admin-title" className="dialog-title">
              Hapus Hak Akses Admin
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
          <p id="remove-admin-desc" className="dialog-main-text">
            Apakah Anda yakin ingin mencabut hak akses Admin untuk pengguna <strong>{admin.name}</strong>?
          </p>

          <div className="delete-target-card">
            <div className="delete-target-row">
              <span className="delete-target-label">Nama Administrator</span>
              <span className="delete-target-value">{admin.name}</span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">Email</span>
              <span className="delete-target-value">{admin.email}</span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">NIK</span>
              <span className="delete-target-value">
                <NikDisplay nik={admin.nik} />
              </span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">Perubahan peran</span>
              <span className="delete-target-value">Admin → Pengguna</span>
            </div>
          </div>

          <div className="delete-warning-box">
            <p>
              Tindakan ini <strong>tidak menghapus akun atau sertifikat pengguna</strong>. Akun ini hanya akan diturunkan statusnya menjadi peran <strong>Pengguna</strong> dan tidak lagi dapat mengakses portal administrasi.
            </p>
          </div>

          {error && (
            <div className="dialog-error-banner" role="alert">
              <IconAlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            className="btn btn-danger dialog-btn-confirm"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Mencabut...' : 'Hapus Admin'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
