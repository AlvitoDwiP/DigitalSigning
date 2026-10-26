import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { AdminItem } from '../types/admins';
import { fetchAdmins, assignAdmin, removeAdmin } from '../services/admins';
import { AdminsTable } from '../components/admins/AdminsTable';
import { AdminCandidatesModal } from '../components/admins/AdminCandidatesModal';
import { AdminAssignDialog } from '../components/admins/AdminAssignDialog';
import { AdminRemoveDialog } from '../components/admins/AdminRemoveDialog';
import { AdminsSkeleton } from '../components/admins/AdminsSkeleton';
import { AdminsEmpty } from '../components/admins/AdminsEmpty';
import { AdminsError } from '../components/admins/AdminsError';
import { IconCheckCircle, IconSearch, IconPlus, IconClose } from '../components/icons/Icons';

interface AdminsPageProps {
  onNavigate: (path: string) => void;
}

export function AdminsPage({ onNavigate: _onNavigate }: AdminsPageProps) {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Candidates modal
  const [isCandidatesModalOpen, setIsCandidatesModalOpen] = useState(false);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<AdminItem | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<AdminItem | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

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
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdmins();
      if (res.success && res.data) {
        setAdmins(res.data.items || []);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat data administrator');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat daftar administrator.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Candidate Selection -> Open Assign Dialog
  const handleSelectCandidate = (candidate: AdminItem) => {
    setIsCandidatesModalOpen(false);
    setAssignTarget(candidate);
    setAssignError(null);
    setIsAssignOpen(true);
  };

  // Confirm Assign Admin
  const handleConfirmAssign = async () => {
    if (!assignTarget) return;
    setIsAssigning(true);
    setAssignError(null);

    try {
      const res = await assignAdmin(assignTarget.id);
      if (res.success) {
        setIsAssignOpen(false);
        setIsCandidatesModalOpen(false);
        setAssignTarget(null);
        showFeedback(`Pengguna ${assignTarget.name} berhasil ditetapkan sebagai Admin.`);
        await loadData();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal menetapkan peran Admin.');
        setAssignError(msg);
      }
    } catch (err: any) {
      setAssignError(err.message || 'Gagal menetapkan peran Admin.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Remove Prompt
  const handlePromptRemove = (admin: AdminItem) => {
    setRemoveTarget(admin);
    setRemoveError(null);
    setIsRemoveOpen(true);
  };

  // Confirm Remove Admin
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    setRemoveError(null);

    try {
      const res = await removeAdmin(removeTarget.id);
      if (res.success) {
        setIsRemoveOpen(false);
        setRemoveTarget(null);
        showFeedback(`Role Admin untuk ${removeTarget.name} berhasil dihapus (USER).`);
        await loadData();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal menghapus role Admin.');
        setRemoveError(msg);
      }
    } catch (err: any) {
      setRemoveError(err.message || 'Gagal menghapus role Admin.');
    } finally {
      setIsRemoving(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    let list = [...admins];
    list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.nik.toLowerCase().includes(q)
    );
  }, [admins, searchQuery]);

  const isFiltered = Boolean(searchQuery.trim());

  return (
    <div className="users-page-container admins-page-container">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-content">
          <div className="page-header-title-group">
            <h1 className="page-title">MANAGEMENT ADMIN</h1>
          </div>
          <p className="page-subtitle">
            Kelola daftar akun Administrator sistem dan tetapkan peran Admin kepada pengguna terdaftar.
          </p>
        </div>
      </header>

      {/* Success Toast */}
      {feedbackMessage && (
        <div className="feedback-banner feedback-success" role="status" aria-live="polite">
          <IconCheckCircle size={18} aria-hidden="true" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Standalone Search Bar (di luar kotak card tabel) */}
      <div className="audit-search-standalone-wrapper">
        <div className="audit-search-box">
          <span className="audit-search-icon" aria-hidden="true">
            <IconSearch size={18} />
          </span>
          <input
            type="search"
            className="audit-search-input"
            placeholder="Cari admin berdasarkan nama, email, atau NIK..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading && admins.length === 0}
            aria-label="Cari admin"
          />
          {searchQuery && (
            <button
              type="button"
              className="audit-search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Hapus pencarian"
              aria-label="Hapus teks pencarian"
            >
              <IconClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Actions Row (di bawah pencarian, di sebelah kanan) */}
      <div className="admins-actions-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCandidatesModalOpen(true)}
          disabled={isLoading}
        >
          <IconPlus size={18} aria-hidden="true" />
          <span>Tambah Admin</span>
        </button>
      </div>

      {/* Main Content Card (Tabel) */}
      <div className="users-content-card">

        {/* Content States */}
        {isLoading && admins.length === 0 ? (
          <AdminsSkeleton rows={5} />
        ) : error ? (
          <AdminsError message={error} onRetry={loadData} />
        ) : filteredAdmins.length === 0 ? (
          <AdminsEmpty
            isFiltered={isFiltered}
            onResetFilters={() => setSearchQuery('')}
            onOpenAddModal={() => setIsCandidatesModalOpen(true)}
          />
        ) : (
          <AdminsTable
            admins={filteredAdmins}
            onRemoveAdmin={handlePromptRemove}
            disabled={isRemoving}
          />
        )}
      </div>

      {/* Candidates Selection Modal */}
      <AdminCandidatesModal
        isOpen={isCandidatesModalOpen}
        onClose={() => setIsCandidatesModalOpen(false)}
        onSelectCandidate={handleSelectCandidate}
        disabled={isAssigning}
      />

      {/* Assign Confirmation Dialog */}
      <AdminAssignDialog
        candidate={assignTarget}
        isOpen={isAssignOpen}
        isProcessing={isAssigning}
        error={assignError}
        onConfirm={handleConfirmAssign}
        onClose={() => {
          if (!isAssigning) {
            setIsAssignOpen(false);
            setAssignTarget(null);
            setIsCandidatesModalOpen(true);
          }
        }}
      />

      {/* Remove Confirmation Dialog */}
      <AdminRemoveDialog
        admin={removeTarget}
        isOpen={isRemoveOpen}
        isProcessing={isRemoving}
        error={removeError}
        onConfirm={handleConfirmRemove}
        onClose={() => {
          if (!isRemoving) {
            setIsRemoveOpen(false);
            setRemoveTarget(null);
          }
        }}
      />
    </div>
  );
}
