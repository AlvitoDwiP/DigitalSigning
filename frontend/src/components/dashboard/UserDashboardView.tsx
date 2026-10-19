import type { DashboardUserData } from '../../types/dashboard';
import { StatusChip } from '../ui/StatusChip';
import { Button } from '../ui/Button';
import {
  IconCertificate,
  IconUser,
  IconSignature,
  IconRefresh,
  IconCalendar,
  IconShield,
  IconClock,
} from '../icons/Icons';
import { maskNik } from '../users/UsersTable';
import { formatWaktuIndonesia, statusSertifikat } from '../../lib/labels';

interface UserDashboardViewProps {
  data: DashboardUserData;
  onNavigate: (path: string) => void;
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
    <div className="dashboard-page user-dashboard-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Selamat datang, <strong className="user-welcome-name">{user.name}</strong>. Ringkasan sertifikat dan informasi akun Anda.
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            loading={isRefreshing}
            icon={<IconRefresh size={16} />}
            aria-label="Segarkan data dashboard"
          >
            Segarkan
          </Button>
        </div>
      </div>

      {/* Grid 2 Kolom untuk Sertifikat & Akun */}
      <div className="user-dashboard-grid">
        {/* Kartu 1: Sertifikat Saya */}
        <div className="card user-cert-card" aria-labelledby="user-cert-title">
          <div className="user-card-header">
            <div className="user-card-title-group">
              <div className="user-card-icon-badge cert-icon-badge">
                <IconCertificate size={22} />
              </div>
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
                <div className="cert-detail-item">
                  <span className="cert-detail-label">Nomor Seri</span>
                  <div className="cert-serial-number">
                    <code>{active_certificate.serial_number}</code>
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
                  <code>{maskNik(user.nik)}</code>
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

          <div className="user-card-footer">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('/account')}
            >
              Kelola Akun
            </Button>
          </div>
        </div>
      </div>

      {/* Kartu 3: Layanan Penandatanganan Dokumen */}
      <div className="card user-sign-placeholder-card" aria-labelledby="user-sign-title">
        <div className="user-sign-content">
          <div className="user-sign-icon-circle">
            <IconSignature size={28} />
          </div>
          <div className="user-sign-text">
            <div className="user-sign-title-row">
              <h2 id="user-sign-title" className="user-sign-title">Penandatanganan Dokumen</h2>
              <StatusChip status="ACTIVE" label="Aktif" />
            </div>
            <p className="user-sign-description">
              Layanan penandatanganan dokumen elektronik terverifikasi menggunakan sertifikat digital tersimpan akun Anda.
            </p>
          </div>
        </div>
        <div className="user-sign-action">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('/signing')}
            title="Buka halaman penandatanganan dokumen"
          >
            Mulai Penandatanganan
          </Button>
        </div>
      </div>
    </div>
  );
}
