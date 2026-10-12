export const statusAkun: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Tidak aktif',
};

export const statusSertifikat: Record<string, string> = {
  ACTIVE: 'Aktif',
  EXPIRED: 'Kedaluwarsa',
  REPLACED: 'Diganti',
  REVOKED: 'Dicabut',
};

export const peran: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  USER: 'Pengguna',
};

export const hasilAktivitas: Record<string, string> = {
  SUCCESS: 'Berhasil',
  FAILED: 'Gagal',
};

export const aktivitas: Record<string, string> = {
  USER_CREATED: 'Pengguna dibuat',
  USER_DELETED: 'Pengguna dihapus',
  CERTIFICATE_GENERATED: 'Sertifikat diterbitkan',
  CERTIFICATE_REGENERATED: 'Sertifikat diterbitkan ulang',
  CERTIFICATE_DELETED: 'Sertifikat dihapus',
  PFX_UPDATED: 'Passphrase diubah',
  PFX_PASSWORD_CHANGED: 'Passphrase diubah',
  ADMIN_ASSIGNED: 'Admin ditetapkan',
  ADMIN_REMOVED: 'Admin dicabut',
  LOGIN: 'Masuk',
  LOGOUT: 'Keluar',
};

export const jenisTarget: Record<string, string> = {
  user: 'Pengguna',
  certificate: 'Sertifikat',
  admin: 'Admin',
};

// Fungsi bantu: kode yang belum dipetakan JANGAN ditampilkan mentah.
export function labelAktivitas(kode: string): string {
  if (!kode) return '-';
  if (aktivitas[kode]) return aktivitas[kode];
  // fallback: "SOME_ACTION_DONE" -> "Some action done"
  const teks = kode.toLowerCase().replace(/_/g, ' ');
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

// Subjek sertifikat (Subject DN): tampilkan hanya nilai CN tanpa "CN="
export function parseCommonName(subject: string | null | undefined): string {
  if (!subject) return '-';
  const match = subject.match(/(?:^|,\s*)CN=([^,]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return subject.replace(/^CN=/i, '').trim() || '-';
}

// Waktu: format Indonesia tanpa detik, contoh "12 Okt 2026, 09.31"
export function formatWaktuIndonesia(isoStr: string | null | undefined): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const datePart = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${datePart}, ${hours}.${minutes}`;
  } catch {
    return '-';
  }
}
