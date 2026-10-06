#!/usr/bin/env bash
set -Eeo pipefail
umask 077
trap 'echo "❌ Error pada baris $LINENO: $BASH_COMMAND" >&2' ERR

# ==================== DEFAULTS (tidak perlu export) ====================
H="${H:-/home/sysadmin}"                                 # root PKI
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-/home/sysadmin/sign-api(well3)/p12}"
DEFAULT_ORG_NAME="${DEFAULT_ORG_NAME:-Universitas B}"
DEFAULT_OU="${DEFAULT_OU:-TTE}"
DEFAULT_CN="${DEFAULT_CN:-Nama Penandatangan}"
DEFAULT_EMAIL="${DEFAULT_EMAIL:-penandatangan@univ-b.ac.id}"
DEFAULT_DAYS="${DEFAULT_DAYS:-730}"
DEFAULT_PFX_PASS="${DEFAULT_PFX_PASS:-12345678}"
# Hardcode password Intermediate CA (bisa override via ENV INTER_CA_PASS)
INTER_CA_PASS="${INTER_CA_PASS:-InterPass!ChangeMe123}"
# =======================================================================

# Lokasi CA (harus sudah ada)
INT_DIR="$H/pki/intermediate"
INT_CNF="$INT_DIR/openssl.cnf"
CHAIN="$INT_DIR/certs/ca-chain.crt"
EXTFILE="$INT_DIR/pdfsign-ext.cnf"
INTER_KEY="$INT_DIR/private/intermediate-ca.key"

command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ditemukan di PATH"; exit 1; }
command -v iconv   >/dev/null 2>&1 || echo "WARN: 'iconv' tidak ada; slugify tanpa transliterasi."

# ==== Input (dengan default; tidak perlu export) ====
read -r -p "Nama Organisasi (O=...) [${DEFAULT_ORG_NAME}]: " ORG_NAME; ORG_NAME="${ORG_NAME:-$DEFAULT_ORG_NAME}"
read -r -p "Unit (OU=...) [${DEFAULT_OU}]: " OU; OU="${OU:-$DEFAULT_OU}"
read -r -p "Nama personal / CN [${DEFAULT_CN}]: " CN; CN="${CN:-$DEFAULT_CN}"
read -r -p "Email personal [${DEFAULT_EMAIL}]: " EMAIL; EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
read -r -p "Masa berlaku (hari) [${DEFAULT_DAYS}]: " DAYS; DAYS="${DAYS:-$DEFAULT_DAYS}"

# NIK (wajib)
read -r -p "Nomor Induk Kependudukan (NIK) [wajib, 16 digit]: " NIK_RAW
NIK_SAFE="$(printf '%s' "$NIK_RAW" | tr -cd '0-9')"
[[ -n "$NIK_SAFE" ]] || { echo "ERROR: NIK wajib diisi."; exit 1; }
if ! [[ "$NIK_SAFE" =~ ^[0-9]{16}$ ]]; then
  echo "WARN: NIK tampaknya bukan 16 digit (dipakai: \"$NIK_SAFE\"). Lanjutkan."
fi

# Password PFX/P12 output (boleh kosong → pakai default)
read -s -r -p "Password PFX output (kosong=${DEFAULT_PFX_PASS}): " PFX_PASS
echo
PFX_PASS="${PFX_PASS:-$DEFAULT_PFX_PASS}"

# ==== Cek CA files ====
[[ -f "$INT_CNF"   ]] || { echo "ERROR: $INT_CNF tidak ada."; exit 1; }
[[ -f "$CHAIN"    ]] || { echo "ERROR: $CHAIN tidak ada (gabungan intermediate+root)."; exit 1; }
[[ -f "$INTER_KEY" ]] || { echo "ERROR: $INTER_KEY tidak ada."; exit 1; }

# Validasi password Intermediate CA (fail-fast)
if ! openssl pkey -in "$INTER_KEY" -passin "pass:$INTER_CA_PASS" -noout >/dev/null 2>&1; then
  echo "ERROR: Password Intermediate CA salah atau key tidak bisa dibaca: $INTER_KEY"
  echo "       Perbaiki variabel INTER_CA_PASS di script (atau export sebelum jalan)."
  exit 1
fi

# ==== Utils ====
slugify () {
  local s="$1"
  if command -v iconv >/dev/null 2>&1; then
    s=$(printf '%s' "$s" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$s")
  fi
  s=$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')
  s=$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g')
  printf '%s' "$s"
}
escape_slash() { printf '%s' "$1" | sed 's,/,\\/,g'; }

# ==== Slug & output dir ====
SLUG_ORG="$(slugify "$ORG_NAME")"
SLUG_CN="$(slugify "$CN")"
PERSON_SLUG="${SLUG_ORG}--${SLUG_CN}"
OUT_DIR="$H/pki/issued/$PERSON_SLUG"
mkdir -p "$OUT_DIR"

# ==== Ekstensi end-entity (PDF signing) ====
mkdir -p "$INT_DIR"
cat > "$EXTFILE" <<'EOF'
[pdfsign]
basicConstraints = critical, CA:false
keyUsage         = critical, digitalSignature, nonRepudiation
extendedKeyUsage = emailProtection, clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = email:copy
EOF

# Trim CN ke maks 64 char (batas X.509)
CN_ORIG="$CN"
CN_LEN=$(printf '%s' "$CN" | wc -m | tr -d ' ')
if [ "$CN_LEN" -gt 64 ]; then
  CN=$(printf '%s' "$CN" | cut -c1-64)
  echo "WARN: CN terlalu panjang ($CN_LEN) → dipotong 64: \"$CN\""
fi
# Peringatan email
if ! printf '%s' "$EMAIL" | grep -Eq '.+@.+\..+'; then
  echo "WARN: Format email tampaknya tidak valid: \"$EMAIL\""
fi

CN_ESC=$(escape_slash "$CN"); ORG_ESC=$(escape_slash "$ORG_NAME"); OU_ESC=$(escape_slash "$OU"); EMAIL_ESC=$(escape_slash "$EMAIL")

echo
echo "==> Ringkasan:"
echo "    Folder      : $OUT_DIR"
echo "    Slug        : $PERSON_SLUG  (org--nama)"
echo "    CN          : $CN_ORIG"
echo "    Email       : $EMAIL"
echo "    O/OU        : $ORG_NAME / $OU"
echo "    Berlaku     : $DAYS hari"
echo "    NIK (file)  : $NIK_SAFE.p12"
echo "    P12 archive : $P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
echo

# ==== Nama file ====
KEY="$OUT_DIR/${PERSON_SLUG}.key"
CSR="$OUT_DIR/${PERSON_SLUG}.csr"
CRT="$OUT_DIR/${PERSON_SLUG}.crt"
PFX="$OUT_DIR/${PERSON_SLUG}.pfx"
P12_NIK="$OUT_DIR/${NIK_SAFE}.p12"
META="$OUT_DIR/${PERSON_SLUG}-meta.txt"

# Konfirmasi overwrite jika file sudah ada
for f in "$KEY" "$CSR" "$CRT" "$PFX" "$P12_NIK" "$META"; do
  if [[ -f "$f" ]]; then
    read -r -p "File sudah ada: $f — overwrite? [y/N]: " ans
    ans="${ans:-N}"
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Dibatalkan."; exit 1; }
    break
  fi
done

echo "→ Generate key (RSA 3072)"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$KEY"
chmod 600 "$KEY"

echo "→ Buat CSR"
SUBJ="/C=ID/O=$ORG_ESC/OU=$OU_ESC/CN=$CN_ESC/emailAddress=$EMAIL_ESC"
openssl req -new -key "$KEY" -out "$CSR" -subj "$SUBJ" -addext "subjectAltName = email:copy"

echo "→ Tanda tangani CSR (Intermediate, ${DAYS} hari)"
openssl ca -config "$INT_CNF" -in "$CSR" -out "$CRT" \
  -extensions pdfsign -extfile "$EXTFILE" -days "$DAYS" -batch -passin "pass:$INTER_CA_PASS"

echo "→ Verifikasi chain"
openssl verify -CAfile "$CHAIN" "$CRT"

FRIENDLY="${CN_ORIG:-$CN} – $ORG_NAME (TTE)"

echo "→ Export PFX (modern)"
openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -name "$FRIENDLY" -passout "pass:$PFX_PASS" -out "$PFX"

echo "→ Export P12 (legacy 3DES), nama = NIK"
openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
  -name "$FRIENDLY" -passout "pass:$PFX_PASS" \
  -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
  -out "$P12_NIK"

echo "→ Arsipkan ke $P12_ARCHIVE_DIR"
mkdir -p "$P12_ARCHIVE_DIR"
cp -f "$P12_NIK" "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
chmod 600 "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12" || true

echo "→ Tulis metadata"
{
  echo "Person       : $CN_ORIG"
  echo "Email        : $EMAIL"
  echo "NIK          : $NIK_SAFE"
  echo "Organisation : $ORG_NAME"
  echo "Org Unit     : $OU"
  echo "Validity     : $DAYS days"
  echo "Folder       : $OUT_DIR"
  echo "Files        : ${PERSON_SLUG}.key | ${PERSON_SLUG}.csr | ${PERSON_SLUG}.crt | ${PERSON_SLUG}.pfx | ${NIK_SAFE}.p12"
  echo "PFX name     : $FRIENDLY"
  echo "PFX pass     : $PFX_PASS"
  date -u +"IssuedAt-UTC : %Y-%m-%dT%H:%M:%SZ"
} > "$META"

echo
ls -lh "$OUT_DIR"/${PERSON_SLUG}* "$OUT_DIR"/${NIK_SAFE}.p12 2>/dev/null || true
echo
echo "SELESAI ✅"
echo "Output dir : $OUT_DIR"
echo "PFX pass   : $PFX_PASS"
echo "Friendly   : $FRIENDLY"
echo "Arsip P12  : $P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
