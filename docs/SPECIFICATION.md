# SPECIFICATION

## 1. Product Overview

Digital Signature Platform adalah aplikasi web untuk mengelola user, provisioning sertifikat/credential, pengelolaan Passphrase, audit, dan persiapan integrasi proses penandatanganan digital.

Platform menggunakan PKI engine yang sudah tersedia sebagai engine penerbitan sertifikat. Platform tidak menulis ulang proses kriptografi pada Phase 1.

Dokumen ini merupakan **master specification / source of truth** untuk kebutuhan produk. Detail teknis dapat dirujuk ke:

- `DATABASE.md` untuk struktur dan aturan database.
- `ARCHITECTURE.md` untuk arsitektur dan batas tanggung jawab komponen.
- `API.md` untuk kontrak endpoint.
- `DESIGN.md` untuk struktur dan rancangan antarmuka.
- `README.md` untuk overview dan cara menjalankan project.

---

## 2. Scope Phase 1 & Status Implementasi

React (+ TypeScript + Vite) merupakan antarmuka web dan konsumen utama dari Platform API ini.

### Status Fitur Aktual:

#### A. Selesai & Terverifikasi (Completed & Verified)
1. **Authentication & Session:** Login JWT Bearer token, session persistence di localStorage (`access_token` & `ds_auth_token`), logout, dan token validation.
2. **Role-Based Access Control (RBAC):** Penegakan hak akses pada seluruh endpoint backend untuk `SUPER_ADMIN`, `ADMIN`, dan `USER`.
3. **User Management:** Manajemen daftar pengguna, pencarian, pemfilteran berdasarkan role/status/sertifikat, pagination, serta halaman detail pengguna.
4. **Generate User Single:** Provisioning pengguna baru dan penerbitan sertifikat terintegrasi dari form React, diproses oleh internal PKI adapter ke skrip Bash OpenSSL, serta penyimpanan metadata ke PostgreSQL dan file bundle `.p12` ke storage disk.
5. **Generate User Bulk (CSV):** Alur validasi 7 kolom (`name,nik,email,organization,ou,password,pfx_pass`), preview data aman tanpa membocorkan rahasia, eksekusi batch, dan isolasi kegagalan per baris.
6. **Certificate Metadata Management:** Pelacakan masa berlaku 730 hari, serial number, subject, issuer, SHA-256 fingerprint, penegakan aturan 1 sertifikat `ACTIVE` per user, serta pembacaan riwayat sertifikat terotentikasi via `GET /api/v1/users/{user_id}/certificates` (Admin) dan `GET /api/v1/account` (User).
7. **Regenerate Certificate:** Penerbitan sertifikat baru menggantikan sertifikat aktif menggunakan mekanisme folder staging terisolasi dan transaksi database dengan cleanup rollback otomatis untuk menjaga integritas status sertifikat lama jika terjadi kegagalan.
8. **Ubah Passphrase:** Pergantian passphrase P12/PFX oleh Admin maupun mandiri oleh User tanpa mengubah metadata sertifikat.
9. **Management Admin:** Pengangkatan dan pencabutan hak akses role Admin oleh Super Admin.
10. **Audit Logging:** Pencatatan riwayat aktivitas operasional penting (generate, regenerate, delete user, ubah passphrase, assign/remove admin) ke tabel `audit_logs` tanpa mengekspos passphrase atau kredensial sensitif. Aktivitas autentikasi/login/sesi maupun navigasi tidak dicatat. Kapasitas log dibatasi maksimal 5.000 entri dengan mekanisme FIFO/Circular Pruning otomatis.
11. **Dashboard Operasional:** Metrik statistik operasional sistem (Total User, Active, Expired), peringatan sertifikat mendekati kedaluwarsa, dan ringkasan aktivitas terbaru.
12. **Containerized Architecture:** Arsitektur terpisah 3 container (`digital_signature_backend`, `digital_signature_pki`, dan `digital_signature_db`) dengan delegasi PKI internal terautentikasi dan isolasi material kredensial P12 secara read-only.
13. **API Publik Baca Sertifikat (Read-Only):** Penyediaan endpoint integrasi terotentikasi (`GET /api/v1/certificates` dan `GET /api/v1/certificates/{identifier}`) untuk membaca daftar metadata publik serta memeriksa keabsahan aktif (*validity check*) sertifikat tanpa mengekspos private key, berkas P12, path server, maupun data pribadi NIK.

#### B. Disiapkan untuk Penguatan (In Progress / Future Phase 1 Enhancement)
1. **Two-Factor Authentication (OTP):** Arsitektur login disiapkan untuk mendukung verifikasi OTP di tahap production.
2. **Public Unauthenticated Verification Portal:** Portal publik tanpa login (misal verifikasi scan QR code oleh pihak ketiga tanpa akun) disiapkan untuk integrasi lanjutan.

#### C. Direncanakan untuk Phase 2 (Advanced Roadmap)
1. **Penandatanganan Dokumen PDF / TTE Digital:** Fitur penandatanganan PDF in-process (`POST /api/v1/signatures/sign` dan UI `/signing`) direncanakan untuk Phase 2. Kode implementasi backend (`pdf_signer.py`, `signatures.py`) dan frontend (`SigningPage.tsx`) dipertahankan sebagai modul dormant/tercadangkan, dan dinonaktifkan secara aman via HTTP 501 Not Implemented pada konfigurasi default Phase 1 (`ENABLE_PDF_SIGNING=false`).
2. Portal verifikasi publik keabsahan dokumen PDF yang telah ditandatangani.
3. Alur persetujuan dokumen bertingkat (*multi-party approval workflow*).
4. Dukungan tanda tangan batch dokumen PDF.
5. Aplikasi mobile dan arsitektur multi-tenant.

---

## 3. Roles

Terdapat tiga role:

- `SUPER_ADMIN`
- `ADMIN`
- `USER`

### Akses fitur

| Fitur | Super Admin | Admin | User |
|---|---:|---:|---:|
| Dashboard | ✓ | ✓ | ✓ |
| Pengguna | ✓ | ✓ | - |
| Generate User | ✓ | ✓ | - |
| Management Admin | ✓ | - | - |
| Audit Log | ✓ | ✓ | - |
| Baca Sertifikat (Public API) | ✓ | ✓ | ✓ |
| Penandatanganan (Phase 2) | - | Reserved (501) | Reserved (501) |
| Kelola Akun | - | - | ✓ |
| Ubah Passphrase | - | Kelola user | ✓ |
| Regenerate | Kelola user | Kelola user | - |

Authorization wajib diperiksa di backend. Frontend hanya mengatur tampilan dan navigasi berdasarkan role.

---

## 4. User Management

### Data User

Field utama:

- Name
- NIK
- Email
- Organization
- OU
- Password akun yang disimpan sebagai password hash
- Role
- Status
- Created At
- Updated At

Aturan:

- NIK tepat 16 digit numerik.
- NIK unik.
- Email valid.
- Email unik.
- Role default saat Generate User adalah `USER`.
- **Ketentuan Kredensial Pembuatan Akun:**
  - Ketika Admin membuat akun baru (baik Single Generate maupun Bulk CSV), sistem mengisi password login awal dan passphrase sertifikat awal secara otomatis menggunakan nilai dasar yang telah ditetapkan dalam dokumentasi proyek (`<DEFAULT_PASSPHRASE>`).
  - Dilarang membuat nilai default baru atau mengubah nilai yang telah disepakati bersama.
  - **Pemisahan Kredensial Tegas:** Password login akun dan passphrase sertifikat adalah dua entitas berbeda yang tidak boleh dicampuradukkan:
    - `password`: Password login akun platform, disimpan secara aman dalam bentuk hash (`password_hash`) menggunakan algoritma cryptographic hashing (bcrypt/argon2). Password plaintext tidak pernah disimpan di database.
    - `pfx_pass` / `passphrase`: Passphrase pelindung private key sertifikat P12/PFX, hanya diproses saat orkestrasi PKI Engine dan **tidak boleh disimpan** di database, audit log, frontend, maupun application log.

User dibuat melalui fitur **Generate User**, bukan melalui tombol Add User pada halaman Pengguna.

---

## 5. Generate User

### Definisi

Generate User berarti provisioning user baru sekaligus menerbitkan certificate/credential melalui PKI engine.

Nama fitur tetap **Generate User**, bukan Generate Certificate.

### Single Generate

Input:

- Name
- NIK
- Email
- Organization
- OU
- Password (Password Login Akun — default otomatis jika tidak diisi secara khusus)
- Passphrase (Passphrase Sertifikat P12 — default otomatis jika tidak diisi secara khusus)
- Confirm Passphrase

Role tidak dipilih dari form Generate dan otomatis menjadi `USER`.

Flow:

```text
Generate User (Single)
→ input form React
→ validasi input & cek DB
→ Internal PKI Adapter (pki_engine.py)
→ PKI Engine (bangkitkan_single.sh)
→ validasi hasil (.crt & .p12)
→ simpan User + Certificate di PostgreSQL
→ Audit Log
→ response 200 OK ke React
```

Generate dianggap berhasil hanya jika hasil PKI berhasil dan output certificate/P12 telah tervalidasi.

### Bulk Generate

CSV menggunakan field (7 kolom):

```text
name,nik,email,organization,ou,password,pfx_pass
```

Mapping ke existing PKI engine:

```text
name         → CN
organization → ORG
ou           → OU
email        → EMAIL
nik          → NIK
pfx_pass     → PFX_PASS (Passphrase)
```

*Catatan: `password` adalah password login akun pengguna dan disimpan dalam bentuk hash di database platform, bukan dikirim ke PKI engine.*

Flow:

```text
Upload CSV
→ Parse
→ Validate semua row
→ Preview aman tanpa secret
→ Confirm
→ Internal PKI Adapter (generate_bulk)
→ PKI Engine (bangkitkan_banyak.sh)
→ Validate output
→ Simpan hasil ke DB
→ Audit Log
```

Validasi mencakup:

- NIK 16 digit.
- Email valid.
- Duplicate NIK dalam CSV.
- Duplicate email dalam CSV.
- Duplicate terhadap database.
- Passphrase tersedia.
- Tidak menampilkan Passphrase pada preview.

CSV tidak digunakan sebagai tempat penyimpanan permanen credential.

---

## 6. Certificate Management

Data certificate utama:

- ID
- User ID
- Serial Number
- Subject
- Issuer
- SHA-256 Fingerprint
- Certificate Path
- P12 Reference
- Issued At
- Expires At
- Status
- Replaced By
- Created At
- Updated At

Status:

- `ACTIVE`
- `EXPIRED`
- `REPLACED`

Hanya satu certificate `ACTIVE` untuk setiap user.

Validity certificate adalah **730 hari / 2 tahun**.

Backend bertanggung jawab memastikan status expiration diperbarui berdasarkan `expires_at`.

---

## 7. Regenerate

Regenerate menerbitkan certificate baru untuk user yang sudah ada dengan default passphrase `<DEFAULT_PASSPHRASE>` jika tidak ditentukan secara eksplisit.

Aturan:

1. Admin wajib memverifikasi identitas dengan memasukkan password akun Admin yang sedang login melalui modal verifikasi sebelum regenerasi diproses.
2. Jika password Admin salah atau kosong, proses langsung dihentikan (`INVALID_CREDENTIALS` / `INVALID_INPUT`) tanpa menyentuh PKI Engine.
3. Certificate lama tetap `ACTIVE` selama proses belum berhasil.
4. Certificate baru harus berhasil diterbitkan dan divalidasi.
5. Setelah berhasil:
   - lama → `REPLACED`;
   - baru → `ACTIVE`.
6. Jika gagal, certificate lama tetap `ACTIVE`.
7. History certificate tetap disimpan sebagai metadata.

Regenerate tersedia untuk Super Admin dan Admin ketika mengelola user.

User tidak dapat melakukan regenerate.

---

## 8. Ubah Passphrase

Ubah Passphrase hanya mengubah passphrase PFX/P12.

Tidak menerbitkan certificate baru.

Data berikut tetap sama:

- Serial Number.
- Fingerprint.
- Issued At.
- Expires At.
- Certificate status.

Flow:

```text
Request
→ validasi akses
→ PKI Service
→ change_p12_passphrase.sh
→ validasi P12 menggunakan passphrase baru
→ success
```

Passphrase:

- tidak disimpan di database;
- tidak disimpan pada audit log;
- tidak dikembalikan ke frontend;
- tidak ditulis ke application log.

Ketentuan Pengelolaan Passphrase:

1. **Tidak Wajib pada Login Pertama:** Passphrase sertifikat **tidak wajib diganti** saat pengguna pertama kali login. Pengingat wajib pada login pertama hanya berlaku untuk password login akun.
2. **Kanal Penggantian Resmi:** Fitur penggantian passphrase tersedia melalui antarmuka pengaturan di aplikasi web (menu *Kelola Akun* untuk penggantian mandiri oleh User, atau menu *Pengguna* untuk penggantian oleh Admin).
3. **Larangan Saluran Email:**
   - Sistem dilarang mengarahkan pengguna ke halaman email untuk mengganti passphrase.
   - Sistem dilarang mengirimkan passphrase melalui email dalam bentuk apapun.
4. **Status Pemulihan Passphrase Terlupa (Open Decision):**
   - Mekanisme penanganan jika pengguna lupa passphrase sertifikat **belum ditetapkan (Keputusan Terbuka)**.
   - Tidak diperbolehkan mengarang alur pemulihan mandiri tanpa penetapan resmi (misal: apakah harus melalui alur regenerasi sertifikat baru oleh Admin atau prosedur verifikasi khusus).
5. **Integritas Arsitektur PKI:**
   - Mempertahankan arsitektur: Platform API → PKI Service (`change_p12_passphrase.sh`) → PKI Engine.
   - Tidak mengubah PKI Engine atau mekanisme teknis penggantian passphrase yang sudah berjalan.

---

## 9. Dashboard

### Admin / Super Admin

Dashboard menampilkan:

- Total User.
- Active.
- Expired.
- Sertifikat yang mendekati expiration.
- Distribusi expiration.
- Aktivitas terbaru.

Sertifikat paling dekat berakhir:

- hanya certificate yang masa berlakunya kurang dari 30 hari;
- maksimal 5 user;
- diurutkan dari yang paling dekat expired;
- menampilkan nama dan tanggal berlaku sampai;
- tidak ada tombol Regenerate;
- tidak ada tombol Detail;
- tersedia aksi Lihat Pengguna.

Distribusi:

- ≤30 hari
- 31–60 hari
- 61–90 hari

Aktivitas terbaru hanya ditampilkan pada Dashboard. Audit Log tetap menjadi fitur terpisah.

### User

Dashboard User tidak menampilkan statistik sistem.

Menampilkan:

- Sertifikat Saya.
- Status certificate.
- Berlaku sampai.
- Sisa masa berlaku.
- Data akun ringkas.
- Quick action Penandatanganan.

---

## 10. Management Admin

Management Admin hanya tersedia untuk Super Admin.

### Tambah Admin

Super Admin memilih user yang saat ini bukan Admin, kemudian mengubah role menjadi `ADMIN`.

### Hapus Admin

Menghapus status Admin dengan mengubah:

```text
ADMIN → USER
```

Data user tidak dihapus.

Audit dicatat untuk perubahan role.

---

## 11. Authentication & Pengelolaan Password

### Alur Autentikasi Dasar

#### Development
```text
Email + Password
→ Validasi Kredensial (password_hash)
→ Terbitkan JWT Bearer Token
→ Cek Status Password Awal
→ Dashboard
```

OTP tidak digunakan pada development/testing.

#### Production
```text
Email + Password
→ OTP
→ Dashboard
```

Struktur authentication memungkinkan OTP ditambahkan kemudian tanpa perubahan arsitektur dasar.

### Pop-up Pengingat Wajib Ganti Password

Sistem menerapkan mekanisme pengingat bagi akun yang masih menggunakan password awal:

1. **Pemicu Pop-up:** Ketika pengguna berhasil login menggunakan password login awal (nilai dasar default) yang belum pernah diganti, sistem secara otomatis menampilkan modal pop-up yang meminta pengguna untuk mengganti password akunnya.
2. **Pengingat Wajib, Bukan Pembatasan Akses (Non-Blocking):**
   - Pop-up ini berstatus sebagai **pengingat wajib (mandatory reminder)** dan secara eksplisit **bukan pembatasan akses (access blocking)**.
   - Pengguna memiliki opsi untuk **menutup pop-up** (tombol Tutup / Nanti Saja) dan **tetap dapat mengakses dashboard serta seluruh fitur aplikasi** sesuai dengan role dan izin aksesnya.
   - Sistem **dilarang memblokir** akses navigasi, dashboard, atau modul operasional lainnya hanya karena pengguna belum mengganti password awal.
3. **Persistensi Status Kewajiban:**
   - Menutup pop-up **tidak mengubah status** password awal menjadi sudah diganti. Status akun tetap tercatat sebagai akun dengan password awal yang belum diganti.
   - Pada sesi login berikutnya, pop-up pengingat wajib ini **akan selalu ditampilkan kembali** selama pengguna belum melakukan penggantian password.
4. **Penyelesaian Kewajiban:**
   - Setelah pengguna berhasil mengganti password (baik melalui modal pop-up tersebut maupun melalui halaman *Kelola Akun*), status wajib ganti password dihapus dan pop-up tidak lagi ditampilkan untuk kewajiban tersebut.

### Penggantian Password Akun (Self-Service)

- Pengguna dapat mengganti password login akun secara mandiri kapan saja melalui halaman pengaturan (*Kelola Akun* / `/account`).
- **Kebijakan Validasi Password:**
  - Panjang minimal 8 karakter;
  - Mengandung minimal 1 huruf besar (uppercase `A-Z`);
  - Mengandung minimal 1 karakter simbol atau non-alphanumeric;
  - Password baru tidak boleh sama dengan password lama;
  - Konfirmasi password baru harus identik.
- Password lama wajib diverifikasi terhadap `password_hash` sebelum password baru di-hash dan disimpan.

### Lupa Password dan Reset Password

1. **Mekanisme Tautan Reset:** Fitur lupa password dirancang menggunakan tautan reset khusus berbasis **token sekali pakai (single-use token)** yang memiliki **masa berlaku (expiration)**.
2. **Status Keputusan Terbuka (Open Decision):**
   - Durasi masa berlaku token reset (misalnya 15 menit, 1 jam, atau 24 jam) dan detail teknis token (panjang karakter, skema hashing token di database) **belum ditetapkan dalam dokumentasi proyek**.
   - Hal ini dicatat sebagai **keputusan yang masih perlu ditetapkan** sebelum implementasi kode.
3. **Status Integrasi Email (Belum Diimplementasikan):**
   - Pengiriman tautan reset dan notifikasi melalui email **belum diimplementasikan dalam fase ini**.
   - Tidak diperkenankan membuat integrasi SMTP, Google API, Microsoft Graph, atau penyedia email lainnya pada tahap ini.
4. **Keamanan Transmisi:**
   - Dilarang mengirimkan password baru atau password sementara dalam bentuk teks biasa (plaintext) melalui email atau saluran komunikasi eksternal apapun.

---

## 12. Audit Log

Audit Log dikelola backend.

Contoh action:

- `LOGIN`
- `USER_CREATED`
- `USER_DELETED`
- `ADMIN_ASSIGNED`
- `ADMIN_REMOVED`
- `CERTIFICATE_GENERATED`
- `CERTIFICATE_REGENERATED`
- `PFX_PASSWORD_CHANGED`

Audit menyimpan:

- actor/user ID jika tersedia;
- action;
- target type;
- target ID;
- status;
- created at.

Audit tidak boleh menyimpan:

- password;
- OTP;
- Passphrase;
- private key;
- PFX/P12;
- service token;
- credential PKI.

Audit log tetap dipertahankan ketika user dihapus.

---

## 13. Account Management

User dapat mengelola akun sendiri melalui **Kelola Akun**.

Data yang dapat ditampilkan/diperbarui mengikuti kebutuhan aplikasi, termasuk:

- Name
- NIK
- Email
- Organization
- OU

Fitur Ubah Passphrase tersedia di bagian Kelola Akun untuk User.

---

## 14. System Architecture

Arsitektur utama:

```text
Frontend
    ↓
Platform API
    ↓
PostgreSQL

Platform API
    ↓
PKI Service
    ↓
Existing PKI Engine
```

PKI Service menjadi satu-satunya komponen yang menjalankan script PKI.

Platform API tidak menjalankan Bash PKI secara langsung.

Existing PKI engine tetap menjadi engine penerbitan certificate.

---

## 15. Existing PKI Engine

Script yang menjadi adapter target:

- `bangkitkan_single.sh`
- `bangkitkan_banyak.sh`
- `change_p12_passphrase.sh`

Platform tidak mengandalkan default credential dari script.

PKI Service harus:

1. menyiapkan input;
2. menjalankan script;
3. memeriksa exit code;
4. menemukan output;
5. memvalidasi certificate;
6. mengekstrak metadata;
7. memvalidasi P12/PFX;
8. mengembalikan metadata tanpa secret.

---

## 16. API Scope

Endpoint utama:

### Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/verify-password
POST /api/v1/auth/forgot-password (Usulan / Belum Diimplementasikan)
POST /api/v1/auth/reset-password  (Usulan / Belum Diimplementasikan)
```

### Dashboard

```text
GET /api/v1/dashboard
```

### Users

```text
GET    /api/v1/users
GET    /api/v1/users/{user_id}
POST   /api/v1/users/generate
POST   /api/v1/users/generate-bulk/validate
POST   /api/v1/users/generate-bulk
GET    /api/v1/users/{user_id}/certificates
POST   /api/v1/users/{user_id}/certificates/regenerate
POST   /api/v1/users/{user_id}/pfx-password
DELETE /api/v1/users/{user_id}
```

### Admin

```text
GET    /api/v1/admins
GET    /api/v1/admins/candidates
POST   /api/v1/admins/{user_id}
DELETE /api/v1/admins/{user_id}
```

### Account

```text
GET   /api/v1/account
PATCH /api/v1/account
POST  /api/v1/account/password     (Ganti password login akun mandiri)
POST  /api/v1/account/pfx-password (Ganti passphrase P12/PFX mandiri)
```

### Audit

```text
GET /api/v1/audit-logs
```

### Signing (Phase 2 Roadmap)

```text
POST /api/v1/signatures        (Reserved / 501 Not Implemented)
POST /api/v1/signatures/sign   (Phase 2 / 501 Not Implemented pada Phase 1)
```

Seluruh route pada prefix `/api/v1/signatures` dinonaktifkan secara aman pada Phase 1 dan mengembalikan `501 Not Implemented` (`code: FEATURE_DISABLED_PHASE_1` atau `code: RESERVED_ENDPOINT`). Modul implementasi backend (`pdf_signer.py`, `signatures.py`) disimpan dalam kondisi dormant dan dapat diaktifkan kembali pada Phase 2 melalui environment variable `ENABLE_PDF_SIGNING=true`. Detail request/response API dijelaskan pada `API.md`.

---

## 17. Database Rules

Database menggunakan PostgreSQL.

Tabel utama:

- `users`
- `certificates`
- `audit_logs`

Aturan penting:

- NIK unik.
- Email unik.
- Serial certificate unik.
- Fingerprint unik.
- Satu ACTIVE certificate per user.
- Certificate terkait user.
- Audit actor menggunakan relasi yang tetap mempertahankan audit ketika user dihapus.
- Tidak menyimpan Passphrase/private key/PFX sebagai data aplikasi.

Detail schema dan constraint ada pada `DATABASE.md`.

---

## 18. Security Requirements

### Secrets

Secret harus berasal dari environment/configuration yang aman.

Contoh:

```text
DATABASE_URL
SECRET_KEY
PKI_ENGINE_DIR
P12_ARCHIVE_DIR
PKI_TIMEOUT
```

Tidak boleh hardcode secret di source code.

### Passphrase & Password Security

- **Pemisahan Kredensial:** Password login akun dan passphrase sertifikat dipisahkan secara ketat.
- **Password Login Akun:** Wajib disimpan dalam bentuk hash kriptografis yang aman (`password_hash`). Plaintext tidak pernah disimpan di database, audit log, maupun respons API.
- **Passphrase P12/PFX:** Hanya digunakan selama proses orkestrasi internal PKI Engine yang membutuhkan kredensial tersebut. Default credential (seperti login password / passphrase sertifikat provisioning atau regenerate) menggunakan nilai standar default sistem (`<DEFAULT_PASSPHRASE>`).
  Tidak boleh:
  - masuk database;
  - masuk audit log;
  - masuk response API;
  - masuk application log;
  - masuk Git.
- **Larangan Pengiriman Plaintext via Email:** Dilarang keras mengirimkan password login (baru/sementara) atau passphrase P12/PFX sebagai teks biasa (plaintext) melalui email atau media transmisi publik lainnya.

### Authorization

Semua endpoint sensitif wajib melakukan pengecekan role di backend.

### PKI Boundary

Private key, CA key, CA password, P12/PFX dan credential internal PKI berada di boundary PKI dan tidak menjadi data frontend.

Detail arsitektur dan security boundary dirujuk ke `ARCHITECTURE.md`.

---

## 19. Error Handling

Error internal PKI tidak langsung diteruskan ke frontend.

Kode error utama:

```text
INVALID_INPUT
INVALID_NIK
INVALID_EMAIL
CERTIFICATE_ALREADY_EXISTS
P12_NOT_FOUND
PKI_GENERATION_FAILED
PKI_VALIDATION_FAILED
P12_VALIDATION_FAILED
PKI_TIMEOUT
PKI_SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

HTTP status:

```text
400 → invalid input
409 → conflict
502 → PKI failure
500 → internal error
```

---

## 20. Transaction Rules

Single Generate:

```text
Validate
→ PKI Generate
→ Validate Output
→ Database Transaction
   → User
   → Certificate
   → Audit
→ Commit
```

Jika PKI gagal, user dan certificate tidak dibuat.

Regenerate:

```text
Generate new
→ Validate new
→ New ACTIVE
→ Old REPLACED
```

Certificate lama tidak diubah sebelum certificate baru berhasil divalidasi.

Bulk generation harus menyimpan hasil berdasarkan keberhasilan setiap row. Tidak dilakukan rollback CA secara sembarangan.

---

## 21. Design Direction

Antarmuka harus sederhana, administratif, dan berorientasi pada pengelolaan data.

Struktur utama:

```text
Sidebar (Mode Admin - Default)
├── Dashboard Admin
├── Pengguna               [Super Admin/Admin]
├── Generate               [Super Admin/Admin]
├── Management Admin       [Super Admin]
├── Audit Log              [Super Admin/Admin]
├── Kelola Akun Saya       [Khusus Super Admin]
└── [Kontrol: Beralih ke Mode Pengguna - Khusus Admin]

Sidebar (Mode Pengguna - User & Admin yang Beralih)
├── Dashboard User
├── Penandatanganan (TTE)  [User / Admin dalam Mode Pengguna]
├── Kelola Akun Saya       [User / Admin dalam Mode Pengguna]
└── [Kontrol: Kembali ke Mode Admin - Khusus Admin]
```

Catatan: Pada Phase 1, fitur Penandatanganan Dokumen (TTE) dinonaktifkan dari antarmuka pengguna (sidebar dan dashboard) serta endpoint backend dibatasi (501 Not Implemented). Navigasi pengguna difokuskan pada Dashboard dan Kelola Akun.

Detail halaman, komponen, state, dan user flow dirujuk ke `DESIGN.md`.

---

## 22. Phase 2

Phase 2 berfokus pada pengembangan fitur penandatanganan dokumen dan integrasi ekosistem:

- Penandatanganan dokumen PDF digital (TTE) tunggal dan massal via web interface (`POST /api/v1/signatures/sign` dan halaman `SigningPage.tsx`).
- Portal verifikasi publik keabsahan dokumen PDF yang telah ditandatangani.
- Alur persetujuan dokumen bertingkat (*multi-party document approval workflow*).
- Penandatanganan batch dokumen PDF (*bulk PDF signing*).
- Aplikasi mobile client dan dukungan multi-tenant.

Catatan: Fondasi implementasi penandatanganan PDF tunggal (`pdf_signer.py` berbasis pyHanko & cryptography) dan endpoint `POST /api/v1/signatures/sign` telah dibangun dan disimpan secara aman dalam codebase sebagai fitur dormant. Pada Phase 1, fitur ini dinonaktifkan secara default (`ENABLE_PDF_SIGNING=false`) dan siap diaktifkan kembali saat memasuki Phase 2.

---

## 23. Non-Goals

Platform tidak ditujukan untuk:

- membuat CA baru;
- mengganti OpenSSL;
- menulis ulang engine PKI;
- menyimpan private key di database;
- menjadi storage permanen PFX;
- menjadi aplikasi approval workflow;
- menjadi platform multi-tenant;
- menjadi aplikasi mobile;
- membangun microservices yang tidak diperlukan.

---

## 24. Source of Truth

Jika terdapat perbedaan detail antar dokumen:

1. `SPECIFICATION.md` menjadi acuan kebutuhan produk dan business rules.
2. `DATABASE.md` menjadi acuan schema database.
3. `ARCHITECTURE.md` menjadi acuan struktur dan batas komponen.
4. `API.md` menjadi acuan kontrak endpoint.
5. `DESIGN.md` menjadi acuan UI/UX dan alur antarmuka.
6. `README.md` menjadi acuan setup dan penggunaan project.

Setiap perubahan requirement harus diperbarui pada dokumen yang relevan agar dokumentasi tetap konsisten.

---

## 25. Prinsip Implementasi

1. Implementasi mengikuti specification sebelum menambah fitur baru.
2. Jangan membuat tabel, endpoint, role, atau service tambahan tanpa kebutuhan yang jelas.
3. Jangan mengubah PKI engine tanpa alasan teknis yang terverifikasi.
4. Backend menjadi sumber kebenaran untuk business rule dan authorization.
5. Frontend tidak boleh dipercaya untuk security enforcement.
6. Credential sensitif tidak boleh dipersistenkan sebagai plaintext.
7. Prioritaskan alur sederhana dan dapat diuji.
8. Phase 1 harus selesai dan stabil sebelum fungsi Phase 2 diaktifkan.
