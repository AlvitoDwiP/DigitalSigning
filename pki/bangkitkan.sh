#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
trap 'echo "❌ Error pada baris $LINENO"; exit 1' ERR

# ====== PUSTIK MKRI — Issue Personal Cert (folder & file: <org-slug>--<cn-slug>) ======
# Output di: ~/pki/issued/<org-slug>--<cn-slug>/
# File:      <org-slug>--<cn-slug>.{key,csr,crt,pfx} , <org-slug>--<cn-slug>-compat.p12 , <org-slug>--<cn-slug>-meta.txt

command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ditemukan di PATH"; exit 1; }
command -v iconv   >/dev/null 2>&1 || echo "WARN: 'iconv' tidak ada; slugify tanpa transliterasi."

# Base path TIDAK ditanyakan; bisa override via env: H=/path/lain bash script.sh
H="${H:-/home/belalangtempur}"

# Lokasi CA (harus ada)
INT_DIR="$H/pki/intermediate"
INT_CNF="$INT_DIR/openssl.cnf"
CHAIN="$INT_DIR/certs/ca-chain.crt"
EXTFILE="$INT_DIR/pdfsign-ext.cnf"
INTER_KEY="$INT_DIR/private/intermediate-ca.key"

# Default prompt
DEFAULT_ORG_NAME="Universitas B"
DEFAULT_OU="TTE"
DEFAULT_CN="Nama Penandatangan"
DEFAULT_EMAIL="penandatangan@univ-b.ac.id"
DEFAULT_DAYS="730"
DEFAULT_PFX_PASS="PfxPass!ChangeMe123"

read -r -p "Nama Organisasi (O=...) [${DEFAULT_ORG_NAME}]: " ORG_NAME; ORG_NAME="${ORG_NAME:-$DEFAULT_ORG_NAME}"
read -r -p "Unit (OU=...) [${DEFAULT_OU}]: " OU; OU="${OU:-$DEFAULT_OU}"
read -r -p "Nama personal / CN [${DEFAULT_CN}]: " CN; CN="${CN:-$DEFAULT_CN}"
read -r -p "Email personal [${DEFAULT_EMAIL}]: " EMAIL; EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
read -r -p "Masa berlaku (hari) [${DEFAULT_DAYS}]: " DAYS; DAYS="${DAYS:-$DEFAULT_DAYS}"

# Password Intermediate CA (untuk 'openssl ca')
if [[ -n "${INTER_CA_PASS:-}" ]]; then
  echo "INFO: INTER_CA_PASS terdeteksi dari ENV (dipakai)."
else
  read -s -r -p "Password Intermediate CA (INTER_CA_PASS) [wajib]: " INTER_CA_PASS
  echo
  [[ -n "$INTER_CA_PASS" ]] || { echo "ERROR: INTER_CA_PASS wajib diisi."; exit 1; }
fi

# Password PFX/P12 output
read -s -r -p "Password PFX output (kosong=${DEFAULT_PFX_PASS}): " PFX_PASS
echo
PFX_PASS="${PFX_PASS:-$DEFAULT_PFX_PASS}"

# Cek berkas CA
[[ -f "$INT_CNF"   ]] || { echo "ERROR: $INT_CNF tidak ada."; exit 1; }
[[ -f "$CHAIN"    ]] || { echo "ERROR: $CHAIN tidak ada (gabungan intermediate+root)."; exit 1; }
[[ -f "$INTER_KEY" ]] || { echo "ERROR: $INTER_KEY tidak ada."; exit 1; }

# Validasi password Intermediate CA lebih dulu (fail-fast)
if ! openssl pkey -in "$INTER_KEY" -passin "pass:$INTER_CA_PASS" -noout >/dev/null 2>&1; then
  echo "ERROR: Password Intermediate CA salah atau key tidak bisa dibaca: $INTER_KEY"
  exit 1
fi

# Fungsi slugify (ASCII, lower-case, spasi/tanda jadi '-')
slugify () {
  local s="$1"
  if command -v iconv >/dev/null 2>&1; then
    s=$(printf '%s' "$s" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$s")
  fi
  s=$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')
  s=$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g')
  printf '%s' "$s"
}

# Folder pakai <org-slug>--<cn-slug>
SLUG_ORG="$(slugify "$ORG_NAME")"
SLUG_CN="$(slugify "$CN")"
PERSON_SLUG="${SLUG_ORG}--${SLUG_CN}"
OUT_DIR="$H/pki/issued/$PERSON_SLUG"
mkdir -p "$OUT_DIR"

# Ekstensi end-entity (PDF signing)
cat > "$EXTFILE" <<'EOF'
[pdfsign]
basicConstraints = critical, CA:false
keyUsage         = critical, digitalSignature, nonRepudiation
extendedKeyUsage = emailProtection, clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = email:copy
EOF

# Trim CN ke maks 64 char (batas X.509 untuk RDN)
CN_ORIG="$CN"
CN_LEN=$(printf '%s' "$CN" | wc -m | tr -d ' ')
if [ "$CN_LEN" -gt 64 ]; then
  CN=$(printf '%s' "$CN" | cut -c1-64)
  echo "WARN: CN terlalu panjang ($CN_LEN) → dipotong 64: \"$CN\""
  echo "      (Friendly name PFX & nama folder tetap pakai nama lengkap)"
fi

# Peringatan email (tidak memblok)
if ! printf '%s' "$EMAIL" | grep -Eq '.+@.+\..+'; then
  echo "WARN: Format email tampaknya tidak valid: \"$EMAIL\""
fi

# Escape '/' dalam subject
escape_slash() { printf '%s' "$1" | sed 's,/,\\/,g'; }
CN_ESC=$(escape_slash "$CN"); ORG_ESC=$(escape_slash "$ORG_NAME"); OU_ESC=$(escape_slash "$OU"); EMAIL_ESC=$(escape_slash "$EMAIL")

echo
echo "==> Ringkasan:"
echo "    Folder      : $OUT_DIR"
echo "    Slug        : $PERSON_SLUG  (org--nama)"
echo "    CN          : $CN_ORIG"
echo "    Email       : $EMAIL"
echo "    O/OU        : $ORG_NAME / $OU"
echo "    Berlaku     : $DAYS hari"
echo "    (INTER_CA_PASS untuk 'openssl ca'; PFX_PASS untuk file PFX/P12)"
echo

# Nama file DISESUAIKAN dengan nama folder/slug
KEY="$OUT_DIR/${PERSON_SLUG}.key"
CSR="$OUT_DIR/${PERSON_SLUG}.csr"
CRT="$OUT_DIR/${PERSON_SLUG}.crt"
PFX="$OUT_DIR/${PERSON_SLUG}.pfx"
P12="$OUT_DIR/${PERSON_SLUG}.p12"
META="$OUT_DIR/${PERSON_SLUG}-meta.txt"

# Konfirmasi overwrite jika file sudah ada
for f in "$KEY" "$CSR" "$CRT" "$PFX" "$P12" "$META"; do
  if [[ -f "$f" ]]; then
    read -r -p "File sudah ada: $f — overwrite? [y/N]: " ans
    ans="${ans:-N}"
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Dibatalkan."; exit 1; }
    break
  fi
done

# 1) PRIVATE KEY (RSA 3072)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$KEY"
chmod 600 "$KEY"

# 2) CSR (Subject personal + org info; SAN email:copy)
SUBJ="/C=ID/O=$ORG_ESC/OU=$OU_ESC/CN=$CN_ESC/emailAddress=$EMAIL_ESC"
openssl req -new -key "$KEY" -out "$CSR" -subj "$SUBJ" -addext "subjectAltName = email:copy"

# 3) SIGN CSR via Intermediate CA
openssl ca -config "$INT_CNF" -in "$CSR" -out "$CRT" \
  -extensions pdfsign -extfile "$EXTFILE" -days "$DAYS" -batch -passin "pass:$INTER_CA_PASS"

# 4) VERIFY chain
openssl verify -CAfile "$CHAIN" "$CRT"

# 5) EXPORT PFX (modern)
FRIENDLY="${CN_ORIG:-$CN} – $ORG_NAME (TTE)"
openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -name "$FRIENDLY" -passout "pass:$PFX_PASS" -out "$PFX"

# 5b) EXPORT P12 (legacy 3DES) opsional
openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -name "$FRIENDLY" -passout "pass:$PFX_PASS" \
  -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
  -out "$P12"

# === [TAMBAHAN] ARSIPKAN .p12 KE /home/sysadmin/pki/p12 ===
P12_ARCHIVE_DIR="/home/sysadmin/sign-api(well3)/p12"
mkdir -p "$P12_ARCHIVE_DIR"
cp -f "$P12" "$P12_ARCHIVE_DIR/${PERSON_SLUG}.p12"
chmod 600 "$P12_ARCHIVE_DIR/${PERSON_SLUG}.p12"
# === [SELESAI TAMBAHAN] ===

# 6) Metadata ringkas  (>>> DITAMBAHKAN: PFX pass <<<)
{
  echo "Person       : $CN_ORIG"
  echo "Email        : $EMAIL"
  echo "Organisation : $ORG_NAME"
  echo "Org Unit     : $OU"
  echo "Validity     : $DAYS days"
  echo "Folder       : $OUT_DIR"
  echo "Files        : ${PERSON_SLUG}.key | ${PERSON_SLUG}.csr | ${PERSON_SLUG}.crt | ${PERSON_SLUG}.pfx | ${PERSON_SLUG}-compat.p12"
  echo "PFX name     : $FRIENDLY"
  echo "PFX pass     : $PFX_PASS"
  date -u +"IssuedAt-UTC : %Y-%m-%dT%H:%M:%SZ"
} > "$META"

echo
ls -lh "$OUT_DIR"/${PERSON_SLUG}* 2>/dev/null || true
echo
echo "SELESAI ✅"
echo "Output dir : $OUT_DIR"
echo "PFX pass   : $PFX_PASS"
echo "Friendly   : $FRIENDLY"
echo "Arsip P12  : $P12_ARCHIVE_DIR/${PERSON_SLUG}.p12"
