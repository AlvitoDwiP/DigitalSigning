# PKI Subsystem & Runtime Area

Direktori ini berisi script engine PKI serta artefak sertifikat runtime.

## Struktur Direktori

- `scripts/` — Skrip bash engine PKI aktif:
  - `bangkitkan_single.sh`: Penerbitan sertifikat single user.
  - `bangkitkan_banyak.sh`: Penerbitan sertifikat bulk user via CSV.
  - `change_p12_passphrase-admin.sh`: Penggantian passphrase P12 oleh Admin.
  - `change_p12_passphrase-user.sh`: Penggantian passphrase P12 oleh User (verifikasi password lama).
- `intermediate/` — Direktori Intermediate Certificate Authority (CA) runtime OpenSSL.
- `root/` — Direktori Root Certificate Authority (CA) runtime OpenSSL.
- `issued/` — Direktori penyimpanan sertifikat dan kunci privat pengguna yang diterbitkan.

> **Catatan Keamanan**: Kunci privat (`.key`), bundle PFX/P12 (`.p12`/`.pfx`), dan file sertifikat individual diabaikan oleh Git via `.gitignore`.
