# DATABASE.md

## 1. Tujuan

Dokumen ini mendefinisikan struktur database untuk Digital Signature Platform Phase 1.

Database digunakan untuk menyimpan:
- identitas dan akun pengguna;
- metadata certificate;
- status dan riwayat certificate;
- audit aktivitas aplikasi.

Database **tidak digunakan untuk menyimpan material PKI rahasia**.

---

## 2. Database

Database yang digunakan:
- PostgreSQL

Migration database menggunakan:
- Alembic

Phase 1 menggunakan tiga tabel utama:

```text
users
  │
  ├──────────────< certificates
  │
  └──────────────< audit_logs
```

---

## 3. Aturan Keamanan Data

Data berikut **tidak boleh disimpan** di database:

- PFX Password
- Private Key
- PFX/P12 binary
- OTP
- Login password dalam bentuk plaintext
- API key
- CA password

Password login hanya disimpan dalam bentuk `password_hash`.

PFX Password hanya digunakan selama proses PKI dan tidak dikembalikan melalui response API maupun audit log.

---

## 4. Enum

### 4.1 Role

```text
SUPER_ADMIN
ADMIN
USER
```

### 4.2 User Status

```text
ACTIVE
INACTIVE
```

### 4.3 Certificate Status

```text
ACTIVE
EXPIRED
REPLACED
REVOKED
```

`REVOKED` disiapkan untuk lifecycle certificate di masa mendatang. Fitur revocation belum menjadi fitur utama Phase 1.

### 4.4 Audit Status

```text
SUCCESS
FAILED
```

---

## 5. Tabel `users`

Tabel `users` menyimpan identitas dan akun pengguna platform.

| Field | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID | PK | ID internal user |
| `name` | VARCHAR(150) | NOT NULL | Nama pengguna |
| `nik` | VARCHAR(16) | UNIQUE, NOT NULL | NIK, tepat 16 digit |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email login |
| `organization` | VARCHAR(255) | NOT NULL | Organisasi |
| `ou` | VARCHAR(100) | NOT NULL | Organizational Unit |
| `password_hash` | TEXT | NOT NULL | Hash password login |
| `role` | VARCHAR(20) | NOT NULL | SUPER_ADMIN / ADMIN / USER |
| `status` | VARCHAR(20) | NOT NULL | ACTIVE / INACTIVE |
| `created_at` | TIMESTAMPTZ | NOT NULL | Waktu pembuatan |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Waktu perubahan |

### Constraint

```sql
CONSTRAINT users_nik_format
    CHECK (nik ~ '^[0-9]{16}$');

CONSTRAINT users_role_check
    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER'));

CONSTRAINT users_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE'));
```

NIK menggunakan `VARCHAR(16)`, bukan integer, karena NIK merupakan identifier.

Email dan NIK harus unik.

---

## 6. Tabel `certificates`

Tabel `certificates` menyimpan metadata certificate yang diterbitkan oleh PKI Engine.

Tabel ini **tidak menyimpan private key, PFX, atau P12 binary**.

| Field | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID | PK | ID certificate |
| `user_id` | UUID | FK, NOT NULL | Pemilik certificate |
| `serial_number` | VARCHAR(255) | UNIQUE, NOT NULL | Serial number certificate |
| `subject` | TEXT | NOT NULL | Subject certificate |
| `issuer` | TEXT | NOT NULL | Issuer certificate |
| `fingerprint_sha256` | VARCHAR(64) | UNIQUE, NOT NULL | Fingerprint SHA-256 |
| `certificate_path` | TEXT | NOT NULL | Referensi artifact certificate |
| `p12_reference` | TEXT | NOT NULL | Referensi P12 |
| `issued_at` | TIMESTAMPTZ | NOT NULL | Waktu mulai berlaku |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Waktu berakhir |
| `status` | VARCHAR(20) | NOT NULL | ACTIVE / EXPIRED / REPLACED / REVOKED |
| `replaced_by` | UUID | FK, NULL | Certificate pengganti |
| `created_at` | TIMESTAMPTZ | NOT NULL | Waktu record dibuat |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Waktu record diperbarui |

### Foreign Key

```sql
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE
```

`replaced_by` mengarah kembali ke tabel `certificates`:

```sql
FOREIGN KEY (replaced_by)
REFERENCES certificates(id)
ON DELETE SET NULL
```

### Constraint

```sql
CONSTRAINT certificates_status_check
    CHECK (
        status IN (
            'ACTIVE',
            'EXPIRED',
            'REPLACED',
            'REVOKED'
        )
    );

CONSTRAINT certificates_validity_check
    CHECK (expires_at > issued_at);
```

---

## 7. Satu Certificate ACTIVE per User

Setiap user hanya boleh memiliki satu certificate dengan status `ACTIVE`.

```sql
CREATE UNIQUE INDEX one_active_certificate_per_user
ON certificates (user_id)
WHERE status = 'ACTIVE';
```

Contoh yang diperbolehkan:

```text
User Budi
├── Certificate A → REPLACED
├── Certificate B → REPLACED
└── Certificate C → ACTIVE
```

Contoh yang tidak diperbolehkan:

```text
User Budi
├── Certificate A → ACTIVE
└── Certificate B → ACTIVE
```

---

## 8. Certificate Uniqueness

Serial number certificate harus unik:

```sql
CREATE UNIQUE INDEX certificates_serial_unique
ON certificates (serial_number);
```

Fingerprint SHA-256 juga harus unik:

```sql
CREATE UNIQUE INDEX certificates_fingerprint_unique
ON certificates (fingerprint_sha256);
```

---

## 9. Tabel `audit_logs`

Tabel `audit_logs` menyimpan aktivitas penting yang dilakukan di dalam platform.

| Field | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID | PK | ID audit |
| `user_id` | UUID | FK, NULL | Actor/pelaku aktivitas |
| `action` | VARCHAR(100) | NOT NULL | Jenis aktivitas |
| `target_type` | VARCHAR(50) | NOT NULL | Jenis target |
| `target_id` | UUID | NULL | ID target |
| `status` | VARCHAR(20) | NOT NULL | SUCCESS / FAILED |
| `created_at` | TIMESTAMPTZ | NOT NULL | Waktu aktivitas |

### Foreign Key

```sql
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE SET NULL
```

Audit tetap dipertahankan meskipun user yang terkait kemudian dihapus.

---

## 10. Audit Action

Action utama Phase 1:

```text
LOGIN
USER_CREATED
USER_DELETED

ADMIN_ASSIGNED
ADMIN_REMOVED

CERTIFICATE_GENERATED
CERTIFICATE_REGENERATED

PFX_PASSWORD_CHANGED
```

Audit log tidak boleh menyimpan:
- PFX password
- Login password
- Private key
- P12/PFX content
- OTP
- API key
- CA password

---

## 11. Index

```sql
CREATE INDEX users_status_idx
ON users (status);

CREATE INDEX users_role_idx
ON users (role);

CREATE INDEX certificates_user_idx
ON certificates (user_id);

CREATE INDEX certificates_status_idx
ON certificates (status);

CREATE INDEX certificates_expires_at_idx
ON certificates (expires_at);

CREATE INDEX audit_logs_created_at_idx
ON audit_logs (created_at);

CREATE INDEX audit_logs_action_idx
ON audit_logs (action);
```

Index mendukung kebutuhan pencarian user, filter status, certificate, dashboard, expiration, dan audit log.

---

## 12. Certificate Expiration

`expires_at` menjadi sumber informasi masa berlaku certificate.

Frontend bukan sumber kebenaran utama untuk menentukan `EXPIRED`.

Backend harus memastikan certificate yang sudah melewati `expires_at` dapat disinkronkan menjadi:

```text
ACTIVE → EXPIRED
```

Untuk Phase 1, tidak perlu scheduler kompleks terlebih dahulu.

---

## 13. Certificate Validity

Certificate yang dihasilkan engine menggunakan masa berlaku:

```text
730 hari
```

Frontend tidak menyediakan field untuk menentukan jumlah hari certificate.

Request Generate User tidak menerima:
- `days`
- `validity_days`
- `expiration_days`

Masa berlaku mengikuti konfigurasi PKI Engine.

---

## 14. Relationship

```text
users
  │
  │ 1:N
  ▼
certificates
```

Satu user dapat memiliki beberapa certificate sepanjang riwayatnya, tetapi hanya satu yang boleh `ACTIVE`.

Relasi audit:

```text
users
  │
  │ 1:N
  ▼
audit_logs
```

`audit_logs.user_id` nullable agar audit tetap dapat dipertahankan ketika user dihapus.

---

## 15. Delete User

Ketika user dihapus:

1. Validasi permission.
2. Hapus operational certificate artifacts sesuai mekanisme PKI Engine.
3. Hapus metadata certificate terkait.
4. Hapus user.
5. Audit log tetap dipertahankan.

Database menggunakan:

```text
certificates.user_id
→ ON DELETE CASCADE
```

dan:

```text
audit_logs.user_id
→ ON DELETE SET NULL
```

State internal CA/PKI tidak boleh dihapus secara sembarangan oleh Platform.

---

## 16. Database Transaction

Operasi yang menghasilkan user dan certificate harus menggunakan transaction.

```text
Validate Request
      ↓
PKI Generate
      ↓
Validate PKI Output
      ↓
BEGIN TRANSACTION
      ├── INSERT users
      ├── INSERT certificates
      └── INSERT audit_logs
      ↓
COMMIT
```

Jika database gagal:

```text
ROLLBACK
```

User tidak boleh tersimpan sebagai user aktif apabila proses certificate gagal.

---

## 17. Generate Bulk

Validasi seluruh data dilakukan sebelum proses PKI dimulai.

```text
Upload CSV
    ↓
Parse
    ↓
Validate seluruh row
    ↓
Ada error?
    ├── Ya → STOP
    └── Tidak
          ↓
      PKI Generate
```

Validasi minimal:
- NIK tepat 16 digit;
- NIK tidak duplikat;
- email valid;
- email tidak duplikat;
- PFX Password tersedia;
- data wajib lengkap.

Password PFX tidak ditampilkan pada preview CSV.

---

## 18. Regenerate Certificate

Regenerate tidak menghapus certificate lama terlebih dahulu.

```text
Certificate lama
      ↓
Tetap ACTIVE
      ↓
Generate certificate baru
      ↓
Validasi certificate baru
      ↓
BEGIN TRANSACTION
      ├── certificate lama → REPLACED
      ├── certificate baru → ACTIVE
      └── audit log
      ↓
COMMIT
```

Jika generate baru gagal:

```text
Certificate lama tetap ACTIVE
```

---

## 19. Ubah Password PFX

Ubah Password PFX **tidak membuat certificate baru**.

Tidak ada insert baru ke tabel `certificates`.

Perubahan hanya terjadi pada artifact P12/PFX yang dikelola PKI Engine.

Database tetap menyimpan metadata certificate yang sama:

```text
Serial Number → tetap
Issued At     → tetap
Expires At    → tetap
Fingerprint   → tetap
Status        → tetap
```

Audit:

```text
PFX_PASSWORD_CHANGED
```

Password baru tidak disimpan.

---

## 20. Authentication dan OTP

Phase 1 development:

```text
Email + Password
        ↓
Dashboard
```

OTP belum membutuhkan tabel database khusus.

Production dapat menambahkan mekanisme OTP kemudian tanpa menyimpan OTP secara permanen di tabel `users`.

---

## 21. Seed Initial Super Admin

Database membutuhkan minimal satu Super Admin saat deployment awal.

Password initial admin:
- tidak boleh hardcoded di source code;
- tidak boleh disimpan plaintext;
- harus di-hash sebelum disimpan.

Provisioning initial admin dilakukan melalui mekanisme deployment/setup yang aman.

---

## 22. SQL Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    nik VARCHAR(16) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    organization VARCHAR(255) NOT NULL,
    ou VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_nik_format
        CHECK (nik ~ '^[0-9]{16}$'),

    CONSTRAINT users_role_check
        CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),

    CONSTRAINT users_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE certificates (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    issuer TEXT NOT NULL,
    fingerprint_sha256 VARCHAR(64) NOT NULL UNIQUE,
    certificate_path TEXT NOT NULL,
    p12_reference TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL,
    replaced_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT certificates_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT certificates_replaced_by_fk
        FOREIGN KEY (replaced_by)
        REFERENCES certificates(id)
        ON DELETE SET NULL,

    CONSTRAINT certificates_status_check
        CHECK (
            status IN (
                'ACTIVE',
                'EXPIRED',
                'REPLACED',
                'REVOKED'
            )
        ),

    CONSTRAINT certificates_validity_check
        CHECK (expires_at > issued_at)
);


CREATE UNIQUE INDEX one_active_certificate_per_user
ON certificates (user_id)
WHERE status = 'ACTIVE';


CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_logs_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT audit_logs_status_check
        CHECK (status IN ('SUCCESS', 'FAILED'))
);


CREATE INDEX users_status_idx
ON users (status);

CREATE INDEX users_role_idx
ON users (role);

CREATE INDEX certificates_user_idx
ON certificates (user_id);

CREATE INDEX certificates_status_idx
ON certificates (status);

CREATE INDEX certificates_expires_at_idx
ON certificates (expires_at);

CREATE INDEX audit_logs_created_at_idx
ON audit_logs (created_at);

CREATE INDEX audit_logs_action_idx
ON audit_logs (action);
```

---

## 23. Status Dokumen

**DATABASE.md ini merupakan baseline schema Phase 1.**

Belum termasuk:
- tabel signing;
- tabel OTP;
- tabel roles/permissions;
- tabel PFX password;
- tabel private key;
- tabel file upload.

Semua tersebut berada di luar scope database Phase 1.
