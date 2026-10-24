import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { IconShield, IconUser } from '../icons/Icons';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
  viewMode?: 'admin' | 'user';
  onToggleViewMode?: () => void;
  isSwitchingMode?: boolean;
  switchingTargetMode?: 'admin' | 'user' | null;
}

export function AppShell({
  children,
  currentPath,
  onNavigate,
  onLogout,
  viewMode = 'admin',
  onToggleViewMode,
  isSwitchingMode = false,
  switchingTargetMode = null,
}: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className={`app-layout ${isSwitchingMode ? 'is-switching-mode' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={onLogout}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        isSwitchingMode={isSwitchingMode}
      />

      {/* Main App Container */}
      <div className="app-main-wrapper">
        <Topbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
          isSwitchingMode={isSwitchingMode}
          onSearch={(_query) => {
            // UI search query handler placeholder
          }}
        />

        <main
          className={`main-content ${isSwitchingMode ? 'main-content-transitioning' : 'main-content-enter'}`}
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Mode Switch Transition Overlay */}
      {isSwitchingMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="mode-switch-overlay" role="status" aria-live="polite">
            <div className="mode-switch-card">
              <div
                className={`mode-switch-icon-wrap ${
                  switchingTargetMode === 'admin' ? 'mode-switch-icon-admin' : 'mode-switch-icon-user'
                }`}
              >
                {switchingTargetMode === 'admin' ? (
                  <IconShield size={28} aria-hidden="true" />
                ) : (
                  <IconUser size={28} aria-hidden="true" />
                )}
              </div>
              <div className="mode-switch-texts">
                <h3 className="mode-switch-title">
                  {switchingTargetMode === 'admin' ? 'Beralih ke Mode Admin' : 'Beralih ke Mode Pengguna'}
                </h3>
                <p className="mode-switch-subtext">Menyesuaikan menu dan tampilan...</p>
              </div>
              <div className="mode-switch-progress-bar">
                <div className="mode-switch-progress-fill" />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
