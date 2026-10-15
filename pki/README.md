# PKI Subsystem & Runtime Area

Direktori ini berisi script engine PKI serta artefak sertifikat runtime.

## Struktur Direktori

- `scripts/` — Skrip bash engine PKI aktif:
  - `issue_cert_single.sh`: Penerbitan sertifikat single user (alias lama: `bangkitkan_single.sh`).
  - `issue_cert_bulk.sh`: Penerbitan sertifikat bulk user via CSV/TSV (alias lama: `bangkitkan_banyak.sh`).
  - `change_p12_passphrase_admin.sh`: Penggantian passphrase P12 oleh Admin (alias lama: `change_p12_passphrase-admin.sh`).
  - `change_p12_passphrase_user.sh`: Penggantian passphrase P12 oleh User (alias lama: `change_p12_passphrase-user.sh`).
  - `change_p12_passphrase.sh`: Wrapper delegasi interaktif CLI menuju script admin.
- `intermediate/` — Direktori Intermediate Certificate Authority (CA) runtime OpenSSL.
- `root/` — Direktori Root Certificate Authority (CA) runtime OpenSSL.
- `issued/` — Direktori penyimpanan sertifikat dan kunci privat pengguna yang diterbitkan.

> **Catatan Keamanan**: Kunci privat (`.key`), bundle PFX/P12 (`.p12`/`.pfx`), dan file sertifikat individual diabaikan oleh Git via `.gitignore`.
