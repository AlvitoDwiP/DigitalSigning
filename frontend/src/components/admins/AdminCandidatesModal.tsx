import { useState, useEffect, useRef, useMemo } from 'react';
import type { AdminItem } from '../../types/admins';
import { fetchAdminCandidates } from '../../services/admins';
import { maskNik } from '../users/UsersTable';
import { StatusChip } from '../ui/StatusChip';
import {
  IconClose,
  IconSearch,
  IconUsers,
  IconAlertTriangle,
  IconRefresh,
} from '../icons/Icons';

interface AdminCandidatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCandidate: (candidate: AdminItem) => void;
  disabled?: boolean;
}

export function AdminCandidatesModal({
  isOpen,
  onClose,
  onSelectCandidate,
  disabled = false,
}: AdminCandidatesModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [candidates, setCandidates] = useState<AdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCandidates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCandidates();
      if (res.success && res.data) {
        setCandidates(res.data.items || []);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat daftar kandidat admin');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat kandidat admin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setSearchQuery('');
      loadCandidates();
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!disabled) {
        onClose();
      }
    };

    const dialog = dialogRef.current;
    if (dialog) {
      dialog.addEventListener('cancel', handleCancel);
    }
    return () => {
      if (dialog) {
        dialog.removeEventListener('cancel', handleCancel);
      }
    };
  }, [disabled, onClose]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.nik.toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal-dialog candidates-modal-dialog"
      aria-labelledby="candidates-modal-title"
    >
      <div className="dialog-content-wrapper candidates-modal-wrapper">
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-title-group">
            <div className="dialog-info-icon" aria-hidden="true">
              <IconUsers size={22} />
            </div>
            <div>
              <h2 id="candidates-modal-title" className="dialog-title">
                Pilih Kandidat Administrator
              </h2>
              <p className="dialog-subtitle">
                Daftar pengguna aktif yang memenuhi syarat untuk dijadikan Administrator (Role: USER).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={disabled}
            aria-label="Tutup modal kandidat"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="candidates-search-bar">
          <div className="users-search-field">
            <span className="search-icon" aria-hidden="true">
              <IconSearch size={18} />
            </span>
            <input
              type="search"
              className="users-search-input"
              placeholder="Cari kandidat berdasarkan nama, email, atau NIK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              aria-label="Cari kandidat admin"
            />
          </div>
        </div>

        {/* Body */}
        <div className="dialog-body candidates-modal-body">
          {isLoading ? (
            <div className="candidates-skeleton-list">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="candidate-skeleton-item" />
              ))}
            </div>
          ) : error ? (
            <div className="users-error-card" role="alert">
              <div className="error-icon" aria-hidden="true">
                <IconAlertTriangle size={24} />
              </div>
              <div className="error-body">
                <h3 className="error-title">Gagal Memuat Kandidat</h3>
                <p className="error-description">{error}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost error-retry-btn"
                onClick={loadCandidates}
              >
                <IconRefresh size={16} aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="candidates-empty-state">
              <p className="empty-text">
                {searchQuery
                  ? 'Tidak ada kandidat yang cocok dengan pencarian.'
                  : 'Tidak ada pengguna dengan role USER yang aktif untuk dijadikan Administrator.'}
              </p>
            </div>
          ) : (
            <div className="candidates-list-container">
              <table className="users-table candidates-table">
                <thead>
                  <tr>
                    <th scope="col">Pengguna</th>
                    <th scope="col">NIK</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => {
                    const initial = candidate.name ? candidate.name.trim().charAt(0).toUpperCase() : 'U';

                    return (
                      <tr key={candidate.id} className="candidate-row">
                        <td>
                          <div className="user-name-cell">
                            <div className="user-avatar-badge" aria-hidden="true">
                              <span>{initial}</span>
                            </div>
                            <div className="user-name-details">
                              <span className="user-full-name">{candidate.name}</span>
                              {candidate.organization && (
                                <span className="user-org-subtext">
                                  {candidate.organization}{candidate.ou ? ` / ${candidate.ou}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono">{maskNik(candidate.nik)}</td>
                        <td>{candidate.email}</td>
                        <td>
                          <StatusChip status={candidate.status} label={candidate.status} />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => onSelectCandidate(candidate)}
                            disabled={disabled}
                          >
                            Jadikan Admin
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-ghost dialog-btn-cancel"
            onClick={onClose}
            disabled={disabled}
          >
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
