# API

## 1. Overview

API ini merupakan kontrak HTTP untuk Digital Signature Platform Phase 1.

Base path:

```text
/api/v1
```

Format request/response utama menggunakan JSON, kecuali upload CSV.

Authentication menggunakan token/session sesuai implementasi backend. Endpoint yang membutuhkan authorization wajib melakukan pemeriksaan role di backend.

---

## 2. Standard Response

### Success

Response mengikuti kebutuhan masing-masing endpoint. Contoh:

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Input tidak valid"
  }
}
```

Raw error dari OpenSSL, path internal server, private key, password, atau credential tidak boleh dikembalikan ke frontend.

---

# 3. Authentication

## POST `/api/v1/auth/login`

Login menggunakan email dan password.

### Request

```json
{
  "email": "user@mkri.go.id",
  "password": "********"
}
```

### Development

```text
Email + Password → Dashboard
```

### Production

```text
Email + Password → OTP → Dashboard
```

### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Budi Santoso",
      "email": "user@mkri.go.id",
      "role": "USER"
    },
    "token": "..."
  }
}
```

Password tidak pernah dikembalikan.

---

## POST `/api/v1/auth/logout`

Mengakhiri session/token pengguna.

### Response

```json
{
  "success": true,
  "message": "Logout berhasil"
}
```

---

## GET `/api/v1/auth/me`

Mengambil informasi user yang sedang login.

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Budi Santoso",
    "nik": "327xxxxxxxxxxxxx",
    "email": "user@mkri.go.id",
    "organization": "Mahkamah Konstitusi Republik Indonesia",
    "ou": "TTE",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

---

## POST `/api/v1/auth/verify-password`

Memverifikasi password akun pengguna yang sedang terotentikasi (Bearer Token). Digunakan sebagai konfirmasi keamanan sebelum beralih ke Mode Admin.

### Request Body

```json
{
  "password": "Password123!"
}
```

### Response Success (200 OK)

```json
{
  "success": true,
  "message": "Password berhasil diverifikasi."
}
```

### Response Error (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Password akun salah. Masukkan password yang benar."
  }
}
```

---

# 4. Dashboard

## GET `/api/v1/dashboard`

Mengembalikan data dashboard berdasarkan role dan mode tampilan.

### Query Parameters

| Parameter | Type | Required | Default | Deskripsi |
|---|---|---|---|---|
| `mode` | `string` | Tidak | Sesuai role | Mode tampilan: `'admin'` atau `'user'`. Digunakan oleh role `ADMIN` untuk beralih ke Mode Pengguna. |

**Aturan Otorisasi Mode:**
- Role `ADMIN` tanpa query `mode` atau `mode=admin`: Mengembalikan data dashboard Admin.
- Role `ADMIN` dengan `mode=user`: Mengembalikan data personal user dashboard milik akun Admin yang sedang login (`has_active_certificate`, `user`, `active_certificate`).
- Role `SUPER_ADMIN` dengan `mode=user`: Ditolak `403 Forbidden` (`SUPER_ADMIN` tidak diizinkan masuk Mode Pengguna / TTE).
- Role `USER` dengan `mode=admin`: Ditolak `403 Forbidden` (`USER` tidak diizinkan mengakses data dashboard Admin).
- Nilai `mode` selain `'admin'` atau `'user'`: Ditolak `400 Bad Request`.

### Admin / Super Admin (Mode Admin)

Data utama:

- total user;
- active;
- expired;
- certificate yang akan berakhir;
- expiry buckets;
- aktivitas terbaru.

### User / Admin (Mode Pengguna)

Data utama:

- certificate milik user / admin;
- status;
- expires_at;
- sisa masa berlaku;
- data akun ringkas.

### Response Admin

```json
{
  "success": true,
  "data": {
    "statistics": {
      "total_user": 100,
      "active": 90,
      "expired": 10
    },
    "expiring_certificates": [
      {
        "user_id": 1,
        "name": "Budi Santoso",
        "expires_at": "2026-10-20T00:00:00"
      }
    ],
    "expiry_buckets": {
      "within_30_days": 3,
      "31_to_60_days": 5,
      "61_to_90_days": 8
    },
    "recent_activities": []
  }
}
```

`expiring_certificates` maksimal 5 user dan hanya certificate yang masa berlakunya kurang dari 30 hari.

### Response Mode Pengguna (User / Admin in User Mode)

```json
{
  "success": true,
  "data": {
    "has_active_certificate": true,
    "user": {
      "id": "20387e9d-...",
      "name": "Administrator",
      "nik": "1234567890123456",
      "email": "admin@mkri.go.id",
      "organization": "Mahkamah Konstitusi",
      "ou": "Pusat TI",
      "role": "ADMIN",
      "status": "ACTIVE"
    },
    "active_certificate": {
      "id": "c1f7a...",
      "serial_number": "...",
      "status": "ACTIVE",
      "issued_at": "2026-10-01T00:00:00Z",
      "expires_at": "2028-10-01T00:00:00Z"
    }
  }
}
```

---

# 5. Users

## GET `/api/v1/users`

Mengambil daftar user.

### Query parameter

```text
search
role
status
certificate_status
sort
order
page
skip
limit
```

Contoh:

```text
GET /api/v1/users?search=Budi&sort=nearest_expiry&order=asc&page=1&limit=20
```

### Response

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

---

## GET `/api/v1/users/{user_id}`

Mengambil detail user.

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Budi Santoso",
    "nik": "327xxxxxxxxxxxxx",
    "email": "user@mkri.go.id",
    "organization": "Mahkamah Konstitusi Republik Indonesia",
    "ou": "TTE",
    "role": "USER",
    "status": "ACTIVE",
    "active_certificate": {},
    "certificate_history": []
  }
}
```

---

# 6. Generate User

## POST `/api/v1/users/generate`

Membuat user baru sekaligus melakukan provisioning certificate melalui PKI Service.

### Role

- Super Admin
- Admin

### Request

```json
{
  "name": "Budi Santoso",
  "nik": "327xxxxxxxxxxxxx",
  "email": "budi@mkri.go.id",
  "organization": "Mahkamah Konstitusi Republik Indonesia",
  "ou": "TTE",
  "password": "Password123!",
  "pfx_password": "********",
  "confirm_pfx_password": "********"
}
```

### Validasi

- NIK tepat 16 digit;
- NIK unik;
- email valid;
- email unik;
- field wajib tersedia;
- Password login akun memenuhi kebijakan keamanan (min. 8 karakter, 1 huruf besar, 1 simbol/non-alphanumeric);
- Passphrase tersedia;
- confirm Passphrase sesuai.

Role otomatis:

```text
USER
```

### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Budi Santoso",
      "email": "budi@mkri.go.id",
      "role": "USER"
    },
    "certificate": {
      "id": 1,
      "serial_number": "...",
      "subject": "...",
      "issuer": "...",
      "fingerprint_sha256": "...",
      "issued_at": "...",
      "expires_at": "...",
      "status": "ACTIVE"
    }
  }
}
```

Passphrase dan password login plaintext tidak boleh dikembalikan. Default credential jika menggunakan nilai default sistem adalah `<DEFAULT_PASSPHRASE>`.

---

# 7. Bulk Generate User

## POST `/api/v1/users/generate-bulk/validate`

Validasi CSV sebelum generation.

### Request

Multipart form-data:

```text
file: users.csv
```

Format CSV (7 kolom):

```csv
name,nik,email,organization,ou,password,pfx_pass
Budi Santoso,327xxxxxxxxxxxxx,budi@mkri.go.id,Mahkamah Konstitusi Republik Indonesia,TTE,Password123!,pfxpass123
```

### Validasi

- format CSV;
- kolom wajib;
- NIK 16 digit;
- duplicate NIK;
- duplicate email;
- duplicate terhadap database;
- email valid;
- Password login akun memenuhi kebijakan keamanan;
- Passphrase tersedia.

### Response

```json
{
  "success": true,
  "data": {
    "total_rows": 2,
    "valid_rows": 2,
    "invalid_rows": 0,
    "rows": [
      {
        "row": 2,
        "name": "Budi Santoso",
        "nik": "327xxxxxxxxxxxxx",
        "email": "budi@mkri.go.id",
        "status": "VALID"
      }
    ]
  }
}
```

Passphrase tidak ditampilkan pada preview.

---

## POST `/api/v1/users/generate-bulk`

Menjalankan bulk provisioning setelah CSV lolos validasi.

### Request

Multipart form-data:

```text
file: users.csv
```

### Response

```json
{
  "success": true,
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "results": [
      {
        "row": 2,
        "nik": "327xxxxxxxxxxxxx",
        "status": "SUCCESS"
      }
    ]
  }
}
```

Hasil harus menunjukkan status per row.

---

# 8. Certificate

## GET `/api/v1/users/{user_id}/certificates`

Mengambil history certificate user.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "serial_number": "...",
      "fingerprint_sha256": "...",
      "issued_at": "...",
      "expires_at": "...",
      "status": "ACTIVE"
    }
  ]
}
```

Passphrase dan private key tidak pernah dikembalikan.

---

## POST `/api/v1/users/{user_id}/certificates/regenerate`

Menerbitkan certificate baru dengan default passphrase `<DEFAULT_PASSPHRASE>` jika tidak disediakan.

### Role

- Super Admin
- Admin

### Request

Body JSON:
```json
{
  "admin_password": "password_akun_admin_yang_sedang_login",
  "password": "opsional_passphrase_sertifikat_baru"
}
```

- `admin_password` (string, wajib): Password akun Admin/Super Admin yang sedang login untuk verifikasi identitas otorisasi sebelum regenerasi diproses.
- `password` (string, opsional): Passphrase baru untuk private key P12/PFX sertifikat (default sistem jika dikosongkan).

### Flow

```text
Generate new certificate
→ Validate
→ new = ACTIVE
→ old = REPLACED
```

Jika gagal:

```text
old = ACTIVE
```

### Response

```json
{
  "success": true,
  "data": {
    "old_certificate_id": 1,
    "new_certificate": {
      "id": 2,
      "serial_number": "...",
      "issued_at": "...",
      "expires_at": "...",
      "status": "ACTIVE"
    }
  }
}
```

---

# 9. Ubah Passphrase

## POST `/api/v1/users/{user_id}/pfx-password`

Mengubah Passphrase PFX/P12 user.

### Role

- Super Admin
- Admin
- User untuk akun sendiri.

### Request

```json
{
  "new_password": "********",
  "confirm_password": "********"
}
```

### Response

```json
{
  "success": true,
  "message": "Passphrase berhasil diubah"
}
```

Passphrase tidak disimpan dan tidak dikembalikan.

---

# 10. Delete User

## DELETE `/api/v1/users/{user_id}`

Menghapus user dari platform.

### Role

- Super Admin
- Admin

### Rules

Penghapusan harus:
- menghapus user dari database;
- menghapus certificate metadata sesuai aturan database;
- menghapus operational material sesuai implementasi PKI;
- mempertahankan audit log.

CA internal state tidak boleh dihapus secara sembarangan.

### Response

```json
{
  "success": true,
  "message": "User berhasil dihapus"
}
```

---

# 11. Management Admin

## GET `/api/v1/admins`

Mengambil daftar Admin.

### Role

- Super Admin

---

## GET `/api/v1/admins/candidates`

Mengambil user yang dapat dijadikan Admin.

Candidate adalah user yang belum memiliki role `ADMIN`.

### Role

- Super Admin

---

## POST `/api/v1/admins/{user_id}`

Mengubah role:

```text
USER → ADMIN
```

### Role

- Super Admin

### Response

```json
{
  "success": true,
  "message": "User berhasil ditetapkan sebagai Admin"
}
```

---

## DELETE `/api/v1/admins/{user_id}`

Menghapus role Admin:

```text
ADMIN → USER
```

User tidak dihapus.

### Role

- Super Admin

---

# 12. Account

## GET `/api/v1/account`

Mengambil akun user yang sedang login.

### Role

- User

### Response

Mengikuti struktur user tanpa data sensitif.

---

## PATCH `/api/v1/account`

Mengubah data akun sendiri.

### Request

```json
{
  "name": "Budi Santoso",
  "email": "budi@mkri.go.id",
  "organization": "Mahkamah Konstitusi Republik Indonesia",
  "ou": "TTE"
}
```

Field yang boleh diubah harus mengikuti business rule aplikasi.

NIK tidak boleh diubah tanpa mekanisme khusus karena menjadi identifier yang digunakan PKI.

---

## POST `/api/v1/account/pfx-password`

Shortcut untuk mengubah Passphrase milik user sendiri.

Request:

```json
{
  "new_password": "********",
  "confirm_password": "********"
}
```

---

# 13. Audit Log

## GET `/api/v1/audit-logs`

Mengambil audit log.

### Role

- Super Admin
- Admin

### Query

```text
search
action
status
start_date
end_date
page
limit
```

### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "action": "CERTIFICATE_GENERATED",
        "target_type": "certificate",
        "target_id": 10,
        "status": "SUCCESS",
        "created_at": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

Tidak boleh menampilkan secret.

---

# 14. Signing (Terintegrasi)

## POST `/api/v1/signatures/sign`

Menandatangani dokumen PDF secara digital (CMS PKCS#7 / PAdES) menggunakan sertifikat P12/PFX user secara in-process melalui internal signing service adapter.

### Role & Autentikasi
- **USER:** Dapat menandatangani dokumen menggunakan sertifikat miliknya sendiri. NIK otomatis diambil dari akun sesi terautentikasi (mencegah IDOR). Field `nik` pada form diabaikan.
- **ADMIN:** Dapat menandatangani menggunakan sertifikat miliknya sendiri atau atas nama NIK pengguna tertentu yang aktif.
- **SUPER_ADMIN:** Dilarang menandatangani (mengembalikan HTTP 403 Forbidden).

### Request
Multipart Form-Data:
- `pdf` (file, wajib): Dokumen file PDF yang valid (`.pdf`, MIME `application/pdf`).
- `passphrase` (string, opsional): Passphrase sertifikat P12. Dapat dikirim via form field ini atau via header `X-P12-Password`.
- `nik` (string, opsional): NIK pemilik sertifikat (hanya diproses untuk role ADMIN; untuk USER selalu dipaksa sesuai sesi).
- `stamp` (file, opsional): Gambar visual stempel (`image/png`, `image/jpeg`).
- `page` (integer, opsional, default: 1): Nomor halaman penempatan stempel (1-indexed).
- `llx` (float, opsional): Koordinat kiri-bawah X bounding box stempel.
- `lly` (float, opsional): Koordinat kiri-bawah Y bounding box stempel.
- `urx` (float, opsional): Koordinat kanan-atas X bounding box stempel.
- `ury` (float, opsional): Koordinat kanan-atas Y bounding box stempel.

Header Opsional:
- `X-P12-Password`: Alternatif aman untuk transmisi passphrase sertifikat tanpa query param/URL.

### Response
- **Status:** `200 OK`
- **Content-Type:** `application/pdf`
- **Content-Disposition:** `attachment; filename="signed_{original_filename}"`
- **Body:** Binary payload stream dokumen PDF yang telah ditandatangani secara kriptografis.

### Validasi & Error Handling
- `400 Bad Request`: Format file bukan PDF, ukuran file kosong, atau koordinat stempel tidak valid.
- `401 Unauthorized`: Token JWT tidak valid atau passphrase sertifikat P12 salah.
- `403 Forbidden`: Role SUPER_ADMIN mencoba menandatangani, atau pengguna tidak memiliki sertifikat berstatus ACTIVE.
- `404 Not Found`: File sertifikat P12 tidak ditemukan di arsip storage.
- `500 Internal Server Error`: Kesalahan pada proses kriptografi PDF. Secret dan passphrase tidak pernah dibocorkan ke respon error atau log.

---

# 15. Internal PKI Service API Contract (Container-to-Container)

Pada arsitektur 2 container aplikasi, Platform API berkomunikasi dengan PKI Service secara internal via HTTP REST di port internal 8001 (tidak diekspos ke host publik). Seluruh permintaan dilindungi header autentikasi `X-Internal-Token`.

### Internal Endpoints

| Method | Endpoint | Fungsi | Auth Header |
|---|---|---|---|
| `GET` | `/health` | Health check PKI daemon | Public internal |
| `POST` | `/internal/v1/pki/certificates/single` | Penerbitan sertifikat tunggal | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/certificates/bulk` | Penerbitan sertifikat massal | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/certificates/regenerate/stage` | Pembuatan sertifikat staging isolasi | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/certificates/regenerate/commit` | Commit arsip hasil staging | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/certificates/regenerate/cleanup` | Pembersihan direktori staging | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/passphrase/user` | Ganti passphrase P12 oleh User | `X-Internal-Token` |
| `POST` | `/internal/v1/pki/passphrase/admin` | Reset passphrase P12 oleh Admin | `X-Internal-Token` |
| `DELETE` | `/internal/v1/pki/materials/{nik}` | Pembersihan berkas kredensial & sertifikat | `X-Internal-Token` |

### Input Schema (`SingleCertRequest`)

```json
{
  "name": "Budi Santoso",
  "nik": "3201123456789012",
  "email": "budi@mkri.go.id",
  "organization": "Mahkamah Konstitusi",
  "ou": "Kepaniteraan",
  "pfx_password": "Passphrase123!"
}
```

### Output Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "serial_number": "1188",
    "subject": "/C=ID/O=Mahkamah Konstitusi/OU=Kepaniteraan/CN=Budi Santoso/emailAddress=budi@mkri.go.id",
    "issuer": "Intermediate CA",
    "fingerprint_sha256": "abcdef...",
    "issued_at": "2026-10-20T07:00:00Z",
    "expires_at": "2028-10-19T07:00:00Z",
    "certificate_path": "/app/pki/issued/mahkamah-konstitusi--budi-santoso/mahkamah-konstitusi--budi-santoso.crt",
    "p12_reference": "/app/sign-api/p12/3201123456789012.p12"
  }
}
```

*Catatan Keamanan:* Passphrase dan secret token tidak pernah disimpan di database, metadata, atau audit log.

---

# 16. Error Codes

| Code | HTTP | Keterangan |
|---|---:|---|
| `INVALID_INPUT` | 400 | Input tidak valid |
| `INVALID_NIK` | 400 | NIK tidak sesuai format |
| `INVALID_EMAIL` | 400 | Email tidak valid |
| `CERTIFICATE_ALREADY_EXISTS` | 409 | Certificate/user conflict |
| `P12_NOT_FOUND` | 502 | P12 tidak ditemukan |
| `PKI_GENERATION_FAILED` | 502 | PKI generation gagal |
| `PKI_VALIDATION_FAILED` | 502 | Hasil PKI gagal divalidasi |
| `P12_VALIDATION_FAILED` | 502 | P12 gagal divalidasi |
| `PKI_TIMEOUT` | 502 | Subprocess PKI engine timeout |
| `INTERNAL_ERROR` | 500 | Kesalahan internal |

Raw error dari engine atau bash stderr tidak pernah menjadi response publik.

---

# 17. Authorization Summary

| Endpoint Group | Super Admin | Admin | User |
|---|---:|---:|---:|
| Auth | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ |
| Users | ✓ | ✓ | - |
| Generate | ✓ | ✓ | - |
| Regenerate | ✓ | ✓ | - |
| Ubah Passphrase User | ✓ | ✓ | Own |
| Delete User | ✓ | ✓ | - |
| Management Admin | ✓ | - | - |
| Account | - | - | Own |
| Audit Log | ✓ | ✓ | - |
| Signing | - | ✓ | ✓ |

Authorization backend adalah sumber kebenaran.

---

# 18. API Principles

1. Frontend (React) berkomunikasi dengan Platform API (FastAPI) secara eksklusif via HTTP/JSON.
2. Platform API tidak menjalankan Bash PKI secara langsung dari route handlers; seluruh eksekusi didelegasikan ke internal adapter (`app.services.pki_engine`).
3. PKI Engine bash scripts tetap dipertahankan tanpa modifikasi kriptografis.
4. Pemanggilan PKI berjalan in-process di dalam container backend tanpa network hop HTTP mikroservis tambahan.
5. Secret (passphrase, private key) tidak pernah masuk response API atau disimpan di database.
6. Raw engine error / subprocess traceback disanitasi dan ditransformasi menjadi standard API error response.
7. Semua endpoint sensitif melakukan verifikasi JWT dan RBAC di backend.
8. API Phase 1 fokus pada lifecycle manajemen pengguna dan sertifikat digital.

