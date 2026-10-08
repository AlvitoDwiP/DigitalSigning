import { useState } from 'react';
import { IconSearch, IconMenu } from '../icons/Icons';
import { ThemeToggle } from '../ui/ThemeToggle';
import { StatusChip } from '../ui/StatusChip';

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onSearch?: (query: string) => void;
}

export function Topbar({ onOpenMobileMenu, onSearch }: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('');

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

        {/* Admin Profile Area */}
        <div className="topbar-profile" tabIndex={0} aria-label="Profil Pengguna: Admin Platform">
          <div className="profile-avatar" aria-hidden="true">
            <span>A</span>
          </div>
          <div className="profile-info">
            <span className="profile-name">Admin Platform</span>
            <StatusChip status="ADMIN" label="ADMIN" className="profile-role-badge" />
          </div>
        </div>
      </div>
    </header>
  );
}
