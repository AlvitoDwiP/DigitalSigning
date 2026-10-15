import { useState } from 'react';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { IconMail } from '../components/icons/Icons';
import { loginUser } from '../services/api';

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
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setFormError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email wajib diisi');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Format email tidak valid');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password wajib diisi');
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
      {/* Top Header Bar for Theme Toggle */}
      <div className="login-header-bar">
        <ThemeToggle />
      </div>

      <div className="login-card-wrapper">
        <div className="card login-card">
          {/* Identity & Branding */}
          <div className="login-brand-header">
            <div className="brand-logo login-logo" aria-hidden="true">
              <span>DS</span>
            </div>
            <h1 className="login-title">Digital Signature</h1>
            <p className="login-subtitle">Masuk ke Portal Administrasi Platform</p>
          </div>

          {/* Session Expired Banner */}
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

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <Input
              id="login-email"
              label="Email Administrator"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
                if (onClearSessionNotice) onClearSessionNotice();
              }}
              error={emailError}
              icon={<IconMail size={18} />}
              required
              autoComplete="username"
              autoFocus
            />

            <PasswordInput
              id="login-password"
              label="Password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
                if (onClearSessionNotice) onClearSessionNotice();
              }}
              error={passwordError}
              required
            />

            <div className="login-actions">
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                className="login-submit-btn"
              >
                Masuk
              </Button>
            </div>
          </form>

          {/* Security Notice Footer */}
          <div className="login-card-footer">
            <p className="security-notice">
              Akses terbatas untuk administrator berwenang. Semua aktivitas dicatat dalam sistem audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
