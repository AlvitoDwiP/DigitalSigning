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

Arsitektur aplikasi menggunakan pendekatan **Monolith Backend Terpadu** yang dirancang untuk kesederhanaan deployment operasional tanpa kompleksitas microservices yang prematur:

```text
[ Frontend (React + TypeScript + Vite) ] (Port 3000)
                    │
                    ▼ HTTP/JSON (CORS & Vite Proxy)
[ Platform API (FastAPI Monolith) ] (Port 8000)
    │                       │
    ▼ (SQLAlchemy/Alembic)   ▼ (In-Process Adapter Call)
[ PostgreSQL DB ]       [ Internal PKI Adapter: pki_client.py & pki_engine.py ]
  (Port 5432)               │
                            ▼ (Secure Subprocess Execution / OpenSSL)
                        [ Existing PKI Engine Scripts (pki/scripts/) ]
                            │
                            ├── Private Key (.key) & CSR (.csr)
                            ├── Intermediate CA Signed Certificate (.crt)
                            └── Encrypted PKCS#12 Bundle (.p12)
```

### Karakteristik Arsitektur:
1. **Frontend Isolation:** Frontend tidak pernah mengakses file privat, database, atau skrip bash secara langsung. Seluruh interaksi melewati REST API.
2. **Controller/Router Separation:** Endpoint FastAPI (`app/api/endpoints/`) tidak memanggil skrip bash OpenSSL secara langsung, melainkan mendelegasikannya ke internal service adapter (`app/services/pki_client.py` dan `pki_engine.py`).
3. **In-Process PKI Adapter:** Adapter menangani validasi input/output, sanitasi format, batas timeout proses, verifikasi integritas artefak sertifikat via OpenSSL, serta mekanisme rollback jika terjadi kegagalan transaksi database.
4. **Data vs Artifact Separation:** PostgreSQL hanya menyimpan metadata identitas dan metadata sertifikat (serial number, subject, issuer, fingerprint, status, masa berlaku). File privat dan bundle `.p12` tersimpan secara terisolasi di volume sistem berkas.

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
1. **Automated Unit Testing (Pytest):**
   - **35 dari 35 test lulus (100%)**: mencakup RBAC Admin, otentikasi JWT, filter & pagination pengguna, validasi CSV bulk 7 kolom, penanganan error PKI, dan staging regenerate sertifikat.
   ```bash
   # Menjalankan test suite backend
   cd backend
   pytest
   ```
2. **Frontend Production Build:**
   - `npm run build` (`tsc && vite build`) berhasil dikompilasi dengan **0 kesalahan TypeScript**.
3. **Pengujian Nyata di Browser (End-to-End):**
   - Alur Login Admin (`POST /api/v1/auth/login`) -> Generate Pengguna (`POST /api/v1/users/generate`) -> Eksekusi OpenSSL Intermediate CA -> Penerbitan Sertifikat & file `.p12` -> Tampilan UI Real-Time telah terverifikasi bekerja end-to-end.

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
