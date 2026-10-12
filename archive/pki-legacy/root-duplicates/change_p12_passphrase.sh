#!/usr/bin/env bash
# Linux, Bash 4+, OpenSSL 3+, flock.
# Interaktif: bash change_p12_passphrase.sh
# STDIN/web: dua baris: NIK, passphrase baru.
# Memakai .key tanpa enkripsi dan .crt yang tersimpan saat penerbitan.
set +x
set -Eeuo pipefail
umask 077

ISSUED_ROOT="${ISSUED_ROOT:-/home/sysadmin/pki/issued}"
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-/home/sysadmin/sign-api(well3)/p12}"
CHAIN_PATH="${CHAIN_PATH:-/home/sysadmin/pki/intermediate/certs/ca-chain.crt}"

die() { echo "ERROR: $*" >&2; exit 1; }
for tool in openssl flock find mktemp cmp cp mv chmod chown sed; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool tidak tersedia."
done
[[ -d "$ISSUED_ROOT" ]] || die "Folder issued tidak ditemukan."

if [[ -t 0 ]]; then
  read -r -p 'NIK: ' NIK
  read -r -s -p 'Passphrase baru: ' P12_NEW_SECRET
  printf '\n'
  read -r -s -p 'Ulangi passphrase baru: ' P12_CONFIRM
  printf '\n'
  [[ "$P12_NEW_SECRET" == "$P12_CONFIRM" ]] || die 'Konfirmasi passphrase berbeda.'
  unset P12_CONFIRM
else
  IFS= read -r NIK || die 'Input NIK tidak tersedia.'
  IFS= read -r P12_NEW_SECRET || die 'Input passphrase baru tidak tersedia.'
fi
[[ "$NIK" =~ ^[0-9]{16}$ ]] || die 'NIK harus tepat 16 digit.'
[[ -n "$P12_NEW_SECRET" ]] || die 'Passphrase baru wajib.'
export P12_NEW_SECRET

# Lock mencegah dua proses script ini berjalan bersamaan.
# Script penerbitan/signing terpisah tidak otomatis mengikuti lock ini.
exec 9>"$ISSUED_ROOT/.change-p12-passphrase.lock"
flock -n 9 || die 'Penggantian passphrase lain sedang berjalan.'

mapfile -d '' -t MATCHES < <(find "$ISSUED_ROOT" -mindepth 2 -maxdepth 2 -type f -name "$NIK.p12" -print0)
[[ ${#MATCHES[@]} -eq 1 ]] || die "Harus ada tepat satu $NIK.p12 di folder issued; ditemukan ${#MATCHES[@]}."
SOURCE="${MATCHES[0]}"
OUT_DIR="${SOURCE%/*}"
PERSON_SLUG="${OUT_DIR##*/}"
KEY="$OUT_DIR/$PERSON_SLUG.key"
CRT="$OUT_DIR/$PERSON_SLUG.crt"
for input_file in "$KEY" "$CRT" "$CHAIN_PATH"; do
  [[ -f "$input_file" && -r "$input_file" ]] || die "Berkas sumber tidak tersedia: $input_file"
done
mkdir -p "$P12_ARCHIVE_DIR"
DEST="$P12_ARCHIVE_DIR/$NIK.p12"
[[ ! -L "$DEST" ]] || die 'Tujuan consume tidak boleh berupa symlink.'
[[ ! -e "$DEST" || -f "$DEST" ]] || die 'Tujuan consume bukan berkas biasa.'
[[ ! "$SOURCE" -ef "$DEST" ]] || die 'Folder issued dan consume harus berbeda.'

WORK=''
ARCHIVE_WORK=''
REPLACE_SOURCE=0
REPLACE_DEST=0
DEST_EXISTED=0
SUCCESS=0

cleanup() {
  local result=$? rollback_failed=0
  trap - EXIT ERR INT TERM HUP
  set +e
  if [[ "$SUCCESS" -ne 1 ]]; then
    if [[ "$REPLACE_DEST" -eq 1 ]]; then
      if [[ "$DEST_EXISTED" -eq 1 ]]; then
        mv -f -- "$ARCHIVE_WORK/old.p12" "$DEST" || rollback_failed=1
      else
        rm -f -- "$DEST" || rollback_failed=1
      fi
    fi
    if [[ "$REPLACE_SOURCE" -eq 1 ]]; then
      mv -f -- "$WORK/old.p12" "$SOURCE" || rollback_failed=1
    fi
    [[ "$result" -ne 0 ]] || result=1
  fi
  if [[ "$rollback_failed" -eq 1 ]]; then
    echo "ERROR: Pemulihan gagal. Simpan folder pemulihan: $WORK dan $ARCHIVE_WORK" >&2
    result=1
  else
    [[ -z "$WORK" ]] || rm -rf -- "$WORK"
    [[ -z "$ARCHIVE_WORK" ]] || rm -rf -- "$ARCHIVE_WORK"
  fi
  unset P12_NEW_SECRET
  exit "$result"
}
trap cleanup EXIT
trap 'echo "ERROR: Proses gagal pada baris $LINENO; berkas lama akan dipulihkan jika sudah diganti." >&2; exit 1' ERR
trap 'exit 130' INT
trap 'exit 143' TERM HUP

WORK="$(mktemp -d "$OUT_DIR/.passphrase.XXXXXX")"
ARCHIVE_WORK="$(mktemp -d "$P12_ARCHIVE_DIR/.passphrase.XXXXXX")"

# Baca kunci asli tanpa password. -passin pass: mencegah prompt tersembunyi.
# Tidak membuka P12 lama, tidak membangkitkan kunci, tidak menerbitkan sertifikat.
if ! openssl pkey -in "$KEY" -passin pass: -check -noout >"$WORK/key-check.txt" 2>&1; then
  die 'Kunci .key tidak dapat dibaca tanpa password atau tidak valid.'
fi
openssl x509 -in "$CRT" -out "$WORK/source-leaf.pem"
sed -n '/^-----BEGIN CERTIFICATE-----$/,/^-----END CERTIFICATE-----$/p' \
  "$CHAIN_PATH" > "$WORK/source-chain.pem"
[[ -s "$WORK/source-chain.pem" ]] || die 'Rantai sertifikat kosong.'
cat "$WORK/source-leaf.pem" "$WORK/source-chain.pem" > "$WORK/source-certs.pem"
openssl x509 -in "$CRT" -pubkey -noout | \
  openssl pkey -pubin -outform DER -out "$WORK/certificate-public.der"
openssl pkey -in "$KEY" -passin pass: -pubout -outform DER -out "$WORK/source-public.der"
cmp -s "$WORK/certificate-public.der" "$WORK/source-public.der" || die 'Kunci .key tidak cocok dengan sertifikat .crt.'

SUBJECT="$(openssl x509 -in "$CRT" -noout -subject -nameopt multiline,utf8)"
CN="$(printf '%s\n' "$SUBJECT" | sed -n 's/^ *commonName *= //p')"
ORG="$(printf '%s\n' "$SUBJECT" | sed -n 's/^ *organizationName *= //p')"
FRIENDLY_NAME="${CN:-$PERSON_SLUG} – $ORG (TTE)"

# Pertahankan mode kompatibel dari script penerbitan milik Anda.
openssl pkcs12 -export -inkey "$KEY" -passin pass: \
  -in "$WORK/source-leaf.pem" -certfile "$WORK/source-chain.pem" \
  -passout env:P12_NEW_SECRET \
  -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
  -name "$FRIENDLY_NAME" -out "$WORK/new.p12"

# Buka ulang hasil; kunci sementara tetap terenkripsi AES-256.
openssl pkcs12 -legacy -in "$WORK/new.p12" -aes256 \
  -passin env:P12_NEW_SECRET -passout env:P12_NEW_SECRET \
  -out "$WORK/new-bundle.pem"
sed -n '/^-----BEGIN CERTIFICATE-----$/,/^-----END CERTIFICATE-----$/p' \
  "$WORK/new-bundle.pem" > "$WORK/new-certs.pem"
openssl pkey -in "$WORK/new-bundle.pem" -passin env:P12_NEW_SECRET \
  -pubout -outform DER -out "$WORK/new-public.der"
cmp -s "$WORK/source-certs.pem" "$WORK/new-certs.pem" || die 'Hasil tidak sesuai sertifikat/rantai sumber.'
cmp -s "$WORK/source-public.der" "$WORK/new-public.der" || die 'Hasil tidak sesuai kunci sumber.'

# Siapkan kedua salinan sebelum mengganti berkas yang aktif.
cp -- "$WORK/new.p12" "$ARCHIVE_WORK/new.p12"
cmp -s "$WORK/new.p12" "$ARCHIVE_WORK/new.p12" || die 'Salinan consume berbeda.'
cp -p -- "$SOURCE" "$WORK/old.p12"
chown --reference="$SOURCE" "$WORK/new.p12"
chmod 600 "$WORK/new.p12"
if [[ -f "$DEST" ]]; then
  DEST_EXISTED=1
  cp -p -- "$DEST" "$ARCHIVE_WORK/old.p12"
  chown --reference="$DEST" "$ARCHIVE_WORK/new.p12"
else
  chown --reference="$SOURCE" "$ARCHIVE_WORK/new.p12"
fi
chmod 600 "$ARCHIVE_WORK/new.p12"

# Rename atomik per folder. EXIT trap memulihkan jika terjadi error biasa.
REPLACE_SOURCE=1
mv -f -- "$WORK/new.p12" "$SOURCE"
REPLACE_DEST=1
mv -f -- "$ARCHIVE_WORK/new.p12" "$DEST"
cmp -s "$SOURCE" "$DEST" || die 'Hasil akhir kedua folder berbeda.'
SUCCESS=1

echo 'SELESAI: passphrase diganti; sertifikat, kunci, dan masa berlaku tetap.'
echo "Issued  : $SOURCE"
echo "Consume : $DEST"
openssl x509 -in "$WORK/new-certs.pem" -noout -serial -dates -fingerprint -sha256
