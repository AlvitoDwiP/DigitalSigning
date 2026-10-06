#!/usr/bin/env bash
set -Eeo pipefail
umask 077
trap 'echo "❌ ERROR di baris $LINENO: $BASH_COMMAND" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_H="$(cd "$SCRIPT_DIR/.." && pwd)"
H="${H:-$DEFAULT_H}"
P12_ARCHIVE_DIR="${P12_ARCHIVE_DIR:-$H/sign-api(well3)/p12}"
export INT_DIR="$H/pki/intermediate"
DEFAULT_DAYS="${DEFAULT_DAYS:-730}"
CONTINUE_ON_ERROR="${CONTINUE_ON_ERROR:-1}"

[[ $# -ge 1 ]] || { echo "Usage: $0 <file.csv>"; exit 1; }
INPUT_FILE="$1"
[[ -f "$INPUT_FILE" ]] || { echo "ERROR: file tidak ditemukan: $INPUT_FILE"; exit 1; }

# ==== CLEAN CSV (hapus CRLF + BOM) ====
CLEAN_TMP="$(mktemp)"
trap 'rm -f "$CLEAN_TMP"' EXIT
sed -e 's/\r$//' "$INPUT_FILE" | sed '1s/^\xEF\xBB\xBF//' > "$CLEAN_TMP"

# ==== AUTO DETECT DELIMITER (dari header) ====
HEADER_LINE="$(sed -n '1p' "$CLEAN_TMP")"
if [[ "$HEADER_LINE" == *";"* ]]; then
  DELIM=";"
elif [[ "$HEADER_LINE" == *","* ]]; then
  DELIM=","
else
  echo "ERROR: delimiter tidak dikenali (bukan , atau ;)"
  exit 1
fi

echo "Delimiter terdeteksi: '$DELIM'"

# ==== BACA SEMUA BARIS ROBUST (baris terakhir tanpa newline tetap dihitung) ====
mapfile -t LINES < "$CLEAN_TMP"

TOTAL_LINES="${#LINES[@]}"
if (( TOTAL_LINES <= 1 )); then
  echo "Total baris data: 0"
  echo "Tidak ada baris data."
  exit 1
fi

TOTAL=$((TOTAL_LINES - 1))
echo "Total baris data: $TOTAL"
echo

# ==== PROSES DATA (SKIP HEADER) ====
IDX=0; OK=0; FAIL=0

for ((i=1; i<${#LINES[@]}; i++)); do
  line="${LINES[$i]}"

  # skip kosong / comment
  [[ -z "${line// }" ]] && continue
  [[ "${line:0:1}" == "#" ]] && continue

  # parse kolom
  IFS="$DELIM" read -r ORG OU CN EMAIL NIK PFXPASS _ <<< "$line"

  ORG="$(echo "${ORG//\"/}" | xargs)"
  [[ -z "$ORG" ]] && continue

  OU="$(echo "${OU//\"/}" | xargs)"
  CN="$(echo "${CN//\"/}" | xargs)"
  EMAIL="$(echo "${EMAIL//\"/}" | xargs)"
  NIK="$(echo "$NIK" | tr -cd '0-9')"
  PFXPASS="$(echo "${PFXPASS:-}" | xargs)"
  [[ -n "$PFXPASS" ]] || PFXPASS="PfxPass!ChangeMe123"

  IDX=$((IDX+1))
  echo "[${IDX}/${TOTAL}] $CN — $ORG (NIK: $NIK)"

  if ./bangkitkan_single.sh <<<"$ORG
$OU
$CN
$EMAIL
$DEFAULT_DAYS
$NIK
$PFXPASS"; then
    OK=$((OK+1))
  else
    FAIL=$((FAIL+1))
    if [[ "$CONTINUE_ON_ERROR" != "1" ]]; then
      echo "STOP karena error (set CONTINUE_ON_ERROR=1 untuk lanjut)."
      exit 1
    fi
  fi
  echo
done

echo "SELESAI ✅  Total: $TOTAL | OK: $OK | FAIL: $FAIL"
echo "Arsip P12: $P12_ARCHIVE_DIR"
