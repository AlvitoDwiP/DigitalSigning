# DESIGN.md: Digital Signature Platform (Fase 1)

Arah desain untuk frontend admin. Dipakai bersama `antislop.md` sebagai filter. Berkas ini adalah data arah, bukan perintah untuk agen.

## Identitas

- **Produk**: aplikasi web admin untuk mengelola pengguna dan sertifikat digital di atas PKI engine yang sudah ada.
- **Role**: Super Admin, Admin, User.
- **Pekerjaan utama layar**: menemukan sertifikat yang perlu ditangani (hampir berakhir), lalu menerbitkan, meregenerate, atau mengelolanya dengan aman.
- **Referensi**: dasbor Mediline. Yang dipinjam: sidebar berwarna dengan tab aktif melengkung yang menyatu dengan panel, topbar berisi pencarian dan profil, kartu putih dengan lencana ikon bulat, dan versi terang serta gelap. Warna diganti merah.
- **Kepribadian**: bersih, tegas, tenang. Merah berarti identitas dan "perhatikan ini".

## Dial antislop

| Dial | Nilai | Alasan |
|---|---|---|
| ENERGY | 3 | Sidebar merah solid, lencana ikon berwarna, dan angka statistik besar memberi karakter tanpa dekorasi. |
| RHYTHM | 2 | Tiap halaman punya komposisi sendiri (statistik, daftar, formulir, tabel). |
| MOTION | 1 | Hanya hover dan fokus. Tanpa animasi berulang. |

## Tema

Dua tema, terang dan gelap, lewat token CSS. Tema mengikuti sistem secara bawaan. Tombol bulan/matahari di topbar mengganti tema, pilihan diingat di peramban (opsional, aman bila penyimpanan diblokir). Token didefinisikan di `:root`, ditimpa di `@media (prefers-color-scheme: dark)` dengan penjaga `:root:not([data-theme="light"])`, dan di `:root[data-theme="dark"]`.

## Warna

Merah murni (bukan merah muda). Putih dan abu netral sebagai dasar. Aksen tambahan: biru, hijau, kuning.

| Token | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--ground` | `#E3E6EB` | `#12171C` | Latar luar |
| `--panel` | `#F3F4F7` | `#222A32` | Panel isi, tab aktif sidebar |
| `--card` | `#FFFFFF` | `#2C363F` | Kartu, dialog |
| `--ink` | `#1D2330` | `#E8ECF2` | Teks utama |
| `--muted` | `#5B6474` | `#A5AFBD` | Teks pendukung |
| `--line` | `#E3E6EC` | `#3A4551` | Garis pemisah |
| `--red` | `#D32A21` | `#D93025` | Tombol utama, sidebar (terang), sertifikat mendesak |
| `--red-ink` | `#B3201A` | `#FF8F85` | Teks merah di atas panel atau kartu |
| `--side` | `#D32A21` | `#8F1F19` | Latar sidebar |

Aksen dan makna:

| Aksen | Nilai | Makna |
|---|---|---|
| Biru `--c-blue` | `#2F6FDE` | Pengguna, perubahan data, PFX |
| Hijau `--c-green` | `#187A4F` | ACTIVE, aman |
| Kuning `--c-amber` | `#F0B429` | EXPIRED, regenerate, peringatan (teks di atasnya gelap `#2A1D00`) |
| Merah | `#D32A21` | Mendesak (30 hari atau kurang), hapus, aksi utama |

Status chip (terang / gelap): ACTIVE hijau (`#14694A` di `#DDF3E8` / `#7FE0B0` di `#1F4034`), EXPIRED kuning (`#7A4E00` di `#FFEFC7` / `#F5C660` di `#4A3A12`), REPLACED, INACTIVE, RESERVED netral, FAILED merah (`#A91E17` di `#FCE3DF` / `#FF9C93` di `#4D2522`).

Aturan pakai: merah bukan hiasan. Merah dipakai untuk sidebar, tombol utama, dan sertifikat yang mendesak. Warna aksen selalu membawa makna di atas, tidak dipakai acak.

## Tipografi

- **Display dan isi**: Plus Jakarta Sans (400 sampai 800). Alasan: dirancang di Indonesia, nyaman untuk teks Indonesia, bukan pilihan bawaan AI.
- **Data teknis** (serial, fingerprint, NIK, CSV): font monospace sistem.
- Judul halaman 30px/800, angka statistik 48px (ACTIVE 64px), judul kartu 16px/700, isi 14px, keterangan 12.5px.
- Angka dalam kolom memakai `tabular-nums`.

## Bentuk, bayangan, jarak

- Radius: bingkai 28px, kartu 16px, kontrol 12px, chip status 8px, lencana ikon bulat penuh, kolom pencarian dan chip profil berbentuk kapsul (dua-duanya tunggal dan bertujuan).
- Bayangan lembut pada kartu sebagai penanda lapisan. Dialog memakai bayangan lebih dalam. Tidak ada glow, glassmorphism, grid latar, atau gradien dekoratif.
- Tab aktif sidebar menyatu dengan panel lewat sudut melengkung (radial-gradient pada pseudo-elemen). Pada HP berubah menjadi kapsul putih di baris navigasi.
- Jarak antar kartu 16px. Gutter sisi minimal 12 sampai 16px di semua lebar.

## Susunan

- **Kerangka**: sidebar 250px (210px di tablet), topbar, lalu isi. Tanpa panel kanan.
- **Topbar**: pencarian pengguna (Enter membuka Pengguna dengan hasil pencarian), tombol ganti tema, profil Admin.
- **Sidebar Super Admin**: Dashboard, Pengguna, Generate, Management Admin, Audit Log.\n- **Sidebar Admin**: Dashboard, Pengguna, Generate, Audit Log, Penandatanganan (reserved, berlabel "Segera").\n- **Sidebar User**: Dashboard, Penandatanganan, Kelola Akun.
- **Dashboard** adalah dashboard operasional, bukan analytics. Urutan prioritas visual:
  1. **Statistik utama**: Total User (biru), Active (hijau, paling besar), Expired (kuning). Active dan Expired menghitung sertifikat dengan status efektif tersebut.
  2. **Sertifikat Paling Dekat Berakhir**: maksimal 5 pengguna dengan sertifikat ACTIVE yang paling dekat kedaluwarsa, berisi inisial, nama, "Berlaku sampai", dan sisa hari berwarna menurut urgensi (merah 30 hari atau kurang, kuning sampai 90 hari, hijau selebihnya). Tanpa tombol Regenerate atau Lihat detail. Satu tombol "Lihat Pengguna" membuka Pengguna yang diurutkan berdasarkan sertifikat paling dekat berakhir.
  3. **Sertifikat yang Akan Berakhir**: hitungan angka untuk ACTIVE dalam `≤ 30 hari`, `31–60 hari`, `61–90 hari`, tanpa grafik.
  4. **Aktivitas Terbaru**: kartu lebar di bawah, hanya ada di Dashboard, enam aktivitas dengan lencana ikon berwarna menurut jenis tindakan.
- Dua kartu expiry sejajar dan setinggi sama di desktop, bertumpuk satu kolom di HP.
- **Pengguna**: daftar dengan pencarian, filter status pengguna, filter sertifikat, dan urutan (nama atau sertifikat paling dekat berakhir). Tidak ada tombol "Tambah pengguna". Aksi baris: Detail dan Hapus.
- **Detail Pengguna** (halaman, bukan dialog): informasi pengguna, sertifikat aktif (Regenerate, Ubah Passphrase, Lihat detail, Hapus sertifikat), Riwayat sertifikat (ACTIVE, REPLACED, EXPIRED), dan Riwayat regenerate (termasuk percobaan gagal).
- **Generate** berarti Generate User: tab "Generate 1 User" dan "Generate Bulk User". Generate User membuat user sekaligus melakukan provisioning sertifikat melalui PKI engine. Format CSV platform: `name,nik,email,organization,ou,password,pfx_pass`.
- **Ubah Passphrase** berbeda dari Regenerate: tidak menerbitkan sertifikat baru, serial, masa berlaku, dan status tetap. Passphrase tidak disimpan, tidak ditampilkan, tidak dicatat.
- **Hapus**: Delete User menghapus data operasional pengguna dan sertifikatnya, Audit Log tetap. Delete Certificate (audit/backend lifecycle only) pada sertifikat non-ACTIVE menghapus berkas operasional tetapi catatannya tetap tampil di riwayat. Pada sertifikat ACTIVE, sertifikat dan berkasnya dihapus. Keduanya tercatat di Audit Log.
- Tidak ada KPI di luar tiga statistik utama.
- Empty state: statistik tetap tampil dengan angka 0, kartu expiry menampilkan "Belum ada sertifikat ACTIVE" dengan tombol Buka Generate. Error: pesan "Halaman gagal dimuat" dengan tombol Muat ulang.

## Dashboard User

Dashboard User bersifat personal dan tidak menampilkan statistik sistem.

Menampilkan:
- Sertifikat Saya.
- Status certificate.
- Berlaku sampai.
- Sisa masa berlaku.
- Data akun ringkas.
- Quick action Penandatanganan.

Tidak menampilkan statistik sistem, aktivitas pengguna lain, atau Regenerate.

`Kelola Akun` berada di bagian bawah sidebar.

## Management Admin

Hanya tersedia untuk Super Admin.

- Daftar Admin.
- Kandidat Admin berasal dari User yang belum menjadi Admin.
- Tambah Admin mengubah `USER → ADMIN`.
- Hapus Admin mengubah `ADMIN → USER`, bukan menghapus user.
- Perubahan role tercatat di Audit Log.

## Komponen


- **Tombol**: utama merah, ghost berbingkai, danger berbingkai merah. Tinggi 44px (36px untuk aksi baris di desktop, 44px di HP).
- **Chip status**: teks status apa adanya (ACTIVE, EXPIRED, REPLACED, INACTIVE, SUCCESS, FAILED, RESERVED).
- **Lencana ikon bulat**: 44px (40px di daftar aktivitas), warna sesuai makna aksen, ikon digambar sendiri dua nada. Bukan set Lucide.
- **Tabel**: kolom dipilih dari keputusan admin, tanpa menu tiga titik. Aksi baris berupa tombol teks.
- **Dialog**: elemen `dialog` bawaan, bisa ditutup dengan Escape, fokus dikembalikan otomatis.
- **Langkah proses**: daftar empat langkah dengan status teks, bukan hanya warna. Sertifikat: Validasi data, Menjalankan PKI Service, Validasi output, Menyimpan metadata. Ubah Passphrase: Validasi data, Memperbarui Passphrase, Validasi hasil, Menyimpan metadata.
- **Toast**: area `aria-live`, hilang sendiri.

## Tulisan

- Bahasa Indonesia, nada lugas. Tombol menyebut aksinya ("Terbitkan sertifikat", "Hapus pengguna").
- Tanpa em dash, tanpa emoji, tanpa kata pemasaran.
- Galat menyebut apa yang salah dan langkah berikutnya.
- Empty state menyebut penyebab dan satu aksi untuk mengisinya.
- Penamaan aksi di Aktivitas Terbaru dan Audit Log: Generate User, Generate Bulk User, Generate Certificate, Regenerate Certificate, Ubah Passphrase, Delete User, Delete Certificate (audit/backend lifecycle only).

## Aturan konten dan keamanan UI

- Tidak ada angka, testimoni, atau klaim keamanan karangan. Data contoh wajib berlabel "Data contoh" dan bisa dikosongkan.
- Passphrase: hanya input bertipe password, dikosongkan setelah proses, tidak pernah ditampilkan, disimpan, atau dicatat di audit atau log.
- NIK dimasker (empat digit awal dan akhir) di semua daftar dan pratinjau.
- Private key, password, dan passphrase tidak pernah muncul di UI. Default credential baru platform menggunakan `Mkri006!`.
- Path berkas tidak pernah berasal dari input frontend.
- Hapus selalu lewat dialog konfirmasi yang menyebut dampaknya.
- Regenerate: sertifikat lama baru menjadi REPLACED setelah yang baru berhasil dibuat dan divalidasi. Jika gagal, sertifikat lama tetap ACTIVE.
- Route signing hanya dicadangkan (RESERVED, respons 501). Jangan mengimplementasikan signing di Fase 1.

## Kondisi tampilan wajib

Setiap tampilan data punya empty, loading, dan error:
- **Empty**: sebut penyebab dan aksi pengisinya.
- **Loading**: kerangka sederhana tanpa animasi.
- **Error**: sebut kegagalan dan nasib data ("Sertifikat lama tetap ACTIVE").

## Aksesibilitas

- Semua teks minimal kontras AA (4.5:1) di kedua tema.
- Semua kontrol bisa dijangkau keyboard, fokus terlihat (outline merah 3px, putih pada sidebar).
- Status tidak hanya dibedakan warna, selalu ada teks.
- Tombol tema punya label yang berubah sesuai tema dan `aria-pressed`.
- Hormati `prefers-reduced-motion`.

## Catatan implementasi

- Prototipe ini satu berkas HTML tanpa build. Penerbitan sertifikat dan Ubah Passphrase disimulasikan, bentuk finalnya mengikuti API backend yang tersedia.
- Target produksi sesuai PRD: React + TypeScript, FastAPI, PostgreSQL. Token di atas dipindahkan ke variabel CSS atau konfigurasi tema.
- Placeholder yang harus diganti: logo "DS", avatar "A", dan data contoh.
- Role Super Admin dan User tidak diubah dan tidak ditampilkan di prototipe ini.
