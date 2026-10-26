import { useState, useEffect, useCallback } from 'react';
import type { AuditLogItem } from '../types/auditLogs';
import { fetchAuditLogs } from '../services/auditLogs';
import { AuditLogsToolbar } from '../components/audit/AuditLogsToolbar';
import { AuditLogsTable } from '../components/audit/AuditLogsTable';
import { AuditLogsPagination } from '../components/audit/AuditLogsPagination';
import { AuditLogsSkeleton } from '../components/audit/AuditLogsSkeleton';
import { AuditLogsEmpty } from '../components/audit/AuditLogsEmpty';
import { AuditLogsError } from '../components/audit/AuditLogsError';
import { AuditLogDetailModal } from '../components/audit/AuditLogDetailModal';
import { IconSearch, IconClose } from '../components/icons/Icons';

interface AuditLogsPageProps {
  onNavigate?: (path: string) => void;
}

export function AuditLogsPage({ onNavigate: _onNavigate }: AuditLogsPageProps) {
  // Filter states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Selected log for detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Data states
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load audit logs from server
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchAuditLogs({
        search: debouncedSearch,
        action: actionFilter || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.success && res.data) {
        setLogs(res.data.items || []);
        setTotalCount(res.data.pagination?.total || 0);
      } else {
        const msg = typeof res.detail === 'string'
          ? res.detail
          : (res.detail?.message || res.message || 'Gagal memuat rekam jejak audit log');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data audit log.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, actionFilter, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleActionChange = (val: string) => {
    setActionFilter(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setActionFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const isFiltered = Boolean(debouncedSearch || actionFilter || statusFilter);

  return (
    <div className="users-page-container audit-page-container">
      {/* 1. Judul dan Deskripsi */}
      <header className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">AUDIT LOG</h1>
          <p className="page-subtitle">
            Catatan semua aktivitas di platform. Catatan ini tidak bisa diubah atau dihapus.
          </p>
        </div>
      </header>

      {/* 2. Pencarian (keluar kotak card) */}
      <div className="audit-search-standalone-wrapper">
        <div className="audit-search-box">
          <span className="audit-search-icon" aria-hidden="true">
            <IconSearch size={18} />
          </span>
          <input
            type="search"
            className="audit-search-input"
            placeholder="Cari aktivitas, objek terkait, ID, atau pelaku..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            disabled={isLoading && logs.length === 0}
            aria-label="Cari entri catatan aktivitas"
          />
          {searchInput && (
            <button
              type="button"
              className="audit-search-clear-btn"
              onClick={() => setSearchInput('')}
              title="Hapus pencarian"
              aria-label="Hapus teks pencarian"
            >
              <IconClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Kotak Card Utama: Filter & Bagan Tabel */}
      <div className="users-content-card">
        {/* Filter (Jenis aktivitas dan Hasil) */}
        <AuditLogsToolbar
          action={actionFilter}
          onActionChange={handleActionChange}
          status={statusFilter}
          onStatusChange={handleStatusChange}
          onReset={handleResetFilters}
          isFiltered={isFiltered}
          disabled={isLoading && logs.length === 0}
        />

        {/* Content States */}
        {isLoading && logs.length === 0 ? (
          <AuditLogsSkeleton rows={pageSize} />
        ) : error ? (
          <AuditLogsError message={error} onRetry={loadLogs} />
        ) : logs.length === 0 ? (
          <AuditLogsEmpty
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <>
            <AuditLogsTable
              logs={logs}
              onSelectLog={(log) => setSelectedLog(log)}
            />

            <AuditLogsPagination
              currentPage={currentPage}
              limit={pageSize}
              total={totalCount}
              onPageChange={setCurrentPage}
              disabled={isLoading}
            />
          </>
        )}
      </div>

      {/* Audit Log Detail Modal */}
      <AuditLogDetailModal
        log={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}

