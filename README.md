# Digital Signature Platform

## 1. Overview

Digital Signature Platform adalah aplikasi web untuk pengelolaan user dan credential digital signature melalui PKI engine yang sudah tersedia.

Phase 1 berfokus pada:

- authentication;
- role management;
- user management;
- Generate User;
- bulk Generate User;
- certificate management;
- regenerate;
- Ubah Password PFX;
- audit;
- API.

PDF signing disiapkan untuk Phase 2.

---

## 2. Architecture

```text
Frontend
    |
    v
Platform API
    |
    +------> PostgreSQL
    |
    v
PKI Service
    |
    v
Existing PKI Engine
```

PKI Service menjadi adapter/orchestrator terhadap script PKI yang sudah tersedia.

Platform tidak menulis ulang engine PKI.

---

## 3. Roles

Terdapat tiga role:

- `SUPER_ADMIN`
- `ADMIN`
- `USER`

Ringkasan:

| Fitur | Super Admin | Admin | User |
|---|---:|---:|---:|
| Dashboard | ✓ | ✓ | ✓ |
| Pengguna | ✓ | ✓ | - |
| Generate | ✓ | ✓ | - |
| Management Admin | ✓ | - | - |
| Audit Log | ✓ | ✓ | - |
| Penandatanganan | - | ✓ | ✓ |
| Kelola Akun | - | - | ✓ |

Detail permission ada di `SPECIFICATION.md`.

---

## 4. Repository Structure

Struktur target:

```text
digital-signature-platform/
├── frontend/
├── backend/
├── pki-service/
├── docs/
├── docker/
├── .env.example
├── .gitignore
└── README.md
```

Dokumentasi:

```text
docs/
├── DATABASE.md
├── ARCHITECTURE.md
├── API.md
├── DESIGN.md
└── SPECIFICATION.md
```

---

## 5. Documentation

### `SPECIFICATION.md`

Master specification dan source of truth kebutuhan produk.

### `DATABASE.md`

Struktur PostgreSQL, tabel, relasi, constraint, index, dan lifecycle data.

### `ARCHITECTURE.md`

Arsitektur komponen dan batas tanggung jawab Frontend, Platform API, PKI Service, PostgreSQL, dan existing PKI engine.

### `API.md`

Kontrak endpoint, request, response, authorization, dan error.

### `DESIGN.md`

Rancangan antarmuka dan user flow. Dokumen ini dikelola terpisah sebagai acuan design.

---

## 6. Technology Direction

### Backend

- Python
- FastAPI
- PostgreSQL
- Alembic

### Frontend

Framework frontend mengikuti implementasi yang dipilih pada tahap development.

### PKI

Menggunakan existing PKI engine:

```text
bangkitkan_single.sh
bangkitkan_banyak.sh
change_p12_passphrase.sh
```

### Container

Phase 1 menggunakan Docker untuk komponen aplikasi utama.

---

## 7. Environment

Contoh konfigurasi:

```env
DATABASE_URL=
SECRET_KEY=
PKI_SERVICE_URL=
PKI_SERVICE_TOKEN=
PKI_TIMEOUT=
```

Secret asli tidak boleh dimasukkan ke repository.

Gunakan `.env` lokal untuk development dan `.env.example` sebagai template.

---

## 8. Development Flow

Urutan implementasi yang direkomendasikan:

```text
1. Database
2. Backend foundation
3. Authentication
4. RBAC
5. User management
6. PKI Service
7. Generate User single
8. Bulk Generate
9. Certificate management
10. Regenerate
11. Ubah Password PFX
12. Dashboard
13. Audit Log
14. Frontend integration
15. Testing
```

Jangan mengaktifkan PDF signing sebelum Phase 1 stabil.

---

## 9. Generate User

Generate User berarti membuat user baru sekaligus melakukan provisioning certificate melalui PKI engine.

Single:

```text
Frontend
→ Platform API
→ PKI Service
→ bangkitkan_single.sh
→ validate output
→ save metadata
→ audit
```

Bulk:

```text
CSV
→ validate
→ preview
→ confirm
→ PKI Service
→ bangkitkan_banyak.sh
→ validate
→ save result
→ audit
```

---

## 10. Certificate

Validity:

```text
730 hari / 2 tahun
```

Status:

```text
ACTIVE
EXPIRED
REPLACED
REVOKED
```

Hanya satu certificate yang boleh `ACTIVE` untuk satu user.

Regenerate tidak mengubah certificate lama sampai certificate baru berhasil dibuat dan divalidasi.

---

## 11. Security

Jangan menyimpan:

- PFX Password;
- private key;
- PFX/P12;
- CA password;
- service token;

di database aplikasi atau Git.

Jangan menampilkan credential sensitif pada frontend.

Jangan mengembalikan raw OpenSSL error ke client.

---

## 12. Running the Project

Detail command final bergantung pada implementasi repository.

Target development menggunakan Docker untuk application services.

Contoh:

```bash
cp .env.example .env
```

Kemudian jalankan service melalui Docker Compose setelah konfigurasi environment tersedia.

Command final sebaiknya diperbarui ketika Docker Compose dan struktur source code sudah dibuat.

---

## 13. Testing

Minimum testing:

### Authentication
- login berhasil;
- login gagal;
- logout;
- authorization.

### User
- validasi NIK;
- validasi email;
- duplicate user;
- generate single;
- bulk validation;
- bulk generation.

### Certificate
- generation;
- expiration;
- regenerate;
- hanya satu ACTIVE certificate.

### PFX
- perubahan password berhasil;
- password baru dapat membuka P12;
- password tidak muncul di log/response.

### RBAC
- Super Admin;
- Admin;
- User;
- akses endpoint tanpa permission harus ditolak.

### Audit
- aktivitas penting menghasilkan audit;
- secret tidak masuk audit.

---

## 14. Phase 1 vs Phase 2

### Phase 1

Fokus pada provisioning dan management:

```text
Authentication
User
Certificate
PKI
PFX
Audit
Dashboard
API
```

### Phase 2

Fokus pada signing:

```text
Upload PDF
→ Sign
→ Signed PDF
→ Verification
```

Existing `sign-api(well3)` dapat digunakan sebagai signing engine pada Phase 2 setelah kontrak integrasinya ditentukan.

---

## 15. Important Rules

1. Jangan membuat PKI engine baru jika existing engine masih digunakan.
2. Jangan menjalankan Bash PKI langsung dari Platform API.
3. Gunakan PKI Service sebagai adapter.
4. Jangan menyimpan Password PFX.
5. Jangan menyimpan private key pada database.
6. Backend menjadi sumber kebenaran authorization.
7. Frontend tidak menjadi security boundary.
8. Jangan mengaktifkan fitur Phase 2 sebelum Phase 1 selesai.
9. Jangan menambah service/tabel/role tanpa kebutuhan yang jelas.
10. Selalu perbarui dokumentasi ketika requirement berubah.

---

## 16. Source of Truth

Untuk implementasi, gunakan urutan referensi:

```text
SPECIFICATION.md
      ↓
ARCHITECTURE.md
      ↓
DATABASE.md
      ↓
API.md
      ↓
DESIGN.md
      ↓
Source Code
```

Jika requirement berubah, dokumentasi harus diperbarui sebelum implementasi perubahan tersebut.
