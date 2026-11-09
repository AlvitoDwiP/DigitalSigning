#!/usr/bin/env bash
# ==============================================================================
# SCRIPT CADANGAN TERENKRIPSI DAN ISOLASI OFFLINE ROOT CA
# DigitalSigning Platform - Mahkamah Konstitusi Republik Indonesia
# ==============================================================================
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PKI_DIR/root"
BACKUP_DIR="${BACKUP_DIR:-$PKI_DIR/cold_storage_backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo "=============================================================================="
echo "🔐 PROSEDUR PENGAMANAN & PENCADANGAN KUNCI INDUK ROOT CA (OFFLINE COLD STORAGE)"
echo "=============================================================================="

if [ ! -d "$ROOT_DIR" ]; then
    echo "❌ ERROR: Direktori Root CA tidak ditemukan pada: $ROOT_DIR" >&2
    exit 1
fi

ROOT_KEY="$ROOT_DIR/private/root-ca.key"
if [ ! -f "$ROOT_KEY" ]; then
    echo "⚠️ PERINGATAN: Kunci privat Root CA ($ROOT_KEY) tidak ditemukan."
    echo "Kemungkinan kunci sudah berhasil diamankan/diisolasi ke media offline sebelumnya."
    exit 0
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

ARCHIVE_TAR="$BACKUP_DIR/root_ca_backup_${TIMESTAMP}.tar"
ARCHIVE_ENC="$BACKUP_DIR/root_ca_backup_${TIMESTAMP}.tar.enc"
CHECKSUM_FILE="$BACKUP_DIR/root_ca_backup_${TIMESTAMP}.sha256"

echo "📦 1. Mengemas direktori Root CA ke arsip sementara..."
tar -cf "$ARCHIVE_TAR" -C "$PKI_DIR" root

echo "🔑 2. Mengenkripsi arsip menggunakan OpenSSL AES-256-CBC (PBKDF2)..."
echo "Masukkan passphrase enkripsi yang kuat untuk melindungi arsip cadangan:"
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$ARCHIVE_TAR" -out "$ARCHIVE_ENC"

# Hapus tar unencrypted seketika
rm -f "$ARCHIVE_TAR"
chmod 600 "$ARCHIVE_ENC"

echo "📝 3. Menghasilkan checksum SHA-256 untuk verifikasi integritas..."
sha256sum "$ARCHIVE_ENC" > "$CHECKSUM_FILE"

echo ""
echo "✅ PENCADANGAN SELESAI!"
echo "------------------------------------------------------------------------------"
echo "📁 Berkas Cadangan Terenkripsi : $ARCHIVE_ENC"
echo "📄 Berkas Checksum SHA-256     : $CHECKSUM_FILE"
echo "------------------------------------------------------------------------------"
echo ""
echo "🚨 LANGKAH KESELAMATAN BERIKUTNYA:"
echo "1. Salin berkas .tar.enc ke media penyimpanan fisik terpisah (Flashdisk terenkripsi/Cold Storage HSM)."
echo "2. Simpan passphrase enkripsi pada brankas kunci (Key Vault/Password Manager resmi)."
echo "3. Setelah memastikan salinan offline aman, amankan kunci privat Root CA dari server online dengan perintah:"
echo "   chmod 000 \"$ROOT_KEY\"  # atau pindahkan ke direktori cadangan offline"
echo ""

# Periksa argumen --isolate jika dipanggil otomatis
if [ "${1:-}" = "--isolate" ]; then
    echo "🛡️ Melakukan isolasi otomatis kunci privat Root CA pada server online..."
    mv "$ROOT_KEY" "$BACKUP_DIR/root-ca.key.isolated_${TIMESTAMP}"
    chmod 000 "$BACKUP_DIR/root-ca.key.isolated_${TIMESTAMP}"
    echo "✅ Kunci privat Root CA berhasil dipindahkan dan diisolasi dari direktori operasional aktif!"
fi

