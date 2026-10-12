import { useState, useEffect, useRef } from 'react';
import type { AccountData } from '../../types/account';
import { updateAccount } from '../../services/account';
import { setAuthUser, getAuthUser } from '../../services/api';
import { maskNik } from '../users/UsersTable';
import { StatusChip } from '../ui/StatusChip';
import { IconUser, IconAlertTriangle, IconEdit, IconCheckCircle, IconClose } from '../icons/Icons';
import { peran, statusAkun } from '../../lib/labels';

interface AccountProfileCardProps {
  account: AccountData;
  onSuccess: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

export function AccountProfileCard({
  account,
  onSuccess,
  onRefresh,
}: AccountProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [organization, setOrganization] = useState(account.organization || '');
  const [ou, setOu] = useState(account.ou || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pop up validasi / konfirmasi simpan profil
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setName(account.name);
    setEmail(account.email);
    setOrganization(account.organization || '');
    setOu(account.ou || '');
  }, [account]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;

    if (isConfirmOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isConfirmOpen]);

  useEffect(() => {
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!isProcessing) {
        setIsConfirmOpen(false);
      }
    };

    const dialog = confirmDialogRef.current;
    if (dialog) {
      dialog.addEventListener('cancel', handleCancel);
    }
    return () => {
      if (dialog) {
        dialog.removeEventListener('cancel', handleCancel);
      }
    };
  }, [isProcessing]);

  const handleCancel = () => {
    setName(account.name);
    setEmail(account.email);
    setOrganization(account.organization || '');
    setOu(account.ou || '');
    setError(null);
    setIsEditing(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!email.trim()) {
      setError('Email wajib diisi.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format email tidak valid.');
      return;
    }

    // Buka pop up validasi konfirmasi
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await updateAccount({
        name: name.trim(),
        email: email.trim(),
        organization: organization.trim() || undefined,
        ou: ou.trim() || undefined,
      });

      if (res.success && res.data) {
        // Update auth user session in storage if current user
        const currentAuth = getAuthUser();
        if (currentAuth && currentAuth.id === res.data.id) {
          setAuthUser({
            ...currentAuth,
            name: res.data.name,
            email: res.data.email,
          });
        }

        setIsConfirmOpen(false);
        setIsEditing(false);
        onSuccess('Profil berhasil diperbarui.');
        await onRefresh();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memperbarui profil.');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <section
        className={`detail-card account-card ${isEditing ? 'account-card-editing' : ''}`}
        aria-labelledby="account-profile-title"
      >
        <div className="detail-card-header">
          <div className="card-title-group">
            <IconUser size={20} className="card-title-icon" aria-hidden="true" />
            <h2 id="account-profile-title" className="detail-card-title">
              Informasi Profil
            </h2>
            {isEditing && (
              <span className="badge-editing-mode" aria-label="Sedang dalam mode edit">
                <span className="badge-editing-dot" aria-hidden="true" />
                Mode Edit
              </span>
            )}
          </div>
          {!isEditing && (
            <button
              type="button"
              className="btn-edit-profile"
              onClick={() => setIsEditing(true)}
              aria-label="Ubah profil akun"
            >
              <IconEdit size={15} className="btn-edit-icon" aria-hidden="true" />
              <span>Ubah Profil</span>
            </button>
          )}
        </div>

        <div className="detail-card-body">
          {isEditing ? (
            <form onSubmit={handleFormSubmit} className="account-form-grid">
            <div className="input-group">
              <label htmlFor="account-edit-name" className="input-label">
                Nama Lengkap <span className="text-danger">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="account-edit-name"
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isProcessing}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="account-edit-email" className="input-label">
                Email <span className="text-danger">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="account-edit-email"
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isProcessing}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="account-edit-org" className="input-label">
                Instansi
              </label>
              <div className="input-wrapper">
                <input
                  id="account-edit-org"
                  type="text"
                  className="input-field"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="account-edit-ou" className="input-label">
                Unit kerja
              </label>
              <div className="input-wrapper">
                <input
                  id="account-edit-ou"
                  type="text"
                  className="input-field"
                  value={ou}
                  onChange={(e) => setOu(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {error && (
              <div className="dialog-error-banner form-error-banner" role="alert">
                <IconAlertTriangle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="account-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isProcessing}
              >
                {isProcessing ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="cert-details-grid">
            <div className="cert-detail-item">
              <dt className="cert-detail-label">Nama Lengkap</dt>
              <dd className="cert-detail-value">{account.name}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Email</dt>
              <dd className="cert-detail-value">{account.email}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">NIK</dt>
              <dd className="cert-detail-value font-mono">{maskNik(account.nik)}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Peran</dt>
              <dd className="cert-detail-value">
                <StatusChip status={account.role} label={peran[account.role] || account.role} />
              </dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Instansi</dt>
              <dd className="cert-detail-value">{account.organization || '-'}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Unit kerja</dt>
              <dd className="cert-detail-value">{account.ou || '-'}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Status akun</dt>
              <dd className="cert-detail-value">
                <StatusChip status={account.status} label={statusAkun[account.status] || account.status} />
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>

    {/* Pop up Validasi / Konfirmasi Simpan Profil */}
    <dialog
      ref={confirmDialogRef}
      className="custom-modal-dialog"
      aria-labelledby="confirm-save-profile-title"
      aria-describedby="confirm-save-profile-desc"
    >
      <div className="dialog-content-wrapper">
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div
              className="dialog-warning-icon"
              style={{ backgroundColor: 'var(--c-red-bg)', color: 'var(--primary, #e11d48)' }}
              aria-hidden="true"
            >
              <IconCheckCircle size={22} />
            </div>
            <h2 id="confirm-save-profile-title" className="dialog-title">
              Simpan perubahan profil?
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={() => !isProcessing && setIsConfirmOpen(false)}
            disabled={isProcessing}
            aria-label="Tutup dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <p id="confirm-save-profile-desc" className="dialog-main-text">
            Pastikan perubahan data profil berikut sudah sesuai sebelum disimpan:
          </p>

          <div className="profile-confirm-preview-box">
            <div className="profile-confirm-row">
              <span className="profile-confirm-label">Nama Lengkap</span>
              <span className="profile-confirm-value">{name.trim()}</span>
            </div>
            <div className="profile-confirm-row">
              <span className="profile-confirm-label">Email</span>
              <span className="profile-confirm-value">{email.trim()}</span>
            </div>
            <div className="profile-confirm-row">
              <span className="profile-confirm-label">Instansi</span>
              <span className="profile-confirm-value">{organization.trim() || '-'}</span>
            </div>
            <div className="profile-confirm-row">
              <span className="profile-confirm-label">Unit kerja</span>
              <span className="profile-confirm-value">{ou.trim() || '-'}</span>
            </div>
          </div>

          {error && (
            <div className="dialog-error-banner" role="alert">
              <IconAlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-ghost dialog-btn-cancel"
            onClick={() => setIsConfirmOpen(false)}
            disabled={isProcessing}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary dialog-btn-confirm"
            onClick={handleConfirmSave}
            disabled={isProcessing}
          >
            {isProcessing ? 'Menyimpan...' : 'Ya, Simpan'}
          </button>
        </div>
      </div>
    </dialog>
  </>
  );
}
