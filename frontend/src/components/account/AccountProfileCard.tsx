import { useState, useEffect } from 'react';
import type { AccountData } from '../../types/account';
import { updateAccount } from '../../services/account';
import { setAuthUser, getAuthUser } from '../../services/api';
import { maskNik } from '../users/UsersTable';
import { StatusChip } from '../ui/StatusChip';
import { IconUser, IconAlertTriangle } from '../icons/Icons';

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

  useEffect(() => {
    setName(account.name);
    setEmail(account.email);
    setOrganization(account.organization || '');
    setOu(account.ou || '');
  }, [account]);

  const handleCancel = () => {
    setName(account.name);
    setEmail(account.email);
    setOrganization(account.organization || '');
    setOu(account.ou || '');
    setError(null);
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!email.trim()) {
      setError('Alamat email wajib diisi.');
      return;
    }

    setIsProcessing(true);
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
    <section className="detail-card account-card" aria-labelledby="account-profile-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconUser size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="account-profile-title" className="detail-card-title">
            Informasi Profil
          </h2>
        </div>
        {!isEditing && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsEditing(true)}
          >
            Edit Profil
          </button>
        )}
      </div>

      <div className="detail-card-body">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="account-form-grid">
            <div className="input-group">
              <label htmlFor="account-edit-name" className="input-label">
                Nama Lengkap <span className="text-danger">*</span>
              </label>
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

            <div className="input-group">
              <label htmlFor="account-edit-email" className="input-label">
                Alamat Email <span className="text-danger">*</span>
              </label>
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

            <div className="input-group">
              <label htmlFor="account-edit-org" className="input-label">
                Organisasi
              </label>
              <input
                id="account-edit-org"
                type="text"
                className="input-field"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                disabled={isProcessing}
                placeholder="Mahkamah Konstitusi Republik Indonesia"
              />
            </div>

            <div className="input-group">
              <label htmlFor="account-edit-ou" className="input-label">
                Unit Organisasi (OU)
              </label>
              <input
                id="account-edit-ou"
                type="text"
                className="input-field"
                value={ou}
                onChange={(e) => setOu(e.target.value)}
                disabled={isProcessing}
                placeholder="Pusat Teknologi Informasi dan Komunikasi"
              />
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
                {isProcessing ? 'Menyimpan...' : 'Simpan Profil'}
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
              <dt className="cert-detail-label">Nomor Induk Kependudukan (NIK)</dt>
              <dd className="cert-detail-value font-mono">{maskNik(account.nik)}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Role Akses</dt>
              <dd className="cert-detail-value">
                <StatusChip status={account.role} label={account.role} />
              </dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Organisasi</dt>
              <dd className="cert-detail-value">{account.organization || '-'}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Unit Organisasi (OU)</dt>
              <dd className="cert-detail-value">{account.ou || '-'}</dd>
            </div>

            <div className="cert-detail-item">
              <dt className="cert-detail-label">Status Akun</dt>
              <dd className="cert-detail-value">
                <StatusChip status={account.status} label={account.status} />
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
