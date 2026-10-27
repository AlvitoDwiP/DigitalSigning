import { useState, useEffect, useCallback, useRef } from 'react';
import type { AccountData } from '../types/account';
import { fetchAccount } from '../services/account';
import { AccountProfileCard } from '../components/account/AccountProfileCard';
import { AccountRegenerateCard } from '../components/account/AccountRegenerateCard';
import { AccountPasswordCard } from '../components/account/AccountPasswordCard';
import { AccountPassphraseCard } from '../components/account/AccountPassphraseCard';
import { AccountSkeleton } from '../components/account/AccountSkeleton';
import { extractErrorMessage } from '../components/account/accountUtils';
import { StatusChip } from '../components/ui/StatusChip';
import { NikDisplay } from '../components/ui/NikDisplay';
import { statusAkun } from '../lib/labels';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconUser,
  IconLock,
  IconKey,
} from '../components/icons/Icons';

export type AccountTab = 'detail' | 'regenerate' | 'password' | 'passphrase';

interface AccountPageProps {
  onNavigate?: (path: string) => void;
  initialTab?: AccountTab;
}

const ACCOUNT_TABS: Array<{
  id: AccountTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}> = [
  { id: 'detail', label: 'Detail Akun', icon: IconUser },
  { id: 'regenerate', label: 'Terbitkan Ulang Sertifikat', icon: IconRefresh },
  { id: 'password', label: 'Ganti Password', icon: IconLock },
  { id: 'passphrase', label: 'Ganti Passphrase', icon: IconKey },
];

function resolveInitialTab(tab?: AccountTab): AccountTab {
  if (tab) return tab;
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#regenerate') return 'regenerate';
    if (window.location.hash === '#password') return 'password';
    if (window.location.hash === '#passphrase') return 'passphrase';
  }
  return 'detail';
}

export function AccountPage({ onNavigate: _onNavigate, initialTab }: AccountPageProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTab>(() => resolveInitialTab(initialTab));

  useEffect(() => {
    setActiveTab(resolveInitialTab(initialTab));
  }, [initialTab]);

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
        setError(extractErrorMessage(res, 'Gagal memuat data akun'));
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
          <h1 className="page-title">KELOLA AKUN</h1>
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
          {/* Header Card & Tab Bar */}
          <div className="user-detail-header-card">
            <div className="user-detail-hero-top">
              <div className="user-profile-header">
                <div className="user-profile-avatar" aria-hidden="true">
                  <span>{account.name ? account.name.trim().charAt(0).toUpperCase() : 'U'}</span>
                </div>
                <div className="user-profile-titles">
                  <div className="user-profile-name-row">
                    <h2 className="user-profile-name">{account.name}</h2>
                    <StatusChip
                      status={account.status}
                      label={statusAkun[account.status] || account.status}
                    />
                  </div>
                  <div className="user-hero-meta-row">
                    <span className="user-hero-meta-item">
                      <NikDisplay nik={account.nik} />
                    </span>
                    <span className="meta-separator">•</span>
                    <span className="user-hero-meta-item">{account.email}</span>
                    {account.organization && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="user-hero-meta-item">
                          {account.organization}{account.ou ? ` / ${account.ou}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation Bar */}
            <div className="user-detail-tabs-bar" role="tablist" aria-label="Tab Pengaturan Akun">
              {ACCOUNT_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`pane-${tab.id}`}
                    className={`user-detail-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Tab Pane Content */}
          <div className="user-detail-tab-pane">
            {activeTab === 'detail' && (
              <div id="pane-detail" role="tabpanel" aria-labelledby="tab-detail">
                <AccountProfileCard
                  account={account}
                  onSuccess={showFeedback}
                  onRefresh={loadAccount}
                />
              </div>
            )}

            {activeTab === 'regenerate' && (
              <div id="pane-regenerate" role="tabpanel" aria-labelledby="tab-regenerate" className="account-tab-card-wrapper">
                <AccountRegenerateCard
                  account={account}
                  onSuccess={showFeedback}
                  onRefresh={loadAccount}
                />
              </div>
            )}

            {activeTab === 'password' && (
              <div id="pane-password" role="tabpanel" aria-labelledby="tab-password" className="account-tab-card-wrapper">
                <AccountPasswordCard onSuccess={showFeedback} />
              </div>
            )}

            {activeTab === 'passphrase' && (
              <div id="pane-passphrase" role="tabpanel" aria-labelledby="tab-passphrase" className="account-tab-card-wrapper">
                <AccountPassphraseCard onSuccess={showFeedback} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
