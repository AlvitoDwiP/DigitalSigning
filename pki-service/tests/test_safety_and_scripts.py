import os
import subprocess
import pytest
from app.services import pki_engine
from app.services.pki_engine import PKIEngineError
from app.core.config import Settings

def test_safety_guard_blocks_primary_ca_in_test_environment(monkeypatch):
    """
    Memastikan guard pengaman memblokir eksekusi skrip CA jika environment
    berada dalam mode test/testing tetapi INT_DIR mengarah ke CA utama.
    """
    pki_engine_dir, pki_dir, _, _, _, _, primary_int_dir = pki_engine.get_pki_paths()
    
    monkeypatch.setattr(pki_engine.settings, "ENVIRONMENT", "testing")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    monkeypatch.setenv("INT_DIR", str(primary_int_dir))

    with pytest.raises(PKIEngineError) as exc_info:
        pki_engine.execute_script("issue_cert_single.sh", input_data="dummy\n")

    assert exc_info.value.code == "PRIMARY_CA_PROTECTION"
    assert "PRIMARY CA" in exc_info.value.message.upper()

def test_pki_settings_production_validation():
    # 1. Menolak test CA di production
    with pytest.raises(ValueError, match="Production environment cannot use a test CA directory"):
        Settings(
            ENVIRONMENT="production",
            PKI_SERVICE_TOKEN="StrongSecureTokenForProduction2026!",
            INTER_CA_PASS="StrongProductionPassphrase2026!",
            INT_DIR="/tmp/test_ca/intermediate"
        )

    # 2. Menolak default INTER_CA_PASS di production
    with pytest.raises(ValueError, match="INTER_CA_PASS"):
        Settings(
            ENVIRONMENT="production",
            PKI_SERVICE_TOKEN="StrongSecureTokenForProduction2026!",
            INTER_CA_PASS="InterPass!ChangeMe123"
        )

    # 3. Menolak insecure PKI_SERVICE_TOKEN di production
    with pytest.raises(ValueError, match="PKI_SERVICE_TOKEN"):
        Settings(
            ENVIRONMENT="production",
            PKI_SERVICE_TOKEN="secret",
            INTER_CA_PASS="StrongProductionPassphrase2026!"
        )

    # 4. Berhasil jika secret production valid dan non-default
    prod = Settings(
        ENVIRONMENT="production",
        PKI_SERVICE_TOKEN="StrongSecureTokenForProduction2026!",
        INTER_CA_PASS="StrongProductionPassphrase2026!"
    )
    assert prod.INTER_CA_PASS == "StrongProductionPassphrase2026!"

def test_script_production_rejects_ca_secret_fallback(isolated_ca):
    """
    Memastikan skrip issue_cert_single.sh menolak eksekusi pada mode production
    jika INTER_CA_PASS menggunakan default atau tidak diisi.
    """
    pki_engine_dir, pki_dir, _, _, _, _, _ = pki_engine.get_pki_paths()
    script_path = pki_engine_dir / "issue_cert_single.sh"

    env_default = os.environ.copy()
    env_default["ENVIRONMENT"] = "production"
    env_default["INTER_CA_PASS"] = "InterPass!ChangeMe123"
    env_default["INT_DIR"] = str(isolated_ca.int_dir)

    res_default = subprocess.run(
        ["bash", str(script_path)],
        input="Univ\nOU\nUser\nuser@univ.ac.id\n730\n1234567890123456\n",
        capture_output=True,
        text=True,
        env=env_default
    )
    assert res_default.returncode != 0
    assert "tidak boleh menggunakan secret default pada mode production" in res_default.stderr
    assert "InterPass!ChangeMe123" not in res_default.stderr
