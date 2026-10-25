import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  IconLock,
  IconEye,
  IconEyeOff,
  IconClose,
  IconShield,
  IconAlertTriangle,
  IconRefresh
} from '../icons/Icons';

interface PassphraseConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (passphrase: string) => void;
  documentName: string;
  targetPageSummary: string;
  signerName: string;
  isSubmitting: boolean;
  errorMsg: string | null;
}

export function PassphraseConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  documentName,
  targetPageSummary,
  signerName,
  isSubmitting,
  errorMsg,
}: PassphraseConfirmDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setPassphrase('');
      setShowPassphrase(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    onConfirm(passphrase.trim());
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog tte-passphrase-modal"
      aria-labelledby="tte-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!isSubmitting) onClose();
      }}
    >
      <div className="dialog-content-wrapper">
        {/* Header Modal */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-icon-badge" aria-hidden="true" style={{ background: 'rgba(0, 90, 50, 0.1)', color: 'var(--primary)' }}>
              <IconLock size={20} />
            </div>
            <div>
              <h2 id="tte-modal-title" className="dialog-title">
                Konfirmasi TTE Dokumen
              </h2>
              <p className="dialog-subtitle" style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                Masukkan passphrase sertifikat digital untuk mengesahkan dokumen
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
          >
            <IconClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            {/* Ringkasan Konfirmasi */}
            <div className="tte-modal-summary-box">
              <div className="tte-modal-summary-row">
                <span className="tte-modal-summary-label">Dokumen:</span>
                <span className="tte-modal-summary-val" title={documentName}>{documentName}</span>
              </div>
              <div className="tte-modal-summary-row">
                <span className="tte-modal-summary-label">Target Halaman:</span>
                <span className="tte-modal-summary-val">{targetPageSummary}</span>
              </div>
              <div className="tte-modal-summary-row">
                <span className="tte-modal-summary-label">Penandatangan:</span>
                <span className="tte-modal-summary-val">{signerName}</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="alert-danger" role="alert" style={{ marginBottom: '14px' }}>
                <IconAlertTriangle size={18} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Input Passphrase */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="input-label" htmlFor="tte-passphrase-input">
                Passphrase Sertifikat Digital (.p12) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  ref={inputRef}
                  id="tte-passphrase-input"
                  type={showPassphrase ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Masukkan passphrase sertifikat Anda..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  disabled={isSubmitting}
                  aria-label={showPassphrase ? 'Sembunyikan passphrase' : 'Lihat passphrase'}
                  tabIndex={-1}
                >
                  {showPassphrase ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              <span className="form-hint" style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <IconShield size={13} aria-hidden="true" />
                <span>Passphrase hanya diproses di memori saat penandatanganan dan tidak pernah disimpan.</span>
              </span>
            </div>
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Kembali ke Pratinjau
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !passphrase.trim()}
            >
              {isSubmitting ? (
                <>
                  <IconRefresh size={16} className="spin-animation" aria-hidden="true" />
                  <span>Membubuhkan TTE...</span>
                </>
              ) : (
                <span>Tanda Tangani Dokumen</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
