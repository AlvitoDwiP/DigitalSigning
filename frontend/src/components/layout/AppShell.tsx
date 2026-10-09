import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

export function AppShell({
  children,
  currentPath,
  onNavigate,
  onLogout,
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
      />

      {/* Main App Container */}
      <div className="app-main-wrapper">
        <Topbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
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
