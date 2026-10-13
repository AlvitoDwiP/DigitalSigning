#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_H="$(cd "$SCRIPT_DIR/../.." && pwd)"
H="${H:-$DEFAULT_H}"
export INT_DIR="$H/pki/intermediate"
DEFAULT_DAYS="${DEFAULT_DAYS:-730}"

if [[ $# -lt 1 ]]; then
  echo '{"status":"FAILED","error":"Usage: bangkitkan_banyak.sh <file.tsv>"}'
  exit 1
fi

INPUT_FILE="$1"
if [[ ! -f "$INPUT_FILE" ]]; then
  echo '{"status":"FAILED","error":"TSV file not found"}'
  exit 1
fi

# Process TSV line by line
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines or comments
  [[ -z "${line// }" ]] && continue
  [[ "${line:0:1}" == "#" ]] && continue

  # Parse TSV (expecting exactly 6 fields: ORG, OU, CN, EMAIL, NIK, PFXPASS)
  IFS=$'\t' read -r ORG OU CN EMAIL NIK PFXPASS EXTRA <<< "$line"

  # Validate fields
  if [[ -n "${EXTRA:-}" ]] || [[ -z "${ORG:-}" ]] || [[ -z "${OU:-}" ]] || [[ -z "${CN:-}" ]] || [[ -z "${EMAIL:-}" ]] || [[ -z "${NIK:-}" ]] || [[ -z "${PFXPASS:-}" ]]; then
    nik_display="${NIK:-unknown}"
    printf '{"nik":"%s","status":"FAILED","error":"Invalid TSV row format: missing or extra fields"}\n' "$nik_display"
    continue
  fi

  # Validate NIK is exactly 16 digits
  if ! [[ "$NIK" =~ ^[0-9]{16}$ ]]; then
    printf '{"nik":"%s","status":"FAILED","error":"Invalid NIK: must be 16 digits"}\n' "$NIK"
    continue
  fi

  # Call bangkitkan_single.sh capturing stdout and stderr
  set +e
  single_output=$("$SCRIPT_DIR/bangkitkan_single.sh" <<EOF 2>&1
$ORG
$OU
$CN
$EMAIL
$DEFAULT_DAYS
$NIK
$PFXPASS
EOF
)
  exit_code=$?
  set -e

  if [[ $exit_code -ne 0 ]]; then
    printf '{"nik":"%s","status":"FAILED","error":"PKI generation failed"}\n' "$NIK"
    continue
  fi

  # Extract Output dir
  out_dir=""
  while IFS= read -r outline; do
    if [[ "$outline" =~ Output\ dir\ :\ (.*) ]]; then
      out_dir="${BASH_REMATCH[1]}"
      out_dir="$(echo "$out_dir" | xargs)"
    fi
  done <<< "$single_output"

  if [[ -z "$out_dir" ]] || [[ ! -d "$out_dir" ]]; then
    printf '{"nik":"%s","status":"FAILED","error":"Output directory not found"}\n' "$NIK"
    continue
  fi

  folder_name="$(basename "$out_dir")"
  crt_file="$out_dir/${folder_name}.crt"
  p12_file="$out_dir/${NIK}.p12"

  if [[ ! -f "$crt_file" ]]; then
    printf '{"nik":"%s","status":"FAILED","error":"Certificate file not found"}\n' "$NIK"
    continue
  fi

  if [[ ! -f "$p12_file" ]] || [[ ! -s "$p12_file" ]] || ! openssl pkcs12 -in "$p12_file" -passin "pass:$PFXPASS" -noout -nokeys 2>/dev/null; then
    printf '{"nik":"%s","status":"FAILED","error":"P12 file missing or validation failed"}\n' "$NIK"
    continue
  fi

  # Extract certificate info via openssl
  serial=""
  not_before=""
  not_after=""
  fingerprint=""

  while IFS='=' read -r k v; do
    case "$k" in
      serial) serial="$(echo "$v" | xargs)" ;;
      notBefore) not_before="$(echo "$v" | xargs)" ;;
      notAfter) not_after="$(echo "$v" | xargs)" ;;
      *Fingerprint*|*fingerprint*) fingerprint="$(echo "$v" | xargs)" ;;
    esac
  done < <(openssl x509 -in "$crt_file" -noout -serial -dates -fingerprint -sha256 2>/dev/null || true)

  # Output single JSON line
  printf '{"nik":"%s","status":"SUCCESS","metadata":{"serial_number":"%s","fingerprint_sha256":"%s","certificate_path":"%s","p12_reference":"%s","issued_at":"%s","expires_at":"%s"}}\n' \
    "$NIK" "$serial" "$fingerprint" "$crt_file" "$p12_file" "$not_before" "$not_after"

done < "$INPUT_FILE"
