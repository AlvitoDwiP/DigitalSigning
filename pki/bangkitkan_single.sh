#!/usr/bin/env bash
set -Eeo pipefail
umask 077
trap 'echo "❌ Error pada baris $LINENO: $BASH_COMMAND" >&2' ERR

# ==================== DEFAULTS ====================
H="${H:-/home/sysadmin}"
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-/home/sysadmin/sign-api(well3)/p12}"

DEFAULT_ORG_NAME="Universitas B"
DEFAULT_OU="TTE"
DEFAULT_CN="Nama Penandatangan"
DEFAULT_EMAIL="penandatangan@univ-b.ac.id"
DEFAULT_DAYS="730"
DEFAULT_PFX_PASS="12345678"
INTER_CA_PASS="InterPass!ChangeMe123"

# ==================== CA PATH ====================
INT_DIR="$H/pki/intermediate"
INT_CNF="$INT_DIR/openssl.cnf"
CHAIN="$INT_DIR/certs/ca-chain.crt"
EXTFILE="$INT_DIR/pdfsign-ext.cnf"
INTER_KEY="$INT_DIR/private/intermediate-ca.key"

command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ada"; exit 1; }

# ==================== INPUT (STDIN / WEB SAFE) ====================
read -r ORG_NAME;   ORG_NAME="${ORG_NAME:-$DEFAULT_ORG_NAME}"
read -r OU;         OU="${OU:-$DEFAULT_OU}"
read -r CN;         CN="${CN:-$DEFAULT_CN}"
read -r EMAIL;      EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
read -r DAYS;       DAYS="${DAYS:-$DEFAULT_DAYS}"
read -r NIK_RAW
read -r PFX_PASS;   PFX_PASS="${PFX_PASS:-$DEFAULT_PFX_PASS}"

NIK_SAFE="$(printf '%s' "$NIK_RAW" | tr -cd '0-9')"
[[ -n "$NIK_SAFE" ]] || { echo "ERROR: NIK wajib"; exit 1; }

# ==================== VALIDASI CA ====================
openssl pkey -in "$INTER_KEY" -passin "pass:$INTER_CA_PASS" -noout >/dev/null

# ==================== SLUG & OUTDIR (IDENTIK) ====================
slugify () {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g'
}

SLUG_ORG="$(slugify "$ORG_NAME")"
SLUG_CN="$(slugify "$CN")"
PERSON_SLUG="${SLUG_ORG}--${SLUG_CN}"
OUT_DIR="$H/pki/issued/$PERSON_SLUG"
mkdir -p "$OUT_DIR"

# ==================== EXTENSION FILE (IDENTIK) ====================
cat > "$EXTFILE" <<'EOF'
[pdfsign]
basicConstraints = critical, CA:false
keyUsage         = critical, digitalSignature, nonRepudiation
extendedKeyUsage = emailProtection, clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = email:copy
EOF

# ==================== FILE NAMES (IDENTIK) ====================
KEY="$OUT_DIR/${PERSON_SLUG}.key"
CSR="$OUT_DIR/${PERSON_SLUG}.csr"
CRT="$OUT_DIR/${PERSON_SLUG}.crt"
PFX="$OUT_DIR/${PERSON_SLUG}.pfx"
P12_NIK="$OUT_DIR/${NIK_SAFE}.p12"
META="$OUT_DIR/${PERSON_SLUG}-meta.txt"

# ==================== GENERATE KEY (NON INTERACTIVE) ====================
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$KEY"
chmod 600 "$KEY"

# ==================== CSR ====================
SUBJ="/C=ID/O=$ORG_NAME/OU=$OU/CN=$CN/emailAddress=$EMAIL"
openssl req -new -key "$KEY" -out "$CSR" -subj "$SUBJ" -addext "subjectAltName = email:copy"

# ==================== SIGN ====================
openssl ca -config "$INT_CNF" -in "$CSR" -out "$CRT" \
  -extensions pdfsign -extfile "$EXTFILE" \
  -days "$DAYS" -batch -passin "pass:$INTER_CA_PASS"

openssl verify -CAfile "$CHAIN" "$CRT"

# ==================== EXPORT ====================
openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -name "$CN – $ORG_NAME (TTE)" -passout "pass:$PFX_PASS" -out "$PFX"

openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
  -name "$CN – $ORG_NAME (TTE)" -passout "pass:$PFX_PASS" -out "$P12_NIK"

# ==================== ARCHIVE (IDENTIK) ====================
mkdir -p "$P12_ARCHIVE_DIR"
cp -f "$P12_NIK" "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
chmod 600 "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12" || true

# ==================== META ====================
{
  echo "Person       : $CN"
  echo "Email        : $EMAIL"
  echo "NIK          : $NIK_SAFE"
  echo "Organisation : $ORG_NAME"
  echo "Org Unit     : $OU"
  echo "Validity     : $DAYS days"
  echo "Folder       : $OUT_DIR"
  echo "Files        : ${PERSON_SLUG}.key | ${PERSON_SLUG}.csr | ${PERSON_SLUG}.crt | ${PERSON_SLUG}.pfx | ${NIK_SAFE}.p12"
  date -u +"IssuedAt-UTC : %Y-%m-%dT%H:%M:%SZ"
} > "$META"

echo "SELESAI ✅"
echo "Output dir : $OUT_DIR"
echo "Arsip P12  : $P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
