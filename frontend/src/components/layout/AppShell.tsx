import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
  viewMode?: 'admin' | 'user';
  onToggleViewMode?: () => void;
}

export function AppShell({
  children,
  currentPath,
  onNavigate,
  onLogout,
  viewMode = 'admin',
  onToggleViewMode,
}: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={onLogout}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
      />

      {/* Main App Container */}
      <div className="app-main-wrapper">
        <Topbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
          onSearch={(_query) => {
            // UI search query handler placeholder
          }}
        />

        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
