import shutil
import pytest
from app.core.config import settings
from tests.test_ca_factory import create_isolated_test_ca

@pytest.fixture(scope="function")
def isolated_ca(tmp_path, monkeypatch):
    """
    Fixture yang menyediakan Intermediate CA terisolasi sepenuhnya untuk pengujian.
    Memastikan direktori pki/intermediate utama tidak tersentuh sama sekali.
    """
    test_ca_dir = tmp_path / "pki_test_ca"
    ca = create_isolated_test_ca(test_ca_dir)

    # Monkeypatch settings
    monkeypatch.setattr(settings, "INT_DIR", str(ca.int_dir))
    monkeypatch.setattr(settings, "CHAIN_PATH", str(ca.chain_path))
    monkeypatch.setattr(settings, "ISSUED_DIR", str(ca.issued_dir))
    monkeypatch.setattr(settings, "P12_ARCHIVE_DIR", str(ca.archive_dir))
    monkeypatch.setattr(settings, "INTER_CA_PASS", ca.ca_pass)
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")

    # Set environment variables untuk subprocess shell scripts
    monkeypatch.setenv("INT_DIR", str(ca.int_dir))
    monkeypatch.setenv("CHAIN_PATH", str(ca.chain_path))
    monkeypatch.setenv("ISSUED_ROOT", str(ca.issued_dir))
    monkeypatch.setenv("P12_ARCHIVE_DIR", str(ca.archive_dir))
    monkeypatch.setenv("INTER_CA_PASS", ca.ca_pass)
    monkeypatch.setenv("ENVIRONMENT", "testing")
    monkeypatch.setenv("PKI_TEST_MODE", "1")

    yield ca

    if test_ca_dir.exists():
        shutil.rmtree(test_ca_dir, ignore_errors=True)
