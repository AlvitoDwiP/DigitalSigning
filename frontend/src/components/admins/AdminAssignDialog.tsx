import { useEffect, useRef } from 'react';
import type { AdminItem } from '../../types/admins';
import { NikDisplay } from '../ui/NikDisplay';
import {
  IconShield,
  IconClose,
  IconAlertTriangle,
} from '../icons/Icons';

interface AdminAssignDialogProps {
  candidate: AdminItem | null;
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function AdminAssignDialog({
  candidate,
  isOpen,
  isProcessing,
  error,
  onConfirm,
  onClose,
}: AdminAssignDialogProps) {
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

  if (!isOpen || !candidate) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog"
      aria-labelledby="assign-admin-title"
      aria-describedby="assign-admin-desc"
    >
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconShield size={22} />
            </div>
            <h2 id="assign-admin-title" className="dialog-title">
              Tetapkan Sebagai Administrator
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
          <p id="assign-admin-desc" className="dialog-main-text">
            Apakah Anda yakin ingin menetapkan hak akses <strong>Admin</strong> kepada pengguna berikut?
          </p>

          <div className="delete-target-card">
            <div className="delete-target-row">
              <span className="delete-target-label">Nama Pengguna</span>
              <span className="delete-target-value">{candidate.name}</span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">Email</span>
              <span className="delete-target-value">{candidate.email}</span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">NIK</span>
              <span className="delete-target-value">
                <NikDisplay nik={candidate.nik} />
              </span>
            </div>
            <div className="delete-target-row">
              <span className="delete-target-label">Perubahan peran</span>
              <span className="delete-target-value">Pengguna → Admin</span>
            </div>
          </div>

          <div className="admin-role-notice-box">
            <p>
              Pengguna ini akan memperoleh hak akses operasional untuk mengelola pengguna, menerbitkan sertifikat, dan melihat audit log. Perubahan peran ini akan dicatat ke dalam Audit Log.
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
            className="btn btn-primary dialog-btn-confirm"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Menetapkan...' : 'Jadikan Admin'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
