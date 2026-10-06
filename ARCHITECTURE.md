# ARCHITECTURE

## 1. Tujuan

Dokumen ini mendefinisikan arsitektur teknis Digital Signature Platform untuk mengelola user, provisioning sertifikat melalui PKI engine yang sudah tersedia, perubahan Password PFX, autentikasi, audit, dan integrasi API.

Platform berfungsi sebagai layer aplikasi dan orkestrasi. Proses kriptografi dan penerbitan sertifikat tetap menggunakan PKI engine yang sudah tersedia dan tidak ditulis ulang pada Phase 1.

## 2. Komponen Sistem

Arsitektur Phase 1 terdiri dari:

1. **Frontend**
   - Antarmuka web.
   - Menampilkan dashboard dan fitur sesuai role.
   - Berkomunikasi hanya dengan Platform API.
   - Tidak mengakses PKI engine secara langsung.

2. **Platform API / Backend**
   - Dibangun menggunakan FastAPI.
   - Menangani autentikasi, RBAC, user management, certificate metadata, dashboard, audit log, dan business logic.
   - Menjadi satu-satunya API yang digunakan frontend.
   - Tidak menjalankan script Bash PKI secara langsung.

3. **PostgreSQL**
   - Menyimpan data user, metadata sertifikat, dan audit log.
   - Tidak menyimpan private key, PFX, Password PFX, atau credential sensitif.

4. **PKI Service**
   - Service internal yang menjadi adapter/orchestrator terhadap PKI engine.
   - Menjalankan script PKI yang sudah tersedia.
   - Melakukan validasi hasil sebelum metadata dikembalikan ke Platform API.
   - Tidak menyediakan akses publik.

5. **Existing PKI Engine**
   - `bangkitkan_single.sh`
   - `bangkitkan_banyak.sh`
   - `change_p12_passphrase.sh`
   - OpenSSL/CA dan struktur penyimpanan sertifikat yang sudah tersedia.
   - Tidak direwrite menjadi engine baru.

6. **Existing Sign API**
   - Digunakan untuk kebutuhan PDF signing pada Phase 2.
   - Tidak diaktifkan atau diintegrasikan ke alur signing pada Phase 1.

## 3. Arsitektur Komunikasi

```text
Frontend
    |
    | HTTP/JSON
    v
Platform API
    |
    | HTTP/JSON internal
    v
PKI Service
    |
    | secure process execution
    v
Existing PKI Engine
    |
    +--> Certificate
    +--> PFX/P12
    +--> Metadata
```

Platform API juga berkomunikasi dengan PostgreSQL:

```text
Frontend
    |
    v
Platform API -----> PostgreSQL
    |
    v
PKI Service -----> Existing PKI Engine
```

Frontend tidak boleh berkomunikasi langsung dengan PostgreSQL, PKI Service, atau PKI engine.

## 4. Batas Tanggung Jawab

### Frontend

Frontend bertanggung jawab atas:
- tampilan;
- form;
- validasi dasar untuk pengalaman pengguna;
- role-based navigation;
- menampilkan status proses;
- menampilkan error yang sudah disederhanakan oleh backend.

Frontend tidak bertanggung jawab atas:
- penerbitan sertifikat;
- penyimpanan Password PFX;
- eksekusi script;
- validasi keamanan akhir;
- pembuatan audit log secara langsung.

### Platform API

Platform API bertanggung jawab atas:
- autentikasi;
- RBAC;
- validasi business rule;
- user management;
- certificate metadata;
- dashboard;
- audit log;
- transaksi database;
- pemanggilan PKI Service.

### PKI Service

PKI Service bertanggung jawab atas:
- menerima request provisioning;
- menjalankan PKI engine;
- timeout dan process handling;
- validasi hasil sertifikat;
- validasi P12/PFX;
- mengambil metadata sertifikat;
- mengembalikan hasil terstruktur.

PKI Service tidak bertanggung jawab atas:
- user authentication;
- role management;
- dashboard;
- audit log aplikasi;
- penyimpanan user di database platform.

## 5. Generate User

Generate User berarti melakukan provisioning user baru sekaligus menerbitkan credential/sertifikat melalui PKI engine.

### Single

```text
Frontend
  -> POST /api/v1/users/generate
  -> Platform API
  -> validasi input
  -> PKI Service
  -> bangkitkan_single.sh
  -> validasi certificate + P12
  -> metadata dikembalikan
  -> Platform API menyimpan user + certificate
  -> audit log
  -> response ke frontend
```

Validasi utama:
- NIK tepat 16 digit;
- NIK belum digunakan;
- email valid dan unik;
- field wajib terisi;
- Password PFX tersedia.

Password PFX hanya diteruskan untuk proses provisioning dan tidak disimpan ke database, audit log, atau response setelah proses selesai.

### Bulk

```text
Frontend
  -> upload CSV
  -> /generate-bulk/validate
  -> validasi seluruh row
  -> preview
  -> konfirmasi
  -> /generate-bulk
  -> PKI Service
  -> bangkitkan_banyak.sh
  -> validasi hasil
  -> simpan user + certificate yang berhasil
  -> audit
```

Semua row harus divalidasi sebelum proses generation dimulai.

Platform tidak bergantung pada default Password PFX dari script lama.

## 6. Regenerate Certificate

Regenerate menghasilkan sertifikat baru untuk user yang sudah ada.

Aturan:
1. Sertifikat lama tetap `ACTIVE` selama proses baru belum berhasil.
2. PKI Service menerbitkan dan memvalidasi sertifikat baru.
3. Setelah sertifikat baru valid:
   - sertifikat lama menjadi `REPLACED`;
   - sertifikat baru menjadi `ACTIVE`.
4. Jika proses gagal, sertifikat lama tetap `ACTIVE`.
5. Hanya satu sertifikat yang boleh berstatus `ACTIVE` untuk satu user.

```text
User
  |
  v
Platform API
  |
  v
PKI Service
  |
  v
Generate certificate
  |
  +-- gagal --> old certificate tetap ACTIVE
  |
  +-- berhasil --> new ACTIVE
                    old REPLACED
```

## 7. Ubah Password PFX

Perubahan Password PFX tidak menerbitkan sertifikat baru.

Alurnya:

```text
Frontend
  -> Platform API
  -> PKI Service
  -> change_p12_passphrase.sh
  -> validasi P12 dengan password baru
  -> success
```

Perubahan ini tidak mengubah:
- serial number;
- fingerprint;
- issued_at;
- expires_at;
- certificate status.

Yang berubah hanya password pada PFX/P12.

Password akun dapat digunakan untuk konfirmasi identitas sesuai kebutuhan aplikasi, tetapi password akun dan Password PFX tetap tidak disimpan sebagai plaintext.

## 8. Authentication

### Development

```text
Email + Password
        |
        v
     Login
        |
        v
    Dashboard
```

### Production

```text
Email + Password
        |
        v
       OTP
        |
        v
    Dashboard
```

Arsitektur autentikasi disiapkan agar OTP dapat ditambahkan kemudian tanpa mengubah struktur utama sistem.

## 9. RBAC

Role:
- `SUPER_ADMIN`
- `ADMIN`
- `USER`

RBAC diterapkan pada Platform API, bukan hanya frontend.

Contoh:
- frontend menyembunyikan menu yang tidak tersedia;
- backend tetap wajib memeriksa role pada setiap endpoint yang membutuhkan hak akses.

Super Admin dapat mengelola Admin.
Admin dapat mengelola User dan proses provisioning.
User hanya mengakses data dan proses miliknya sendiri sesuai fitur yang tersedia.

## 10. Security Boundary

Hal yang tidak boleh keluar dari boundary internal:
- private key;
- PFX/P12 password;
- CA private key;
- CA password;
- service token;
- credential PKI lainnya.

Password PFX:
- tidak disimpan di PostgreSQL;
- tidak disimpan di audit log;
- tidak dikirim kembali ke frontend setelah proses;
- tidak ditulis ke log aplikasi.

PKI Service menggunakan service token internal melalui environment variable.

## 11. Konfigurasi Environment

Credential dan konfigurasi sensitif menggunakan environment variable, antara lain:

```text
DATABASE_URL
SECRET_KEY
PKI_SERVICE_URL
PKI_SERVICE_TOKEN
PKI_TIMEOUT
```

Nilai secret tidak ditulis langsung pada source code.

`.env` lokal tidak boleh masuk repository.

`.env.example` hanya berisi nama variable dan contoh non-secret.

## 12. Docker

Phase 1 menggunakan Docker untuk:
- frontend;
- backend;
- PostgreSQL.

PKI engine yang sudah berjalan tidak perlu dipindahkan ke container hanya demi arsitektur platform.

Jika PKI Service ditempatkan dalam container, container tersebut harus memiliki akses aman ke environment PKI engine dan tidak mengekspos endpoint PKI ke publik.

## 13. Repository Boundary

Repository platform tidak memasukkan:
- `.git` dari project PKI lama;
- `.venv`;
- generated certificate;
- PFX/P12;
- private key;
- CA key;
- CA credential;
- hasil issuance;
- file upload sensitif;
- secret.

Source PKI engine yang sudah ada menjadi dependency/environment terpisah sesuai deployment.

## 14. Error Handling

Platform API tidak mengembalikan raw output OpenSSL atau path internal server ke frontend.

Error internal dipetakan menjadi error terstruktur, misalnya:

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

HTTP mapping:

```text
400 -> validation/input error
409 -> conflict
502 -> PKI service/engine failure
500 -> internal error
```

Detail teknis hanya dicatat secara aman pada internal log yang tidak mengandung secret.

## 15. Transaction Boundary

Untuk single generate:

```text
Validate
  -> Generate PKI
  -> Validate output
  -> DB transaction
      - create user
      - create certificate
      - create audit
  -> commit
```

Jika provisioning PKI gagal, user/certificate tidak dibuat.

Jika database gagal setelah certificate berhasil dibuat, sistem tidak boleh menganggap provisioning database sukses. Kondisi tersebut perlu dicatat untuk reconciliation/manual handling dan tidak boleh menyebabkan penghapusan CA state secara sembarangan.

Untuk regenerate:
- jangan mengubah certificate lama sebelum certificate baru berhasil divalidasi.

## 16. Expiration

Validity certificate:
- 730 hari / 2 tahun.

Status certificate:
- `ACTIVE`
- `EXPIRED`
- `REPLACED`
- `REVOKED`

Backend menjadi sumber kebenaran untuk sinkronisasi expiration.

Frontend tidak boleh menjadi satu-satunya mekanisme yang mengubah status `ACTIVE` menjadi `EXPIRED`.

## 17. Phase 1

Fokus Phase 1:

- authentication;
- RBAC;
- Dashboard;
- Pengguna;
- Generate User single;
- Generate User bulk;
- certificate metadata;
- regenerate;
- Ubah Password PFX;
- Audit Log;
- account management;
- API platform;
- PKI Service integration.

Tidak termasuk:
- PDF signing;
- QR signature;
- signature appearance;
- verification portal;
- approval workflow;
- sign-api integration aktif;
- mobile app;
- multi-tenant;
- microservices tambahan yang tidak diperlukan.

## 18. Phase 2

Phase 2 dapat mengaktifkan:

```text
User
  -> Upload PDF
  -> Signing API
  -> PKCS#12 / certificate
  -> Digital Signature
  -> Signed PDF
  -> Verification
```

Existing `sign-api(well3)` menjadi kandidat engine untuk proses signing karena sudah menyediakan endpoint `/sign`.

Phase 2 tidak mengubah fungsi provisioning sertifikat pada Phase 1.

## 19. Prinsip Arsitektur

1. **Platform tidak menulis ulang PKI engine.**
2. **Platform API tidak menjalankan Bash PKI secara langsung.**
3. **PKI Service menjadi satu-satunya adapter ke PKI engine.**
4. **Database hanya menyimpan metadata, bukan material kriptografi sensitif.**
5. **Backend menjadi sumber kebenaran untuk authorization dan certificate state.**
6. **Password PFX tidak pernah dipersistenkan sebagai plaintext.**
7. **Certificate lama tidak diganti sebelum certificate baru berhasil divalidasi.**
8. **Phase 1 fokus pada provisioning dan management, bukan PDF signing.**
9. **Arsitektur dibuat sederhana agar mudah dikembangkan tanpa overengineering.**
