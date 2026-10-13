import { useState } from 'react';
import type { GenerateUserData } from '../../types/users';
import { generateUser } from '../../services/users';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { IconAlertTriangle, IconLock, IconShield } from '../icons/Icons';

interface GenerateSingleUserFormProps {
  onSuccess: (data: GenerateUserData) => void;
}

export function GenerateSingleUserForm({ onSuccess }: GenerateSingleUserFormProps) {
  // Form fields state
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [ou, setOu] = useState('');
  const [password, setPassword] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [confirmPfxPassword, setConfirmPfxPassword] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Nama
    const cleanName = name.trim();
    if (!cleanName) {
      errors.name = 'Nama lengkap wajib diisi.';
    }

    // 2. NIK
    const cleanNik = nik.trim();
    if (!cleanNik) {
      errors.nik = 'NIK wajib diisi.';
    } else if (!/^[0-9]{16}$/.test(cleanNik)) {
      errors.nik = 'NIK harus tepat 16 digit angka.';
    }

    // 3. Email
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = 'Alamat email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Format alamat email tidak valid.';
    }

    // Validasi Nama dan Email tidak boleh sama
    if (cleanName && cleanEmail && cleanName.toLowerCase() === cleanEmail.toLowerCase()) {
      errors.name = 'Nama pengguna dan email tidak boleh sama.';
      errors.email = 'Nama pengguna dan email tidak boleh sama.';
    }

    // 4. Organization
    if (!organization.trim()) {
      errors.organization = 'Instansi wajib diisi.';
    }

    // 5. OU
    if (!ou.trim()) {
      errors.ou = 'Unit kerja wajib diisi.';
    }

    // 6. Password Login
    if (!password) {
      errors.password = 'Kata sandi wajib diisi.';
    } else if (password.length < 8) {
      errors.password = 'Kata sandi minimal 8 karakter.';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Kata sandi harus mengandung minimal satu huruf kapital.';
    } else if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.password = 'Kata sandi harus mengandung minimal satu simbol.';
    }

    // 7. Passphrase
    if (!pfxPassword) {
      errors.pfxPassword = 'Passphrase wajib diisi.';
    } else if (pfxPassword.length < 8) {
      errors.pfxPassword = 'Passphrase minimal 8 karakter.';
    }

    // 8. Confirm Passphrase
    if (!confirmPfxPassword) {
      errors.confirmPfxPassword = 'Ulangi passphrase.';
    } else if (pfxPassword !== confirmPfxPassword) {
      errors.confirmPfxPassword = 'Passphrase tidak cocok.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await generateUser({
        name: name.trim(),
        nik: nik.trim(),
        email: email.trim(),
        organization: organization.trim(),
        ou: ou.trim(),
        password,
        pfx_password: pfxPassword,
        confirm_pfx_password: confirmPfxPassword,
      });

      if (response.success && response.data) {
        // Clear sensitive credentials from memory
        setPassword('');
        setPfxPassword('');
        setConfirmPfxPassword('');

        onSuccess(response.data);
      } else {
        const msg = typeof response.detail === 'string'
          ? response.detail
          : (response.detail?.message || response.message || 'Gagal membuat akun pengguna dan sertifikat.');
        setServerError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan sistem saat membuat sertifikat.';
      setServerError(msg);
      const lower = msg.toLowerCase();
      if (lower.includes('nama pengguna dan email tidak boleh sama') || lower.includes('nama dan email tidak boleh sama')) {
        setFormErrors((prev) => ({
          ...prev,
          name: 'Nama pengguna dan email tidak boleh sama.',
          email: 'Nama pengguna dan email tidak boleh sama.',
        }));
      } else if (lower.includes('nama pengguna sudah') || lower.includes('nama sudah terdaftar')) {
        setFormErrors((prev) => ({ ...prev, name: 'Nama pengguna sudah terdaftar di sistem.' }));
      } else if (lower.includes('email already exists') || lower.includes('email sudah terdaftar')) {
        setFormErrors((prev) => ({ ...prev, email: 'Alamat email sudah terdaftar di sistem.' }));
      } else if (lower.includes('nik already exists') || lower.includes('nik sudah terdaftar')) {
        setFormErrors((prev) => ({ ...prev, nik: 'NIK sudah terdaftar di sistem.' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="generate-form" noValidate>
      {/* Top Server Error Alert */}
      {serverError && (
        <div className="generate-error-banner" role="alert">
          <IconAlertTriangle size={18} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Section 1: User Identity & Organization */}
      <div className="generate-form-section">
        <div className="form-section-header">
          <h3 className="form-section-title">
            <span>Data pengguna</span>
          </h3>
          <p className="form-section-desc">
            Data ini akan tercantum di sertifikat.
          </p>
        </div>

        <div className="form-grid">
          {/* Nama Lengkap */}
          <div className="form-col-2">
            <Input
              id="gen-user-name"
              label="Nama Lengkap"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
              }}
              error={formErrors.name}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* NIK */}
          <div className="form-col-1">
            <Input
              id="gen-user-nik"
              label="NIK"
              helperText="16 digit"
              maxLength={16}
              value={nik}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setNik(val);
                if (formErrors.nik) setFormErrors(prev => ({ ...prev, nik: '' }));
              }}
              error={formErrors.nik}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Email */}
          <div className="form-col-1">
            <Input
              id="gen-user-email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
              }}
              error={formErrors.email}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Organization */}
          <div className="form-col-1">
            <Input
              id="gen-user-org"
              label="Instansi"
              value={organization}
              onChange={(e) => {
                setOrganization(e.target.value);
                if (formErrors.organization) setFormErrors(prev => ({ ...prev, organization: '' }));
              }}
              error={formErrors.organization}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* OU */}
          <div className="form-col-1">
            <Input
              id="gen-user-ou"
              label="Unit kerja"
              value={ou}
              onChange={(e) => {
                setOu(e.target.value);
                if (formErrors.ou) setFormErrors(prev => ({ ...prev, ou: '' }));
              }}
              error={formErrors.ou}
              disabled={isSubmitting}
              required
            />
          </div>
        </div>
      </div>

      {/* Section 2: Account Login Password */}
      <div className="generate-form-section">
        <div className="form-section-header">
          <h3 className="form-section-title">
            <IconLock size={16} aria-hidden="true" />
            <span>Akun login</span>
          </h3>
        </div>

        <div className="form-grid">
          <div className="form-col-2">
            <PasswordInput
              id="gen-user-password"
              label="Kata sandi"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors(prev => ({ ...prev, password: '' }));
              }}
              error={formErrors.password}
              helperText="Minimal 8 karakter, ada satu huruf kapital dan satu simbol."
              disabled={isSubmitting}
              required
            />
          </div>
        </div>
      </div>

      {/* Section 3: Passphrase */}
      <div className="generate-form-section">
        <div className="form-section-header">
          <h3 className="form-section-title">
            <IconShield size={16} aria-hidden="true" />
            <span>Passphrase</span>
          </h3>
          <p className="form-section-desc">
            Dipakai untuk membuka berkas sertifikat pengguna. Berbeda dari kata sandi login.
          </p>
        </div>

        <div className="form-grid">
          <div className="form-col-1">
            <PasswordInput
              id="gen-user-pfx-pass"
              label="Passphrase"
              helperText="Minimal 8 karakter"
              value={pfxPassword}
              onChange={(e) => {
                setPfxPassword(e.target.value);
                if (formErrors.pfxPassword) setFormErrors(prev => ({ ...prev, pfxPassword: '' }));
              }}
              error={formErrors.pfxPassword}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-col-1">
            <PasswordInput
              id="gen-user-confirm-pfx-pass"
              label="Ulangi passphrase"
              value={confirmPfxPassword}
              onChange={(e) => {
                setConfirmPfxPassword(e.target.value);
                if (formErrors.confirmPfxPassword) setFormErrors(prev => ({ ...prev, confirmPfxPassword: '' }));
              }}
              error={formErrors.confirmPfxPassword}
              disabled={isSubmitting}
              required
            />
          </div>
        </div>
        <p className="text-muted text-xs" style={{ marginTop: '8px' }}>
          Tidak disimpan oleh sistem, jadi catat dengan aman.
        </p>
      </div>

      {/* Submit Action */}
      <div className="generate-form-footer">
        <button
          type="submit"
          className="btn btn-primary btn-generate-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Memproses...' : 'Buat pengguna dan sertifikat'}
        </button>
      </div>
    </form>
  );
}
