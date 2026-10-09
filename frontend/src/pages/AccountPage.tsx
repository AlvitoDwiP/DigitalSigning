import { useState, useEffect, useCallback, useRef } from 'react';
import type { AccountData } from '../types/account';
import { fetchAccount } from '../services/account';
import { AccountProfileCard } from '../components/account/AccountProfileCard';
import { AccountPasswordCard } from '../components/account/AccountPasswordCard';
import { AccountPassphraseCard } from '../components/account/AccountPassphraseCard';
import { AccountSkeleton } from '../components/account/AccountSkeleton';
import { IconCheckCircle, IconAlertTriangle, IconRefresh } from '../components/icons/Icons';

interface AccountPageProps {
  onNavigate?: (path: string) => void;
}

export function AccountPage({ onNavigate: _onNavigate }: AccountPageProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success Feedback Toast
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAccount();
      if (res.success && res.data) {
        setAccount(res.data);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat data akun');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data akun.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  return (
    <div className="users-page-container account-page-container">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Kelola Akun</h1>
          <p className="page-subtitle">
            Pengaturan profil pribadi, perubahan kata sandi login, dan pembaruan passphrase sertifikat digital.
          </p>
        </div>
      </header>

      {/* Success Toast Feedback */}
      {feedbackMessage && (
        <div className="feedback-banner feedback-success" role="status" aria-live="polite">
          <IconCheckCircle size={18} aria-hidden="true" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <AccountSkeleton />
      ) : error ? (
        <div className="users-error-card" role="alert">
          <div className="error-icon" aria-hidden="true">
            <IconAlertTriangle size={32} />
          </div>
          <div className="error-body">
            <h2 className="error-title">Gagal Memuat Informasi Akun</h2>
            <p className="error-description">{error}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost error-retry-btn"
            onClick={loadAccount}
          >
            <IconRefresh size={16} aria-hidden="true" />
            <span>Muat Ulang</span>
          </button>
        </div>
      ) : account ? (
        <div className="account-grid-layout">
          {/* Profile Card */}
          <AccountProfileCard
            account={account}
            onSuccess={showFeedback}
            onRefresh={loadAccount}
          />

          {/* Security / Password Cards */}
          <div className="account-security-grid">
            <AccountPasswordCard onSuccess={showFeedback} />
            <AccountPassphraseCard onSuccess={showFeedback} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
