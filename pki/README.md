# PKI Subsystem & Runtime Area

Direktori ini berisi script engine PKI serta artefak sertifikat runtime OpenSSL yang digunakan oleh DigitalSigning Platform.

## Struktur Direktori

- `scripts/` — Skrip bash engine PKI aktif:
  - `issue_cert_single.sh`: Penerbitan sertifikat pengguna tunggal (kunci RSA 2048-bit, CSR, X.509 v3, dan bundle PKCS#12 berproteksi passphrase).
  - `issue_cert_bulk.sh`: Penerbitan sertifikat massal batch via CSV/TSV dengan isolasi kesalahan per baris.
  - `revoke_cert.sh`: Pencabutan sertifikat digital pengguna berdasarkan alasan standar RFC 5280 dan otomasi regenerasi berkas CRL.
  - `generate_crl.sh`: Kompilasi dan pembaruan berkas Certificate Revocation List (CRL) Intermediate CA format DER dan PEM.
  - `backup_root_ca_offline.sh`: Skrip pengemasan terenkripsi (AES-256-CBC) dan isolasi offline kunci Root CA ke cold storage.
  - `change_p12_passphrase_admin.sh`: Reset passphrase berkas .p12 pengguna oleh Administrator.
  - `change_p12_passphrase_user.sh`: Penggantian passphrase berkas .p12 mandiri oleh pengguna dengan verifikasi passphrase lama.
  - `change_p12_passphrase.sh`: Wrapper delegasi interaktif CLI menuju script admin.
- `intermediate/` — Direktori Intermediate Certificate Authority (CA) runtime OpenSSL:
  - `certs/`: Sertifikat Intermediate CA (`intermediate-ca.crt`) dan rantai sertifikat publik (`ca-chain.crt`).
  - `private/`: Kunci privat Intermediate CA (`intermediate-ca.key`, izin `077` / mode `0600`).
  - `crl/`: Berkas CRL aktif (`intermediate-ca.crl` format PEM dan `intermediate-ca.crl.der` format DER).
  - `newcerts/`: Arsip sertifikat X.509 terbitan berdasarkan nomor seri heksadesimal.
  - `index.txt`: Basis data teks pencatatan status sertifikat CA (`V` = Valid, `R` = Revoked, `E` = Expired).
- `root/` — Direktori Root Certificate Authority (CA) induk:
  - `certs/`: Sertifikat publik Root CA (`ca.crt`).
  - `private/`: Kunci privat Root CA (`root-ca.key`). Wajib diisolasi ke cold storage di lingkungan produksi sesuai SOP.
- `issued/` — Direktori penyimpanan sertifikat (`.crt`), CSR (`.csr`), dan metadata pengguna yang diterbitkan.
- `cold_storage_backups/` — Folder penyimpanan arsip terenkripsi kunci Root CA (diabaikan oleh Git via `.gitignore`).

## Prosedur Keamanan & SOP
- [ROOT_CA_OFFLINE_PROCEDURE.md](ROOT_CA_OFFLINE_PROCEDURE.md) — Panduan resmi pengamanan dan isolasi offline kunci Root CA (*air-gapped/cold storage*).

> **Catatan Keamanan**: Kunci privat (`.key`), bundle PFX/P12 (`.p12`/`.pfx`), arsip cadangan terenkripsi (`.enc`), dan berkas sertifikat individual pengguna diabaikan oleh Git via `.gitignore`.
