# PANDUAN DEPLOYMENT SERVER ON-PREMISES (SERVER LOKAL MK / INTRANET)
**Sistem DigitalSigning — Mahkamah Konstitusi Republik Indonesia**

Panduan ini ditujukan untuk deployment pada **Server Lokal / Server On-Premises Mahkamah Konstitusi (Intranet/LAN MK)**, bukan di komputer pribadi pengembang dan bukan di domain publik internet terbuka. 

Seluruh sistem berjalan secara mandiri di dalam server MK, sehingga pegawai di jaringan internal kantor MK dapat mengakses aplikasi langsung menggunakan browser.

---

## 1. Arsitektur Akses Jaringan Lokal (LAN MK)

```text
[ Komputer Pegawai / Pejabat di Kantor MK ]
   │
   │ Buka Browser ke: http://<IP_SERVER_MK>:3000  atau  http://<IP_SERVER_MK>
   ▼
+------------------------------------------------------------------------------------+
|                             SERVER ON-PREMISES MK                                  |
|                                                                                    |
|  [ Frontend / Nginx Container ] (Port 3000 / 80)                                   |
|   - Menyajikan tampilan web React SPA ke browser pegawai                           |
|   - Otomatis mem-proxy panggilan /api/ ke Backend internal                         |
|        │                                                                           |
|        ▼                                                                           |
|  [ Backend API Container ] (Port 8000)                                             |
|   - Memproses penandatanganan PDF PAdES (Visible & Invisible)                      |
|   - Mengorkestrasi PKI OpenSSL                                                     |
|        │                                        │                                  |
|        ▼ (Jaringan Internal Docker)             ▼ (Jaringan Internal Docker)       |
|  [ PKI Service Container ] (Port 8001)   [ PostgreSQL 16 ] (Port 5432)             |
|   - Akses Kunci CA & Penerbitan .p12      - Database (Named Volume: postgres_data) |
+------------------------------------------------------------------------------------+
```

---

## 2. Persiapan Sebelum Menjalankan Server

### A. Periksa IP Address Server Lokal MK
Di terminal server MK, jalankan perintah:
```bash
hostname -I | awk '{print $1}'
# atau:
ip a
```
*Contoh output:* `192.168.10.50` (Catat IP ini sebagai alamat akses bagi seluruh pegawai).

### B. Siapkan Berkas Konfigurasi Produksi (`.env.production`)
Jika belum ada, bangkitkan kunci rahasia berkekuatan tinggi otomatis:
```bash
python3 scripts/generate_production_secrets.py
```
*Catatan:* Skrip ini otomatis menghasilkan kunci kriptografi acak berkeamanan tinggi (>32 karakter) dan mengatur perizinan berkas ke mode aman (`0600`).

---

## 3. Menjalankan Sistem di Server MK

Cukup jalankan satu perintah Docker Compose di terminal server MK:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Docker akan secara otomatis:
1. Membangun image frontend produksi (Nginx) dan backend (FastAPI).
2. Menjalankan migrasi database PostgreSQL (`alembic upgrade head`).
3. Mengaktifkan 4 worker backend Uvicorn tanpa flag dev `--reload`.
4. Mengamankan port internal database (`5432`) dan PKI (`8001`) agar hanya bisa diakses di dalam kontainer.
5. Membuka port `3000` dan `80` untuk akses antarmuka web, serta port `8000` untuk API.

---

## 4. Memverifikasi Status Kontainer
Periksa kesehatan seluruh kontainer:
```bash
docker compose -f docker-compose.prod.yml ps
```
Semua kontainer harus berada dalam status **`Up (healthy)`**:
- `digital_signature_db` (PostgreSQL)
- `digital_signature_pki` (PKI OpenSSL Engine)
- `digital_signature_backend` (FastAPI)
- `digital_signature_frontend` (Nginx + React SPA)

Uji kesehatan via terminal server:
```bash
curl http://localhost:8000/health
# Respons: {"status":"ok","database":"connected","pki_service":"connected"}
```

---

## 5. Cara Pegawai & Aplikasi Lain Mengakses DigitalSigning

### A. Akses Antarmuka Web oleh Pegawai Kantor MK
Pegawai di jaringan LAN/Wi-Fi MK cukup membuka browser (Chrome / Edge / Firefox) dan mengetikkan:
```text
http://<IP_SERVER_MK>:3000
# atau
http://<IP_SERVER_MK>
```
*(Contoh: `http://192.168.10.50:3000`)*.  
Pegawai dapat langsung login, melihat sertifikatnya, dan menandatangani dokumen PDF.

### B. Integrasi Aplikasi Eksternal MK (e-Court / Persuratan / SIMPEG)
Aplikasi internal lain di server MK dapat memanggil API penandatanganan secara langsung:
- **Base URL:** `http://<IP_SERVER_MK>:8000/api/v1`
- **Header:** `X-API-Key: <nilai_API_KEY_di_env_production>`
- **Endpoint TTE Visible:** `POST /api/v1/signatures/visible`
- **Endpoint TTE Invisible:** `POST /api/v1/signatures/invisible`

---

## 6. Perintah Pemeliharaan Harian di Server MK

### Memantau Log Berjalan
```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Backup Database Rutin
Jadwalkan di cron server MK (misal tiap tengah malam):
```bash
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres digital_signature_db > /backup/digital_signature_$(date +%Y%m%d).sql
```

### Mengamankan Kunci Root CA ke Flashdisk/Cold Storage
Kunci privat Root CA (`pki/root/private/root-ca.key`) tidak dibutuhkan dalam penandatanganan sehari-hari (hanya Intermediate CA yang dipakai). Amankan kunci Root CA ke flashdisk terpisah:
```bash
./pki/scripts/backup_root_ca_offline.sh --isolate
```

### Menghentikan / Merestart Layanan
```bash
# Restart sistem:
docker compose -f docker-compose.prod.yml restart

# Matikan sistem (data database & sertifikat tetap aman):
docker compose -f docker-compose.prod.yml down
```
