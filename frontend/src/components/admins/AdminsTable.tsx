import type { AdminItem } from '../../types/admins';
import { StatusChip } from '../ui/StatusChip';
import { maskNik, formatDate } from '../users/UsersTable';
import { peran, statusAkun } from '../../lib/labels';

interface AdminsTableProps {
  admins: AdminItem[];
  onRemoveAdmin: (admin: AdminItem) => void;
  disabled?: boolean;
}

export function AdminsTable({ admins, onRemoveAdmin, disabled = false }: AdminsTableProps) {
  return (
    <div className="users-table-responsive-wrapper" tabIndex={0} aria-label="Tabel Daftar Administrator">
      <table className="users-table admins-table">
        <thead>
          <tr>
            <th scope="col" className="col-user">Administrator</th>
            <th scope="col" className="col-nik">NIK</th>
            <th scope="col" className="col-email">Email</th>
            <th scope="col" className="col-role">Peran</th>
            <th scope="col" className="col-user-status">Status akun</th>
            <th scope="col" className="col-date">Bergabung</th>
            <th scope="col" className="col-actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => {
            const initial = admin.name ? admin.name.trim().charAt(0).toUpperCase() : 'A';

            return (
              <tr key={admin.id} className="users-table-row">
                {/* Administrator Name + Org */}
                <td className="col-user">
                  <div className="user-name-cell">
                    <div className="user-avatar-badge" aria-hidden="true">
                      <span>{initial}</span>
                    </div>
                    <div className="user-name-details">
                      <span className="user-full-name">{admin.name}</span>
                      {admin.organization && (
                        <span className="user-org-subtext">
                          {admin.organization}{admin.ou ? ` / ${admin.ou}` : ''}
                        </span>
                      )}
                      <div className="user-mobile-subinfo" aria-label={`Email dan NIK ${admin.name}`}>
                        <span className="user-mobile-email">{admin.email}</span>
                        <span className="user-mobile-nik font-mono">{maskNik(admin.nik)}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Masked NIK */}
                <td className="col-nik font-mono">
                  {maskNik(admin.nik)}
                </td>

                {/* Email */}
                <td className="col-email">
                  {admin.email}
                </td>

                {/* Role Chip */}
                <td className="col-role">
                  <StatusChip
                    status={admin.role}
                    label={peran[admin.role] || admin.role}
                  />
                </td>

                {/* Status Chip */}
                <td className="col-user-status">
                  <StatusChip
                    status={admin.status}
                    label={statusAkun[admin.status] || admin.status}
                  />
                </td>

                {/* Created Date */}
                <td className="col-date">
                  {formatDate(admin.created_at)}
                </td>

                {/* Actions */}
                <td className="col-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-danger-text"
                    onClick={() => onRemoveAdmin(admin)}
                    disabled={disabled}
                    aria-label={`Hapus status Admin untuk ${admin.name}`}
                  >
                    Hapus Admin
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
