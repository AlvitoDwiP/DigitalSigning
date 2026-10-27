import os
import subprocess
import re
import json
import tempfile
import shutil
import uuid
from pathlib import Path
from app.core.config import settings

class PKIEngineError(Exception):
    def __init__(self, message: str, code: str = "PKI_ENGINE_ERROR", status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

def slugify(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def get_pki_paths():
    raw_engine_dir = getattr(settings, "PKI_ENGINE_DIR", os.getenv("PKI_ENGINE_DIR", "/app/pki/scripts"))
    pki_engine_dir = Path(raw_engine_dir)
    if not pki_engine_dir.exists():
        from app.core.config import ROOT_DIR
        local_candidate = ROOT_DIR / "pki" / "scripts"
        if local_candidate.exists():
            pki_engine_dir = local_candidate

    pki_dir = pki_engine_dir if pki_engine_dir.name == "pki" else pki_engine_dir.parent
    h_dir = pki_dir.parent
    int_dir = Path(getattr(settings, "INT_DIR", None) or os.getenv("INT_DIR") or str(pki_dir / "intermediate")).resolve()
    issued_dir = Path(getattr(settings, "ISSUED_DIR", None) or os.getenv("ISSUED_DIR") or str(pki_dir / "issued")).resolve()

    default_p12 = h_dir / "sign-api" / "p12"
    raw_p12 = getattr(settings, "P12_ARCHIVE_DIR", None) or os.getenv("P12_ARCHIVE_DIR")
    if raw_p12 and Path(raw_p12).exists():
        p12_archive_dir = Path(raw_p12).resolve()
    else:
        p12_archive_dir = Path(default_p12).resolve()

    chain_path = Path(getattr(settings, "CHAIN_PATH", None) or os.getenv("CHAIN_PATH") or str(int_dir / "certs" / "ca-chain.crt")).resolve()
    return pki_engine_dir, pki_dir, h_dir, issued_dir, p12_archive_dir, chain_path, int_dir

def execute_script(script_name: str, input_data: str = None, args: list = None, timeout: int = None, env: dict = None) -> str:
    if timeout is None:
        timeout = getattr(settings, "PKI_TIMEOUT", 60)
    pki_engine_dir, pki_dir, h_dir, issued_dir, p12_archive_dir, chain_path, int_dir = get_pki_paths()

    # Safety Guard: In test environment, block execution if INT_DIR points to primary intermediate CA
    env_mode = (os.getenv("ENVIRONMENT") or getattr(settings, "ENVIRONMENT", "development")).lower()
    is_test_mode = env_mode in ("test", "testing") or os.getenv("PKI_TEST_MODE") == "1" or getattr(settings, "ENVIRONMENT", "").lower() in ("test", "testing")
    primary_int_dir = (pki_dir / "intermediate").resolve()

    raw_int_dir = (env.get("INT_DIR") if env and "INT_DIR" in env else None) or os.getenv("INT_DIR") or getattr(settings, "INT_DIR", None) or str(int_dir)
    effective_int_dir = Path(raw_int_dir).resolve()
    effective_chain = Path(env.get("CHAIN_PATH", str(chain_path))).resolve() if env and "CHAIN_PATH" in env else chain_path
    effective_issued = Path(env.get("ISSUED_ROOT", str(issued_dir))).resolve() if env and "ISSUED_ROOT" in env else issued_dir
    effective_p12 = Path(env.get("P12_ARCHIVE_DIR", str(p12_archive_dir))).resolve() if env and "P12_ARCHIVE_DIR" in env else p12_archive_dir

    if is_test_mode and effective_int_dir == primary_int_dir:
        raise PKIEngineError(
            "SAFETY VIOLATION: Execution in test environment attempted to use the primary CA directory! "
            "An isolated test CA directory (INT_DIR) must be configured.",
            "PRIMARY_CA_PROTECTION",
            500
        )
    
    SCRIPT_MAP = {
        "bangkitkan_single.sh": "issue_cert_single.sh",
        "bangkitkan_banyak.sh": "issue_cert_bulk.sh",
        "change_p12_passphrase-user.sh": "change_p12_passphrase_user.sh",
        "change_p12_passphrase-admin.sh": "change_p12_passphrase_admin.sh",
    }
    
    target_names = [script_name]
    if script_name in SCRIPT_MAP:
        target_names.append(SCRIPT_MAP[script_name])
    for old_name, new_name in SCRIPT_MAP.items():
        if script_name == new_name and old_name not in target_names:
            target_names.append(old_name)
            
    script_path = None
    for name in target_names:
        candidate = pki_engine_dir / name
        if candidate.is_file():
            script_path = candidate
            break
        candidate_pki = pki_dir / name
        if candidate_pki.is_file():
            script_path = candidate_pki
            break
            
    if not script_path:
        raise PKIEngineError(f"Script {script_name} not found at {pki_engine_dir / script_name}", "INTERNAL_ERROR", 500)
        
    cmd = ["bash", str(script_path)]
    if args:
        cmd.extend(args)
        
    run_env = os.environ.copy()
    run_env["H"] = str(h_dir)
    run_env["INT_DIR"] = str(effective_int_dir)
    run_env["ISSUED_ROOT"] = str(effective_issued)
    run_env["P12_ARCHIVE_DIR"] = str(effective_p12)
    run_env["CHAIN_PATH"] = str(effective_chain)
    run_env["ENVIRONMENT"] = getattr(settings, "ENVIRONMENT", "development")
    run_env["INTER_CA_PASS"] = getattr(settings, "INTER_CA_PASS", "InterPass!ChangeMe123")
    run_env["DEFAULT_PFX_PASS"] = getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
    if env:
        run_env.update(env)
        
    try:
        result = subprocess.run(
            cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(pki_engine_dir),
            env=run_env
        )
        if result.returncode != 0:
            err_msg = result.stderr.strip() or f"Script failed with exit code {result.returncode}"
            raise PKIEngineError(f"Script {script_name} failed: {err_msg}", "PKI_GENERATION_FAILED", 502)
        return result.stdout
    except subprocess.TimeoutExpired:
        raise PKIEngineError(f"Script {script_name} timed out after {timeout} seconds", "TIMEOUT", 504)
    except Exception as e:
        if isinstance(e, PKIEngineError):
            raise
        raise PKIEngineError(f"Unexpected error executing PKI engine: {str(e)}", "INTERNAL_ERROR", 500)

def validate_p12_file(p12_path: Path, pfx_password: str):
    if not p12_path.is_file() or p12_path.stat().st_size == 0:
        raise PKIEngineError(f"P12 credential file not found: {p12_path.name}", "P12_NOT_FOUND", 502)
    try:
        run_env = os.environ.copy()
        run_env["P12_VALIDATE_PASS"] = pfx_password or ""
        res = subprocess.run(
            ["openssl", "pkcs12", "-in", str(p12_path), "-passin", "env:P12_VALIDATE_PASS", "-noout", "-nokeys"],
            capture_output=True,
            text=True,
            env=run_env
        )
        if res.returncode != 0:
            raise PKIEngineError("P12 credential file validation failed: invalid passphrase or corrupt archive", "P12_VALIDATION_FAILED", 502)
    except subprocess.CalledProcessError:
        raise PKIEngineError("Failed to validate generated P12 credential", "P12_VALIDATION_FAILED", 502)

def generate_single(name: str, nik: str, email: str, organization: str, ou: str, pfx_password: str) -> dict:
    lines = [
        organization or "",
        ou or "",
        name or "",
        email or "",
        "",
        nik or "",
        pfx_password or ""
    ]
    input_data = "\n".join(lines) + "\n"
    
    stdout = execute_script("issue_cert_single.sh", input_data=input_data)
    
    out_dir_match = re.search(r"Output dir :\s+(.*)", stdout)
    if not out_dir_match:
        raise PKIEngineError("Could not determine output directory from PKI engine", "ARTIFACT_ERROR", 502)
        
    out_dir = Path(out_dir_match.group(1).strip())
    meta_file = out_dir / f"{out_dir.name}-meta.txt"
    if not meta_file.is_file():
        raise PKIEngineError("Metadata file not generated", "ARTIFACT_ERROR", 502)
        
    crt_file = out_dir / f"{out_dir.name}.crt"
    if not crt_file.is_file():
        raise PKIEngineError("Certificate file not generated", "ARTIFACT_ERROR", 502)
        
    try:
        cert_info = subprocess.run(
            ["openssl", "x509", "-in", str(crt_file), "-noout", "-serial", "-dates", "-fingerprint", "-sha256"],
            capture_output=True, text=True, check=True
        ).stdout
    except subprocess.CalledProcessError:
        raise PKIEngineError("Failed to read generated certificate", "CERTIFICATE_VALIDATION_FAILED", 502)
        
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
            fingerprint = line.split("=")[1].strip().replace(":", "")
            
    p12_file = out_dir / f"{nik}.p12"
    validate_p12_file(p12_file, pfx_password)
    
    return {
        "serial_number": serial,
        "subject": f"/C=ID/O={organization}/OU={ou}/CN={name}/emailAddress={email}",
        "issuer": "Pustik CA",
        "fingerprint_sha256": fingerprint,
        "issued_at": not_before,
        "expires_at": not_after,
        "certificate_path": str(crt_file),
        "p12_reference": str(p12_file)
    }

def generate_staged(name: str, nik: str, email: str, organization: str, ou: str, pfx_password: str) -> dict:
    pki_engine_dir, pki_dir, h_dir, issued_dir, p12_archive_dir, chain_path, int_dir = get_pki_paths()
    
    person_slug = f"{slugify(organization)}--{slugify(name)}"
    final_user_dir = issued_dir / person_slug
    final_p12_path = p12_archive_dir / f"{nik}.p12"
    
    # Create unique isolated staging directory
    staging_id = uuid.uuid4().hex
    staging_dir = issued_dir / f".staging_{person_slug}_{staging_id}"
    staging_archive = staging_dir / "archive"
    staging_dir.mkdir(parents=True, exist_ok=True)
    staging_archive.mkdir(parents=True, exist_ok=True)
    
    lines = [
        organization or "",
        ou or "",
        name or "",
        email or "",
        "",
        nik or "",
        pfx_password or ""
    ]
    input_data = "\n".join(lines) + "\n"
    
    env = {
        "OUT_DIR": str(staging_dir),
        "P12_ARCHIVE_DIR": str(staging_archive)
    }
    
    try:
        stdout = execute_script("issue_cert_single.sh", input_data=input_data, env=env)
    except Exception as e:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise e
        
    crt_files = list(staging_dir.glob("*.crt"))
    if not crt_files:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise PKIEngineError("Certificate file not generated in staging", "ARTIFACT_ERROR", 502)
        
    crt_file = crt_files[0]
    
    try:
        cert_info = subprocess.run(
            ["openssl", "x509", "-in", str(crt_file), "-noout", "-serial", "-dates", "-fingerprint", "-sha256"],
            capture_output=True, text=True, check=True
        ).stdout
    except subprocess.CalledProcessError:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise PKIEngineError("Failed to read generated certificate", "CERTIFICATE_VALIDATION_FAILED", 502)
        
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
            fingerprint = line.split("=")[1].strip().replace(":", "")
            
    staged_p12_files = list(staging_dir.glob("*.p12"))
    if not staged_p12_files:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise PKIEngineError("P12 credential file not generated in staging", "P12_NOT_FOUND", 502)
    
    try:
        validate_p12_file(staged_p12_files[0], pfx_password)
    except Exception as e:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise e

    final_crt_path = final_user_dir / f"{person_slug}.crt"
    final_p12_ref = final_user_dir / f"{nik}.p12"
    
    return {
        "staging_token": str(staging_dir),
        "target_user_dir": str(final_user_dir),
        "target_archive_p12": str(final_p12_path),
        "metadata": {
            "serial_number": serial,
            "subject": f"/C=ID/O={organization}/OU={ou}/CN={name}/emailAddress={email}",
            "issuer": "Pustik CA",
            "fingerprint_sha256": fingerprint,
            "issued_at": not_before,
            "expires_at": not_after,
            "certificate_path": str(final_crt_path),
            "p12_reference": str(final_p12_ref)
        }
    }

def commit_staged(staging_token: str, target_user_dir: str, target_archive_p12: str) -> bool:
    staging_path = Path(staging_token)
    if not staging_path.exists():
        raise PKIEngineError("Staging directory not found", "ARTIFACT_ERROR", 502)
        
    target_dir = Path(target_user_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    
    for item in staging_path.iterdir():
        if item.is_file():
            shutil.copy2(item, target_dir / item.name)
            
    staging_archive = staging_path / "archive"
    if staging_archive.exists() and target_archive_p12:
        for p12 in staging_archive.glob("*.p12"):
            archive_target = Path(target_archive_p12)
            if "sign-api" not in str(archive_target):
                archive_target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p12, archive_target)
            
    shutil.rmtree(staging_path, ignore_errors=True)
    return True

def cleanup_staged(staging_token: str) -> bool:
    staging_path = Path(staging_token)
    if staging_path.exists():
        shutil.rmtree(staging_path, ignore_errors=True)
    return True

def generate_bulk(requests: list) -> dict:
    if not requests:
        return {"results": []}
        
    temp_fd, temp_path_str = tempfile.mkstemp(suffix=".tsv", prefix="pki_bulk_")
    temp_path = Path(temp_path_str)
    
    try:
        os.chmod(temp_path, 0o600)
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            for req in requests:
                req_dict = req if isinstance(req, dict) else req.model_dump()
                for k in ["organization", "ou", "name", "email", "nik", "pfx_password"]:
                    val = str(req_dict.get(k, ""))
                    if "\t" in val or "\r" in val or "\n" in val:
                        raise PKIEngineError(f"Field {k} contains forbidden tab/newline characters", "INVALID_INPUT", 400)
                row = f"{req_dict['organization']}\t{req_dict['ou']}\t{req_dict['name']}\t{req_dict['email']}\t{req_dict['nik']}\t{req_dict['pfx_password']}\n"
                f.write(row)
                
        timeout = max(60, len(requests) * 30)
        stdout = execute_script("issue_cert_bulk.sh", args=[str(temp_path)], timeout=timeout)
        
        results = []
        for line in stdout.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            try:
                item = json.loads(line_str)
                if item.get("status") == "SUCCESS" and "metadata" in item:
                    meta = item["metadata"]
                    matched_req = next((r if isinstance(r, dict) else r.model_dump() for r in requests if (r if isinstance(r, dict) else r.model_dump()).get("nik") == item.get("nik")), None)
                    if matched_req:
                        crt_path_str = meta.get("certificate_path")
                        if not crt_path_str or not Path(crt_path_str).is_file():
                            item["status"] = "FAILED"
                            item["error"] = "Certificate file missing or invalid"
                            results.append(item)
                            continue
                            
                        p12_path_str = meta.get("p12_reference")
                        if not p12_path_str or not Path(p12_path_str).is_file():
                            item["status"] = "FAILED"
                            item["error"] = "P12 credential file missing or invalid"
                            results.append(item)
                            continue
                            
                        try:
                            validate_p12_file(Path(p12_path_str), matched_req["pfx_password"])
                        except PKIEngineError as pe:
                            item["status"] = "FAILED"
                            item["error"] = f"P12 validation failed: {pe.message}"
                            results.append(item)
                            continue

                        if "subject" not in meta:
                            meta["subject"] = f"/C=ID/O={matched_req['organization']}/OU={matched_req['ou']}/CN={matched_req['name']}/emailAddress={matched_req['email']}"
                    else:
                        if "subject" not in meta:
                            meta["subject"] = "CN=Unknown"
                    if "issuer" not in meta:
                        meta["issuer"] = "Pustik CA"
                results.append(item)
            except json.JSONDecodeError:
                continue
                
        return {"results": results}
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

def change_p12_passphrase_user(nik: str, old_password: str, new_password: str) -> bool:
    nik_safe = re.sub(r'[^0-9]', '', nik)
    if len(nik_safe) != 16:
        raise PKIEngineError("NIK must be 16 digits", "INVALID_IDENTIFIER", 400)
        
    for val in [old_password, new_password]:
        if "\n" in val or "\r" in val or "\t" in val:
            raise PKIEngineError("Password cannot contain newlines or tabs", "INVALID_INPUT", 400)
            
    input_data = f"{nik_safe}\n{old_password}\n{new_password}\n"
    execute_script("change_p12_passphrase_user.sh", input_data=input_data)
    return True

def change_p12_passphrase_admin(nik: str, new_password: str) -> bool:
    nik_safe = re.sub(r'[^0-9]', '', nik)
    if len(nik_safe) != 16:
        raise PKIEngineError("NIK must be 16 digits", "INVALID_IDENTIFIER", 400)
        
    if "\n" in new_password or "\r" in new_password or "\t" in new_password:
        raise PKIEngineError("Password cannot contain newlines or tabs", "INVALID_INPUT", 400)
        
    input_data = f"{nik_safe}\n{new_password}\n"
    execute_script("change_p12_passphrase_admin.sh", input_data=input_data)
    return True

def delete_user_pki_materials(nik: str) -> dict:
    nik_safe = re.sub(r'[^0-9]', '', nik)
    if not nik_safe:
        raise PKIEngineError("Invalid NIK provided", "INVALID_IDENTIFIER", 400)
        
    pki_engine_dir, pki_dir, h_dir, issued_dir, p12_archive_dir, _, _ = get_pki_paths()
    
    deleted_files = []
    failed_files = []
    
    def try_delete(filepath: Path):
        if filepath.exists():
            try:
                filepath.unlink()
                deleted_files.append(str(filepath))
            except Exception:
                failed_files.append(str(filepath))
                
    archive_p12 = p12_archive_dir / f"{nik_safe}.p12"
    try_delete(archive_p12)
    
    if issued_dir.exists():
        matched_dirs = set()
        for p12_file in issued_dir.glob(f"*/{nik_safe}.p12"):
            matched_dirs.add(p12_file.parent)

        for meta_file in issued_dir.glob("*/*-meta.txt"):
            try:
                content = meta_file.read_text(encoding="utf-8", errors="ignore")
                if re.search(rf"NIK\s*:\s*{nik_safe}\b", content):
                    matched_dirs.add(meta_file.parent)
            except Exception:
                pass

        for out_dir in matched_dirs:
            person_slug = out_dir.name
            try_delete(out_dir / f"{person_slug}.key")
            try_delete(out_dir / f"{person_slug}.csr")
            try_delete(out_dir / f"{person_slug}.crt")
            try_delete(out_dir / f"{person_slug}.pfx")
            try_delete(out_dir / f"{person_slug}-meta.txt")
            try_delete(out_dir / f"{nik_safe}.p12")

            try:
                for child in list(out_dir.iterdir()):
                    try_delete(child)
                if not any(out_dir.iterdir()):
                    out_dir.rmdir()
                    deleted_files.append(str(out_dir))
            except Exception:
                pass

    if failed_files:
        raise PKIEngineError("Partial cleanup failure", "PARTIAL_CLEANUP_FAILURE", 500)

    return {"success": True, "deleted": deleted_files}
