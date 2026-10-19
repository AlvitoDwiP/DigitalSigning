import { useEffect, useRef, useState } from 'react';
import type { AuditLogItem } from '../../types/auditLogs';
import { StatusChip } from '../ui/StatusChip';
import {
  IconAudit,
  IconClose,
  IconClock,
  IconShield,
  IconCopy,
  IconCheckCircle,
} from '../icons/Icons';
import {
  labelAktivitas,
  hasilAktivitas,
  jenisTarget,
  formatWaktuIndonesia,
} from '../../lib/labels';

interface AuditLogDetailModalProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDetailModal({
  log,
  isOpen,
  onClose,
}: AuditLogDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copiedTargetId, setCopiedTargetId] = useState(false);
  const [copiedAuditId, setCopiedAuditId] = useState(false);

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

  if (!log) return null;

  const isCertAction = log.action === 'CERTIFICATE_REGENERATED' || log.action === 'CERTIFICATE_GENERATED';
  const targetTypeLabel = isCertAction ? 'Pengguna' : (jenisTarget[log.target_type] || log.target_type);
  const statusLabel = hasilAktivitas[log.status] || log.status;
  const actorName = log.actor_name || (log.user_id ? `ID: ${log.user_id.slice(0, 8)}...` : 'Sistem');

  const handleCopyTargetId = () => {
    if (log.target_id) {
      navigator.clipboard.writeText(log.target_id);
      setCopiedTargetId(true);
      setTimeout(() => setCopiedTargetId(false), 2000);
    }
  };

  const handleCopyAuditId = () => {
    navigator.clipboard.writeText(log.id);
    setCopiedAuditId(true);
    setTimeout(() => setCopiedAuditId(false), 2000);
  };

  // Format tanggal & jam presisi ISO
  const formatIsoPrecision = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <dialog ref={dialogRef} className="custom-modal-dialog audit-detail-modal" aria-labelledby="audit-detail-title">
      <div className="dialog-content-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-warning-icon" style={{ backgroundColor: 'var(--active-tint)', color: 'var(--accent-text)' }}>
              <IconAudit size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="audit-detail-title" className="dialog-title">
                Rincian Catatan Audit
              </h2>
              <p className="dialog-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-2)', margin: '2px 0 0 0' }}>
                Metadata lengkap dan keterlacakan aktivitas sistem.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Tutup rincian"
          >
            <IconClose size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="audit-detail-body">
          {/* Status & Time Highlight Box */}
          <div className="audit-detail-status-banner">
            <div className="status-banner-left">
              <span className="detail-meta-label">Hasil Aktivitas</span>
              <StatusChip status={log.status} label={statusLabel} />
            </div>
            <div className="status-banner-right">
              <span className="detail-meta-label">Waktu Kejadian</span>
              <div className="audit-detail-time-text">
                <IconClock size={14} className="text-muted" aria-hidden="true" />
                <span>{formatWaktuIndonesia(log.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Grid Metadata Details */}
          <div className="audit-detail-fields-grid">
            {/* Aktivitas */}
            <div className="audit-detail-field-item">
              <span className="field-item-label">Aktivitas</span>
              <span className="field-item-value font-semibold">
                {labelAktivitas(log.action)}
              </span>
              <span className="field-item-code font-mono">{log.action}</span>
            </div>

            {/* Dilakukan oleh */}
            <div className="audit-detail-field-item">
              <span className="field-item-label">Dilakukan oleh</span>
              <div className="field-actor-row">
                <span className={`field-item-value font-semibold ${actorName === 'Sistem' ? 'text-secondary' : 'text-primary'}`}>
                  {actorName}
                </span>
                {log.actor_email && (
                  <span className="field-actor-email text-xs text-muted">
                    ({log.actor_email})
                  </span>
                )}
              </div>
            </div>

            {/* Objek Terkait */}
            <div className="audit-detail-field-item">
              <span className="field-item-label">Objek Terkait</span>
              <span className="field-item-value">
                {targetTypeLabel}
                {log.target_name && (
                  <strong className="field-target-name"> ({log.target_name})</strong>
                )}
              </span>
            </div>

            {/* Waktu Presisi */}
            <div className="audit-detail-field-item">
              <span className="field-item-label">Waktu Presisi</span>
              <span className="field-item-value text-xs text-secondary">
                {formatIsoPrecision(log.created_at)}
              </span>
            </div>

            {/* ID Target */}
            <div className="audit-detail-field-item full-width">
              <span className="field-item-label">ID Objek Target</span>
              <div className="field-id-copy-row">
                <code className="font-mono text-xs">{log.target_id || 'Tidak ada ID target'}</code>
                {log.target_id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-copy-meta"
                    onClick={handleCopyTargetId}
                    title="Salin ID Target"
                  >
                    {copiedTargetId ? (
                      <>
                        <IconCheckCircle size={14} className="text-success" aria-hidden="true" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <IconCopy size={14} aria-hidden="true" />
                        <span>Salin ID</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* ID Rekaman Audit */}
            <div className="audit-detail-field-item full-width">
              <span className="field-item-label">ID Catatan Audit</span>
              <div className="field-id-copy-row">
                <code className="font-mono text-xs">{log.id}</code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-copy-meta"
                  onClick={handleCopyAuditId}
                  title="Salin ID Audit"
                >
                  {copiedAuditId ? (
                    <>
                      <IconCheckCircle size={14} className="text-success" aria-hidden="true" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={14} aria-hidden="true" />
                      <span>Salin ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Security & Integrity Note */}
          <div className="audit-detail-security-notice">
            <IconShield size={16} className="text-primary flex-shrink-0" aria-hidden="true" />
            <p className="security-notice-text">
              Catatan audit dilindungi secara permanen untuk menjamin integritas. Informasi sensitif seperti kunci privat dan passphrase sertifikat tidak disimpan dalam riwayat audit.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-secondary dialog-btn-cancel"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
