#!/usr/bin/env bash
# PUSTIK MKRI — Batch Issue Personal Cert (PDF signing)
# Input CSV/TSV kolom: org,ou,cn,email,nik,pfx_pass   (header boleh ada)
# Output per orang: $H/pki/issued/<org-slug>--<cn-slug>/{key,csr,crt,pfx,<NIK>.p12,meta.txt}
# Arsip .p12 (NIK) → $P12_ARCHIVE_DIR/<NIK>.p12

set -Eeo pipefail
umask 077
trap 'echo "❌ ERROR (exit $?) di baris $LINENO: $BASH_COMMAND" >&2' ERR
[[ "${DEBUG:-0}" == "1" ]] && set -x

# ------------------ DEFAULTS (bisa dioverride via ENV) ------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_H="$(cd "$SCRIPT_DIR/.." && pwd)"
H="${H:-$DEFAULT_H}"
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-$H/sign-api(well3)/p12}"
DELIM="${DELIM:-,}"                     # ',', ';', atau $'\t'
OVERWRITE="${OVERWRITE:-1}"             # 1 timpa, 0 skip
CONTINUE_ON_ERROR="${CONTINUE_ON_ERROR:-1}"
DEFAULT_DAYS="${DEFAULT_DAYS:-730}"
INTER_CA_PASS="InterPass!ChangeMe123"   # hardcoded sesuai permintaan
# ------------------------------------------------------------------------

# Lokasi CA
INT_DIR="$H/pki/intermediate"
export INT_DIR="$INT_DIR"
INT_CNF="$INT_DIR/openssl.cnf"
CHAIN="$INT_DIR/certs/ca-chain.crt"
EXTFILE="$INT_DIR/pdfsign-ext.cnf"
INTER_KEY="$INT_DIR/private/intermediate-ca.key"

# Depedensi
command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ditemukan di PATH"; exit 1; }
if ! command -v iconv >/dev/null 2>&1; then
  echo "WARN: 'iconv' tidak ada; slugify tanpa transliterasi."
fi

# Argumen
if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <daftar.csv|tsv>"; exit 1
fi
INPUT_FILE="$1"
[[ -f "$INPUT_FILE" ]] || { echo "ERROR: file input tidak ditemukan: $INPUT_FILE"; exit 1; }

# Info awal
echo "==[CONFIG]==============================="
echo "H                : $H"
echo "INT_CNF          : $INT_CNF"
echo "CHAIN            : $CHAIN"
echo "INTER_KEY        : $INTER_KEY"
echo "P12_ARCHIVE_DIR  : $P12_ARCHIVE_DIR"
echo "DELIM            : $(printf %q "$DELIM")"
echo "OVERWRITE        : $OVERWRITE"
echo "CONTINUE_ON_ERROR: $CONTINUE_ON_ERROR"
echo "DEFAULT_DAYS     : $DEFAULT_DAYS"
echo "INPUT_FILE       : $INPUT_FILE"
echo "========================================="
echo

# Cek CA files
[[ -f "$INT_CNF"   ]] || { echo "ERROR: $INT_CNF tidak ada."; exit 1; }
[[ -f "$CHAIN"    ]] || { echo "ERROR: $CHAIN tidak ada."; exit 1; }
[[ -f "$INTER_KEY" ]] || { echo "ERROR: $INTER_KEY tidak ada."; exit 1; }

# Validasi password intermediate (fail-fast)
if ! openssl pkey -in "$INTER_KEY" -passin "pass:$INTER_CA_PASS" -noout >/dev/null 2>&1; then
  echo "ERROR: Password Intermediate CA salah atau key tidak bisa dibaca: $INTER_KEY"; exit 1
fi

# Ekstensi PDF signing
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

slugify () {
  local s="$1"
  if command -v iconv >/dev/null 2>&1; then
    s=$(printf '%s' "$s" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$s")
  fi
  s=$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')
  s=$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g')
  printf '%s' "$s"
}
trim () { printf '%s' "$1" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g'; }
escape_slash() { printf '%s' "$1" | sed 's,/,\\/,g'; }

is_header_line () {
  # normalize lower-case + strip CR + strip BOM di baris pertama
  local l
  l="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/\r$//' | sed '1s/^\xEF\xBB\xBF//')"
  [[ "$l" =~ ^[[:space:]]*org[[:space:]]*${DELIM}[[:space:]]*ou${DELIM} ]]
}

generate_one () {
  local ORG_NAME="$1" OU="$2" CN_ORIG="$3" EMAIL="$4" NIK_RAW="$5" PFX_PASS="$6"
  local DAYS="${7:-$DEFAULT_DAYS}"

  local NIK_SAFE; NIK_SAFE="$(printf '%s' "$NIK_RAW" | tr -cd '0-9')"
  [[ -n "$NIK_SAFE" ]] || { echo "  -> ERROR: NIK kosong → skip"; return 1; }
  [[ "$NIK_SAFE" =~ ^[0-9]{16}$ ]] || echo "  -> WARN: NIK bukan 16 digit (pakai: \"$NIK_SAFE\")"

  local SLUG_ORG SLUG_CN PERSON_SLUG OUT_DIR
  SLUG_ORG="$(slugify "$ORG_NAME")"
  SLUG_CN="$(slugify "$CN_ORIG")"
  PERSON_SLUG="${SLUG_ORG}--${SLUG_CN}"
  OUT_DIR="$H/pki/issued/$PERSON_SLUG"
  mkdir -p "$OUT_DIR"

  local KEY CSR CRT PFX P12_NIK META
  KEY="$OUT_DIR/${PERSON_SLUG}.key"
  CSR="$OUT_DIR/${PERSON_SLUG}.csr"
  CRT="$OUT_DIR/${PERSON_SLUG}.crt"
  PFX="$OUT_DIR/${PERSON_SLUG}.pfx"
  P12_NIK="$OUT_DIR/${NIK_SAFE}.p12"
  META="$OUT_DIR/${PERSON_SLUG}-meta.txt"

  if [[ "$OVERWRITE" != "1" ]]; then
    for f in "$KEY" "$CSR" "$CRT" "$PFX" "$P12_NIK" "$META"; do
      if [[ -f "$f" ]]; then
        echo "  -> SKIP (sudah ada): $f"; return 0
      fi
    done
  else
    rm -f "$KEY" "$CSR" "$CRT" "$PFX" "$P12_NIK" "$META" 2>/dev/null || true
  fi

  # Trim CN ke 64
  local CN="$CN_ORIG"
  local CN_LEN; CN_LEN=$(printf '%s' "$CN" | wc -m | tr -d ' ')
  if (( CN_LEN > 64 )); then
    CN=$(printf '%s' "$CN" | cut -c1-64)
    echo "  -> WARN: CN > 64, dipotong: \"$CN\""
  fi
  [[ "$EMAIL" =~ .+@.+\..+ ]] || echo "  -> WARN: Email tampak tidak valid: \"$EMAIL\""

  local CN_ESC ORG_ESC OU_ESC EMAIL_ESC
  CN_ESC=$(escape_slash "$CN"); ORG_ESC=$(escape_slash "$ORG_NAME"); OU_ESC=$(escape_slash "$OU"); EMAIL_ESC=$(escape_slash "$EMAIL")

  echo "  -> gen key"
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$KEY"
  chmod 600 "$KEY" || true

  echo "  -> make CSR"
  local SUBJ="/C=ID/O=$ORG_ESC/OU=$OU_ESC/CN=$CN_ESC/emailAddress=$EMAIL_ESC"
  openssl req -new -key "$KEY" -out "$CSR" -subj "$SUBJ" -addext "subjectAltName = email:copy"

  echo "  -> sign CSR (days=$DAYS)"
  openssl ca -config "$INT_CNF" -in "$CSR" -out "$CRT" \
    -extensions pdfsign -extfile "$EXTFILE" -days "$DAYS" -batch -passin "pass:$INTER_CA_PASS"

  echo "  -> verify chain"
  openssl verify -CAfile "$CHAIN" "$CRT" >/dev/null

  local FRIENDLY="${CN_ORIG:-$CN} – $ORG_NAME (TTE)"

  echo "  -> export PFX"
  openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
    -name "$FRIENDLY" -passout "pass:$PFX_PASS" -out "$PFX"

  echo "  -> export P12 (legacy, NIK)"
  openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -certfile "$CHAIN" \
    -name "$FRIENDLY" -passout "pass:$PFX_PASS" \
    -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
    -out "$P12_NIK"

  echo "  -> arsip .p12 ke $P12_ARCHIVE_DIR"
  mkdir -p "$P12_ARCHIVE_DIR"
  cp -f "$P12_NIK" "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12"
  chmod 600 "$P12_ARCHIVE_DIR/${NIK_SAFE}.p12" || true

  echo "  -> write meta"
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

  echo "  -> OK  →  $OUT_DIR"
}

# Siapkan file sementara (strip CRLF dan BOM)
CLEAN_TMP="$(mktemp)"
trap 'rm -f "$CLEAN_TMP" 2>/dev/null || true' EXIT
# strip CR (\r) dan BOM di baris pertama
sed -e 's/\r$//' "$INPUT_FILE" | sed '1s/^\xEF\xBB\xBF//' > "$CLEAN_TMP"

# Hitung total baris data
TOTAL=0
while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  [[ "${line:0:1}" == "#" ]] && continue
  if is_header_line "$line"; then continue; fi
  ((TOTAL+=1))
done < "$CLEAN_TMP"

echo "Total baris data: $TOTAL"
[[ "$TOTAL" -gt 0 ]] || { echo "Tidak ada baris data yang diproses (cek header/delimiter)."; exit 1; }
echo

# Proses per baris
IDX=0; OK=0; FAIL=0
while IFS="$DELIM" read -r ORG OU CN EMAIL NIK PFXPASS REST; do
  [[ -z "${ORG// }" ]] && continue
  [[ "${ORG:0:1}" == "#" ]] && continue
  line_join="$ORG$DELIM$OU$DELIM$CN$DELIM$EMAIL$DELIM$NIK$DELIM$PFXPASS"
  if is_header_line "$line_join"; then continue; fi

  ORG="$(trim "$ORG")"; OU="$(trim "$OU")"; CN="$(trim "$CN")"
  EMAIL="$(trim "$EMAIL")"; NIK="$(trim "$NIK")"; PFXPASS="$(trim "${PFXPASS:-}")"
  [[ -n "$PFXPASS" ]] || PFXPASS="PfxPass!ChangeMe123"

  ((IDX+=1))
  echo "[${IDX}/${TOTAL}] ${CN} — ${ORG}  (NIK: ${NIK})"
  if generate_one "$ORG" "$OU" "$CN" "$EMAIL" "$NIK" "$PFXPASS" "$DEFAULT_DAYS"; then
    ((OK+=1))
  else
    ((FAIL+=1))
    if [[ "$CONTINUE_ON_ERROR" != "1" ]]; then
      echo "STOP karena error (set CONTINUE_ON_ERROR=1 untuk lanjut)."
      exit 1
    fi
  fi
  echo
done < "$CLEAN_TMP"

echo "SELESAI ✅  Total: $TOTAL | OK: $OK | FAIL: $FAIL"
echo "Arsip P12: $P12_ARCHIVE_DIR"
