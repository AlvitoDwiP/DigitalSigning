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
ISSUED_ROOT="${ISSUED_ROOT:-$H/pki/issued}"

command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl tidak ada"; exit 1; }

# ==================== INPUT ====================
# Arg 1: Identifier (File path, Serial Number, or NIK)
# Arg 2: Revocation Reason (default: unspecified)
TARGET_INPUT="${1:-}"
REASON="${2:-unspecified}"

if [[ -z "$TARGET_INPUT" ]]; then
  # Read from stdin if not passed via arguments
  read -r TARGET_INPUT || true
  read -r REASON_IN || true
  if [[ -n "${REASON_IN:-}" ]]; then
    REASON="$REASON_IN"
  fi
fi

if [[ -z "$TARGET_INPUT" ]]; then
  echo "ERROR: Identifier sertifikat (path, serial number, atau NIK) wajib diisi" >&2
  exit 1
fi

# Validasi Reason RFC 5280
case "$REASON" in
  unspecified|keyCompromise|CACompromise|affiliationChanged|superseded|cessationOfOperation|certificateHold|removeFromCRL)
    ;;
  *)
    echo "ERROR: Alasan pencabutan '$REASON' tidak valid. Pilihan: unspecified, keyCompromise, CACompromise, affiliationChanged, superseded, cessationOfOperation, certificateHold, removeFromCRL" >&2
    exit 1
    ;;
esac

# ==================== LOCATE CERTIFICATE FILE ====================
CRT_FILE=""

# 1. Cek apakah TARGET_INPUT merupakan path file langsung
if [[ -f "$TARGET_INPUT" ]]; then
  CRT_FILE="$(cd "$(dirname "$TARGET_INPUT")" && pwd)/$(basename "$TARGET_INPUT")"
fi

# 2. Cek apakah berupa NIK (16 digit angka)
if [[ -z "$CRT_FILE" && "$TARGET_INPUT" =~ ^[0-9]{16}$ ]]; then
  # Cari di issued directory
  FOUND_CRT=$(find "$ISSUED_ROOT" -type f -name "*.crt" -exec grep -l -i "$TARGET_INPUT" {} + 2>/dev/null || true)
  if [[ -z "$FOUND_CRT" ]]; then
    # Cari berdasarkan file p12 di subdirektori
    P12_MATCH=$(find "$ISSUED_ROOT" -type f -name "${TARGET_INPUT}.p12" 2>/dev/null | head -n 1 || true)
    if [[ -n "$P12_MATCH" ]]; then
      PARENT_DIR="$(dirname "$P12_MATCH")"
      DIR_NAME="$(basename "$PARENT_DIR")"
      if [[ -f "$PARENT_DIR/${DIR_NAME}.crt" ]]; then
        CRT_FILE="$PARENT_DIR/${DIR_NAME}.crt"
      fi
    fi
  else
    CRT_FILE="$(echo "$FOUND_CRT" | head -n 1)"
  fi
fi

# 3. Cek apakah berupa serial number (hex string, e.g. 1001 atau 110F)
if [[ -z "$CRT_FILE" ]]; then
  NORM_SERIAL="$(echo "$TARGET_INPUT" | tr '[:lower:]' '[:upper:]' | tr -cd '0-9A-F')"
  if [[ -n "$NORM_SERIAL" ]]; then
    # Cek di newcerts/
    CANDIDATE="$INT_DIR/newcerts/${NORM_SERIAL}.pem"
    if [[ -f "$CANDIDATE" ]]; then
      CRT_FILE="$CANDIDATE"
    else
      # Cari di newcerts dengan leading zeros atau format serial
      CANDIDATE_FIND=$(find "$INT_DIR/newcerts" -type f -name "*${NORM_SERIAL}*.pem" 2>/dev/null | head -n 1 || true)
      if [[ -n "$CANDIDATE_FIND" ]]; then
        CRT_FILE="$CANDIDATE_FIND"
      fi
    fi
  fi
fi

# 4. Fallback search across issued certificates
if [[ -z "$CRT_FILE" ]]; then
  FOUND=$(find "$ISSUED_ROOT" -type f -name "*${TARGET_INPUT}*.crt" 2>/dev/null | head -n 1 || true)
  if [[ -n "$FOUND" ]]; then
    CRT_FILE="$FOUND"
  fi
fi

if [[ -z "$CRT_FILE" || ! -f "$CRT_FILE" ]]; then
  echo "ERROR: Berkas sertifikat untuk identifier '$TARGET_INPUT' tidak ditemukan" >&2
  exit 1
fi

# Ekstrak serial number aktual dari sertifikat
SERIAL_HEX="$(openssl x509 -in "$CRT_FILE" -noout -serial | cut -d'=' -f2 | tr '[:lower:]' '[:upper:]')"
if [[ -z "$SERIAL_HEX" ]]; then
  echo "ERROR: Gagal membaca nomor seri dari berkas sertifikat $CRT_FILE" >&2
  exit 1
fi

# ==================== VALIDASI CA ====================
openssl pkey -in "$INTER_KEY" -passin env:INTER_CA_PASS -noout >/dev/null

# ==================== REVOKE CERTIFICATE ====================
mkdir -p "$CRL_DIR"

REVOKE_OUT=""
set +e
REVOKE_OUT=$(openssl ca -config "$INT_CNF" -revoke "$CRT_FILE" -crl_reason "$REASON" -passin env:INTER_CA_PASS 2>&1)
REVOKE_STATUS=$?
set -e

if [[ $REVOKE_STATUS -ne 0 ]]; then
  if echo "$REVOKE_OUT" | grep -qi "Already revoked"; then
    echo "NOTICE: Sertifikat dengan serial $SERIAL_HEX sudah berada dalam status revoked"
  else
    echo "ERROR: Gagal mencabut sertifikat: $REVOKE_OUT" >&2
    exit 1
  fi
fi

# ==================== GENERATE UPDATED CRL ====================
CRL_PEM="$CRL_DIR/intermediate-ca.crl"
CRL_DER="$CRL_DIR/intermediate-ca.crl.der"

openssl ca -config "$INT_CNF" -gencrl -out "$CRL_PEM" -passin env:INTER_CA_PASS
openssl crl -in "$CRL_PEM" -outform DER -out "$CRL_DER"

echo "REVOKED_SERIAL : $SERIAL_HEX"
echo "REASON         : $REASON"
echo "CERT_FILE      : $CRT_FILE"
echo "CRL_PEM        : $CRL_PEM"
echo "CRL_DER        : $CRL_DER"
echo "SELESAI ✅"

