import { useState } from 'react';
import { IconSearch, IconMenu } from '../icons/Icons';
import { ThemeToggle } from '../ui/ThemeToggle';
import { StatusChip } from '../ui/StatusChip';
import { getAuthUser } from '../../services/api';

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onSearch?: (query: string) => void;
  onNavigate?: (path: string) => void;
}

export function Topbar({ onOpenMobileMenu, onSearch, onNavigate }: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const authUser = getAuthUser();
  const userName = authUser?.name || 'Pengguna Platform';
  const userRole = authUser?.role || 'USER';
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
    if (onNavigate && (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN')) {
      onNavigate('/users');
    }
  };

  return (
    <header className="topbar" aria-label="Topbar Navigasi">
      <div className="topbar-left">
        {onOpenMobileMenu && (
          <button
            type="button"
            className="topbar-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
          >
            <IconMenu size={22} />
          </button>
        )}

        {/* Search Capsule */}
        <form className="topbar-search-form" onSubmit={handleSearchSubmit} role="search">
          <div className="topbar-search-capsule">
            <span className="search-icon" aria-hidden="true">
              <IconSearch size={18} />
            </span>
            <input
              type="search"
              className="topbar-search-input"
              placeholder="Cari pengguna..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Cari pengguna di platform"
            />
          </div>
        </form>
      </div>

      <div className="topbar-right">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Area */}
        <div
          className="topbar-profile"
          tabIndex={0}
          role="button"
          onClick={() => onNavigate && onNavigate('/account')}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onNavigate) {
              e.preventDefault();
              onNavigate('/account');
            }
          }}
          aria-label={`Profil Pengguna: ${userName}, Role: ${userRole}. Klik untuk Kelola Akun.`}
        >
          <div className="profile-avatar" aria-hidden="true">
            <span>{initial}</span>
          </div>
          <div className="profile-info">
            <span className="profile-name">{userName}</span>
            <StatusChip status={userRole} label={userRole} className="profile-role-badge" />
          </div>
        </div>
      </div>
    </header>
  );
}
