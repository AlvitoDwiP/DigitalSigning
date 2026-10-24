import shutil
import subprocess
from pathlib import Path
from dataclasses import dataclass

TEST_CA_PASS = "TestCaSecret123!"

@dataclass
class IsolatedTestCA:
    base_dir: Path
    int_dir: Path
    chain_path: Path
    key_path: Path
    issued_dir: Path
    archive_dir: Path
    ca_pass: str

def create_isolated_test_ca(target_dir: Path) -> IsolatedTestCA:
    """
    Membangun lingkungan Intermediate CA khusus pengujian yang terisolasi sepenuhnya.
    Menghasilkan private key CA uji, certificate chain, serial, dan database index.txt sendiri.
    Tidak pernah menyalin atau menyentuh kunci CA produksi.
    """
    target_dir = Path(target_dir).resolve()
    int_dir = target_dir / "intermediate"
    certs_dir = int_dir / "certs"
    priv_dir = int_dir / "private"
    newcerts_dir = int_dir / "newcerts"
    crl_dir = int_dir / "crl"
    issued_dir = target_dir / "issued"
    archive_dir = target_dir / "archive"

    for d in [certs_dir, priv_dir, newcerts_dir, crl_dir, issued_dir, archive_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Inisialisasi basis data CA pengujian
    (int_dir / "index.txt").write_text("")
    (int_dir / "index.txt.attr").write_text("unique_subject = no\n")
    (int_dir / "serial").write_text("1001\n")
    (int_dir / "crlnumber").write_text("01\n")

    # Salin template openssl.cnf & extension
    # Temukan folder pki template
    pki_template_dir = None
    for candidate in [
        Path("/app/pki/intermediate"),
        Path(__file__).resolve().parent.parent.parent / "pki/intermediate",
    ]:
        if candidate.is_dir() and (candidate / "openssl.cnf").is_file():
            pki_template_dir = candidate
            break

    if not pki_template_dir:
        raise RuntimeError("PKI intermediate template directory not found for test CA setup")

    shutil.copy2(pki_template_dir / "openssl.cnf", int_dir / "openssl.cnf")
    shutil.copy2(pki_template_dir / "pdfsign-ext.cnf", int_dir / "pdfsign-ext.cnf")

    # Bangkitkan Private Key Intermediate CA Uji (2048-bit RSA)
    key_path = priv_dir / "intermediate-ca.key"
    subprocess.run([
        "openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048",
        "-aes256", "-pass", f"pass:{TEST_CA_PASS}", "-out", str(key_path)
    ], check=True, capture_output=True)
    key_path.chmod(0o400)

    # Bangkitkan Sertifikat CA Uji
    cert_path = certs_dir / "intermediate-ca.crt"
    chain_path = certs_dir / "ca-chain.crt"
    subprocess.run([
        "openssl", "req", "-new", "-x509", "-key", str(key_path),
        "-passin", f"pass:{TEST_CA_PASS}",
        "-subj", "/C=ID/ST=DKI Jakarta/O=TEST PUSTIK MKRI/CN=TEST Intermediate Document Signing CA",
        "-days", "365", "-out", str(cert_path)
    ], check=True, capture_output=True)
    shutil.copy2(cert_path, chain_path)

    return IsolatedTestCA(
        base_dir=target_dir,
        int_dir=int_dir,
        chain_path=chain_path,
        key_path=key_path,
        issued_dir=issued_dir,
        archive_dir=archive_dir,
        ca_pass=TEST_CA_PASS
    )
