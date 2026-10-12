import { useState, useEffect, useCallback } from 'react';
import type { AuditLogItem } from '../types/auditLogs';
import { fetchAuditLogs } from '../services/auditLogs';
import { AuditLogsToolbar } from '../components/audit/AuditLogsToolbar';
import { AuditLogsTable } from '../components/audit/AuditLogsTable';
import { AuditLogsPagination } from '../components/audit/AuditLogsPagination';
import { AuditLogsSkeleton } from '../components/audit/AuditLogsSkeleton';
import { AuditLogsEmpty } from '../components/audit/AuditLogsEmpty';
import { AuditLogsError } from '../components/audit/AuditLogsError';

interface AuditLogsPageProps {
  onNavigate?: (path: string) => void;
}

export function AuditLogsPage({ onNavigate: _onNavigate }: AuditLogsPageProps) {
  // Filter states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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
      // Format start_date and end_date if present
      let formattedStart: string | undefined = undefined;
      let formattedEnd: string | undefined = undefined;

      if (startDate) {
        formattedStart = `${startDate}T00:00:00Z`;
      }
      if (endDate) {
        formattedEnd = `${endDate}T23:59:59Z`;
      }

      const res = await fetchAuditLogs({
        search: debouncedSearch,
        action: actionFilter || undefined,
        status: statusFilter || undefined,
        start_date: formattedStart,
        end_date: formattedEnd,
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
  }, [debouncedSearch, actionFilter, statusFilter, startDate, endDate, currentPage, pageSize]);

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

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setCurrentPage(1);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setActionFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const isFiltered = Boolean(
    debouncedSearch || actionFilter || statusFilter || startDate || endDate
  );

  return (
    <div className="users-page-container audit-page-container">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">
            Catatan semua aktivitas di platform. Catatan ini tidak bisa diubah atau dihapus.
          </p>
        </div>
      </header>

      {/* Content Card */}
      <div className="users-content-card">
        {/* Toolbar */}
        <AuditLogsToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          action={actionFilter}
          onActionChange={handleActionChange}
          status={statusFilter}
          onStatusChange={handleStatusChange}
          startDate={startDate}
          onStartDateChange={handleStartDateChange}
          endDate={endDate}
          onEndDateChange={handleEndDateChange}
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
            <AuditLogsTable logs={logs} />

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
    </div>
  );
}
