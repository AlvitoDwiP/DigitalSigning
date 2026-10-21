import { useEffect } from 'react';
import type { ComponentType } from 'react';
import {
  IconDashboard,
  IconUsers,
  IconGenerate,
  IconAudit,
  IconShield,
  IconUser,
  IconSignature,
  IconClose,
} from '../icons/Icons';
import { getAuthUser } from '../../services/api';
import logoImg from '../../assets/logo.png';

export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isReserved?: boolean;
  reservedBadge?: string;
}

export function getNavItemsForRole(role: string, viewMode: 'admin' | 'user' = 'admin'): NavItem[] {
  if (role === 'SUPER_ADMIN') {
    return [
      {
        id: 'dashboard',
        path: '/dashboard',
        label: 'Dashboard',
        icon: IconDashboard,
      },
      {
        id: 'users',
        path: '/users',
        label: 'Pengguna',
        icon: IconUsers,
      },
      {
        id: 'generate',
        path: '/generate',
        label: 'Generate',
        icon: IconGenerate,
      },
      {
        id: 'admins',
        path: '/admins',
        label: 'Management Admin',
        icon: IconShield,
      },
      {
        id: 'audit-log',
        path: '/audit-log',
        label: 'Audit Log',
        icon: IconAudit,
      },
      {
        id: 'account',
        path: '/account',
        label: 'Kelola Akun',
        icon: IconUser,
      },
      {
        id: 'signing',
        path: '/signing',
        label: 'Penandatanganan',
        icon: IconSignature,
        isReserved: true,
        reservedBadge: 'Soon',
      },
    ];
  }

  if (role === 'ADMIN') {
    if (viewMode === 'user') {
      // Admin pada Mode Pengguna: Menampilkan navigasi User dengan penanda Soon untuk Penandatanganan
      return [
        {
          id: 'dashboard',
          path: '/dashboard',
          label: 'Dashboard',
          icon: IconDashboard,
        },
        {
          id: 'account',
          path: '/account',
          label: 'Kelola Akun',
          icon: IconUser,
        },
        {
          id: 'signing',
          path: '/signing',
          label: 'Penandatanganan',
          icon: IconSignature,
          isReserved: true,
          reservedBadge: 'Soon',
        },
      ];
    }

    // Admin pada Mode Admin: Menu administrasi dengan penanda Soon untuk Penandatanganan
    return [
      {
        id: 'dashboard',
        path: '/dashboard',
        label: 'Dashboard',
        icon: IconDashboard,
      },
      {
        id: 'users',
        path: '/users',
        label: 'Pengguna',
        icon: IconUsers,
      },
      {
        id: 'generate',
        path: '/generate',
        label: 'Generate',
        icon: IconGenerate,
      },
      {
        id: 'audit-log',
        path: '/audit-log',
        label: 'Audit Log',
        icon: IconAudit,
      },
      {
        id: 'signing',
        path: '/signing',
        label: 'Penandatanganan',
        icon: IconSignature,
        isReserved: true,
        reservedBadge: 'Soon',
      },
    ];
  }

  // Role: USER (Phase 1: Dashboard, Kelola Akun, Penandatanganan Soon)
  return [
    {
      id: 'dashboard',
      path: '/dashboard',
      label: 'Dashboard',
      icon: IconDashboard,
    },
    {
      id: 'account',
      path: '/account',
      label: 'Kelola Akun',
      icon: IconUser,
    },
    {
      id: 'signing',
      path: '/signing',
      label: 'Penandatanganan',
      icon: IconSignature,
      isReserved: true,
      reservedBadge: 'Soon',
    },
  ];
}

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  viewMode?: 'admin' | 'user';
  onToggleViewMode?: () => void;
}

export function Sidebar({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
  viewMode = 'admin',
  onToggleViewMode,
}: SidebarProps) {
  const authUser = getAuthUser();
  const currentRole = authUser?.role || 'ADMIN';
  const navItems = getNavItemsForRole(currentRole, viewMode);

  // Lock scroll and handle escape key when mobile drawer is open
  useEffect(() => {
    if (!isOpenMobile) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) {
        onCloseMobile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpenMobile, onCloseMobile]);

  const isPathActive = (itemPath: string) => {
    if (currentPath === itemPath) return true;
    if (itemPath === '/audit-log' && (currentPath === '/audit-logs' || currentPath === '/audit-log')) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isOpenMobile ? 'sidebar-open' : ''}`}
        aria-label="Navigasi Utama"
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <img src={logoImg} alt="Logo" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-title">Digital Signature</span>
          </div>
          {isOpenMobile && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onCloseMobile}
              aria-label="Tutup navigasi"
            >
              <IconClose size={20} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navItems.map((item) => {
              const isActive = isPathActive(item.path);
              const Icon = item.icon;

              return (
                <li key={item.id} className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${isActive ? 'nav-link-active' : ''} ${item.isReserved ? 'nav-link-reserved' : ''}`}
                    onClick={() => {
                      if (item.isReserved) return;
                      onNavigate(item.path);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    disabled={item.isReserved}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="nav-icon-wrapper" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span className="nav-label">{item.label}</span>
                      {item.isReserved && (
                        <span className="sidebar-badge-soon">{item.reservedBadge || 'Soon'}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {currentRole === 'ADMIN' && onToggleViewMode && (
            <button
              type="button"
              className={`sidebar-mode-btn ${viewMode === 'user' ? 'sidebar-mode-btn-user' : 'sidebar-mode-btn-admin'}`}
              onClick={onToggleViewMode}
              aria-label={viewMode === 'user' ? 'Kembali ke Mode Admin' : 'Beralih ke Mode Pengguna'}
            >
              {viewMode === 'user' ? (
                <>
                  <IconShield size={18} aria-hidden="true" />
                  <span>Kembali ke Mode Admin</span>
                </>
              ) : (
                <>
                  <IconUser size={18} aria-hidden="true" />
                  <span>Mode Pengguna</span>
                </>
              )}
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              aria-label="Keluar dari sesi akun"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Keluar</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
