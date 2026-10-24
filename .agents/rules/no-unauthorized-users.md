# Aturan Pengelolaan Data Pengguna & Pengujian

## 1. Larangan Penambahan Akun Tanpa Perintah Eksplisit
- **DILARANG KERAS** menambahkan akun pengguna baru ke dalam database (`users`), baik melalui API, skrip, seeder, maupun command manual, **KECUALI atas instruksi eksplisit langsung dari USER**.
- Jangan pernah membuat akun dengan nama-nama sembarang/dummy seperti `Special Admin`, `Bulk User`, `User Gen`, `Verify User`, `User UQ`, dsb. ke dalam database aktif.

## 2. Standar Eksekusi Pengujian (Testing)
- Seluruh pengujian otomatis (`pytest`, integration test, unit test) **TIDAK BOLEH** meninggalkan data pengguna, sertifikat, atau log pengujian di database aplikasi (`digital_signature_db`).
- Setiap data uji yang dibuat diwajibkan untuk:
  1. Berjalan di dalam database test terisolasi atau transaksi database yang otomatis di-*rollback* (`db.rollback()`), ATAU
  2. Dihapus secara bersih dan menyeluruh (*hard cleanup / teardown*) di akhir fixture pengujian tanpa menyisakan row di tabel `users`, `certificates`, `audit_logs`, maupun `certificate_yearly_counters`.

## 3. Integritas Data Eksisting
- Database saat ini memiliki 38 akun pengguna resmi Mahkamah Konstitusi.
- Data ini tidak boleh diubah, ditimpa, atau dicampur dengan data dummy pengujian.
