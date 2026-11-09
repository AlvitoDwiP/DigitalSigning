#!/usr/bin/env python3
"""
Production Secrets & Environment Generator for DigitalSigning Platform.
Generates cryptographically secure, high-entropy secrets and builds .env.production.
"""

import os
import secrets
import string
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def generate_secure_token(length: int = 64) -> str:
    """Generate a high-entropy hexadecimal secret."""
    return secrets.token_hex(length // 2)


def generate_secure_password(length: int = 32) -> str:
    """Generate a high-entropy alphanumeric password with symbols."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    # Ensure at least 1 uppercase, 1 lowercase, 1 digit, 1 symbol
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd)
                and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$%^&*-_=+" for c in pwd)):
            return pwd


def generate_production_env(output_path: Path = None, domain: str = "tte.mkri.go.id") -> Path:
    if output_path is None:
        output_path = BASE_DIR / ".env.production"

    secret_key = generate_secure_token(64)
    pki_token = generate_secure_token(64)
    api_key = generate_secure_token(48)
    postgres_password = generate_secure_password(32)
    inter_ca_pass = generate_secure_password(24)

    env_content = f"""# ==============================================================================
# DIGITAL SIGNING PLATFORM - PRODUCTION ENVIRONMENT CONFIGURATION
# Generated automatically with high-entropy cryptographic secrets.
# SENSITIVE: JANGAN PERNAH MENYIMPAN ATAU MENG-COMMIT BERKAS INI KE REPOSITORY GIT!
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. ENVIRONMENT & RUNTIME
# ------------------------------------------------------------------------------
ENVIRONMENT=production
PORT=8000
VITE_API_URL=https://{domain}

# ------------------------------------------------------------------------------
# 2. APPLICATION AUTHENTICATION & SECRETS
# ------------------------------------------------------------------------------
# Secret key 64-karakter untuk penandatanganan JWT sesi (HMAC-SHA256)
SECRET_KEY={secret_key}

# API Key resmi untuk integrasi Machine-to-Machine (M2M / External API)
API_KEY={api_key}

# Domain CORS resmi instansi (pisahkan dengan koma jika ada domain alternatif)
CORS_ORIGINS=https://{domain},http://localhost:3000,http://127.0.0.1:3000

# ------------------------------------------------------------------------------
# 3. DATABASE CONFIGURATION (PostgreSQL)
# ------------------------------------------------------------------------------
POSTGRES_USER=postgres
POSTGRES_PASSWORD={postgres_password}
POSTGRES_DB=digital_signature_db
DATABASE_URL=postgresql://postgres:{postgres_password}@postgres:5432/digital_signature_db

# ------------------------------------------------------------------------------
# 4. INTERNAL PKI SERVICE COMMUNICATION (Isolated Docker Network)
# ------------------------------------------------------------------------------
PKI_SERVICE_URL=http://pki_service:8001
PKI_PORT=8001
# Token autentikasi internal antarlayanan (X-Internal-Token)
PKI_SERVICE_TOKEN={pki_token}

# ------------------------------------------------------------------------------
# 5. PKI CRYPTOGRAPHIC SECRETS & PATHS
# ------------------------------------------------------------------------------
# Passphrase untuk membuka kunci privat Intermediate CA (diisolasi pada container PKI)
INTER_CA_PASS={inter_ca_pass}

PKI_ENGINE_DIR=/app/pki/scripts
P12_ARCHIVE_DIR=/app/sign-api/p12
ISSUED_DIR=/app/pki/issued

# Nilai default kredensial awal saat akun baru diterbitkan
DEFAULT_PFX_PASS=Mkri006!
DEFAULT_USER_PASS=Konstitusi100%

# ------------------------------------------------------------------------------
# 6. FEATURE FLAGS & RESOURCE HARDENING
# ------------------------------------------------------------------------------
ENABLE_PDF_SIGNING=true
MAX_CONCURRENT_SIGNING=10
SIGNING_TIMEOUT_SECONDS=60
MAX_PDF_SIZE_MB=25
MAX_STAMP_SIZE_MB=2
MAX_STAMP_WIDTH=4096
MAX_STAMP_HEIGHT=4096
MAX_STAMP_PIXELS=16777216
MAX_PDF_PAGES=1000
MAX_AUDIT_LOGS=5000
"""

    with open(output_path, "w") as f:
        f.write(env_content)

    # Set file permissions strictly to 0600 (owner read/write only)
    try:
        os.chmod(output_path, 0o600)
    except OSError:
        pass

    print(f"✅ Berhasil membuat file konfigurasi produksi: {output_path}")
    print("🔒 Izin berkas disetel ketat ke mode 0600 (read/write hanya untuk pemilik berkas).")
    return output_path


if __name__ == "__main__":
    generate_production_env()

