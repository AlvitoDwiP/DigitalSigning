#!/usr/bin/env bash
# ==============================================================================
# Digital Signature Platform - PKI Engine Compatibility Wrapper
# Delegator transparan menuju change_p12_passphrase-admin.sh
# Mempertahankan kompatibilitas 100% untuk pemanggil lama dan dokumentasi
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/change_p12_passphrase_admin.sh"

if [[ ! -f "$TARGET_SCRIPT" ]]; then
  echo "ERROR: Target script not found: $TARGET_SCRIPT" >&2
  exit 1
fi

exec "$TARGET_SCRIPT" "$@"
