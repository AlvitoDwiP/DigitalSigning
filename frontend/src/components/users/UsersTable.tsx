import { useState } from 'react';
import type { UserItem } from '../../types/users';
import { StatusChip } from '../ui/StatusChip';
import { IconEye, IconEyeOff } from '../icons/Icons';
import { statusAkun, statusSertifikat } from '../../lib/labels';

interface UsersTableProps {
  users: UserItem[];
  onDetail: (userId: string) => void;
  onDelete: (user: UserItem) => void;
}

export function maskNik(nik: string): string {
  if (!nik) return '-';
  const clean = nik.trim();
  if (clean.length >= 8) {
    const start = clean.slice(0, 4);
    const end = clean.slice(-4);
    return `${start}********${end}`;
  }
  return clean.replace(/./g, '*');
}

export function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return 'Belum ada';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Belum ada';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Belum ada';
  }
}

export function UsersTable({ users, onDetail, onDelete }: UsersTableProps) {
  const [showAllNik, setShowAllNik] = useState(false);

  return (
    <div className="users-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Daftar Pengguna">
      <table className="users-table">
        <thead>
          <tr>
            <th scope="col" className="col-user">Pengguna</th>
            <th scope="col" className="col-nik">
              <div className="th-nik-wrapper">
                <span>NIK</span>
                <button
                  type="button"
                  className="btn-nik-toggle"
                  onClick={() => setShowAllNik((prev) => !prev)}
                  title={showAllNik ? 'Sembunyikan semua NIK' : 'Perlihatkan semua NIK'}
                  aria-label={showAllNik ? 'Sembunyikan semua NIK' : 'Perlihatkan semua NIK'}
                >
                  {showAllNik ? <IconEyeOff size={13} aria-hidden="true" /> : <IconEye size={13} aria-hidden="true" />}
                </button>
              </div>
            </th>
            <th scope="col" className="col-email">Email</th>
            <th scope="col" className="col-user-status">Status akun</th>
            <th scope="col" className="col-cert-status">Sertifikat</th>
            <th scope="col" className="col-expiry">Berlaku sampai</th>
            <th scope="col" className="col-actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const initial = user.name ? user.name.trim().charAt(0).toUpperCase() : 'U';
            const activeCert = user.active_certificate;

            return (
              <tr key={user.id} className="users-table-row">
                {/* Pengguna: Avatar + Name */}
                <td className="col-user">
                  <div className="user-name-cell">
                    <div className="user-avatar-badge" aria-hidden="true">
                      <span>{initial}</span>
                    </div>
                    <div className="user-name-details">
                      <span className="user-full-name">{user.name}</span>
                      {user.organization && (
                        <span className="user-org-subtext">
                          {user.organization}{user.ou ? ` / ${user.ou}` : ''}
                        </span>
                      )}
                      <div className="user-mobile-subinfo" aria-label={`Email dan NIK ${user.name}`}>
                        <span className="user-mobile-email">{user.email}</span>
                        <span className="user-mobile-nik font-mono">
                          {showAllNik ? (user.nik || '-') : maskNik(user.nik)}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* NIK: Masked Monospace */}
                <td className="col-nik">
                  <span className="masked-nik-text font-mono">
                    {showAllNik ? (user.nik || '-') : maskNik(user.nik)}
                  </span>
                </td>

                {/* Email */}
                <td className="col-email">
                  <span className="user-email-text">{user.email}</span>
                </td>

                {/* Status Akun */}
                <td className="col-user-status">
                  <StatusChip
                    status={user.status}
                    label={statusAkun[user.status] || user.status}
                  />
                </td>

                {/* Status Sertifikat */}
                <td className="col-cert-status">
                  {activeCert ? (
                    <StatusChip
                      status={activeCert.status}
                      label={statusSertifikat[activeCert.status] || activeCert.status}
                    />
                  ) : (
                    <span className="cert-status-none">Belum ada</span>
                  )}
                </td>

                {/* Masa Berlaku */}
                <td className="col-expiry">
                  <span className="cert-expiry-text">
                    {activeCert ? formatDate(activeCert.expires_at) : 'Belum ada'}
                  </span>
                </td>

                {/* Aksi: Detail & Hapus */}
                <td className="col-actions">
                  <div className="table-actions-group">
                    <button
                      type="button"
                      className="btn-table-action btn-table-detail"
                      onClick={() => onDetail(user.id)}
                      aria-label={`Lihat detail pengguna ${user.name}`}
                    >
                      Detail
                    </button>
                    <button
                      type="button"
                      className="btn-table-action btn-table-delete"
                      onClick={() => onDelete(user)}
                      aria-label={`Hapus pengguna ${user.name}`}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
