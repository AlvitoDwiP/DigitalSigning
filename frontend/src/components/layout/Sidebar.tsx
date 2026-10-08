import type { ComponentType } from 'react';
import {
  IconDashboard,
  IconUsers,
  IconGenerate,
  IconAudit,
  IconSignature,
  IconClose
} from '../icons/Icons';
import { StatusChip } from '../ui/StatusChip';

export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isReserved?: boolean;
  reservedBadge?: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
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
    id: 'audit-logs',
    path: '/audit-logs',
    label: 'Audit Log',
    icon: IconAudit,
  },
  {
    id: 'signing',
    path: '/signing',
    label: 'Penandatanganan',
    icon: IconSignature,
    isReserved: true,
    reservedBadge: 'Segera',
  },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export function Sidebar({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
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
          <div className="brand-logo" aria-hidden="true">
            <span>DS</span>
          </div>
          <div className="brand-text">
            <span className="brand-title">Digital Signature</span>
            <span className="brand-subtitle">Admin Platform</span>
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
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.path;
              const Icon = item.icon;

              return (
                <li key={item.id} className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${isActive ? 'nav-link-active' : ''} ${item.isReserved ? 'nav-link-reserved' : ''}`}
                    onClick={() => {
                      onNavigate(item.path);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="nav-icon-wrapper" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                    {item.isReserved && item.reservedBadge && (
                      <StatusChip
                        status="RESERVED"
                        label={item.reservedBadge}
                        className="nav-reserved-badge"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {onLogout && (
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              aria-label="Keluar dari sesi Admin"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Keluar</span>
            </button>
          )}
          <div className="sidebar-version-tag">v1.0 • Phase 1</div>
        </div>
      </aside>
    </>
  );
}
