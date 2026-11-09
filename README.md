# Digital Signature Platform (DigitalSigning)

Aplikasi enterprise-grade terpadu untuk pengelolaan identitas pengguna, provisioning sertifikat digital X.509 berbasis Public Key Infrastructure (PKI) OpenSSL, serta penandatanganan dokumen elektronik (TTE) PAdES berstandar ISO 32000-1 di lingkungan **Mahkamah Konstitusi Republik Indonesia**.

Aplikasi terdiri dari antarmuka web modern berbasis **React 18 + TypeScript + Vite** dan backend RESTful berperforma tinggi berbasis **FastAPI (Python 3.9)** yang terintegrasi dengan database relasional **PostgreSQL 16**.

---

## 1. Status Implementasi & Fitur Utama

Sistem telah **100% Selesai & Terverifikasi (Production Ready)** mencakup seluruh fitur inti:

- **Autentikasi & Sesi:** Login JWT Bearer Token, proteksi sesi di localStorage, dan pop-up pengingat ganti kata sandi awal (*first-login password reminder*).
- **Role-Based Access Control (RBAC):** Penegakan hak akses ketat di tingkat backend untuk 3 peran: `SUPER_ADMIN`, `ADMIN`, dan `USER`.
- **Dual-View Mode Switcher:** Memungkinkan akun dengan peran `ADMIN` beralih antarmuka antara Mode Administrasi (tata kelola) dan Mode Pengguna (TTE personal) secara instan tanpa perlu logout.
- **Manajemen Pengguna:** Pencarian, pemfilteran berdasarkan status akun/sertifikat, pagination, dan halaman detail riwayat pengguna.
- **Penerbitan Sertifikat Tunggal (*Single Generate*):** Pembuatan akun dan penerbitan sertifikat digital instan dengan validasi keunikan NIK 16 digit dan email resmi.
- **Penerbitan Sertifikat Massal (*Bulk CSV Generate*):** Onboarding pegawai dalam jumlah besar melalui berkas CSV 7 kolom (`name,nik,email,organization,ou,password,pfx_pass`) dengan validasi client-side, tabel preview aman, dan isolasi kegagalan per baris (*row-level isolation*).
- **Penandatanganan Dokumen PDF (TTE PAdES):**
  - **TTE Terlihat (*Visible*):** Pembubuhan tanda tangan PAdES dengan stempel visual/paraf/QR code pada halaman dan koordinat tertentu, dilengkapi komponen interaktif *Interactive Signature Box* (drag and resize) di atas pratinjau PDF.
  - **TTE Tak Terlihat (*Invisible*):** Penandatanganan kriptografis murni tanpa mengubah visual halaman dokumen dengan kepatuhan kamus `/Sig` pada array `/Annots`.
- **Kendali Konkurensi (*Concurrency Limiter*):** Pengunci *thread-safe* yang membatasi maksimal 10 proses tanda tangan paralel simultan untuk mencegah kehabisan memori RAM (*Out-of-Memory*) dan lonjakan CPU.
- **Pencabutan (*Revocation*) & Otomasi CRL:** Pencabutan sertifikat digital oleh Administrator dengan verifikasi kata sandi admin dan alasan standar RFC 5280, disertai regenerasi otomatis berkas *Certificate Revocation List* (CRL).
- **Distribusi Publik CRL & Read-Only Cert API:**
  - `GET /api/v1/certificates/crl` (Format biner DER) dan `/crl.pem` (Format teks PEM) untuk validator PDF eksternal.
  - `GET /api/v1/certificates` dan `GET /api/v1/certificates/{id}` untuk pemeriksaan status dan keabsahan sertifikat publik terotentikasi.
- **Audit Logging Melingkar (*Circular Pruning*):** Pencatatan riwayat seluruh aktivitas operasional penting dengan pembatasan kapasitas maksimal 5.000 baris berbasis *First-In-First-Out* (FIFO) tanpa pernah membocorkan data rahasia (*zero secret logging*).
- **REST API Machine-to-Machine (M2M):** Dukungan pemanggilan API penandatanganan dari aplikasi eksternal (e-Court, SIMPEG, atau skrip otomasi) menggunakan header `X-API-Key`.

---

## 2. Arsitektur Sistem

Arsitektur aplikasi menggunakan pemisahan kontainer Docker berdasarkan pemisahan tanggung jawab (*separation of concerns*):

1. **Dashboard / Platform API (`digital_signature_backend`, port 8000)** — Menangani penyajian frontend statis, REST API publik, autentikasi JWT, otorisasi RBAC, manajemen pengguna, metadata sertifikat, audit log, dan penandatanganan PDF via TTE signer in-process.
2. **PKI Service (`digital_signature_pki`, port 8001 internal)** — Mengisolasi beban kerja kriptografi OpenSSL, pembuatan RSA key, CSR, penandatanganan sertifikat, packaging P12, staging regenerasi, dan pembersihan material sertifikat. Terhubung hanya melalui jaringan internal dengan token rahasia antarlayanan (`X-Internal-Token`).
3. **PostgreSQL Database (`digital_signature_db`, port 5432 internal)** — Menyimpan data terstruktur identitas pengguna, status dan metadata sertifikat, serta catatan audit log. Menggunakan named volume `postgres_data` untuk persistensi data.
4. **Frontend & Reverse Proxy (`digital_signature_frontend`, port 3000 / 80 / 443)** — Nginx web server produksi yang menyajikan React SPA dan mem-proxy panggilan API ke backend.

```text
[ Browser Pengguna / Klien Eksternal ]
                  │
                  │ Port 3000 / Port 80 (HTTP) atau Port 443 (HTTPS)
                  ▼
+------------------------------------------------------------------------------------+
| CONTAINER: digital_signature_frontend (Nginx Reverse Proxy & React SPA)            |
| - Melayani antarmuka web responsif (Mode Light & Dark)                             |
| - Reverse proxy /api/ ke backend:8000 (Meniadakan isu CORS pada LAN)               |
+------------------------------------------------------------------------------------+
                  │
                  │ HTTP / Internal Docker Network (platform_network:8000)
                  ▼
+------------------------------------------------------------------------------------+
| CONTAINER: digital_signature_backend (Platform API & Web Host)                     |
| - FastAPI Web Server & REST API Provider (Port 8000)                               |
| - Autentikasi JWT & API Key, RBAC, Validasi Input, Audit Log, Dokumen TTE          |
| - Concurrency Limiter (Maks. 10 proses simultan) & Worker Threadpool (Timeout 60s) |
| - Volume Mount:                                                                    |
|   - ./sign-api/p12 -> /app/sign-api/p12:ro (Arsip P12 Read-Only untuk TTE)         |
|   - ./pki/issued   -> /app/pki/issued:ro   (Sertifikat Pengguna Read-Only)         |
+------------------------------------------------------------------------------------+
              │                                            │
              │ Docker Network (platform_network:8001)     │ Docker Network (platform_network:5432)
              │ Internal Only (Tanpa Port Publik)          │ Internal Only (Port 5432 Terisolasi)
              ▼                                            ▼
+-------------------------------------------+  +-------------------------------------+
| CONTAINER: digital_signature_pki          |  | CONTAINER: digital_signature_db     |
| (PKI Service / Certificate Issuer)        |  | (PostgreSQL 16 Alpine Relasional)   |
| - FastAPI Daemon Kriptografi (Port 8001)  |  | - Named Volume: postgres_data       |
| - Endpoint Terproteksi X-Internal-Token   |  | - Skema Tabel:                      |
| - Engine: pki_engine.py & OpenSSL CLI     |  |   * users (Akun & Password Hash)    |
| - Volume Mount:                           |  |   * certificates (Metadata & Status)|
|   - ./pki -> /app/pki (CA keys & issued)  |  |   * audit_logs (Riwayat Operasional)|
|   - ./sign-api -> /app/sign-api (Archive) |  +-------------------------------------+
+-------------------------------------------+
```

---

## 3. Matriks Peran & Hak Akses (RBAC)

| Fitur / Modul Operasional | Super Admin | Admin (Mode Admin) | Admin (Mode Pengguna) | User Pegawai |
|---|:---:|:---:|:---:|:---:|
| **Dashboard Operasional Sistem** | ✓ | ✓ | - | - |
| **Dashboard Personal TTE** | - | - | ✓ | ✓ |
| **Penandatanganan Dokumen (TTE)** | Dilarang (403) | - | ✓ | ✓ |
| **Daftar & Detail Pengguna** | ✓ | ✓ | - | - |
| **Penerbitan Single & Bulk CSV** | ✓ | ✓ | - | - |
| **Cabut Sertifikat (*Revoke*)** | ✓ | ✓ | - | - |
| **Regenerasi Sertifikat** | ✓ | ✓ | - | - |
| **Reset Passphrase Pengguna** | ✓ | ✓ | - | - |
| **Manajemen Administrator** | ✓ | - | - | - |
| **Pemeriksaan Audit Log** | ✓ | ✓ | - | - |
| **Ganti Password Akun Mandiri** | - | ✓ | ✓ | ✓ |
| **Ubah Passphrase P12 Mandiri** | - | - | ✓ | ✓ |

> **Prinsip Separation of Duties:** Role `SUPER_ADMIN` dibatasi khusus untuk tata kelola wewenang administrator dan secara ketat **dilarang menandatangani dokumen (HTTP 403 Forbidden)**. Pejabat penandatangan diberikan akun dengan peran `ADMIN` (menggunakan tombol *Dual-View Switcher* untuk beralih ke Mode Pengguna saat menandatangani) atau peran `USER`.

---

## 4. Struktur Direktori Proyek

```text
digital-signature-platform/
├── backend/                  # REST API Backend (FastAPI, Python 3.9)
│   ├── alembic/              # Skrip migrasi skema database PostgreSQL
│   ├── app/
│   │   ├── api/endpoints/    # Controller API (auth, users, certs, signatures, audit)
│   │   ├── core/             # Konfigurasi aplikasi & enkripsi security.py
│   │   ├── models/           # SQLAlchemy models (User, Certificate, AuditLog)
│   │   ├── schemas/          # Validasi skema Pydantic v2
│   │   └── services/         # Business logic (pki_engine, pdf_signer, audit)
│   └── tests/                # Test suite backend (pytest)
├── frontend/                 # Single Page Application (React 18, TypeScript, Vite)
│   ├── src/
│   │   ├── components/       # UI Widgets (signing, generate, layout, admin, audit)
│   │   ├── pages/            # Halaman aplikasi (Dashboard, Users, Signing, Account)
│   │   └── services/         # API HTTP Client (Fetch/Axios)
│   └── dist/                 # Hasil build statis siap saji
├── pki-service/              # Daemon mikroservis eksekusi kriptografi OpenSSL
│   ├── app/                  # Controller & business logic PKI Service
│   └── tests/                # Test suite PKI Service
├── pki/                      # Runtime & arsip Public Key Infrastructure
│   ├── root/                 # Root CA (Kunci induk offline & sertifikat publik)
│   ├── intermediate/         # Intermediate CA (Kunci operasional, certs, serial, index.txt)
│   ├── issued/               # Berkas sertifikat pengguna aktif (.crt, .csr)
│   ├── scripts/              # Skrip otomasi Bash OpenSSL (issue, revoke, crl, passphrase)
│   └── ROOT_CA_OFFLINE_PROCEDURE.md # SOP pengamanan offline kunci Root CA
├── sign-api/
│   └── p12/                  # Arsip kanonis berkas PKCS#12 (.p12) pengguna berizin 077
├── docker/                   # Berkas konfigurasi Docker & Nginx
│   ├── Dockerfile.backend    # Container backend Python
│   ├── Dockerfile.frontend   # Container frontend Nginx dev
│   ├── Dockerfile.frontend.prod # Container frontend Nginx produksi (HTTP/HTTPS)
│   ├── Dockerfile.pki        # Container daemon PKI OpenSSL
│   ├── nginx.conf            # Nginx dev proxy
│   └── nginx-prod.conf       # Nginx produksi (LAN MK & reverse proxy)
├── scripts/                  # Skrip pembantu manajemen produksi
│   └── generate_production_secrets.py # Generator kunci rahasia produksi otomatis
├── docker-compose.yml        # Orkestrasi Docker Compose lingkungan Development
├── docker-compose.prod.yml   # Orkestrasi Docker Compose Server On-Premises MK
├── PRODUCTION_DEPLOYMENT_GUIDE.md # Panduan resmi deployment server lokal MK
└── README.md                 # Dokumentasi ini
```

---

## 5. Menjalankan Proyek

Sistem mendukung dua mode operasional:

### Mode A: Deployment Server On-Premises (Server Lokal / Intranet MK)
Gunakan mode ini untuk penerapan resmi di server lokal Mahkamah Konstitusi agar dapat diakses oleh seluruh pegawai di jaringan LAN/Wi-Fi kantor:

1. **Siapkan Kunci Rahasia Produksi Otomatis:**
   ```bash
   python3 scripts/generate_production_secrets.py
   ```
   *(Menghasilkan berkas `.env.production` dengan izin ketat `0600` dan kunci acak berkeamanan tinggi).*
2. **Jalankan Docker Compose Produksi:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
3. **Akses Aplikasi dari Seluruh Komputer Pegawai:**
   Buka browser ke alamat IP server lokal MK:
   👉 **`http://<IP_SERVER_MK>:3000`** atau **`http://<IP_SERVER_MK>`**
4. **Panduan Lengkap:** Rujuk ke berkas [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md).

---

### Mode B: Pengembangan Lokal (*Local Development*)
Gunakan mode ini untuk pengembangan fitur di komputer pribadi pengembang:

1. **Siapkan Berkas Lingkungan Development:**
   ```bash
   cp .env.example .env
   ```
2. **Jalankan Kontainer Backend, PKI, dan Database:**
   ```bash
   docker compose up -d --build
   ```
3. **Jalankan Frontend (React + Vite):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Aplikasi dapat diakses di browser melalui: **`http://localhost:3000`**.

---

## 6. Verifikasi & Pengujian Sistem

Seluruh komponen telah melalui pengujian kepatuhan ketat:

1. **Pengujian Terotomasi Backend & PKI (Pytest):**
   - 100% lulus (*pass*) pada pengujian sanitasi NIK, kalkulasi koordinat PDF, boundary check, penanganan berkas PDF terenkripsi, isolasi threadpool worker, dan Concurrency Limiter (10 proses simultan).
   - Verifikasi isolasi kesalahan per baris pada pemrosesan batch CSV.
   - Verifikasi pemangkasan melingkar (*Circular Pruning*) tabel `audit_logs` tepat pada batas 5.000 entri.
2. **Verifikasi Kepatuhan PAdES pada Adobe Acrobat Reader DC & PDFgear:**
   Dokumen PDF hasil tanda tangan (baik mode Visible maupun Invisible) terverifikasi langsung pada aplikasi pembaca PDF industri:
   - Status tanda tangan: **"Signed and all signatures are valid"**.
   - Integritas berkas: **"Document has not been modified since this signature was applied"**.
   - Rantai kepercayaan: Terhubung secara hierarkis ke Intermediate CA dan Root CA instansi.
   - Stempel waktu: Tervalidasi sesuai zona waktu Indonesia Barat (WIB / UTC+7).
   - Pengujian pencabutan: Dokumen bertanda tangan dari sertifikat berstatus `REVOKED` otomatis terdeteksi tidak sah melalui pengecekan berkas CRL.

---

## 7. Panduan Terkait & Berkas SOP

1. [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) — Panduan resmi deployment server on-premises (intranet/LAN MK).
2. [pki/ROOT_CA_OFFLINE_PROCEDURE.md](pki/ROOT_CA_OFFLINE_PROCEDURE.md) — Prosedur pencadangan terenkripsi dan isolasi offline kunci Root CA.
3. [pki/README.md](pki/README.md) — Dokumentasi subsistem dan skrip engine PKI OpenSSL.
4. [docs/](docs/) — Direktori dokumen spesifikasi sistem, database, arsitektur, dan Postman collection.
