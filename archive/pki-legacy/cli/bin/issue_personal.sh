#!/usr/bin/env bash
set -euo pipefail

# ==== KONFIG YANG KAMU ISI SEKALI SAJA ====
H="${H:-/home/belalangtempur}"            # base path
ORG_SLUG="${ORG_SLUG:-univ-b}"            # folder & nama file (contoh: univ-b)
ORG_NAME="${ORG_NAME:-Universitas B}"     # O=...
OU="${OU:-TTE}"                           # OU=...
CN="${CN:-Nama Penandatangan}"            # nama personal (CN)
EMAIL="${EMAIL:-penandatangan@univ-b.ac.id}"  # email personal
DAYS="${DAYS:-730}"                       # masa berlaku hari

# password (pakai ENV kalau ada; kalau tidak dipakai default)
INTER_CA_PASS="${INTER_CA_PASS:-InterPass!ChangeMe123}"
PFX_PASS="${PFX_PASS:-PfxPass!ChangeMe123}"

# ==== LOKASI BERKAS CA (harus sudah ada) ====
INT_CNF="$H/pki/intermediate/openssl.cnf"
CHAIN="$H/pki/intermediate/certs/ca-chain.crt"     # intermediate + root (sebagai CAfile)
EXTFILE="$H/pki/intermediate/pdfsign-ext.cnf"

# ==== OUTPUT DIR ====
ISSUED_DIR="$H/pki/issued/$ORG_SLUG"
mkdir -p "$ISSUED_DIR"

# ==== CEK PRASYARAT ====
[[ -f "$INT_CNF" ]] || { echo "ERROR: $INT_CNF tidak ada."; exit 1; }
[[ -f "$CHAIN"  ]] || { echo "ERROR: $CHAIN tidak ada (gabungkan intermediate+root)."; exit 1; }

# ==== EXTENSI END-ENTITY UNTUK PDF SIGNING ====
cat > "$EXTFILE" <<'EOF'
[pdfsign]
basicConstraints = critical, CA:false
keyUsage         = critical, digitalSignature, nonRepudiation
extendedKeyUsage = emailProtection, clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = email:copy
EOF

echo "==> Menerbitkan sertifikat personal: $CN <$EMAIL>, $ORG_NAME [$ORG_SLUG]"
echo "    Output dir: $ISSUED_DIR"

# 1) PRIVATE KEY
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 \
  -out "$ISSUED_DIR/$ORG_SLUG.key"
chmod 600 "$ISSUED_DIR/$ORG_SLUG.key"

# 2) CSR (Subject personal + info universitas)
SUBJ="/C=ID/O=$ORG_NAME/OU=$OU/CN=$CN/emailAddress=$EMAIL"
openssl req -new \
  -key "$ISSUED_DIR/$ORG_SLUG.key" \
  -out "$ISSUED_DIR/$ORG_SLUG.csr" \
  -subj "$SUBJ" \
  -addext "subjectAltName = email:copy"

# 3) Tanda tangani dengan Intermediate CA
openssl ca -config "$INT_CNF" \
  -in  "$ISSUED_DIR/$ORG_SLUG.csr" \
  -out "$ISSUED_DIR/$ORG_SLUG.crt" \
  -extensions pdfsign -extfile "$EXTFILE" \
  -days "$DAYS" -batch -passin "pass:$INTER_CA_PASS"

# 4) Verifikasi rantai
openssl verify -CAfile "$CHAIN" "$ISSUED_DIR/$ORG_SLUG.crt"

# 5) Ekspor PKCS#12 (PFX/P12)
FRIENDLY="$CN – $ORG_NAME (TTE)"
openssl pkcs12 -export \
  -inkey   "$ISSUED_DIR/$ORG_SLUG.key" \
  -in      "$ISSUED_DIR/$ORG_SLUG.crt" \
  -certfile "$CHAIN" \
  -name    "$FRIENDLY" \
  -passout "pass:$PFX_PASS" \
  -out     "$ISSUED_DIR/$ORG_SLUG.pfx"

# (opsional) kompatibel (legacy 3DES) jika dibutuhkan
openssl pkcs12 -export \
  -inkey   "$ISSUED_DIR/$ORG_SLUG.key" \
  -in      "$ISSUED_DIR/$ORG_SLUG.crt" \
  -certfile "$CHAIN" \
  -name    "$FRIENDLY" \
  -passout "pass:$PFX_PASS" \
  -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha256 \
  -out     "$ISSUED_DIR/$ORG_SLUG-compat.p12"

# 6) Ringkasan
echo
ls -lh "$ISSUED_DIR/$ORG_SLUG."{key,csr,crt,pfx} 2>/dev/null || true
ls -lh "$ISSUED_DIR/$ORG_SLUG-compat.p12" 2>/dev/null || true
echo
echo "SELESAI."
echo "Friendly name: $FRIENDLY"
echo "Password PFX : $PFX_PASS"
