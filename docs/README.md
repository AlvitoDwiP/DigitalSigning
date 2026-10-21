# Technical Documentation

Direktori ini berisi dokumentasi teknis dan spesifikasi arsitektur resmi untuk **Digital Signature Platform** (Phase 1).

## Daftar Dokumen

1. [SPECIFICATION.md](SPECIFICATION.md) — Master spesifikasi sistem, roles, permissions, status fitur aktual, dan alur bisnis.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — Arsitektur 3-container terpisah (Platform API, PKI Service, PostgreSQL), batas tanggung jawab service/client/engine, data flow, dan batasan keamanan.
3. [DATABASE.md](DATABASE.md) — Skema database PostgreSQL aktual, model ORM, relasi, index, dan constraint database.
4. [API.md](API.md) — Kontrak REST API platform, format request/response, autentikasi JWT, validasi, dan penanganan error.
5. [DESIGN.md](DESIGN.md) — Panduan desain visual, layout antarmuka, token warna/tema, dan rancangan komponen UI.

---
Untuk panduan operasional, instalasi Docker, pembuatan akun admin, dan quickstart, lihat [README.md](../README.md) di root direktori proyek.
