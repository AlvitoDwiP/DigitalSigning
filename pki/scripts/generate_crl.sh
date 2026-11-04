#!/usr/bin/env bash
set -Eeo pipefail
umask 077
trap 'echo "❌ Error pada baris $LINENO" >&2' ERR

# ==================== DEFAULTS ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_H="$(cd "$SCRIPT_DIR/../.." && pwd)"
H="${H:-$DEFAULT_H}"

# ==================== ENVIRONMENT & CA SECRET ====================
ENV_MODE="$(printf '%s' "${ENVIRONMENT:-development}" | tr '[:upper:]' '[:lower:]')"

if [[ "$ENV_MODE" == "production" ]]; then
  if [[ -z "${INTER_CA_PASS:-}" ]]; then
    echo "ERROR: INTER_CA_PASS wajib dikonfigurasi pada mode production" >&2
    exit 1
  fi
  if [[ "$INTER_CA_PASS" == "InterPass!ChangeMe123" ]]; then
    echo "ERROR: INTER_CA_PASS tidak boleh menggunakan secret default pada mode production" >&2
    exit 1
  fi
else
  INTER_CA_PASS="${INTER_CA_PASS:-InterPass!ChangeMe123}"
fi
export INTER_CA_PASS

# ==================== CA PATH ====================
INT_DIR="${INT_DIR:-$H/pki/intermediate}"
export INT_DIR
INT_CNF="${INT_CNF:-$INT_DIR/openssl.cnf}"
INTER_KEY="${INTER_KEY:-$INT_DIR/private/intermediate-ca.key}"
CRL_DIR="${CRL_DIR:-$INT_DIR/crl}"

command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ada"; exit 1; }

# ==================== VALIDASI CA ====================
openssl pkey -in "$INTER_KEY" -passin env:INTER_CA_PASS -noout >/dev/null

# ==================== GENERATE CRL ====================
mkdir -p "$CRL_DIR"

CRL_PEM="$CRL_DIR/intermediate-ca.crl"
CRL_DER="$CRL_DIR/intermediate-ca.crl.der"

openssl ca -config "$INT_CNF" -gencrl -out "$CRL_PEM" -passin env:INTER_CA_PASS
openssl crl -in "$CRL_PEM" -outform DER -out "$CRL_DER"

# Tampilkan ringkasan info CRL
CRL_NUMBER="$(openssl crl -in "$CRL_PEM" -noout -crlnumber 2>/dev/null | cut -d'=' -f2 || echo "N/A")"
LAST_UPDATE="$(openssl crl -in "$CRL_PEM" -noout -lastupdate 2>/dev/null | cut -d'=' -f2 || echo "N/A")"
NEXT_UPDATE="$(openssl crl -in "$CRL_PEM" -noout -nextupdate 2>/dev/null | cut -d'=' -f2 || echo "N/A")"

echo "CRL_PEM     : $CRL_PEM"
echo "CRL_DER     : $CRL_DER"
echo "CRL_NUMBER  : $CRL_NUMBER"
echo "LAST_UPDATE : $LAST_UPDATE"
echo "NEXT_UPDATE : $NEXT_UPDATE"
echo "SELESAI ✅"

