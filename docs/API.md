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

# 4. Dashboard

## GET `/api/v1/dashboard`

Mengembalikan data dashboard berdasarkan role.

### Admin / Super Admin

Data utama:

- total user;
- active;
- expired;
- certificate yang akan berakhir;
- expiry buckets;
- aktivitas terbaru.

### User

Data utama:

- certificate milik user;
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

Passphrase dan password login plaintext tidak boleh dikembalikan. Default credential jika menggunakan default adalah `Mkri006!`.

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

Menerbitkan certificate baru dengan default passphrase `Mkri006!`.

### Role

- Super Admin
- Admin

### Request

Tidak membutuhkan body khusus (menggunakan default passphrase `Mkri006!`).

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

# 14. Signing

## POST `/api/v1/signatures`

Route disiapkan untuk Phase 2.

Pada Phase 1:

```text
501 Not Implemented
```

Tidak melakukan integrasi aktif dengan existing sign-api.

---

# 15. Internal PKI Service Contract

Endpoint internal:

```text
POST /internal/pki/generate
POST /internal/pki/generate-bulk
POST /internal/pki/pfx-password
```

Endpoint ini tidak boleh diakses frontend/public.

### Generate

Request:

```json
{
  "name": "Budi Santoso",
  "nik": "327xxxxxxxxxxxxx",
  "email": "budi@mkri.go.id",
  "organization": "Mahkamah Konstitusi Republik Indonesia",
  "ou": "TTE",
  "pfx_password": "********"
}
```

Response metadata:

```json
{
  "serial_number": "...",
  "subject": "...",
  "issuer": "...",
  "fingerprint_sha256": "...",
  "issued_at": "...",
  "expires_at": "...",
  "certificate_path": "...",
  "p12_reference": "..."
}
```

Tidak mengembalikan password/private key.

### Passphrase

Request:

```json
{
  "nik": "327xxxxxxxxxxxxx",
  "new_password": "********"
}
```

Response:

```json
{
  "success": true
}
```

PKI Service harus memvalidasi P12 menggunakan password baru sebelum mengembalikan success.

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
| `PKI_TIMEOUT` | 502 | PKI timeout |
| `PKI_SERVICE_UNAVAILABLE` | 502 | PKI Service tidak tersedia |
| `INTERNAL_ERROR` | 500 | Kesalahan internal |

Raw error dari engine tidak boleh menjadi response publik.

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

1. Frontend hanya berkomunikasi dengan Platform API.
2. Platform API tidak menjalankan Bash PKI secara langsung.
3. PKI Service menjadi adapter ke existing PKI engine.
4. Endpoint internal PKI tidak public.
5. Secret tidak masuk response.
6. Raw engine error tidak diteruskan ke frontend.
7. Semua endpoint sensitif melakukan authorization di backend.
8. API Phase 1 tidak mengaktifkan PDF signing.
