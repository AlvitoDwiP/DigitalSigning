import { useState } from 'react';
import type { GenerateUserData } from '../types/users';
import { GenerateSingleUserForm } from '../components/generate/GenerateSingleUserForm';
import { GenerateBulkUserView } from '../components/generate/GenerateBulkUserView';
import { IconGenerate, IconUsers } from '../components/icons/Icons';

interface GeneratePageProps {
  onNavigate: (path: string) => void;
}

export function GeneratePage({ onNavigate }: GeneratePageProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  const handleGenerateSuccess = (data: GenerateUserData) => {
    if (data && data.user && data.user.id) {
      onNavigate(`/users/${data.user.id}`);
    } else {
      onNavigate('/users');
    }
  };

  return (
    <div className="generate-page-container">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Generate User</h1>
          <p className="page-subtitle">
            Penerbitan akun pengguna baru sekaligus provisioning pasangan kunci kriptografi dan sertifikat digital X.509 melalui PKI Service.
          </p>
        </div>
      </header>

      {/* Main Content Card */}
      <div className="generate-content-card">
        {/* Tab Navigation */}
        <div className="generate-tabs-bar" role="tablist" aria-label="Metode Pembuatan Pengguna">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'single'}
            className={`generate-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            <IconGenerate size={18} aria-hidden="true" />
            <span>Generate 1 User</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bulk'}
            className={`generate-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            <IconUsers size={18} aria-hidden="true" />
            <span>Generate Bulk User</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="generate-tab-content">
          {activeTab === 'single' ? (
            <GenerateSingleUserForm onSuccess={handleGenerateSuccess} />
          ) : (
            <GenerateBulkUserView onNavigateUsers={() => onNavigate('/users')} />
          )}
        </div>
      </div>
    </div>
  );
}

