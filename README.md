# Digital Signature Platform

## 1. Overview

Digital Signature Platform adalah aplikasi web enterprise-grade untuk pengelolaan identitas pengguna dan provisioning kredensial sertifikat tanda tangan digital menggunakan engine PKI OpenSSL berbasis skrip Bash yang telah tersedia.

Konsumen utama dari platform ini adalah antarmuka web berbasis **React + TypeScript + Vite**, yang berinteraksi secara aman dengan **FastAPI Backend**.

Fokus implementasi Phase 1 meliputi:

- Authentication & Session Management (JWT Bearer Token);
- Role-Based Access Control (RBAC: `SUPER_ADMIN`, `ADMIN`, `USER`);
- User Management & Lifecycle (Active, Inactive);
- Single User Generate (penerbitan akun dan sertifikat terintegrasi);
- Bulk User Generate (validasi dan pemrosesan batch via CSV);
- Certificate Management (Active, Expired, Replaced, Revoked);
- Certificate Expiration & Regenerate (Staged generation & rollback);
- Perubahan Passphrase P12/PFX (Admin & Self-Service User);
- Audit Logging untuk semua aktivitas penting;
- REST API terstruktur untuk seluruh operasi.

Fitur penandatanganan dokumen (PDF Signing aktif) dipersiapkan untuk Phase 2.

---

## 2. Architecture

Arsitektur aplikasi menggunakan pemisahan **3 Container Docker** berdasarkan pemisahan tanggung jawab yang terisolasi:

1. **Container 1: Dashboard / Platform API (`digital_signature_backend`, port 8000)** — Menangani penyajian frontend statis, REST API publik, autentikasi JWT, otorisasi RBAC, manajemen pengguna, metadata sertifikat, audit log, dan penandatanganan PDF via TTE signer.
2. **Container 2: PKI Service (`digital_signature_pki`, port 8001 internal)** — Mengisolasi beban kerja kriptografi OpenSSL, pembuatan RSA key, CSR, penandatanganan sertifikat, packaging P12, staging regenerasi, dan pembersihan material sertifikat. Terhubung hanya melalui jaringan internal dengan otentikasi token rahasia antarlayanan (`X-Internal-Token`).
3. **Container 3: PostgreSQL Database (`digital_signature_db`, port 5432)** — Menyimpan data terstruktur identitas pengguna, status dan metadata sertifikat, serta catatan audit log. Menggunakan named volume `postgres_data` untuk persistensi data.

```text
[ Browser / Frontend (React + TypeScript) ]
                     │
                     │ Port 8000 (HTTP / SPA & API) atau Port 3000 (Vite Dev Proxy)
                     ▼
+------------------------------------------------------------------------------------+
| CONTAINER 1: digital_signature_backend (Platform API & Web Dashboard)              |
| - FastAPI Web Server & SPA Host (Port 8000)                                        |
| - Autentikasi JWT, RBAC, Validasi Input, Audit Log, Dokumen TTE                    |
| - Client: PKIApiClient (httpx, X-Internal-Token)                                   |
| - Volume Mount:                                                                    |
|   - ./sign-api/p12 -> /app/sign-api/p12:ro (Arsip P12 Read-Only untuk TTE)         |
|   - ./frontend/dist -> /app/frontend/dist (SPA statis produksi)                    |
+------------------------------------------------------------------------------------+
              │                                            │
              │ Docker Network (platform_network:8001)     │ Docker Network (platform_network:5432)
              │ Internal Only (Tanpa Port Publik)          │ Internal Only (Port 5432)
              ▼                                            ▼
+-------------------------------------------+  +-------------------------------------+
| CONTAINER 2: digital_signature_pki        |  | CONTAINER 3: digital_signature_db   |
| (PKI Service / Certificate Issuer)        |  | (PostgreSQL Database Relasional)    |
| - FastAPI Daemon Kriptografi (Port 8001)  |  | - Port 5432 (postgres:16-alpine)    |
| - Endpoint Terproteksi X-Internal-Token   |  | - Named Volume: postgres_data       |
| - Engine: pki_engine.py & OpenSSL CLI     |  | - Menyimpan metadata user, cert,    |
| - Volume Mount:                           |  |   dan audit log                     |
|   - ./pki -> /app/pki (CA keys & issued)  |  +-------------------------------------+
|   - ./sign-api -> /app/sign-api (Archive) |
+-------------------------------------------+
```

### Karakteristik Arsitektur:
1. **Frontend Isolation:** Frontend tidak pernah mengakses file privat, database, atau skrip bash secara langsung. Seluruh interaksi melewati REST API.
2. **Container Separation:** Platform API (`backend/`) menangani autentikasi pengguna, otorisasi role, audit log, dan metadata database, sedangkan proses kriptografi terisolasi di PKI Service (`pki-service/`).
3. **Internal Inter-Service Security:** PKI Service hanya dapat diakses melalui jaringan Docker internal dengan autentikasi header `X-Internal-Token`. Port PKI Service (8001) tidak diekspos ke host publik.
4. **Shared P12 Volume:** Arsip sertifikat PKCS#12 kanonis (`sign-api/p12`) dibagikan ke Platform API agar fitur penandatanganan PDF (`pdf_signer.py`) dapat membaca bundle P12 untuk proses TTE.
5. **Data vs Artifact Separation:** PostgreSQL hanya menyimpan metadata identitas dan metadata sertifikat (serial number, subject, issuer, fingerprint, status, masa berlaku). Private key CA dan file fisik tersimpan secara terisolasi di volume PKI.

---

## 3. Roles & Permissions

Platform menerapkan RBAC ketat pada layer backend:

| Fitur | Super Admin | Admin | User | Keterangan |
|---|:---:|:---:|:---:|---|
| Dashboard | ✓ | ✓ | ✓ | User melihat personal dashboard, Admin melihat ringkasan operasional |
| Pengguna | ✓ | ✓ | - | Manajemen data pengguna dan riwayat kredensial |
| Generate User | ✓ | ✓ | - | Provisioning akun dan sertifikat tunggal / bulk CSV |
| Management Admin | ✓ | - | - | Pengangkatan dan pemberhentian role Admin |
| Audit Log | ✓ | ✓ | - | Rekam jejak aktivitas sistem yang tidak dapat diubah |
| Penandatanganan | - | ✓ | ✓ | Placeholder / dipersiapkan untuk Phase 2 |
| Kelola Akun | - | - | ✓ | Profil mandiri dan perubahan passphrase P12 user |
| Ubah Passphrase | Admin Reset | Admin Reset | Self-Service | Pergantian passphrase P12 tanpa menerbitkan ulang sertifikat |
| Regenerate | ✓ | ✓ | - | Penerbitan sertifikat baru menggantikan sertifikat aktif |

---

## 4. Repository Structure

```text
digital-signature-platform/
├── frontend/               # Single Page Application (React, Vite, TypeScript)
│   ├── src/
│   │   ├── components/     # UI components (dashboard, generate, users, audit, ui)
│   │   ├── pages/          # Page views (Dashboard, Users, Generate, Login, etc.)
│   │   ├── services/       # API client adapter (api.ts, users.ts, admins.ts, etc.)
│   │   └── types/          # TypeScript interface definitions
│   ├── package.json
│   └── vite.config.ts      # Dev server & reverse proxy configuration
├── backend/                # Monolith API Backend (FastAPI, SQLAlchemy, Alembic)
│   ├── app/
│   │   ├── api/            # API endpoints & dependency injection (deps.py)
│   │   ├── core/           # Configuration, security, database session
│   │   ├── models/         # SQLAlchemy ORM models (User, Certificate, AuditLog)
│   │   ├── schemas/        # Pydantic schemas (request/response validation)
│   │   ├── services/       # Business logic & PKI Engine adapter (pki_engine.py)
│   │   └── cli.py          # Operational CLI (Bootstrap Super Admin)
│   ├── alembic/            # Database schema migrations
│   ├── requirements.txt    # Python dependencies
│   └── tests/              # Pytest automated test suite
├── pki/                    # PKI Engine & CA Runtime
│   ├── scripts/            # Bash orchestration scripts (issue_cert_single.sh, dll)
│   ├── root/               # Root Certificate Authority
│   ├── intermediate/       # Intermediate Certificate Authority
│   └── issued/             # Penyimpanan artefak sertifikat per pengguna
├── sign-api/               # Direktori arsip P12 kanonis untuk verifikasi dan penandatanganan dokumen
│   └── p12/                # Arsip kredensial .p12 aktif
├── docker/                 # Dockerfiles untuk backend dan frontend
├── docs/                   # Spesifikasi teknis dan dokumentasi arsitektur
├── docker-compose.yml      # Orkestrasi container PostgreSQL & Backend Monolith
├── .env.example            # Template konfigurasi environment
└── README.md               # Dokumentasi utama proyek
```

---

## 5. Environment Configuration

Konfigurasi menggunakan variabel lingkungan yang dikelola melalui file `.env`. Gunakan `.env.example` sebagai referensi.

```env
# Database Credentials (PostgreSQL)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=digital_signature_db

# Connection URL
DATABASE_URL=postgresql://postgres:your_secure_db_password@postgres:5432/digital_signature_db

# Security & Secrets
SECRET_KEY=your_at_least_32_characters_random_secret_key
ENVIRONMENT=development
PORT=8000

# PKI Paths inside Container
PKI_ENGINE_DIR=/app/pki/scripts
P12_ARCHIVE_DIR=/app/sign-api/p12

# CORS Allowed Origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> **Keamanan Kredensial:**
> - File `.env` lokal diabaikan oleh Git via `.gitignore`.
> - Jangan pernah mencantumkan secret produksi di dalam `.env.example` atau commit Git.
> - Pada environment `production`, backend memvalidasi bahwa `SECRET_KEY` memiliki panjang minimal 32 karakter dan `CORS_ORIGINS` tidak menggunakan wildcard (`*`).

---

## 6. Running the Project

### Prasyarat:
- Docker Desktop atau Docker Engine yang mendukung Docker Compose v2.
- Node.js v18+ dan npm (untuk menjalankan development frontend).

### Langkah 1: Siapkan File Environment
```bash
cp .env.example .env
# Sesuaikan password dan secret key pada file .env
```

### Langkah 2: Jalankan Backend & Database via Docker
Jalankan container backend dan PostgreSQL:
```bash
docker compose up -d --build postgres backend
```

Periksa status container untuk memastikan status `healthy`:
```bash
docker compose ps
```

Container yang berjalan:
- `digital_signature_db`: PostgreSQL 16 (Port 5432)
- `digital_signature_backend`: FastAPI Backend Monolith (Port 8000)

### Langkah 3: Bootstrap Akun Super Admin Pertama
Eksekusi CLI bootstrap langsung di dalam container backend:
```bash
docker exec -it digital_signature_backend python -m app.cli create-super-admin \
  --email admin@mkri.id \
  --password <YourAdminPassword> \
  --name "Super Admin" \
  --nik 1234567890123456 \
  --organization "Universitas B" \
  --ou "TTE"
```

### Langkah 4: Jalankan Frontend (React + Vite)
Di terminal host lokal:
```bash
cd frontend
npm install
npm run dev
```
Aplikasi web dapat diakses di browser melalui: **`http://localhost:3000`**.

---

## 7. Verifikasi & Pengujian

### Status Pengujian Terverifikasi:
1. **Automated Backend & Integration Testing (Pytest):**
   - **66 dari 66 test lulus (100%)**: mencakup RBAC Admin, otentikasi JWT, filter & pagination pengguna, validasi CSV bulk 7 kolom, penanganan error PKI, staging regenerate sertifikat, client HTTP antarlayanan, dan integrasi penandatanganan PDF.
   ```bash
   PYTHONPATH=backend pytest -v backend/tests/
   ```
2. **PKI Service Automated Testing (Pytest):**
   - **7 dari 7 test lulus (100%)**: mencakup verifikasi token internal (`X-Internal-Token`), otorisasi antarlayanan, alur single/bulk issuance, isolasi staging, commit, cleanup, dan penghapusan material pengguna.
   ```bash
   PYTHONPATH=pki-service pytest -v pki-service/tests/
   ```
3. **Frontend Production Build:**
   - `npm run build` (`tsc && vite build`) berhasil dikompilasi dengan **0 kesalahan TypeScript** dalam 8.8 detik.
4. **Pengujian Nyata di 3 Container Docker (End-to-End):**
   - Container `digital_signature_backend`, `digital_signature_pki`, dan `digital_signature_db` terverifikasi aktif dan sehat.
   - Alur Login Super Admin -> Generate Single User -> Bulk CSV Validate & Generate -> Staged Regenerate -> Commit & Rollback -> Change Passphrase -> Delete User & Materials terverifikasi bekerja end-to-end tanpa kebocoran secret pada log.

---

## 8. Panduan Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `could not translate host name "postgres"` saat menjalankan pytest di host | Variabel `DATABASE_URL` di terminal host mencoba mengakses hostname Docker | Pastikan pengujian lokal di host menggunakan koneksi localhost atau database test terisolasi. |
| `Permission denied` saat eksekusi skrip PKI | Hak eksekusi skrip bash hilang | Jalankan `chmod +x pki/scripts/*.sh`. |
| Login gagal dengan pesan `value is not a valid email address` | Format email menggunakan domain reserved (misal `.local`) | Gunakan domain TLD standar seperti `.id`, `.com`, atau `.org` pada pendaftaran akun. |
| `one_active_certificate_per_user` constraint violation | Terdapat duplikasi sertifikat aktif untuk pengguna yang sama | Pastikan proses regenerate menggunakan alur staging terisolasi dan transaksi database untuk menandai sertifikat lama sebagai `REPLACED`. |

---

## 9. Dokumentasi Terkait

Rincian arsitektur dan spesifikasi dapat dipelajari lebih lanjut pada berkas di direktori `docs/`:

1. [SPECIFICATION.md](docs/SPECIFICATION.md) — Master spesifikasi kebutuhan sistem, roles, dan business rules.
2. [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Rincian arsitektur monolith, interaksi komponen, dan boundary keamanan.
3. [DATABASE.md](docs/DATABASE.md) — Skema database PostgreSQL, model tabel, relasi, constraint, dan index.
4. [API.md](docs/API.md) — Kontrak endpoint API, skema request/response, autentikasi, dan error handling.
5. [DESIGN.md](docs/DESIGN.md) — Panduan desain visual, layout antarmuka, dan pengalaman pengguna.
