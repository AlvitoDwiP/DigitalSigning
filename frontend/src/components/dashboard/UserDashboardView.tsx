import { useState } from 'react';
import type { DashboardUserData } from '../../types/dashboard';
import { StatusChip } from '../ui/StatusChip';
import { Button } from '../ui/Button';
import {
  IconCertificate,
  IconUser,
  IconRefresh,
  IconCalendar,
  IconShield,
  IconClock,
  IconSignature,
  IconCopy,
  IconCheckCircle,
} from '../icons/Icons';
import { NikDisplay } from '../ui/NikDisplay';
import { formatWaktuIndonesia, statusSertifikat } from '../../lib/labels';

interface UserDashboardViewProps {
  data: DashboardUserData;
  onNavigate?: (path: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function UserDashboardView({
  data,
  onNavigate,
  onRefresh,
  isRefreshing = false,
}: UserDashboardViewProps) {
  const { user, active_certificate, has_active_certificate } = data;
  const [copiedCertNum, setCopiedCertNum] = useState(false);

  const handleCopyCertNum = async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedCertNum(true);
      setTimeout(() => setCopiedCertNum(false), 2000);
    } catch {
      // fallback
    }
  };

  const getDaysRemainingBadge = (days: number) => {
    if (days <= 0) {
      return (
        <span className="badge-days badge-days-danger">
          Kedaluwarsa
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="badge-days badge-days-warning">
          {days} hari tersisa
        </span>
      );
    }
    return (
      <span className="badge-days badge-days-success">
        {days} hari tersisa
      </span>
    );
  };

  return (
    <div className={`dashboard-page user-dashboard-page ${isRefreshing ? 'dashboard-refreshing-content' : 'dashboard-revealed'}`}>
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Dashboard User</h1>
          <p className="page-subtitle">
            Selamat datang, <strong className="user-welcome-name">{user.name}</strong>. Ringkasan sertifikat dan informasi akun Anda.
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            icon={<IconRefresh size={16} className={isRefreshing ? 'spin-animation' : ''} />}
            aria-label="Segarkan data dashboard"
          >
            {isRefreshing ? 'Menyegarkan...' : 'Segarkan'}
          </Button>
        </div>
      </div>

      {/* Grid 2 Kolom untuk Sertifikat & Akun */}
      <div className="user-dashboard-grid">
        {/* Kartu 1: Sertifikat Saya */}
        <div className="card user-cert-card" aria-labelledby="user-cert-title">
          <div className="user-card-header">
            <div className="user-card-title-group">
              <div>
                <h2 id="user-cert-title" className="user-card-title">Sertifikat Saya</h2>
                <p className="user-card-subtitle">Status dan masa berlaku sertifikat digital</p>
              </div>
            </div>
            {has_active_certificate && active_certificate ? (
              <StatusChip
                status={active_certificate.status}
                label={statusSertifikat[active_certificate.status] || active_certificate.status}
              />
            ) : (
              <StatusChip status="INACTIVE" label="Belum Ada" />
            )}
          </div>

          <div className="user-card-body">
            {has_active_certificate && active_certificate ? (
              <div className="user-cert-details">
                <div className="cert-number-card-container">
                  <div className="cert-number-header-row">
                    <span className="cert-detail-label">
                      <IconShield size={13} className="detail-inline-icon" /> Nomor Sertifikat Resmi
                    </span>
                    <button
                      type="button"
                      className="btn-copy-cert-number"
                      onClick={() => handleCopyCertNum(active_certificate.certificate_number || active_certificate.serial_number)}
                      title="Salin nomor sertifikat ke papan klip"
                      aria-label="Salin nomor sertifikat"
                    >
                      {copiedCertNum ? (
                        <>
                          <IconCheckCircle size={14} className="copy-icon-success" />
                          <span className="copy-text-success">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={14} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="cert-number-hero-box">
                    <div className="cert-number-icon-chip" aria-hidden="true">
                      <IconCertificate size={22} />
                    </div>
                    <div className="cert-number-value-wrap">
                      <code className="cert-number-code">
                        {active_certificate.certificate_number || active_certificate.serial_number}
                      </code>
                      <span className="cert-number-subtext">Sertifikat Digital Elektronik Mahkamah Konstitusi RI</span>
                    </div>
                  </div>
                </div>

                <div className="cert-detail-grid">
                  <div className="cert-detail-item">
                    <span className="cert-detail-label">
                      <IconCalendar size={14} className="detail-inline-icon" /> Berlaku Sampai
                    </span>
                    <span className="cert-detail-value font-medium">
                      {formatWaktuIndonesia(active_certificate.expires_at)}
                    </span>
                  </div>

                  <div className="cert-detail-item">
                    <span className="cert-detail-label">
                      <IconClock size={14} className="detail-inline-icon" /> Sisa Masa Berlaku
                    </span>
                    <div className="cert-detail-value">
                      {getDaysRemainingBadge(active_certificate.days_remaining)}
                    </div>
                  </div>

                  <div className="cert-detail-item">
                    <span className="cert-detail-label">
                      <IconShield size={14} className="detail-inline-icon" /> Tanggal Penerbitan
                    </span>
                    <span className="cert-detail-value">
                      {formatWaktuIndonesia(active_certificate.issued_at)}
                    </span>
                  </div>

                  <div className="cert-detail-item">
                    <span className="cert-detail-label">Status Keaktifan</span>
                    <span className="cert-detail-value font-medium">
                      {active_certificate.status === 'ACTIVE' ? 'Sertifikat Valid & Siap Digunakan' : active_certificate.status}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="user-cert-empty-state">
                <div className="empty-icon-circle">
                  <IconCertificate size={32} />
                </div>
                <h3 className="empty-title">Belum Ada Sertifikat Aktif</h3>
                <p className="empty-description">
                  Akun Anda saat ini belum memiliki sertifikat digital aktif. Silakan hubungi Administrator sistem untuk penerbitan sertifikat baru Anda.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Kartu 2: Data Akun Ringkas */}
        <div className="card user-account-card" aria-labelledby="user-account-title">
          <div className="user-card-header">
            <div className="user-card-title-group">
              <div className="user-card-icon-badge account-icon-badge">
                <IconUser size={22} />
              </div>
              <div>
                <h2 id="user-account-title" className="user-card-title">Data Akun Ringkas</h2>
                <p className="user-card-subtitle">Identitas dan unit kerja terdaftar</p>
              </div>
            </div>
          </div>

          <div className="user-card-body">
            <dl className="user-info-list">
              <div className="user-info-row">
                <dt className="user-info-term">Nama Lengkap</dt>
                <dd className="user-info-desc font-semibold">{user.name}</dd>
              </div>

              <div className="user-info-row">
                <dt className="user-info-term">NIK</dt>
                <dd className="user-info-desc">
                  <NikDisplay nik={user.nik} />
                </dd>
              </div>

              <div className="user-info-row">
                <dt className="user-info-term">Email Kedinasan</dt>
                <dd className="user-info-desc">{user.email}</dd>
              </div>

              <div className="user-info-row">
                <dt className="user-info-term">Instansi</dt>
                <dd className="user-info-desc">{user.organization || 'Mahkamah Konstitusi'}</dd>
              </div>

              <div className="user-info-row">
                <dt className="user-info-term">Unit Kerja (OU)</dt>
                <dd className="user-info-desc">{user.ou || '-'}</dd>
              </div>
            </dl>
          </div>

        </div>
      </div>

      {/* Kartu 3: Layanan Penandatanganan Dokumen */}
      <div className="card user-sign-placeholder-card" aria-labelledby="user-sign-title">
        <div className="user-sign-content">
          <div className="user-sign-icon-circle" aria-hidden="true">
            <IconSignature size={26} />
          </div>
          <div className="user-sign-text">
            <div className="user-sign-title-row">
              <h2 id="user-sign-title" className="user-sign-title">Penandatanganan Dokumen</h2>
              <span className="badge-soon">Soon</span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
              Sematkan tanda tangan digital dan stempel visual pada berkas PDF Anda.
            </p>
          </div>
        </div>
        <div className="user-sign-action">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (onNavigate) onNavigate('/signing');
            }}
            aria-label="Mulai Penandatanganan Dokumen (Soon)"
          >
            Mulai Penandatanganan (Soon)
          </Button>
        </div>
      </div>
    </div>
  );
}
