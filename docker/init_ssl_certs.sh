#!/bin/sh
set -e

CERTS_DIR="${CERTS_DIR:-/etc/nginx/certs}"
mkdir -p "$CERTS_DIR"

FULLCHAIN="$CERTS_DIR/fullchain.pem"
PRIVKEY="$CERTS_DIR/privkey.pem"

if [ ! -f "$FULLCHAIN" ] || [ ! -f "$PRIVKEY" ]; then
    echo "⚠️ Sertifikat SSL resmi tidak ditemukan pada $CERTS_DIR."
    echo "⚙️ Membangkitkan sertifikat SSL mandiri (Self-Signed) sementara agar Nginx HTTPS dapat berjalan..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$PRIVKEY" \
        -out "$FULLCHAIN" \
        -subj "/C=ID/ST=DKI Jakarta/L=Jakarta Pusat/O=Mahkamah Konstitusi Republik Indonesia/OU=Pusat TI/CN=tte.mkri.go.id" \
        -addext "subjectAltName=DNS:tte.mkri.go.id,DNS:localhost,IP:127.0.0.1" 2>/dev/null
        
    chmod 600 "$PRIVKEY"
    chmod 644 "$FULLCHAIN"
    echo "✅ Sertifikat SSL sementara berhasil dibuat."
    echo "💡 Catatan: Ganti dengan sertifikat SSL resmi (Let's Encrypt / CA Instansi) dengan menaruh fullchain.pem dan privkey.pem pada folder certs."
else
    echo "✅ Sertifikat SSL resmi terdeteksi di $CERTS_DIR."
fi

exec "$@"

