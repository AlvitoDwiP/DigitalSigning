import { useState } from 'react';
import type { AccountData } from '../../types/account';
import { regenerateUserCertificate } from '../../services/users';
import { PasswordInput } from '../ui/PasswordInput';
import {
  IconRefresh,
  IconAlertTriangle,
  IconCheckCircle,
} from '../icons/Icons';

interface AccountRegenerateCardProps {
  account: AccountData;
  onSuccess: (msg: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export function AccountRegenerateCard({
  account,
  onSuccess,
  onRefresh,
}: AccountRegenerateCardProps) {
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    const trimmed = password.trim();
    if (!trimmed) {
      setError('Password login akun wajib diisi untuk verifikasi identitas.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await regenerateUserCertificate(account.id, {
        password: trimmed,
      });

      if (res.success) {
        setPassword('');
        const successMsg =
          'Sertifikat digital Anda berhasil diterbitkan ulang! Pasangan kunci dan masa berlaku baru telah aktif selama 2 tahun ke depan.';
        setSuccessInfo(successMsg);
        onSuccess(successMsg);
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        const msg =
          typeof res.detail === 'string'
            ? res.detail
            : res.detail?.message || res.message || 'Gagal menerbitkan ulang sertifikat.';
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses penerbitan ulang sertifikat.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="detail-card account-card" aria-labelledby="account-regenerate-title">
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconRefresh size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id="account-regenerate-title" className="detail-card-title">
            Penerbitan Ulang Sertifikat Digital
          </h2>
        </div>
      </div>

      <div className="detail-card-body">
        <p className="dialog-main-text mb-4">
          Penerbitan ulang dan perpanjangan masa aktif sertifikat elektronik Anda selama 2 tahun ke depan.
        </p>

        <form onSubmit={handleSubmit} className="account-two-col-form">
          <div className="account-form-cols">
            {/* Kolom Kiri: Verifikasi Password Akun */}
            <div className="account-form-col">
              <PasswordInput
                id="account-regenerate-password"
                name="password"
                label="Password Akun Anda"
                placeholder="Masukkan password login Anda untuk konfirmasi"
                helperText="Konfirmasikan identitas Anda dengan memasukkan password akun yang sedang aktif."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isProcessing}
                autoComplete="current-password"
                required
              />

              <div className="password-policy-hints">
                <span className="policy-hint-title">Keamanan & Otorisasi:</span>
                <ul className="policy-hints-list">
                  <li>Verifikasi kata sandi akun diperlukan demi keamanan identitas digital Anda.</li>
                  <li>Kunci baru akan dibangkitkan secara aman di server</li>
                  <li>Sertifikat baru langsung aktif seketika setelah proses penerbitan ulang berhasil.</li>
                </ul>
              </div>
            </div>

            {/* Kolom Kanan: Ketentuan & Informasi Sertifikat (Warna Semantik: Info / Biru Muda) */}
            <div className="account-form-col">
              <div className="card-semantic-info" style={{ padding: '14px 16px', borderRadius: '8px', fontSize: '12.5px' }}>
                <span className="card-semantic-title" style={{ margin: '0 0 8px 0', fontSize: '13px', display: 'block' }}>
                  Ketentuan Penerbitan ulang Sertifikat:
                </span>
                <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', lineHeight: 1.55 }}>
                  Penerbitan ulang sertifikat akan menonaktifkan sertifikat digital lama dan langsung menerbitkan sertifikat yang berlaku selama <strong>2 tahun ke depan</strong>.
                </p>
                <ul className="policy-hints-list" style={{ color: 'inherit' }}>
                  <li>Gunakan fitur ini apabila sertifikat digital Anda mendekati masa kedaluwarsa.</li>
                  <li>Seluruh dokumen PDF yang telah Anda tandatangani sebelumnya tetap sah dan valid secara hukum.</li>
                  <li>Sertifikat digital Anda akan diperbarui dengan passphrase yang tetap sama.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feedback & Error Banners (Warna Semantik: Danger / Success) */}
          {error && (
            <div className="card-semantic-danger form-error-banner" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px' }}>
              <IconAlertTriangle size={16} className="card-semantic-icon" aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="card-semantic-success form-error-banner" role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px' }}>
              <IconCheckCircle size={16} className="card-semantic-icon" aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="account-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing || !password.trim()}
            >
              {isProcessing ? (
                <>
                  <IconRefresh size={16} className="spin-animation" />
                  <span>Memproses Penerbitan Ulang Sertifikat...</span>
                </>
              ) : (
                <>
                  <IconRefresh size={16} />
                  <span>Verifikasi & Terbitkan Ulang Sertifikat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
