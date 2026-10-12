import { IconMenu } from '../icons/Icons';
import { ThemeToggle } from '../ui/ThemeToggle';
import { getAuthUser } from '../../services/api';

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onSearch?: (query: string) => void;
  onNavigate?: (path: string) => void;
}

export function Topbar({ onOpenMobileMenu, onNavigate }: TopbarProps) {
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
          aria-label={`Profil Pengguna: ${userName}. Klik untuk Kelola Akun.`}
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
