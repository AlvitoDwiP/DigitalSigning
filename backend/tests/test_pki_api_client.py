import pytest
import httpx
from unittest.mock import patch, MagicMock
from app.services.pki_api_client import PKIApiClient, PKIEngineError

@pytest.fixture
def pki_client():
    return PKIApiClient(base_url="http://test-pki:8001", token="test-internal-token-xyz")

def test_pki_client_headers_contains_internal_token(pki_client):
    headers = pki_client._headers()
    assert headers["X-Internal-Token"] == "test-internal-token-xyz"
    assert headers["Content-Type"] == "application/json"

def test_generate_single_success(pki_client):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.is_success = True
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "success": True,
        "data": {
            "serial_number": "12345678",
            "subject": "CN=Test",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "abcdef",
            "issued_at": "2026-10-01",
            "expires_at": "2028-10-01",
            "certificate_path": "/path/cert.crt",
            "p12_reference": "/path/cert.p12"
        }
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp) as mock_post:
        result = pki_client.generate_single(
            name="Test User",
            nik="1234567890123456",
            email="test@example.com",
            organization="Mahkamah Konstitusi",
            ou="IT",
            pfx_password="Passphrase123!"
        )
        assert result["serial_number"] == "12345678"
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://test-pki:8001/internal/v1/pki/certificates/single"
        assert kwargs["json"]["nik"] == "1234567890123456"
        assert kwargs["headers"]["X-Internal-Token"] == "test-internal-token-xyz"

def test_generate_bulk_success(pki_client):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.is_success = True
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "success": True,
        "data": {
            "results": [
                {"nik": "1111111111111111", "status": "SUCCESS"},
                {"nik": "2222222222222222", "status": "FAILED", "error": "Invalid format"}
            ]
        }
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp) as mock_post:
        requests = [
            {"name": "A", "nik": "1111111111111111", "email": "a@mkri.go.id", "organization": "MK", "ou": "IT", "pfx_password": "Pass123!"},
            {"name": "B", "nik": "2222222222222222", "email": "b@mkri.go.id", "organization": "MK", "ou": "IT", "pfx_password": "Pass123!"}
        ]
        res = pki_client.generate_bulk(requests)
        assert len(res["results"]) == 2
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://test-pki:8001/internal/v1/pki/certificates/bulk"

def test_pki_service_error_mapping_raises_pki_engine_error(pki_client):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.is_success = False
    mock_resp.status_code = 400
    mock_resp.json.return_value = {
        "detail": {
            "code": "INVALID_INPUT",
            "message": "Field contains forbidden tab character"
        }
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp):
        with pytest.raises(PKIEngineError) as exc_info:
            pki_client.generate_single(name="Bad\tUser")
        assert exc_info.value.code == "INVALID_INPUT"
        assert exc_info.value.status_code == 400
        assert "forbidden" in exc_info.value.message

def test_pki_service_connection_error_raises_502(pki_client):
    with patch.object(httpx.Client, "post", side_effect=httpx.ConnectError("Connection refused")):
        with pytest.raises(PKIEngineError) as exc_info:
            pki_client.generate_single(name="User")
        assert exc_info.value.code == "PKI_SERVICE_UNAVAILABLE"
        assert exc_info.value.status_code == 502
        assert "unreachable" in exc_info.value.message.lower()

def test_pki_service_timeout_raises_504(pki_client):
    with patch.object(httpx.Client, "post", side_effect=httpx.TimeoutException("Timed out")):
        with pytest.raises(PKIEngineError) as exc_info:
            pki_client.generate_single(name="User")
        assert exc_info.value.code == "TIMEOUT"
        assert exc_info.value.status_code == 504

def test_regenerate_flow_stage_commit_cleanup(pki_client):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.is_success = True
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "success": True,
        "data": {
            "staging_token": "token-123",
            "target_user_dir": "/path/dir",
            "target_archive_p12": "/path/archive.p12",
            "metadata": {"serial_number": "SN999"}
        }
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp):
        stage = pki_client.regenerate_stage(nik="1234567890123456")
        assert stage["staging_token"] == "token-123"

        commit_ok = pki_client.regenerate_commit("token-123", "/path/dir", "/path/archive.p12")
        assert commit_ok is True

        cleanup_ok = pki_client.regenerate_cleanup("token-123")
        assert cleanup_ok is True

def test_delete_user_materials(pki_client):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.is_success = True
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"deleted": ["/path/1.p12"]}}

    with patch.object(httpx.Client, "delete", return_value=mock_resp) as mock_del:
        res = pki_client.delete_user_materials("1234567890123456")
        assert "/path/1.p12" in res["deleted"]
        mock_del.assert_called_once_with(
            "http://test-pki:8001/internal/v1/pki/materials/1234567890123456",
            headers=pki_client._headers()
        )
