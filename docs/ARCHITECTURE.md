# ARCHITECTURE

## 1. Tujuan

Dokumen ini mendefinisikan arsitektur teknis **Digital Signature Platform** (Phase 1) untuk mengelola akun pengguna, provisioning sertifikat digital melalui PKI engine OpenSSL berbasis skrip Bash yang telah tersedia, perubahan Passphrase, otentikasi, otorisasi, pencatatan audit log, serta integrasi API platform.

Platform berfungsi sebagai layer aplikasi, business logic, dan orkestrasi. Proses kriptografi dan penerbitan sertifikat tetap menggunakan PKI engine yang sudah tersedia dan tidak ditulis ulang.

---

## 2. Rasional Keputusan Arsitektur: Monolith Backend Terpadu

Pada evaluasi awal, backend sempat dipisahkan menjadi dua container: `backend` (Platform API) dan `pki-service` (adapter eksekusi bash di port 8001). Berdasarkan tinjauan kepraktisan dan kebutuhan operasional Phase 1, arsitektur disederhanakan menjadi **Satu Backend Monolith Terpadu (FastAPI)** karena:

1. **Efisiensi Sumber Daya & Operasional:** Menghilangkan overhead pengelolaan 2 aplikasi FastAPI, 2 Dockerfile, latensi jaringan HTTP internal, dan alokasi RAM ganda pada container engine.
2. **Eliminasi Kerapuhan Jaringan Internal:** Pemanggilan PKI dieksekusi secara *in-process* melalui modul Python bawaan (`subprocess.run`), menghilangkan risiko kegagalan koneksi antar-container atau kendala sinkronisasi token internal (`PKI_SERVICE_TOKEN`).
3. **Pemisahan Tanggung Jawab Tetap Terjaga:** Secara struktural di tingkat kode, router controller (`app/api/endpoints/`) tetap terpisah dari adapter PKI (`app/services/pki_engine.py` dan `pki_client.py`). Kode tetap modular dan mudah diekstrak kembali jika kebutuhan skala besar di masa mendatang menuntutnya.

---

## 3. Komponen Sistem

Arsitektur Phase 1 terdiri dari komponen-komponen berikut:

1. **Frontend (React + TypeScript + Vite)**
   - Bertindak sebagai antarmuka pengguna web utama dan konsumen utama Platform API.
   - Mengelola state interaktif, form input pengguna, rendering data dashboard, dan token sesi di localStorage (`access_token` / `ds_auth_token`).
   - Berkomunikasi secara eksklusif dengan Platform API melalui HTTP REST (via proxy Vite di lokal atau reverse proxy di production).
   - **Isolasi Keamanan:** Frontend tidak pernah mengakses file privat, bundle P12, atau skrip PKI secara langsung.

2. **Platform API / Backend Monolith (FastAPI)**
   - Satu-satunya backend API utama untuk aplikasi.
   - Menangani autentikasi JWT, RBAC (`SUPER_ADMIN`, `ADMIN`, `USER`), validasi Pydantic, business logic, manajemen siklus hidup sertifikat, dan audit logging.
   - Router controller **tidak menjalankan skrip Bash PKI secara langsung**, melainkan mendelegasikannya ke service adapter internal.

3. **PostgreSQL**
   - Menyimpan data operasional aplikasi: tabel `users`, `certificates`, dan `audit_logs`.
   - Menegakkan integritas data melalui foreign keys, unique constraints, dan partial indexes (misal: hanya 1 sertifikat `ACTIVE` per user).
   - **Prinsip Keamanan:** Database **tidak pernah menyimpan** private key, binary bundle PFX/P12, plaintext password, atau passphrase.

4. **Internal PKI Adapter (`app/services/pki_engine.py` & `pki_client.py`)**
   - Modul internal di dalam backend yang bertugas sebagai orkestrator dan jembatan ke skrip Bash PKI.
   - Menjalankan skrip Bash via Python `subprocess.run` dengan argumen aman (tanpa `shell=True`) dan batasan timeout ketat.
   - Memvalidasi keberadaan dan integritas file output (`.crt` dan `.p12`) menggunakan OpenSSL CLI sebelum metadata disimpan ke database.
   - Menangani staging isolasi untuk proses regenerate serta pembersihan artefak (*cleanup/rollback*) jika terjadi kegagalan transaksi database.

5. **Existing PKI Engine (`pki/scripts/`)**
   - Skrip Bash aktif yang membungkus perintah OpenSSL:
     - `bangkitkan_single.sh`: Penerbitan sertifikat single user.
     - `bangkitkan_banyak.sh`: Penerbitan batch melalui input TSV/CSV.
     - `change_p12_passphrase-admin.sh`: Reset passphrase P12 oleh Admin.
     - `change_p12_passphrase-user.sh`: Ganti passphrase P12 oleh User mandiri.
   - Struktur CA runtime: Root CA (`pki/root/`) dan Intermediate CA (`pki/intermediate/`).
   - Direktori penyimpanan sertifikat: `pki/issued/` dan arsip kredensial `sign-api(well3)/p12/`.

6. **Existing Sign API (`sign-api(well3)`)**
   - Disiapkan untuk kebutuhan PDF signing pada Phase 2.
   - Tidak diaktifkan atau diintegrasikan ke alur signing pada Phase 1.

---

## 4. Arsitektur Komunikasi

```text
[ Browser / Frontend (React + Vite) ] (Port 3000)
                     │
                     ▼ HTTP/JSON (Bearer Token & CORS)
[ Backend Platform API (FastAPI Monolith) ] (Port 8000)
    │                               │
    ▼ (SQLAlchemy ORM / Alembic)     ▼ (In-Process Python Call)
[ PostgreSQL Database ]         [ Internal PKI Adapter: pki_engine.py ]
  (Port 5432)                       │
                                    ▼ (Secure Subprocess / OpenSSL CLI)
                                [ Existing PKI Engine (pki/scripts/) ]
                                    │
                                    ├── Private Key (.key) & CSR (.csr)
                                    ├── Signed Certificate (.crt)
                                    └── Encrypted PKCS#12 Bundle (.p12)
```

---

## 5. Batas Tanggung Jawab Komponen

### A. Frontend (React)
- Menangani rendering visual, formulir input, dan feedback pengguna.
- Menyimpan dan menyertakan token otentikasi JWT pada request API.
- Menampilkan pesan error yang telah distandardisasi oleh backend.
- **Batasan:** Tidak melakukan validasi keamanan akhir dan tidak pernah memproses file kriptografi secara langsung.

### B. Backend Routers & Controllers (`app/api/endpoints/`)
- Menerima request HTTP, memvalidasi schema input Pydantic.
- Menegakkan RBAC melalui dependency injection FastAPI (`deps.py`).
- Mengelola transaksi database (commit/rollback) dan pencatatan audit log.
- Memanggil internal service adapter untuk operasi PKI.
- **Batasan:** Tidak berisi baris kode OpenSSL, pemanggilan subprocess, atau pembacaan path fisik berkas PKI.

### C. Internal Service Adapter (`app/services/pki_engine.py` & `pki_client.py`)
- Menerjemahkan kebutuhan bisnis menjadi parameter input skrip Bash.
- Menjalankan subprocess OpenSSL dengan penanganan timeout dan penangkapan exit code/stderr.
- Melakukan verifikasi artefak fisik: memastikan sertifikat `.crt` dan file kredensial `.p12` terbentuk serta dapat dibuka dengan passphrase.
- Mengurai metadata sertifikat (serial number, subject, issuer, SHA-256 fingerprint, masa berlaku).
- Menyediakan fungsi isolasi staging untuk regenerate dan fungsi cleanup jika terjadi kegagalan transaksi database.
- **Batasan:** Tidak mengelola sesi HTTP pengguna, otorisasi role, atau rendering respons frontend.

### D. PKI Engine Scripts (`pki/scripts/`)
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
       - Panggil pki_client.delete_user_materials(nik) untuk membersihkan artefak fisik
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

Arsitektur monolith diorkestrasi melalui file `docker-compose.yml`:

```text
services:
  postgres:
    image: postgres:16-alpine
    container_name: digital_signature_db
    ports: ["5432:5432"]
    healthcheck: pg_isready

  backend:
    build: docker/Dockerfile.backend (Python 3.9 + OpenSSL + Bash CLI Tools)
    container_name: digital_signature_backend
    ports: ["8000:8000"]
    volumes:
      - ./backend/app:/app/app
      - ./pki:/app/pki
      - ./sign-api(well3):/app/sign-api(well3)
    depends_on: postgres (condition: service_healthy)

  frontend (Opsional / Development):
    profiles: ["frontend", "full"]
    build: docker/Dockerfile.frontend
    ports: ["3000:3000"]
```

---

## 9. Catatan Kesiapan Produksi (Production Readiness)

Meskipun sistem telah terbukti lulus 100% pada 35 unit test dan pengujian fungsional browser end-to-end, status saat ini adalah **tahap pengujian integrasi fungsional (Development/Staging)**. Sebelum dideklarasikan *production-ready*, langkah operasional berikut tetap diwajibkan:

1. **Rotasi Kredensial:** Mengganti seluruh default password, `POSTGRES_PASSWORD`, dan `SECRET_KEY` dengan string acak berkekuatan tinggi (>32 karakter) di lingkungan produksi.
2. **Reverse Proxy & TLS:** Menempatkan Nginx atau Cloud Ingress dengan sertifikat HTTPS resmi di depan backend port 8000 dan frontend port 3000.
3. **Pencadangan CA:** Menyiapkan mekanisme backup berkala terenkripsi untuk direktori `pki/intermediate/` dan `pki/root/`.
