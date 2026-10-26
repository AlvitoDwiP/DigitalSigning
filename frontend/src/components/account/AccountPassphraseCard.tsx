import { useState } from 'react';
import { changeAccountPfxPassword } from '../../services/account';
import { PasswordInput } from '../ui/PasswordInput';
import { IconLock, IconAlertTriangle } from '../icons/Icons';

interface AccountPassphraseCardProps {
  onSuccess: (msg: string) => void;
}

export function AccountPassphraseCard({ onSuccess }: AccountPassphraseCardProps) {
  const [oldPassphrase, setOldPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassphrase) {
      setError('Passphrase lama wajib diisi.');
      return;
    }
    if (!newPassphrase) {
      setError('Passphrase baru wajib diisi.');
      return;
    }
    if (newPassphrase.length < 8) {
      setError('Passphrase baru minimal 8 karakter.');
      return;
    }
    if (newPassphrase === oldPassphrase) {
      setError('Passphrase baru tidak boleh sama dengan passphrase lama.');
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      setError('Passphrase tidak cocok.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await changeAccountPfxPassword({
        old_password: oldPassphrase,
        new_password: newPassphrase,
        confirm_password: confirmPassphrase,
      });

      if (res.success) {
        // Clear sensitive inputs
        setOldPassphrase('');
        setNewPassphrase('');
        setConfirmPassphrase('');
        setError(null);
        onSuccess('Passphrase berhasil diubah.');
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal mengubah passphrase.');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah passphrase.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="detail-card account-card" aria-labelledby="account-passphrase-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconLock size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="account-passphrase-title" className="detail-card-title">
            Ubah Passphrase
          </h2>
        </div>
      </div>

      <div className="detail-card-body">
        <p className="dialog-main-text mb-4">
          Ganti passphrase untuk membuka berkas sertifikat digital Anda.
        </p>

        <form onSubmit={handleSubmit} className="account-two-col-form">
          <div className="account-form-cols">
            <div className="account-form-col">
              <PasswordInput
                id="account-old-pfx-passphrase"
                name="old_passphrase"
                label="Passphrase Lama"
                placeholder="Ketik passphrase saat ini"
                value={oldPassphrase}
                onChange={(e) => {
                  setOldPassphrase(e.target.value);
                  setError(null);
                }}
                disabled={isProcessing}
                autoComplete="current-password"
                required
              />

              <div className="password-policy-hints">
                <span className="policy-hint-title">Ketentuan Passphrase:</span>
                <ul className="policy-hints-list">
                  <li>Minimal 8 karakter</li>
                  <li>Digunakan untuk mengamankan sertifikat digital Anda</li>
                  <li>Hanya passphrase yang berganti, sertifikat & masa berlaku tetap sama</li>
                </ul>
              </div>
            </div>

            <div className="account-form-col">
              {(() => {
                const isNewPfxValid = newPassphrase.length >= 8;
                const isConfirmPfxValid = Boolean(newPassphrase && confirmPassphrase && confirmPassphrase === newPassphrase && isNewPfxValid);

                return (
                  <>
                    <PasswordInput
                      id="account-new-pfx-passphrase"
                      name="new_passphrase"
                      label="Passphrase Baru"
                      placeholder="Min. 8 karakter"
                      helperText={isNewPfxValid ? 'Passphrase memenuhi syarat (min. 8 karakter)' : undefined}
                      value={newPassphrase}
                      onChange={(e) => {
                        setNewPassphrase(e.target.value);
                        setError(null);
                      }}
                      isValid={isNewPfxValid}
                      disabled={isProcessing}
                      autoComplete="new-password"
                      required
                    />

                    <PasswordInput
                      id="account-confirm-pfx-passphrase"
                      name="confirm_passphrase"
                      label="Konfirmasi Passphrase Baru"
                      placeholder="Ketik ulang passphrase baru"
                      helperText={isConfirmPfxValid ? 'Konfirmasi passphrase cocok' : undefined}
                      value={confirmPassphrase}
                      onChange={(e) => {
                        setConfirmPassphrase(e.target.value);
                        setError(null);
                      }}
                      isValid={isConfirmPfxValid}
                      disabled={isProcessing}
                      autoComplete="new-password"
                      required
                    />
                  </>
                );
              })()}
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
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing}
            >
              {isProcessing ? 'Menyimpan...' : 'Perbarui Passphrase'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
