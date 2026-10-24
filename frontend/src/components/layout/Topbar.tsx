import { IconMenu } from '../icons/Icons';
import { ThemeToggle } from '../ui/ThemeToggle';
import { getAuthUser } from '../../services/api';

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onSearch?: (query: string) => void;
  onNavigate?: (path: string) => void;
  viewMode?: 'admin' | 'user';
  onToggleViewMode?: () => void;
  isSwitchingMode?: boolean;
}

export function Topbar({
  onOpenMobileMenu,
  onNavigate: _onNavigate,
  viewMode = 'admin',
  onToggleViewMode,
  isSwitchingMode = false,
}: TopbarProps) {
  const authUser = getAuthUser();
  const userName = authUser?.name || 'Pengguna Platform';
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';

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
      </div>

      <div className="topbar-right">
        {/* Admin Mode Switcher di Topbar */}
        {authUser?.role === 'ADMIN' && onToggleViewMode && (
          <button
            type="button"
            className={`topbar-mode-btn ${viewMode === 'user' ? 'topbar-mode-btn-user mode-user' : 'topbar-mode-btn-admin mode-admin'} ${
              isSwitchingMode ? 'is-switching' : ''
            }`}
            onClick={onToggleViewMode}
            disabled={isSwitchingMode}
            aria-label={viewMode === 'user' ? 'Kembali ke Mode Admin' : 'Beralih ke Mode Pengguna'}
          >
            <span className={`mode-dot ${viewMode === 'user' ? 'mode-dot-user' : 'mode-dot-admin'} ${isSwitchingMode ? 'is-spinning' : ''}`} />
            <span>{isSwitchingMode ? 'Beralih mode...' : (viewMode === 'user' ? 'Mode Pengguna' : 'Mode Admin')}</span>
          </button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Area (Static display for all roles, non-clickable) */}
        <div
          className="topbar-profile"
          aria-label={`Identitas Pengguna: ${userName}`}
        >
          <div className="profile-avatar" aria-hidden="true">
            <span>{initial}</span>
          </div>
          <div className="profile-info">
            <span className="profile-name">{userName}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
