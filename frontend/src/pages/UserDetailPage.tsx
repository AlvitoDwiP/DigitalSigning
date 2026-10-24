import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserDetailData } from '../types/users';
import {
  fetchUserDetail,
  regenerateUserCertificate,
  changeUserPfxPassword,
  deleteUser,
} from '../services/users';
import { UserSummaryTab } from '../components/users/detail/UserSummaryTab';
import { UserInfoCard } from '../components/users/detail/UserInfoCard';
import { ActiveCertificateCard } from '../components/users/detail/ActiveCertificateCard';
import { CertificateHistoryCard } from '../components/users/detail/CertificateHistoryCard';
import { UserActivityTab } from '../components/users/detail/UserActivityTab';
import { RegenerateDialog } from '../components/users/detail/RegenerateDialog';
import { ChangePfxDialog } from '../components/users/detail/ChangePfxDialog';
import { UserDeleteDialog } from '../components/users/UserDeleteDialog';
import { StatusChip } from '../components/ui/StatusChip';
import { NikDisplay } from '../components/ui/NikDisplay';
import { statusAkun } from '../lib/labels';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconUsers,
  IconDashboard,
  IconUser,
  IconCertificate,
  IconAudit,
} from '../components/icons/Icons';

export type UserDetailTab = 'summary' | 'account' | 'certificate' | 'activity';

interface UserDetailPageProps {
  userId: string;
  onNavigate: (path: string) => void;
  initialTab?: UserDetailTab;
}

export function UserDetailPage({ userId, onNavigate, initialTab }: UserDetailPageProps) {
  const [user, setUser] = useState<UserDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<UserDetailTab>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'certificate' || p === 'account' || p === 'activity' || p === 'summary') {
        return p;
      }
    }
    return 'summary';
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Success Feedback Toast
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog States
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const [isChangePfxOpen, setIsChangePfxOpen] = useState(false);
  const [isChangingPfx, setIsChangingPfx] = useState(false);
  const [changePfxError, setChangePfxError] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    if (!userId) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const res = await fetchUserDetail(userId);
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat detail pengguna.');
        setError(msg);
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('tidak ditemukan')) {
        setIsNotFound(true);
      } else {
        setError(errMsg || 'Terjadi kesalahan saat memuat detail pengguna.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Regenerate Actions
  const handleOpenRegenerate = () => {
    setRegenerateError(null);
    setIsRegenerateOpen(true);
  };

  const handleCloseRegenerate = () => {
    if (!isRegenerating) {
      setIsRegenerateOpen(false);
      setRegenerateError(null);
    }
  };

  const handleConfirmRegenerate = async (adminPassword: string) => {
    if (!user) return;
    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      const res = await regenerateUserCertificate(user.id, {
        admin_password: adminPassword,
      });
      if (res.success) {
        setIsRegenerateOpen(false);
        showFeedback('Sertifikat baru berhasil diterbitkan dan status sertifikat lama telah diperbarui.');
        await loadData();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Sertifikat gagal diterbitkan. Sertifikat lama masih berlaku. Coba lagi.');
        setRegenerateError(msg);
      }
    } catch (err: any) {
      setRegenerateError(err.message || 'Sertifikat gagal diterbitkan. Sertifikat lama masih berlaku. Coba lagi.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Change PFX Actions
  const handleOpenChangePfx = () => {
    setChangePfxError(null);
    setIsChangePfxOpen(true);
  };

  const handleCloseChangePfx = () => {
    if (!isChangingPfx) {
      setIsChangePfxOpen(false);
      setChangePfxError(null);
    }
  };

  const handleConfirmChangePfx = async (newPassword: string, confirmPassword: string) => {
    if (!user) return;
    setIsChangingPfx(true);
    setChangePfxError(null);

    try {
      const res = await changeUserPfxPassword(user.id, {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (res.success) {
        setIsChangePfxOpen(false);
        showFeedback('Passphrase berhasil diubah.');
        await loadData();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal mengubah passphrase.');
        setChangePfxError(msg);
      }
    } catch (err: any) {
      setChangePfxError(err.message || 'Gagal mengubah passphrase.');
    } finally {
      setIsChangingPfx(false);
    }
  };

  // Delete User Actions
  const handleOpenDelete = () => {
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    if (!isDeleting) {
      setIsDeleteOpen(false);
      setDeleteError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteUser(user.id);
      if (res.success) {
        setIsDeleteOpen(false);
        onNavigate('/users');
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal menghapus pengguna.');
        setDeleteError(msg);
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.toLowerCase().includes('not found')) {
        setIsDeleteOpen(false);
        onNavigate('/users');
      } else {
        setDeleteError(err.message || 'Gagal menghapus pengguna dari sistem.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // 404 Not Found State
  if (isNotFound) {
    return (
      <div className="user-detail-page-container">
        <nav className="detail-breadcrumbs" aria-label="Navigasi rekam jejak">
          <button
            type="button"
            className="btn-breadcrumb"
            onClick={() => onNavigate('/users')}
          >
            ← Kembali ke Pengguna
          </button>
        </nav>

        <div className="users-empty-state-card" role="status">
          <div className="empty-state-icon" aria-hidden="true">
            <IconUsers size={32} />
          </div>
          <h2 className="empty-state-title">Pengguna Tidak Ditemukan</h2>
          <p className="empty-state-description">
            Data pengguna dengan identifier yang diminta tidak ditemukan di basis data atau telah dihapus.
          </p>
          <button
            type="button"
            className="btn btn-primary empty-state-action-btn"
            onClick={() => onNavigate('/users')}
          >
            Kembali ke Daftar Pengguna
          </button>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="user-detail-page-container">
        <nav className="detail-breadcrumbs" aria-label="Navigasi rekam jejak">
          <button
            type="button"
            className="btn-breadcrumb"
            onClick={() => onNavigate('/users')}
          >
            ← Kembali ke Pengguna
          </button>
        </nav>

        <div className="users-error-card" role="alert">
          <div className="error-icon" aria-hidden="true">
            <IconAlertTriangle size={32} />
          </div>
          <div className="error-body">
            <h2 className="error-title">Gagal Memuat Detail Pengguna</h2>
            <p className="error-description">{error}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost error-retry-btn"
            onClick={loadData}
          >
            <IconRefresh size={16} aria-hidden="true" />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>
    );
  }

  const certHistoryCount = user?.certificate_history ? user.certificate_history.length : 0;

  return (
    <div className="user-detail-page-container">
      {/* Breadcrumb Navigation */}
      <nav className="detail-breadcrumbs" aria-label="Navigasi rekam jejak">
        <button
          type="button"
          className="btn-breadcrumb"
          onClick={() => onNavigate('/users')}
        >
          <span>Pengguna</span>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <span className="breadcrumb-current">{user ? user.name : 'Detail Pengguna'}</span>
        </button>
      </nav>

      {/* Success Toast Feedback */}
      {feedbackMessage && (
        <div className="feedback-banner feedback-success" role="status" aria-live="polite">
          <IconCheckCircle size={18} aria-hidden="true" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading || !user ? (
        <div className="detail-skeleton-container" aria-busy="true" aria-label="Memuat detail pengguna...">
          <div className="skeleton-card skeleton-card-user" />
          <div className="skeleton-card skeleton-card-cert" />
          <div className="skeleton-card skeleton-card-history" />
        </div>
      ) : (
        <>
          {/* Header Card & Tab Bar */}
          <div className="user-detail-header-card">
            <div className="user-detail-hero-top">
              <div className="user-profile-header">
                <div className="user-profile-avatar" aria-hidden="true">
                  <span>{user.name ? user.name.trim().charAt(0).toUpperCase() : 'U'}</span>
                </div>
                <div className="user-profile-titles">
                  <div className="user-profile-name-row">
                    <h1 className="user-profile-name">{user.name}</h1>
                    <StatusChip
                      status={user.status}
                      label={statusAkun[user.status] || user.status}
                    />
                  </div>
                  <div className="user-hero-meta-row">
                    <span className="user-hero-meta-item">
                      <NikDisplay nik={user.nik} />
                    </span>
                    <span className="meta-separator">•</span>
                    <span className="user-hero-meta-item">{user.email}</span>
                    {user.organization && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="user-hero-meta-item">
                          {user.organization}{user.ou ? ` / ${user.ou}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation Bar */}
            <div className="user-detail-tabs-bar" role="tablist" aria-label="Tab Informasi Pengguna">
              <button
                type="button"
                role="tab"
                id="tab-summary"
                aria-selected={activeTab === 'summary'}
                aria-controls="pane-summary"
                className={`user-detail-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                <IconDashboard size={17} aria-hidden="true" />
                <span>Ringkasan</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-account"
                aria-selected={activeTab === 'account'}
                aria-controls="pane-account"
                className={`user-detail-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                <IconUser size={17} aria-hidden="true" />
                <span>Akun</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-certificate"
                aria-selected={activeTab === 'certificate'}
                aria-controls="pane-certificate"
                className={`user-detail-tab-btn ${activeTab === 'certificate' ? 'active' : ''}`}
                onClick={() => setActiveTab('certificate')}
              >
                <IconCertificate size={17} aria-hidden="true" />
                <span>Sertifikat</span>
                {certHistoryCount > 0 && (
                  <span className="tab-badge">{certHistoryCount}</span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                id="tab-activity"
                aria-selected={activeTab === 'activity'}
                aria-controls="pane-activity"
                className={`user-detail-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                <IconAudit size={17} aria-hidden="true" />
                <span>Riwayat Aktivitas</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panes */}
          <div className="user-detail-tab-pane" role="tabpanel">
            {activeTab === 'summary' && (
              <div id="pane-summary" aria-labelledby="tab-summary">
                <UserSummaryTab user={user} onSwitchTab={setActiveTab} />
              </div>
            )}

            {activeTab === 'account' && (
              <div id="pane-account" aria-labelledby="tab-account">
                <UserInfoCard
                  user={user}
                  onDeleteUser={handleOpenDelete}
                />
              </div>
            )}

            {activeTab === 'certificate' && (
              <div id="pane-certificate" aria-labelledby="tab-certificate" className="detail-cards-stack">
                <ActiveCertificateCard
                  certificate={user.active_certificate}
                  onRegenerate={handleOpenRegenerate}
                  onChangePfx={handleOpenChangePfx}
                  disabled={isRegenerating || isChangingPfx}
                />
                <CertificateHistoryCard
                  history={user.certificate_history}
                />
              </div>
            )}

            {activeTab === 'activity' && (
              <div id="pane-activity" aria-labelledby="tab-activity">
                <UserActivityTab userId={user.id} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      <RegenerateDialog
        user={user}
        isOpen={isRegenerateOpen}
        isProcessing={isRegenerating}
        error={regenerateError}
        onConfirm={handleConfirmRegenerate}
        onClose={handleCloseRegenerate}
      />

      <ChangePfxDialog
        user={user}
        isOpen={isChangePfxOpen}
        isProcessing={isChangingPfx}
        error={changePfxError}
        onConfirm={handleConfirmChangePfx}
        onClose={handleCloseChangePfx}
      />

      <UserDeleteDialog
        user={user}
        isOpen={isDeleteOpen}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseDelete}
      />
    </div>
  );
}

