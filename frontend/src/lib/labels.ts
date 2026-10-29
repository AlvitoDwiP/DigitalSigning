export const statusAkun: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Tidak aktif',
};

export const statusSertifikat: Record<string, string> = {
  ACTIVE: 'Aktif',
  EXPIRED: 'Kedaluwarsa',
  REPLACED: 'Diganti',
  DELETED: 'Dihapus',
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

export interface ParsedSubject {
  cn?: string;
  o?: string;
  ou?: string;
  email?: string;
  c?: string;
  raw?: string;
}

// Subjek sertifikat: parse detail field (CN, O, OU, emailAddress)
export function parseSubjectDetails(subject: string | null | undefined): ParsedSubject {
  if (!subject) return {};
  const res: ParsedSubject = { raw: subject };
  
  const regex = /(?:^|[/,]\s*)([A-Za-z0-9_]+)=([^/,]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(subject)) !== null) {
    const key = match[1].trim().toUpperCase();
    const val = match[2].trim();
    if (key === 'CN') res.cn = val;
    else if (key === 'O') res.o = val;
    else if (key === 'OU') res.ou = val;
    else if (key === 'EMAILADDRESS' || key === 'EMAIL' || key === 'E') res.email = val;
    else if (key === 'C') res.c = val;
  }
  return res;
}

// Subjek sertifikat (Subject DN): tampilkan hanya nilai CN tanpa "CN="
export function parseCommonName(subject: string | null | undefined): string {
  if (!subject) return '-';
  const details = parseSubjectDetails(subject);
  if (details.cn) return details.cn;
  const match = subject.match(/(?:^|[,/]\s*)CN=([^,/]+)/i);
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

export const deskripsiAktivitasMap: Record<string, string> = {
  CERTIFICATE_GENERATED: 'Sertifikat berstatus aktif.',
  CERTIFICATE_REGENERATED: 'Kunci dan sertifikat baru diterbitkan ulang.',
  CERTIFICATE_DELETED: 'Sertifikat digital dihapus dari sistem.',
  USER_CREATED: 'Pengguna baru berhasil dibuat.',
  USER_DELETED: 'Akun pengguna dihapus dari sistem.',
  PFX_UPDATED: 'Passphrase berkas PFX diperbarui.',
  PFX_PASSWORD_CHANGED: 'Passphrase berkas PFX diperbarui.',
  ADMIN_ASSIGNED: 'Peran pengguna ditingkatkan menjadi admin.',
  ADMIN_REMOVED: 'Hak akses admin pengguna dicabut.',
  LOGIN: 'Sesi masuk ke platform diverifikasi.',
  LOGOUT: 'Sesi akun berhasil diakhiri.',
};

export function deskripsiAktivitas(kode: string, status?: string): string {
  if (status === 'FAILED') {
    return 'Aktivitas gagal diproses oleh sistem.';
  }
  return deskripsiAktivitasMap[kode] || 'Aktivitas tercatat dalam sistem.';
}

export function formatPelaku(name?: string | null, role?: string | null): string {
  const roleLabel = role ? (peran[role] || role) : null;
  if (!name && !roleLabel) return 'Admin Platform';
  if (name && roleLabel) {
    if (name.toLowerCase() === roleLabel.toLowerCase()) return name;
    return `${name} (${roleLabel})`;
  }
  return name || roleLabel || 'Admin Platform';
}
