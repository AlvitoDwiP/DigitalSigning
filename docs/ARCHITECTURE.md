# ARCHITECTURE

## 1. Tujuan

Dokumen ini mendefinisikan arsitektur teknis **Digital Signature Platform** (Phase 1) untuk mengelola akun pengguna, provisioning sertifikat digital melalui PKI engine OpenSSL berbasis skrip Bash yang telah tersedia, perubahan Passphrase, otentikasi, otorisasi, pencatatan audit log, serta integrasi API platform.

Platform berfungsi sebagai layer aplikasi, business logic, dan orkestrasi. Proses kriptografi dan penerbitan sertifikat tetap menggunakan PKI engine yang sudah tersedia dan tidak ditulis ulang.

---

## 2. Rasional Keputusan Arsitektur: 3-Container Service Separation

Arsitektur sistem menggunakan pemisahan tiga container independen untuk menegakkan prinsip **Least Privilege** dan **Defense-in-Depth**:

1. **Isolasi Total Kunci Privat CA:** Kunci privat Intermediate CA (`intermediate-ca.key`) dan seluruh skrip engine CA diisolasi secara eksklusif di dalam container **PKI Service** (`digital_signature_pki`). Container Backend/Platform API **tidak memiliki akses fisik maupun mount** ke direktori `./pki`.
2. **Mount Arsip P12 Read-Only pada Backend:** Container Backend hanya me-mount subdirektori `./sign-api/p12` dengan izin *Read-Only* (`:ro`) untuk melayani penandatanganan PDF (TTE). Backend tidak dapat memodifikasi, membuat, atau menghapus berkas pada arsip P12.
3. **Pemberian Hak Kelola Kriptografi Hanya pada PKI Service:** Seluruh operasi pembuatan, regenerasi sertifikat, perubahan passphrase P12, dan pembersihan material pengguna dilakukan oleh PKI Service melalui API internal terotentikasi token (`X-Internal-Token`).
4. **Keamanan Database Terisolasi:** Container PostgreSQL hanya membuka port `5432` pada jaringan bridge internal Docker (`platform_network`), tanpa mapping port publik pada host.
5. **Lingkungan CA Khusus Testing:** Pengujian penerbitan sertifikat menggunakan Test CA terisolasi penuh (`test_ca_factory`), menjamin file `index.txt` dan `serial` pada CA utama tidak mengalami perubahan saat test dijalankan.

---

## 3. Komponen Sistem

Arsitektur terdiri dari komponen-komponen berikut:

1. **Frontend (React + TypeScript + Vite)**
   - Antarmuka web pengguna untuk manajemen akun, pengajuan generate sertifikat, dan penandatanganan dokumen TTE.
   - Berkomunikasi secara eksklusif dengan Platform API melalui HTTP REST di port 8000.
   - **Isolasi Keamanan:** Frontend tidak pernah mengakses file privat, bundle P12, atau skrip PKI secara langsung.

2. **Platform API / Dashboard Backend (FastAPI — Port 8000)**
   - Menangani autentikasi JWT pengguna, RBAC (`SUPER_ADMIN`, `ADMIN`, `USER`), validasi request, audit logging, dan fitur penandatanganan PDF in-process (`pdf_signer.py`).
   - Menerima mount arsip P12 dengan mode **Read-Only** (`./sign-api/p12:/app/sign-api/p12:ro`).
   - Berkomunikasi dengan PKI Service via HTTP internal (`http://pki_service:8001/internal/v1/pki/`).
   - **Bebas Secret CA:** Backend tidak menerima, menyimpan, atau memvalidasi rahasia `INTER_CA_PASS`.

3. **PKI Service / Certificate Issuer (FastAPI Internal — Port 8001)**
   - Service internal daemon tanpa eksposur ke jaringan publik (hanya `expose: 8001`).
   - Memegang mount direktori `./pki` (Root & Intermediate CA) dan `./sign-api` (Read-Write).
   - Menjalankan skrip Bash penerbitan sertifikat, regenerasi staging, perubahan passphrase, dan penghapusan material.
   - Mewajibkan token internal `X-Internal-Token` untuk seluruh endpoint operasional.
   - Memiliki proteksi *safety guard* otomatis yang menggagalkan eksekusi test jika tidak menggunakan Test CA terisolasi.

4. **PostgreSQL (Port 5432 Internal)**
   - Menyimpan entitas `users`, `certificates`, dan `audit_logs`.
   - Hanya dapat diakses oleh container Backend melalui jaringan internal `platform_network`.
   - Tidak pernah menyimpan private key, passphrase, atau binary berkas P12.

5. **Integrated PDF Signing Service (`pdf_signer.py`)**
   - Berjalan in-process di dalam container Backend.
   - Membaca berkas `.p12` pengguna secara read-only dari `/app/sign-api/p12/<nik>.p12`.
   - Menggunakan passphrase masukan pengguna (dari header `X-P12-Password` atau form field) untuk melakukan signing digital berbasis CMS/PAdES via pustaka `endesive`.

6. **Isolated Testing CA Factory (`tests/test_ca_factory.py`)**
   - Utilitas otomatis untuk membangun Test Intermediate CA sementara di direktori terisolasi (`/tmp`).
   - Memiliki key, cert, index.txt, dan serial sendiri untuk kebutuhan integration test.

---

## 4. Arsitektur Komunikasi 3 Container Docker

```text
[ Browser / Frontend (React + TypeScript) ]
                     │
                     │ Port 8000 (HTTP / SPA & API) atau Port 3000 (Vite Dev Proxy)
                     ▼
+------------------------------------------------------------------------------------+
| CONTAINER 1: digital_signature_backend (Platform API & Web Dashboard)              |
| - FastAPI Web Server & SPA Static Host (Port 8000)                                 |
| - Autentikasi JWT, RBAC, Validasi Input, Audit Log, Dokumen TTE                    |
| - Client: PKIApiClient (httpx, X-Internal-Token)                                   |
| - Volume Mount:                                                                    |
|   - ./sign-api -> /app/sign-api (P12 archive kanonis)                              |
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

---

## 5. Batas Tanggung Jawab Komponen

### A. Frontend (React + TypeScript)
- Menangani rendering visual, formulir input, dan feedback pengguna.
- Menyimpan dan menyertakan token otentikasi JWT pada request API.
- Menampilkan pesan error yang telah distandardisasi oleh backend.
- Dapat disajikan langsung oleh Container 1 melalui bundling statis (`/app/frontend/dist`) atau melalui Vite dev server di port 3000 selama masa pengembangan.
- **Batasan:** Tidak melakukan validasi keamanan akhir dan tidak pernah memproses file kriptografi secara langsung.

### B. Container 1 — Dashboard / Platform API (`backend/`)
- Menerima request HTTP publik di port 8000, memvalidasi schema input Pydantic.
- Menegakkan RBAC melalui dependency injection FastAPI (`deps.py`).
- Mengelola koneksi dan transaksi PostgreSQL (commit/rollback) serta pencatatan audit log.
- Memanggil PKI Service melalui client HTTP internal (`pki_api_client.py`) yang terproteksi token rahasia antarlayanan (`X-Internal-Token`).
- Melayani penandatanganan PDF (`pdf_signer.py`) menggunakan shared volume arsip `.p12` kanonis (`/app/sign-api/p12`).
- **Batasan:** Tidak mengeksekusi subprocess Bash PKI secara langsung dan tidak memiliki akses langsung ke direktori kunci privat CA (`pki/intermediate/private/`).

### C. Container 2 — PKI Service / Certificate Issuer (`pki-service/`)
- Menyediakan endpoint API internal terproteksi (`/internal/v1/pki/...`) di port 8001 internal.
- Mengisolasi beban kerja komputasi berat OpenSSL (RSA keygen, CSR signing, PKCS#12 packaging) dari layanan web dashboard.
- Menjalankan orkestrasi `pki_engine.py` untuk mengeksekusi skrip Bash OpenSSL dengan penanganan timeout, stdin piping, dan penangkapan exit code/stderr.
- Memvalidasi artefak fisik: memastikan sertifikat `.crt` dan file kredensial `.p12` terbentuk serta dapat dibuka dengan passphrase.
- Mengurai metadata sertifikat (serial number, subject, issuer, SHA-256 fingerprint, masa berlaku).
- Menyediakan fungsi isolasi staging untuk regenerate dan fungsi cleanup jika terjadi kegagalan transaksi database.
- **Batasan:** Tidak diekspos ke host publik, tidak terhubung langsung ke database PostgreSQL, dan tidak mengelola sesi HTTP pengguna publik.

### D. Container 3 — Database Service (`postgres:16-alpine`)
- Menyediakan basis data relasional PostgreSQL untuk Platform API.
- Menyimpan entitas pengguna, metadata sertifikat, dan catatan audit log sesuai `DATABASE.md`.
- Menggunakan named volume `postgres_data` untuk menjamin persistensi data saat container direstart atau di-rebuild.
- Memiliki health check berkala (`pg_isready`) dan kebijakan `restart: always`.
- **Batasan:** Hanya dapat diakses oleh Platform API melalui jaringan internal Docker `platform_network`. Tidak diekspos ke jaringan publik pada deployment produksi.

### E. PKI Engine Scripts (`pki/scripts/`)
- Mengeksekusi perintah kriptografi OpenSSL: pembuatan RSA key, CSR, penandatanganan oleh Intermediate CA, dan packaging PKCS#12.
- Mengelola serial number CA dan index database teks CA (`index.txt`, `serial`).

---

## 6. Alur Kerja Proses Kritis

### 6.1. Generate User (Single)

```text
Frontend React
  -> POST /api/v1/users/generate (Header: Bearer Token)
  -> Router FastAPI (users.py):
       1. Validasi role (SUPER_ADMIN / ADMIN)
       2. Validasi input Pydantic & cek duplikasi NIK/Email/Name di PostgreSQL
  -> Internal Adapter (pki_engine.generate_single):
       3. Eksekusi pki/scripts/bangkitkan_single.sh via subprocess
       4. Validasi artefak: OpenSSL x509 membaca metadata & OpenSSL pkcs12 menguji keterbacaan .p12
  -> Router FastAPI:
       5. Database transaction:
            - Insert User
            - Insert Certificate (Status: ACTIVE)
            - Insert AuditLog ("USER_CREATED", "CERTIFICATE_GENERATED")
       6. Commit DB transaction
  -> Jika DB gagal:
       - Rollback DB transaction
       - Panggil pki_engine.delete_user_materials(nik) untuk membersihkan artefak fisik
  -> Return 200 OK dengan metadata user & sertifikat ke React
```

### 6.2. Generate User Bulk (CSV)

```text
Frontend React
  -> Upload CSV 7 kolom: name,nik,email,organization,ou,password,pfx_pass
  -> POST /api/v1/users/generate-bulk/validate:
       - Validasi header, tipe data, format NIK 16 digit, format email, dan duplikasi DB
       - Return preview aman tanpa membocorkan password/passphrase
  -> POST /api/v1/users/generate-bulk:
       - Buat temporary file TSV terproteksi (permission 0600)
       - Internal Adapter memanggil bangkitkan_banyak.sh via subprocess
       - Validasi setiap sertifikat .crt dan .p12 yang dihasilkan
       - Iterasi penyimpanan ke PostgreSQL per user (isolasi kegagalan per row)
       - Catat AuditLog untuk setiap penerbitan berhasil
  -> Return ringkasan hasil (total, success, failed) ke React
```

### 6.3. Regenerate Certificate (Isolated Staging & Rollback)

Regenerate menerbitkan sertifikat baru untuk pengguna yang sudah ada dengan default passphrase `<DEFAULT_PASSPHRASE>` jika tidak disediakan, tanpa merusak sertifikat lama jika terjadi kegagalan:

```text
Admin memicu Regenerate di Frontend
  -> POST /api/v1/users/{user_id}/certificates/regenerate
  -> Router FastAPI:
       - Cek keberadaan user dan sertifikat berstatus ACTIVE
  -> Internal Adapter (pki_engine.generate_staged):
       1. Buat folder staging sementara terisolasi: .staging_{person_slug}_{staging_id}
       2. Jalankan penerbitan sertifikat ke dalam folder staging
       3. Validasi fisik artefak di staging via OpenSSL
  -> Router FastAPI:
       4. Database Transaction:
            - Update sertifikat lama: status -> REPLACED, replaced_by -> ID sertifikat baru
            - Insert sertifikat baru: status -> ACTIVE
            - Insert AuditLog: action -> CERTIFICATE_REGENERATED, status -> SUCCESS
       5. Commit Transaction
  -> Internal Adapter (commit_staged):
       6. Pindahkan file dari folder staging ke folder aktif dan arsip P12
       7. Hapus folder staging
  -> Jika terjadi kegagalan di langkah manapun:
       - Rollback database (sertifikat lama TETAP berstatus ACTIVE)
       - Panggil cleanup_staged() untuk menghapus artefak di folder staging
       - Catat AuditLog dengan status FAILED
```

### 6.4. Ubah Passphrase P12/PFX

Perubahan passphrase P12 **tidak menerbitkan sertifikat baru**:

```text
Frontend -> POST /api/v1/users/{user_id}/pfx-password atau /api/v1/account/pfx-password
  -> Router FastAPI memvalidasi hak akses:
       - Admin dapat mereset tanpa password lama
       - User wajib menyertakan password lama
  -> Internal Adapter memanggil skrip:
       - Admin: change_p12_passphrase-admin.sh
       - User: change_p12_passphrase-user.sh
  -> Skrip mengekstrak private key & cert dengan password lama, lalu mengemas ulang dengan password baru
  -> Verifikasi keterbacaan P12 baru via OpenSSL
  -> AuditLog dicatat (tanpa mencatat nilai passphrase)
  -> Serial number, fingerprint, dan masa berlaku sertifikat TETAP SAMA
```

### 6.5. Mode Pengguna untuk Akun Admin (Dual-View Navigation)

Fitur Mode Pengguna memungkinkan akun dengan role `ADMIN` beralih antarmuka navigasi dan dashboard antara Mode Admin dan Mode Pengguna:

1. **Prinsip Otorisasi & Sesi:**
   - Role asli di database tetap `ADMIN`. Tidak ada perubahan role DB, token JWT baru, atau akun duplikat.
   - Sesi autentikasi tetap sama (`Bearer <token>`).
   - Mode tampilan disimpan pada client-side state (`localStorage: ds_admin_view_mode`) sebagai preferensi tampilan.
2. **Pemisahan Tampilan:**
   - **Mode Admin:** Menampilkan dashboard operasional sistem, Pengguna, Generate, dan Audit Log. Menu Penandatanganan (TTE) dan Kelola Akun **tidak ditampilkan** (Kelola Akun diakses melalui Mode Pengguna).
   - **Mode Pengguna:** Menggunakan layout dan navigasi User yang sudah ada (Dashboard User personal, Penandatanganan TTE, Kelola Akun Saya). Menu administrasi Pengguna, Generate, dan Audit Log disembunyikan.
3. **Keamanan & Otorisasi Endpoint:**
   - **Verifikasi Masuk Mode Admin:** Saat Admin beralih dari Mode Pengguna ke Mode Admin, sistem memunculkan popup verifikasi password. Password divalidasi melalui endpoint `POST /api/v1/auth/verify-password`.
   - Client meminta dashboard personal via `GET /api/v1/dashboard/?mode=user`. Backend memverifikasi identitas admin dan menyajikan metrik sertifikat personal milik admin sendiri.
   - Penandatanganan TTE (`POST /api/v1/signatures/sign`) menandatangani dokumen menggunakan sertifikat personal milik akun Admin.
   - Otorisasi endpoint tetap dievaluasi di sisi backend; manipulasi state frontend tidak dapat melewati permission backend.
   - Akun `SUPER_ADMIN` dilarang beralih ke Mode Pengguna atau mengakses TTE (`403 Forbidden`).

---

## 7. Batasan Keamanan & Boundary Operasional

1. **Secret & Key Isolation:**
   - Private key (`.key`), sertifikat individual (`.crt`), dan kredensial (`.p12`) diabaikan oleh Git melalui `.gitignore`.
   - File fisik `.p12` dibuat dengan mask permission `umask 077` (hanya dapat dibaca oleh pemilik proses).
2. **No Secret in Database / Logs:**
   - Password login akun di-hash menggunakan algoritma `bcrypt`.
   - Passphrase P12 tidak pernah disimpan di database, audit log, maupun respons API.
3. **CORS Enforcement:**
   - Mengizinkan origin frontend spesifik (`http://localhost:3000`, `http://127.0.0.1:3000`).
   - Pada environment `production`, konfigurasi secara ketat menolak penggunaan wildcard `*` jika `allow_credentials=True`.
4. **Subprocess Sanitization:**
   - Pemanggilan skrip bash dilakukan menggunakan list argumen `["bash", path]` tanpa `shell=True`.
   - Input baris divalidasi terhadap karakter berbahaya (`\t`, `\r`, `\n`) dan NIK disanitasi hanya menerima digit numerik.

---

## 8. Deployment via Docker Compose

Arsitektur 3-container diorkestrasi melalui file `docker-compose.yml`:

```text
services:
  postgres:
    image: postgres:16-alpine
    container_name: digital_signature_db
    expose: ["5432"]                     # Terisolasi pada platform_network
    healthcheck: pg_isready

  pki_service:
    build: docker/Dockerfile.pki         # Python 3.9 + OpenSSL + Bash CLI
    container_name: digital_signature_pki
    expose: ["8001"]                     # Daemon internal tanpa port publik
    volumes:
      - ./pki:/app/pki                   # Kunci CA eksklusif di container ini
      - ./sign-api:/app/sign-api         # Read-Write untuk penerbitan P12

  backend:
    build: docker/Dockerfile.backend     # Python 3.9 + Endesive + FastAPI
    container_name: digital_signature_backend
    ports: ["8000:8000"]                 # Akses web platform API & static UI
    volumes:
      - ./backend/app:/app/app
      - ./backend/alembic:/app/alembic
      - ./sign-api/p12:/app/sign-api/p12:ro  # Read-Only arsip P12 untuk TTE
      - ./frontend/dist:/app/frontend/dist
    depends_on:
      postgres: condition: service_healthy
      pki_service: condition: service_healthy

  frontend (Opsional / Standalone Dev):
    profiles: ["frontend-standalone"]
    build: docker/Dockerfile.frontend
    ports: ["3000:3000"]
```

---

## 9. Catatan Kesiapan Produksi (Production Readiness)

Meskipun sistem telah terbukti lulus 100% pada 35 unit test dan pengujian fungsional browser end-to-end, status saat ini adalah **tahap pengujian integrasi fungsional (Development/Staging)**. Sebelum dideklarasikan *production-ready*, langkah operasional berikut tetap diwajibkan:

1. **Rotasi Kredensial:** Mengganti seluruh default password, `POSTGRES_PASSWORD`, dan `SECRET_KEY` dengan string acak berkekuatan tinggi (>32 karakter) di lingkungan produksi.
2. **Reverse Proxy & TLS:** Menempatkan Nginx atau Cloud Ingress dengan sertifikat HTTPS resmi di depan backend port 8000 dan frontend port 3000.
3. **Pencadangan CA:** Menyiapkan mekanisme backup berkala terenkripsi untuk direktori `pki/intermediate/` dan `pki/root/`.
