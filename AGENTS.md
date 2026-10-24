# Project Guidelines & Agent Rules

## Aturan Ketat Pengelolaan Akun Pengguna (Strict User Creation Rule)
1. **Dilarang Menambah Akun Tanpa Izin**:
   - Agen AI dilarang keras menambahkan akun pengguna baru ke database (`users`), baik melalui kode seeder, script manual, maupun panggilan API, kecuali ada permintaan eksplisit dari USER.
   - Jangan pernah menambahkan akun dengan nama dummy/sembarang (misal `Special Admin`, `Bulk User`, `User Gen`, `Verify User`, dll.) ke database aktif.

2. **Integritas Database Utama**:
   - Database aktif hanya diperuntukkan bagi 38 akun pengguna resmi yang sudah ada.
   - Pengujian otomatis (automated tests) tidak boleh meninggalkan artefak data di database bersama (`digital_signature_db`). Setiap uji coba harus menggunakan transaksi yang di-rollback atau dibersihkan seketika pada teardown.

3. **Penghapusan Pengguna di Antarmuka**:
   - Jika pengguna menghapus akun di frontend, antarmuka harus menangani kondisi jika data sudah terhapus (404) secara elegan dengan me-refresh daftar pengguna tanpa memblokir dialog modal.
