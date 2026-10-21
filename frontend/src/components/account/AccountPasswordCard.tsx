import { useState } from 'react';
import { changeAccountLoginPassword } from '../../services/account';
import { getAuthUser, setAuthUser } from '../../services/api';
import { PasswordInput } from '../ui/PasswordInput';
import { IconLock, IconAlertTriangle } from '../icons/Icons';

interface AccountPasswordCardProps {
  onSuccess: (msg: string) => void;
}

export function AccountPasswordCard({ onSuccess }: AccountPasswordCardProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      setError('Password lama wajib diisi.');
      return;
    }
    if (!newPassword) {
      setError('Password baru wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password baru harus mengandung setidaknya satu huruf besar (A-Z).');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      setError('Password baru harus mengandung setidaknya satu karakter simbol/non-alfanumerik.');
      return;
    }
    if (newPassword === oldPassword) {
      setError('Password baru tidak boleh sama dengan password lama.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await changeAccountLoginPassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (res.success) {
        // Clear sensitive inputs
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        try {
          const user = getAuthUser();
          if (user) {
            setAuthUser({ ...user, must_change_password: false });
          }
        } catch {
          // ignore
        }
        onSuccess('Password login berhasil diubah.');
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal mengubah password login.');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah password login.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="detail-card account-card" aria-labelledby="account-password-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconLock size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="account-password-title" className="detail-card-title">
            Ubah Password Login
          </h2>
        </div>
      </div>

      <div className="detail-card-body">
        <p className="dialog-main-text mb-4">
          Perbarui kata sandi akun Anda untuk autentikasi masuk ke platform.
        </p>

        <form onSubmit={handleSubmit} className="account-two-col-form">
          <div className="account-form-cols">
            <div className="account-form-col">
              <PasswordInput
                id="account-old-login-password"
                name="old_password"
                label="Password Lama"
                placeholder="Ketik password saat ini"
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  setError(null);
                }}
                disabled={isProcessing}
                autoComplete="current-password"
                required
              />

              <div className="password-policy-hints">
                <span className="policy-hint-title">Ketentuan Password:</span>
                <ul className="policy-hints-list">
                  <li>Minimal 8 karakter</li>
                  <li>Mengandung minimal 1 huruf besar (uppercase)</li>
                  <li>Mengandung minimal 1 simbol / karakter non-alfanumerik</li>
                </ul>
              </div>
            </div>

            <div className="account-form-col">
              {(() => {
                const isNewPassValid = Boolean(newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[^a-zA-Z0-9]/.test(newPassword));
                const isConfirmPassValid = Boolean(newPassword && confirmPassword && confirmPassword === newPassword && isNewPassValid);

                return (
                  <>
                    <PasswordInput
                      id="account-new-login-password"
                      name="new_password"
                      label="Password Baru"
                      placeholder="Min. 8 karakter, 1 huruf besar, 1 simbol"
                      helperText={isNewPassValid ? 'Password baru memenuhi syarat' : undefined}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError(null);
                      }}
                      isValid={isNewPassValid}
                      disabled={isProcessing}
                      autoComplete="new-password"
                      required
                    />

                    <PasswordInput
                      id="account-confirm-login-password"
                      name="confirm_password"
                      label="Konfirmasi Password Baru"
                      placeholder="Ketik ulang password baru"
                      helperText={isConfirmPassValid ? 'Konfirmasi password cocok' : undefined}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError(null);
                      }}
                      isValid={isConfirmPassValid}
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
              {isProcessing ? 'Menyimpan...' : 'Perbarui Password Login'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
