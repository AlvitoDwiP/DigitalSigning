import { useState } from 'react';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { loginUser } from '../services/api';
import logoImg from '../assets/logo.png';

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
  sessionExpiredNotice?: { title: string; message: string } | null;
  onClearSessionNotice?: () => void;
}

export function LoginPage({
  onLoginSuccess,
  sessionExpiredNotice,
  onClearSessionNotice,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setFormError(null);

    const cleanIdentity = email.trim();
    if (!cleanIdentity) {
      setEmailError('Nama pengguna atau email wajib diisi');
      isValid = false;
    } else if (cleanIdentity.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentity)) {
      setEmailError('Format email tidak valid');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Kata sandi wajib diisi');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await loginUser(email.trim(), password);
      if (res.success) {
        onLoginSuccess(res.data.user.email);
      } else {
        setFormError(res.message || 'Login gagal.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Kredensial tidak valid. Periksa email atau password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card-wrapper">
        <div className="login-card">
          {/* ================= LEFT PANEL: Visual Brand & Building ================= */}
          <div className="login-visual-panel">
            {/* Topographic Wave Lines */}
            <div className="login-visual-waves" aria-hidden="true">
              <svg viewBox="0 0 500 600" fill="none" preserveAspectRatio="none">
                <path d="M-40 80 C 120 50, 240 130, 540 60" stroke="currentColor" strokeWidth="1.2" />
                <path d="M-40 120 C 110 90, 260 170, 540 100" stroke="currentColor" strokeWidth="1.2" />
                <path d="M-40 160 C 130 130, 280 210, 540 140" stroke="currentColor" strokeWidth="1.2" />
                <path d="M-40 200 C 140 170, 300 250, 540 180" stroke="currentColor" strokeWidth="1.2" />
                <path d="M-40 240 C 150 210, 320 290, 540 220" stroke="currentColor" strokeWidth="1.2" />
                <path d="M-40 280 C 160 250, 330 330, 540 260" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Brand Logo & Name */}
            <div className="login-brand-header">
              <div className="login-brand-badge">
                <img
                  src={logoImg}
                  alt="Mahkamah Konstitusi"
                  className="login-brand-logo"
                />
                <span className="login-brand-title">Digital Signature Platform</span>
              </div>
            </div>

            {/* Headline Slogan with Yellow Accent Bar */}
            <div className="login-visual-content">
              <div className="login-visual-gold-bar" aria-hidden="true" />
              <h2 className="login-visual-headline">
                SATU TEMPAT UNTUK MENGELOLA TANDA TANGAN ELEKTRONIK
              </h2>
              <p className="login-visual-subheadline">
                Masuk untuk membuka dashboard.
              </p>
            </div>

            {/* Gedung Mahkamah Konstitusi */}
            <div className="login-visual-building-wrapper">
              <img
                src="/gedung-mk.webp"
                alt="Gedung Mahkamah Konstitusi"
                className="login-visual-building"
                loading="eager"
              />
            </div>
          </div>

          {/* ================= RIGHT PANEL: Login Form ================= */}
          <div className="login-form-panel">
            {/* Topbar: Theme Toggle */}
            <div className="login-form-topbar">
              <ThemeToggle />
            </div>

            <div className="login-form-content">
              {/* Platform Tag */}

              <h1 className="login-form-title">Selamat datang</h1>
              <p className="login-form-subtitle">Masuk untuk melanjutkan ke dashboard.</p>

              {/* Session Expired Notice */}
              {sessionExpiredNotice && !formError && (
                <div className="login-alert-warning" role="alert" aria-live="polite">
                  <div className="login-alert-warning-icon" aria-hidden="true">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div className="login-alert-warning-body">
                    <strong className="login-alert-warning-title">{sessionExpiredNotice.title}</strong>
                    <p className="login-alert-warning-desc">{sessionExpiredNotice.message}</p>
                  </div>
                </div>
              )}

              {/* Form Error Banner */}
              {formError && (
                <div className="login-alert-error" role="alert" aria-live="assertive">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              {/* Authentication Form */}
              <form className="login-form-elements" onSubmit={handleSubmit} noValidate>
                {/* Username / Email Field */}
                <div className="login-field-group">
                  <label htmlFor="login-identity" className="login-field-label">
                    Nama pengguna atau email
                  </label>
                  <div className={`login-input-box ${emailError ? 'has-error' : ''}`}>
                    <input
                      id="login-identity"
                      type="text"
                      className="login-input-control"
                      placeholder="Contoh: admin@instansi.go.id"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                        if (onClearSessionNotice) onClearSessionNotice();
                      }}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  {emailError && <p className="login-field-error-text">{emailError}</p>}
                </div>

                {/* Password Field with "Tampilkan" toggle button */}
                <div className="login-field-group">
                  <label htmlFor="login-password" className="login-field-label">
                    Kata sandi
                  </label>
                  <div className={`login-input-box ${passwordError ? 'has-error' : ''}`}>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-input-control"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                        if (onClearSessionNotice) onClearSessionNotice();
                      }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="login-password-visibility-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </div>
                  {passwordError && <p className="login-field-error-text">{passwordError}</p>}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="login-submit-button"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="login-btn-loading">
                      <span className="login-spinner" aria-hidden="true" />
                      <span>Memproses...</span>
                    </span>
                  ) : (
                    'Masuk'
                  )}
                </button>
              </form>

              {/* Footers */}
              <div className="login-form-footer">
                <p className="login-footer-reset">
                  Lupa kata sandi? Hubungi admin platform Anda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
