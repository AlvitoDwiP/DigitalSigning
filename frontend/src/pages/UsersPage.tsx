import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserItem } from '../types/users';
import { fetchUsers, deleteUser } from '../services/users';
import { UsersToolbar } from '../components/users/UsersToolbar';
import { UsersTable } from '../components/users/UsersTable';
import { UserDeleteDialog } from '../components/users/UserDeleteDialog';
import { UsersPagination } from '../components/users/UsersPagination';
import { UsersSkeleton } from '../components/users/UsersSkeleton';
import { UsersEmpty } from '../components/users/UsersEmpty';
import { UsersError } from '../components/users/UsersError';
import { IconCheckCircle } from '../components/icons/Icons';

interface UsersPageProps {
  onNavigate: (path: string) => void;
  initialSort?: string;
  initialOrder?: 'asc' | 'desc';
}

export function UsersPage({ onNavigate, initialSort, initialOrder }: UsersPageProps) {
  // Filter & Search states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('');
  const [sortField, setSortField] = useState(initialSort || 'name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialOrder || 'asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Data states
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success Feedback Toast
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Delete Dialog state
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // Reset page on search change
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load users from API
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchUsers({
        search: debouncedSearch,
        status: userStatus,
        certificate_status: certificateStatus,
        sort: sortField,
        order: sortOrder,
        page: currentPage,
        limit: pageSize,
      });

      if (response.success && response.data) {
        setUsers(response.data.items || []);
        setTotalCount(response.data.pagination?.total || 0);
      } else {
        const errMsg = typeof response.detail === 'string'
          ? response.detail
          : (response.detail?.message || response.message || 'Gagal memuat data pengguna');
        setError(errMsg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data pengguna.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, userStatus, certificateStatus, sortField, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter change handlers
  const handleUserStatusChange = (val: string) => {
    setUserStatus(val);
    setCurrentPage(1);
  };

  const handleCertStatusChange = (val: string) => {
    setCertificateStatus(val);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: string, newOrder: 'asc' | 'desc') => {
    setSortField(newSort);
    setSortOrder(newOrder);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setUserStatus('');
    setCertificateStatus('');
    setSortField('name');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Row action handlers
  const handleDetail = (userId: string) => {
    onNavigate(`/users/${userId}`);
  };

  const handleDeletePrompt = (user: UserItem) => {
    setDeleteTargetUser(user);
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClose = () => {
    if (!isDeleting) {
      setIsDeleteDialogOpen(false);
      setDeleteTargetUser(null);
      setDeleteError(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetUser) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteUser(deleteTargetUser.id);
      if (res.success) {
        setIsDeleteDialogOpen(false);
        setDeleteTargetUser(null);
        showFeedback(`Pengguna ${deleteTargetUser.name} berhasil dihapus.`);
        // Reload table
        await loadUsers();
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal menghapus pengguna.');
        setDeleteError(msg);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus pengguna dari sistem.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isFiltered = Boolean(debouncedSearch || userStatus || certificateStatus || sortField !== 'name' || sortOrder !== 'asc');

  return (
    <div className="users-page-container">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Pengguna</h1>
          <p className="page-subtitle">
            Daftar akun pengguna, verifikasi NIK, status masa berlaku sertifikat X.509, dan manajemen akun.
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
      <div className="users-content-card">
        {/* Toolbar */}
        <UsersToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          status={userStatus}
          onStatusChange={handleUserStatusChange}
          certificateStatus={certificateStatus}
          onCertificateStatusChange={handleCertStatusChange}
          sort={sortField}
          order={sortOrder}
          onSortChange={handleSortChange}
          disabled={isLoading && users.length === 0}
        />

        {/* Content States */}
        {isLoading && users.length === 0 ? (
          <UsersSkeleton rows={pageSize} />
        ) : error ? (
          <UsersError message={error} onRetry={loadUsers} />
        ) : users.length === 0 ? (
          <UsersEmpty
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
            onNavigateGenerate={() => onNavigate('/generate')}
          />
        ) : (
          <>
            <UsersTable
              users={users}
              onDetail={handleDetail}
              onDelete={handleDeletePrompt}
            />

            <UsersPagination
              currentPage={currentPage}
              limit={pageSize}
              total={totalCount}
              onPageChange={setCurrentPage}
              disabled={isLoading}
            />
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <UserDeleteDialog
        user={deleteTargetUser}
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteClose}
      />
    </div>
  );
}
