import os
import subprocess
import re
from pathlib import Path
from app.core.config import pki_settings

class PKIEngineError(Exception):
    def __init__(self, message: str, code: str = "PKI_ENGINE_ERROR"):
        super().__init__(message)
        self.code = code

def execute_script(script_name: str, input_data: str = None, args: list = None, timeout: int = 30) -> str:
    script_path = Path(pki_settings.PKI_ENGINE_DIR) / script_name
    if not script_path.is_file():
        raise PKIEngineError(f"Script {script_name} not found", "INTERNAL_ERROR")
        
    cmd = ["bash", str(script_path)]
    if args:
        cmd.extend(args)
        
    try:
        result = subprocess.run(
            cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=pki_settings.PKI_ENGINE_DIR
        )
        if result.returncode != 0:
            # We don't want to leak passwords/private keys in the error message, 
            # so we only log/return safe generic error. 
            # Safe parsing of stderr could be done, but for now generic.
            raise PKIEngineError(f"Script {script_name} failed with code {result.returncode}", "PKI_GENERATION_FAILED")
        return result.stdout
    except subprocess.TimeoutExpired:
        raise PKIEngineError(f"Script {script_name} timed out", "TIMEOUT")
    except Exception as e:
        if isinstance(e, PKIEngineError):
            raise
        raise PKIEngineError("Unexpected error executing PKI engine", "INTERNAL_ERROR")

def generate_single(name: str, nik: str, email: str, organization: str, ou: str, pfx_password: str):
    # Prepare standard input data expected by the bash script
    # Input order: ORG, OU, CN, EMAIL, DAYS, NIK_RAW, PFX_PASS
    
    # Days is left empty to use default.
    lines = [
        organization,
        ou,
        name,
        email,
        "",
        nik,
        pfx_password
    ]
    input_data = "\n".join(lines) + "\n"
    
    stdout = execute_script("bangkitkan_single.sh", input_data=input_data)
    
    # Parse the output to get the generated paths
    # Output contains "Output dir : <path>" and "Arsip P12  : <path>"
    out_dir_match = re.search(r"Output dir :\s+(.*)", stdout)
    if not out_dir_match:
        raise PKIEngineError("Could not determine output directory from PKI engine", "ARTIFACT_ERROR")
        
    out_dir = Path(out_dir_match.group(1).strip())
    meta_file = out_dir / f"{out_dir.name}-meta.txt"
    
    if not meta_file.is_file():
        raise PKIEngineError("Metadata file not generated", "ARTIFACT_ERROR")
        
    # Example meta parse, but actual cert data can be read from the CRT file using cryptography or openssl
    crt_file = out_dir / f"{out_dir.name}.crt"
    if not crt_file.is_file():
        raise PKIEngineError("Certificate file not generated", "ARTIFACT_ERROR")
        
    # Validate certificate and extract metadata
    try:
        cert_info = subprocess.run(
            ["openssl", "x509", "-in", str(crt_file), "-noout", "-serial", "-dates", "-fingerprint", "-sha256"],
            capture_output=True, text=True, check=True
        ).stdout
    except subprocess.CalledProcessError:
        raise PKIEngineError("Failed to read generated certificate", "CERTIFICATE_VALIDATION_FAILED")
        
    # Parse serial, dates, fingerprint
    serial = ""
    not_before = ""
    not_after = ""
    fingerprint = ""
    
    for line in cert_info.splitlines():
        if line.startswith("serial="):
            serial = line.split("=")[1].strip()
        elif line.startswith("notBefore="):
            not_before = line.split("=")[1].strip()
        elif line.startswith("notAfter="):
            not_after = line.split("=")[1].strip()
        elif "Fingerprint" in line:
            fingerprint = line.split("=")[1].strip()
            
    p12_file = out_dir / f"{nik}.p12"
    
    return {
        "serial_number": serial,
        "subject": f"/C=ID/O={organization}/OU={ou}/CN={name}/emailAddress={email}",
        "issuer": "Intermediate CA",  # We can extract actual issuer if needed
        "fingerprint_sha256": fingerprint,
        "issued_at": not_before,
        "expires_at": not_after,
        "certificate_path": str(crt_file),
        "p12_reference": str(p12_file)
    }

def change_p12_passphrase(nik: str, new_password: str):
    # Input expects NIK, Passphrase baru, Ulangi passphrase baru (only 2 lines if non-tty)
    # The script uses `read -r P12_NEW_SECRET` twice or once depending on tty.
    # From script: 
    # IFS= read -r NIK || die ...
    # IFS= read -r P12_NEW_SECRET || die ...
    lines = [
        nik,
        new_password
    ]
    input_data = "\n".join(lines) + "\n"
    execute_script("change_p12_passphrase.sh", input_data=input_data)
    return True
