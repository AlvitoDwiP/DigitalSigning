#!/usr/bin/env bash
# Linux, Bash 4+, OpenSSL 3+, flock.
# Interaktif: bash change_p12_passphrase.sh
# STDIN/web: tiga baris: NIK, passphrase lama, passphrase baru.
set +x
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_H="$(cd "$SCRIPT_DIR/../.." && pwd)"
H="${H:-$DEFAULT_H}"

ISSUED_ROOT="${ISSUED_ROOT:-$H/pki/issued}"
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-$H/sign-api/p12}"


die() { echo "ERROR: $*" >&2; exit 1; }

copy_ownership() {
  local ref="$1"
  local target="$2"
  chown --reference="$ref" "$target" 2>/dev/null && return 0
  local owner group
  owner="$(stat -f '%u' "$ref" 2>/dev/null || stat -c '%u' "$ref" 2>/dev/null || true)"
  group="$(stat -f '%g' "$ref" 2>/dev/null || stat -c '%g' "$ref" 2>/dev/null || true)"
  if [[ -n "$owner" && -n "$group" ]]; then
    chown "$owner:$group" "$target" 2>/dev/null || true
  fi
}

for tool in openssl find mktemp cmp cp mv chmod chown sed; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool tidak tersedia."
done

[[ -d "$ISSUED_ROOT" ]] || die "Folder issued tidak ditemukan."

if [[ -t 0 ]]; then
  read -r -p 'NIK: ' NIK
  read -r -s -p 'Passphrase lama: ' P12_OLD_SECRET
  printf '\n'
  read -r -s -p 'Passphrase baru: ' P12_NEW_SECRET
  printf '\n'
  read -r -s -p 'Ulangi passphrase baru: ' P12_CONFIRM
  printf '\n'

  [[ "$P12_NEW_SECRET" == "$P12_CONFIRM" ]] ||
    die 'Konfirmasi passphrase berbeda.'

  unset P12_CONFIRM
else
  IFS= read -r NIK ||
    die 'Input NIK tidak tersedia.'

  IFS= read -r P12_OLD_SECRET ||
    die 'Input passphrase lama tidak tersedia.'

  IFS= read -r P12_NEW_SECRET ||
    die 'Input passphrase baru tidak tersedia.'
fi

[[ "$NIK" =~ ^[0-9]{16}$ ]] ||
  die 'NIK harus tepat 16 digit.'

[[ -n "$P12_OLD_SECRET" ]] ||
  die 'Passphrase lama wajib.'

[[ -n "$P12_NEW_SECRET" ]] ||
  die 'Passphrase baru wajib.'

[[ "$P12_OLD_SECRET" != "$P12_NEW_SECRET" ]] ||
  die 'Passphrase baru sama dengan yang lama.'

export P12_OLD_SECRET P12_NEW_SECRET

if command -v flock >/dev/null 2>&1; then
  exec 9>"$ISSUED_ROOT/.change-p12-passphrase.lock"
  flock -n 9 || die 'Penggantian passphrase lain sedang berjalan.'
fi

MATCHES=()
while IFS= read -r -d '' match; do
  MATCHES+=("$match")
done < <(
  find "$ISSUED_ROOT" \
    -mindepth 2 \
    -maxdepth 2 \
    -type f \
    -name "$NIK.p12" \
    -print0
)

[[ ${#MATCHES[@]} -eq 1 ]] ||
  die "Harus ada tepat satu $NIK.p12 di folder issued; ditemukan ${#MATCHES[@]}."

SOURCE="${MATCHES[0]}"
OUT_DIR="${SOURCE%/*}"

mkdir -p "$P12_ARCHIVE_DIR"

DEST="$P12_ARCHIVE_DIR/$NIK.p12"

[[ ! -L "$DEST" ]] ||
  die 'Tujuan consume tidak boleh berupa symlink.'

[[ ! -e "$DEST" || -f "$DEST" ]] ||
  die 'Tujuan consume bukan berkas biasa.'

[[ ! "$SOURCE" -ef "$DEST" ]] ||
  die 'Folder issued dan consume harus berbeda.'

WORK=''
ARCHIVE_WORK=''
REPLACE_SOURCE=0
REPLACE_DEST=0
DEST_EXISTED=0
SUCCESS=0

cleanup() {
  local result=$?
  local rollback_failed=0

  trap - EXIT ERR INT TERM HUP
  set +e

  if [[ "$SUCCESS" -ne 1 ]]; then
    if [[ "$REPLACE_DEST" -eq 1 ]]; then
      if [[ "$DEST_EXISTED" -eq 1 ]]; then
        mv -f -- "$ARCHIVE_WORK/old.p12" "$DEST" ||
          rollback_failed=1
      else
        rm -f -- "$DEST" ||
          rollback_failed=1
      fi
    fi

    if [[ "$REPLACE_SOURCE" -eq 1 ]]; then
      mv -f -- "$WORK/old.p12" "$SOURCE" ||
        rollback_failed=1
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

  unset P12_OLD_SECRET P12_NEW_SECRET

  exit "$result"
}

trap cleanup EXIT

trap \
  'echo "ERROR: Proses gagal pada baris $LINENO; berkas lama akan dipulihkan jika sudah diganti." >&2; exit 1' \
  ERR

trap 'exit 130' INT
trap 'exit 143' TERM HUP

WORK="$(mktemp -d "$OUT_DIR/.passphrase.XXXXXX")"
ARCHIVE_WORK="$(mktemp -d "$P12_ARCHIVE_DIR/.passphrase.XXXXXX")"

if ! openssl pkcs12 \
  -legacy \
  -in "$SOURCE" \
  -aes256 \
  -passin env:P12_OLD_SECRET \
  -passout env:P12_NEW_SECRET \
  -out "$WORK/old-bundle.pem" \
  2>"$WORK/import-error.txt"; then

  die 'Tidak bisa membuka P12 lama. Periksa passphrase, isi berkas, dan dukungan OpenSSL.'
fi

FRIENDLY_NAME="$(
  sed -n \
    '/^ *friendlyName: /{s/^ *friendlyName: //;p;q;}' \
    "$WORK/old-bundle.pem"
)"

NAME_ARGS=()

[[ -z "$FRIENDLY_NAME" ]] ||
  NAME_ARGS=(-name "$FRIENDLY_NAME")

openssl pkcs12 \
  -export \
  -in "$WORK/old-bundle.pem" \
  -passin env:P12_NEW_SECRET \
  -passout env:P12_NEW_SECRET \
  -legacy \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-3DES \
  -macalg sha256 \
  "${NAME_ARGS[@]}" \
  -out "$WORK/new.p12"

openssl pkcs12 \
  -legacy \
  -in "$WORK/new.p12" \
  -aes256 \
  -passin env:P12_NEW_SECRET \
  -passout env:P12_NEW_SECRET \
  -out "$WORK/new-bundle.pem"

for version in old new; do
  sed -n \
    '/^-----BEGIN CERTIFICATE-----$/,/^-----END CERTIFICATE-----$/p' \
    "$WORK/$version-bundle.pem" \
    > "$WORK/$version-certs.pem"

  openssl pkey \
    -in "$WORK/$version-bundle.pem" \
    -passin env:P12_NEW_SECRET \
    -pubout \
    -outform DER \
    -out "$WORK/$version-public.der"
done

cmp -s \
  "$WORK/old-certs.pem" \
  "$WORK/new-certs.pem" ||
  die 'Sertifikat/rantai sertifikat berubah.'

cmp -s \
  "$WORK/old-public.der" \
  "$WORK/new-public.der" ||
  die 'Kunci berubah.'

cp -- "$WORK/new.p12" "$ARCHIVE_WORK/new.p12"

cmp -s \
  "$WORK/new.p12" \
  "$ARCHIVE_WORK/new.p12" ||
  die 'Salinan consume berbeda.'

cp -p -- "$SOURCE" "$WORK/old.p12"

copy_ownership "$SOURCE" "$WORK/new.p12"
chmod 600 "$WORK/new.p12"

if [[ -f "$DEST" ]]; then
  DEST_EXISTED=1

  cp -p -- "$DEST" "$ARCHIVE_WORK/old.p12"

  copy_ownership "$DEST" "$ARCHIVE_WORK/new.p12"
else
  copy_ownership "$SOURCE" "$ARCHIVE_WORK/new.p12"
fi

chmod 600 "$ARCHIVE_WORK/new.p12"

REPLACE_SOURCE=1
mv -f -- "$WORK/new.p12" "$SOURCE"

REPLACE_DEST=1
mv -f -- "$ARCHIVE_WORK/new.p12" "$DEST"

cmp -s "$SOURCE" "$DEST" ||
  die 'Hasil akhir kedua folder berbeda.'

SUCCESS=1

echo 'SELESAI: passphrase diganti; sertifikat, kunci, dan masa berlaku tetap.'
echo "Issued  : $SOURCE"
echo "Consume : $DEST"

openssl x509 \
  -in "$WORK/new-certs.pem" \
  -noout \
  -serial \
  -dates \
  -fingerprint \
  -sha256
