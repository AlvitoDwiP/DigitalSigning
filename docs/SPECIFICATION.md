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

## 2. Scope Phase 1

### Termasuk

1. Authentication.
2. Role Based Access Control.
3. Dashboard.
4. User Management.
5. Generate User single.
6. Generate User bulk melalui CSV.
7. Certificate metadata management.
8. Regenerate certificate.
9. Ubah Passphrase.
10. Management Admin.
11. Audit Log.
12. Kelola Akun.
13. Platform API.
14. Integrasi dengan PKI Service.

### Tidak termasuk

1. Upload PDF untuk signing.
2. PDF signing aktif.
3. QR signature.
4. Signature appearance.
5. Upload gambar tanda tangan/stempel.
6. Verification portal.
7. Approval workflow.
8. Mobile application.
9. Multi-tenant.
10. Rewriting PKI/CA engine.
11. Integrasi aktif dengan existing sign-api untuk proses PDF signing.

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
| Penandatanganan | - | ✓ | ✓ |
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
- Password login tidak disimpan sebagai plaintext.

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
- Password (Password Login Akun)
- Passphrase
- Confirm Passphrase

Role tidak dipilih dari form Generate dan otomatis menjadi `USER`.

Flow:

```text
Generate User
→ input
→ validasi
→ PKI Service
→ PKI Engine
→ validasi hasil
→ simpan User + Certificate
→ Audit
→ selesai
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
→ Preview
→ Confirm
→ Generate
→ Validate output
→ Simpan hasil
→ Audit
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
- `REVOKED`

Hanya satu certificate `ACTIVE` untuk setiap user.

Validity certificate adalah **730 hari / 2 tahun**.

Backend bertanggung jawab memastikan status expiration diperbarui berdasarkan `expires_at`.

---

## 7. Regenerate

Regenerate menerbitkan certificate baru untuk user yang sudah ada dengan default passphrase `Mkri006!`.

Aturan:

1. Certificate lama tetap `ACTIVE` selama proses belum berhasil.
2. Certificate baru harus berhasil diterbitkan dan divalidasi.
3. Setelah berhasil:
   - lama → `REPLACED`;
   - baru → `ACTIVE`.
4. Jika gagal, certificate lama tetap `ACTIVE`.
5. History certificate tetap disimpan sebagai metadata.

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

## 11. Authentication

### Development

```text
Email + Password
→ Dashboard
```

OTP tidak digunakan pada development/testing.

### Production

```text
Email + Password
→ OTP
→ Dashboard
```

Struktur authentication harus memungkinkan OTP ditambahkan kemudian tanpa perubahan besar pada arsitektur.

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
POST  /api/v1/account/pfx-password
```

### Audit

```text
GET /api/v1/audit-logs
```

### Signing

```text
POST /api/v1/signatures
```

Pada Phase 1 endpoint signing disediakan sebagai route yang belum diimplementasikan dan dapat mengembalikan `501 Not Implemented`.

Detail request/response API menjadi tanggung jawab `API.md`.

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
PKI_SERVICE_URL
PKI_SERVICE_TOKEN
PKI_TIMEOUT
```

Tidak boleh hardcode secret di source code.

### Passphrase

Passphrase hanya digunakan selama proses yang membutuhkan credential tersebut. Default credential (seperti login password / passphrase sertifikat provisioning atau regenerate) menggunakan `Mkri006!`.

Tidak boleh:

- masuk database;
- masuk audit;
- masuk response;
- masuk log;
- masuk Git.

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
Sidebar
├── Dashboard
├── Pengguna
├── Generate
├── Management Admin      [Super Admin]
├── Audit Log             [Super Admin/Admin]
├── Penandatanganan       [Admin/User]
└── Kelola Akun            [User]
```

Detail halaman, komponen, state, dan user flow dirujuk ke `DESIGN.md`.

---

## 22. Phase 2

Phase 2 mengembangkan fungsi:

- Upload PDF.
- Signing.
- Signed PDF.
- Verification.
- Signature appearance.
- QR/signature visual.
- Integrasi existing sign-api.

Existing `sign-api(well3)` menjadi kandidat engine signing karena sudah memiliki endpoint `/sign`.

Phase 2 tidak mengubah prinsip provisioning certificate pada Phase 1.

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
