# Archive PKI Legacy & Reference

Direktori ini berisi salinan script lama, prototype, dan backup dari masa pengembangan awal PKI Engine.

> **PERINGATAN:**
> Direktori ini bersifat **arsip historis non-operasional** (read-only reference).
> Seluruh proses penerbitan sertifikat, perubahan passphrase, dan integrasi Digital Signature Platform yang aktif dijalankan secara eksklusif melalui direktori `pki/scripts/`.

## Struktur Arsip

1. `cli/`
   - `bangkitkan.sh`: Script interaktif awal (pra-NIK).
   - `bangkitkan_nik.sh`: Script interaktif versi awal NIK dengan prompt `read -p`.
   - `bangkitkan_banyak-cli.sh`: Script CLI terminal mandiri untuk pemrosesan batch.
   - `bin/`: Prototype paling awal pembentukan CA dan pengujian manual.

2. `backups/`
   - File backup script historis (`bk.*`, `*.bk`) dan file sampel CSV pengujian lama.

3. `prototype-web/`
   - `app.py`, `templates/`, `requirements.txt`, `uploads/`: Prototype web sederhana berbasis Jinja2 HTML yang telah sepenuhnya digantikan oleh arsitektur platform baru (FastAPI Platform API + PKI Service + React Frontend).

4. `root-duplicates/`
   - Duplikat script lama dari root `pki/` yang kini telah distandardisasi dan dipusatkan di `pki/scripts/`.

5. `issued-prelaunch/` (Diabaikan oleh Git via `.gitignore`)
   - Berisi 97 folder artefak sertifikat dan kunci dari tahap pengujian batch pra-peluncuran sebelum Digital Signature Platform aktif.

