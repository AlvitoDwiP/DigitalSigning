import React from 'react';
import { IconSearch, IconFilter, IconSort, IconRefresh } from '../icons/Icons';
import { statusAkun, statusSertifikat } from '../../lib/labels';

interface UsersToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  certificateStatus: string;
  onCertificateStatusChange: (value: string) => void;
  sort: string;
  order: 'asc' | 'desc';
  onSortChange: (sort: string, order: 'asc' | 'desc') => void;
  onReset?: () => void;
  isFiltered?: boolean;
  disabled?: boolean;
}

export function UsersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  certificateStatus,
  onCertificateStatusChange,
  sort,
  order,
  onSortChange,
  onReset,
  isFiltered = false,
  disabled = false,
}: UsersToolbarProps) {
  const currentSortKey = `${sort}_${order}`;

  const handleSortSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'name_asc') {
      onSortChange('name', 'asc');
    } else if (val === 'name_desc') {
      onSortChange('name', 'desc');
    } else if (val === 'nearest_expiry_asc') {
      onSortChange('nearest_expiry', 'asc');
    } else if (val === 'nearest_expiry_desc') {
      onSortChange('nearest_expiry', 'desc');
    } else if (val === 'created_at_desc') {
      onSortChange('created_at', 'desc');
    }
  };

  return (
    <section className="users-toolbar-container" aria-label="Alat Penyaringan Pengguna">
      <div className="users-toolbar">
        {/* Optional Search Bar inside toolbar if provided */}
        {search !== undefined && onSearchChange && (
          <div className="users-search-field">
            <div className="search-input-wrapper">
              <span className="search-input-icon" aria-hidden="true">
                <IconSearch size={18} />
              </span>
              <input
                id="users-search-input"
                type="search"
                className="users-search-input"
                placeholder="Cari nama, NIK, atau email"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={disabled}
                autoComplete="off"
                aria-label="Cari nama, NIK, atau email"
              />
            </div>
          </div>
        )}

        {/* Filters and Sort */}
        <div className="users-filters-group">
          {/* User Status Filter */}
          <div className="filter-select-wrapper">
            <label htmlFor="user-status-filter" className="filter-label">
              <IconFilter size={14} className="filter-icon" aria-hidden="true" />
              <span>Status:</span>
            </label>
            <select
              id="user-status-filter"
              className="users-filter-select"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={disabled}
            >
              <option value="">Semua status</option>
              <option value="ACTIVE">{statusAkun.ACTIVE || 'Aktif'}</option>
              <option value="INACTIVE">{statusAkun.INACTIVE || 'Tidak aktif'}</option>
            </select>
          </div>

          {/* Certificate Status Filter */}
          <div className="filter-select-wrapper">
            <label htmlFor="cert-status-filter" className="filter-label">
              <IconFilter size={14} className="filter-icon" aria-hidden="true" />
              <span>Sertifikat:</span>
            </label>
            <select
              id="cert-status-filter"
              className="users-filter-select"
              value={certificateStatus}
              onChange={(e) => onCertificateStatusChange(e.target.value)}
              disabled={disabled}
            >
              <option value="">Semua sertifikat</option>
              <option value="ACTIVE">{statusSertifikat.ACTIVE || 'Aktif'}</option>
              <option value="EXPIRED">{statusSertifikat.EXPIRED || 'Kedaluwarsa'}</option>
              <option value="REPLACED">{statusSertifikat.REPLACED || 'Diganti'}</option>
              <option value="REVOKED">{statusSertifikat.REVOKED || 'Dicabut'}</option>
            </select>
          </div>

          {/* Sorting Control */}
          <div className="filter-select-wrapper filter-select-sort">
            <label htmlFor="users-sort-select" className="filter-label">
              <IconSort size={14} className="filter-icon" aria-hidden="true" />
              <span>Urutan:</span>
            </label>
            <select
              id="users-sort-select"
              className="users-filter-select"
              value={currentSortKey}
              onChange={handleSortSelectChange}
              disabled={disabled}
            >
              <option value="created_at_desc">Paling baru</option>
              <option value="name_asc">Nama A-Z</option>
              <option value="name_desc">Nama Z-A</option>
              <option value="nearest_expiry_asc">Paling cepat berakhir</option>
            </select>
          </div>

          {/* Reset Filters button if any filter is active */}
          {isFiltered && onReset && (
            <button
              type="button"
              className="btn-audit-reset-filter"
              onClick={onReset}
              disabled={disabled}
              title="Reset semua filter"
              aria-label="Reset semua filter"
            >
              <IconRefresh size={13} aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
