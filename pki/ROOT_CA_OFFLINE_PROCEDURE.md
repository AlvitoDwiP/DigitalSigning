# STANDAR OPERASIONAL PROSEDUR (SOP) PENGAMANAN OFFLINE ROOT CA
**Mahkamah Konstitusi Republik Indonesia — DigitalSigning Platform**

---

## 1. Prinsip Keamanan Root CA (Two-Tier CA Hierarchy)
Dalam arsitektur kriptografi Public Key Infrastructure (PKI) standar industri (**RFC 5280 / ISO 27001**):
1. **Root CA (`pki/root/`)** adalah Otoritas Induk (*Trust Anchor*) tertinggi dengan masa berlaku 20 tahun.
2. **Intermediate CA (`pki/intermediate/`)** adalah CA operasional yang aktif menerbitkan sertifikat penandatangan pengguna harian dan menerbitkan Certificate Revocation List (CRL).

> ⚠️ **ATURAN MUTLAK KEAMANAN:**  
> Selama operasional rutin berlangsung, server online **HANYA** membutuhkan:
> - Kunci privat Intermediate CA: `pki/intermediate/private/intermediate-ca.key`
> - Sertifikat publik rantai CA: `pki/intermediate/certs/ca-chain.crt`
> - Sertifikat publik Root CA: `pki/root/certs/ca.crt` (Hanya sertifikat publik, bukan private key!).
> 
> **Kunci privat Root CA (`pki/root/private/root-ca.key`) TIDAK BOLEH berada di server web yang tersambung ke jaringan publik.**

---

## 2. Prosedur Pencadangan ke Media Cold Storage

### Langkah 1: Eksekusi Skrip Pencadangan Terenkripsi
Jalankan skrip pencadangan pada server:
```bash
./pki/scripts/backup_root_ca_offline.sh
```
Skrip akan mengemas direktori Root CA dan mengenkripsinya dengan algoritma **AES-256-CBC (PBKDF2)**. Masukkan *passphrase* enkripsi berkekuatan tinggi saat diminta.

### Langkah 2: Salin Berkas Cadangan ke Media Fisik Offline
Pindahkan berkas hasil pencadangan:
- Berkas arsip terenkripsi: `pki/cold_storage_backups/root_ca_backup_<TIMESTAMP>.tar.enc`
- Berkas sidik jari: `pki/cold_storage_backups/root_ca_backup_<TIMESTAMP>.sha256`

Salin kedua berkas tersebut ke media fisik eksternal (*Flashdisk terenkripsi Hardware BitLocker/LUKS* atau brankas *Hardware Security Module / HSM*).

### Langkah 3: Isolasi Kunci Privat dari Server Online
Setelah berkas cadangan offline aman, amankan kunci privat Root CA dari direktori aktif dengan menjalankan:
```bash
./pki/scripts/backup_root_ca_offline.sh --isolate
```
Atau secara manual:
```bash
# Pindahkan kunci privat ke lokasi cold storage terisolasi
mv pki/root/private/root-ca.key pki/cold_storage_backups/root-ca.key.offline
chmod 000 pki/cold_storage_backups/root-ca.key.offline
```

---

## 3. Prosedur Restorasi (Hanya Jika Memperbarui Intermediate CA)
Kunci privat Root CA hanya perlu dikembalikan ke `pki/root/private/root-ca.key` ketika masa aktif Intermediate CA habis (setelah 10 tahun) atau saat menerbitkan Intermediate CA baru:

1. Ambil berkas `root_ca_backup_<TIMESTAMP>.tar.enc` dari cold storage.
2. Dekripsi arsip:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in root_ca_backup_<TIMESTAMP>.tar.enc -out root_ca_restore.tar
   ```
3. Ekstrak kunci privat kembali ke direktori `pki/root/private/`:
   ```bash
   tar -xf root_ca_restore.tar
   chmod 600 pki/root/private/root-ca.key
   rm -f root_ca_restore.tar
   ```
4. Setelah penerbitan Intermediate CA selesai, ulangi kembali Langkah 3 untuk mengisolasi kembali kunci Root CA.

