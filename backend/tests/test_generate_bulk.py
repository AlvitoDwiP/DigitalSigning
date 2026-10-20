import io
import uuid
import random
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


def test_single_generate_password_policy(client: TestClient, auth_headers: dict):
    # Test weak password (< 8 chars)
    payload_weak = {
        "name": "Budi Santoso",
        "nik": "9999888877776666",
        "email": "budi_weak@mkri.go.id",
        "organization": "Mahkamah Konstitusi",
        "ou": "TTE",
        "password": "weak",
        "pfx_password": "pfxpassword123",
        "confirm_pfx_password": "pfxpassword123"
    }
    res = client.post("/api/v1/users/generate", json=payload_weak, headers=auth_headers["admin"])
    assert res.status_code in [400, 422]

    # Test missing uppercase / symbol
    payload_no_upper = {
        "name": "Budi Santoso",
        "nik": "9999888877776666",
        "email": "budi_no_upper@mkri.go.id",
        "organization": "Mahkamah Konstitusi",
        "ou": "TTE",
        "password": "password123!",
        "pfx_password": "pfxpassword123",
        "confirm_pfx_password": "pfxpassword123"
    }
    res = client.post("/api/v1/users/generate", json=payload_no_upper, headers=auth_headers["admin"])
    assert res.status_code in [400, 422]


def test_single_generate_success_and_no_secret_leak(client: TestClient, auth_headers: dict):
    str_suffix = uuid.uuid4().hex[:6]
    num_suffix = f"{random.randint(100000, 999999):06d}"
    payload = {
        "name": f"User Gen {str_suffix}",
        "nik": f"8888777766{num_suffix}",
        "email": f"user_gen_{str_suffix}@mkri.go.id",
        "organization": "Mahkamah Konstitusi",
        "ou": "TTE",
        "password": "Password123!",
        "pfx_password": "PfxPassword123!",
        "confirm_pfx_password": "PfxPassword123!"
    }

    mock_pki_response = {
        "serial_number": f"SER-GEN-{str_suffix}",
        "subject": f"CN={payload['name']}",
        "issuer": "Intermediate CA",
        "fingerprint_sha256": f"FINGERPRINTGEN{str_suffix}0000000000000000000000000000000000000000"[:64],
        "certificate_path": f"/path/{str_suffix}.crt",
        "p12_reference": f"/path/{str_suffix}.p12",
        "issued_at": "2026-10-01T00:00:00Z",
        "expires_at": "2028-10-01T00:00:00Z",
    }

    with patch("app.api.endpoints.users.pki_engine.generate_single", return_value=mock_pki_response):
        response = client.post("/api/v1/users/generate", json=payload, headers=auth_headers["admin"])
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "user" in data["data"]
        assert "certificate" in data["data"]
        # Ensure password and pfx_password are NOT in response
        response_str = response.text
        assert "Password123!" not in response_str
        assert "PfxPassword123!" not in response_str
        assert "password_hash" not in data["data"]["user"]


def test_bulk_csv_validate_accepts_7_columns(client: TestClient, auth_headers: dict):
    str_suffix = uuid.uuid4().hex[:6]
    num1 = f"{random.randint(100000, 999999):06d}"
    num2 = f"{random.randint(100000, 999999):06d}"
    valid_csv = f"""name,nik,email,organization,ou,password,pfx_pass
User Satu {str_suffix},9111222233{num1},user1_{str_suffix}@mkri.go.id,MKRI,TTE,Password123!,PfxPass123!
User Dua {str_suffix},9222333344{num2},user2_{str_suffix}@mkri.go.id,MKRI,TTE,Password123!,PfxPass123!
"""
    files = {"file": ("users.csv", io.BytesIO(valid_csv.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/users/generate-bulk/validate", files=files, headers=auth_headers["admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["total"] == 2
    assert data["data"]["valid"] == 2
    assert data["data"]["invalid"] == 0

    # Ensure passwords are NOT in preview rows
    for row in data["data"]["rows"]:
        assert "password" not in row
        assert "pfx_pass" not in row
        assert "pfx_password" not in row


def test_bulk_csv_validate_rejects_6_columns_old_format(client: TestClient, auth_headers: dict):
    old_6_col_csv = """name,nik,email,organization,ou,pfx_pass
User Satu,9111222233334444,user1@mkri.go.id,MKRI,TTE,PfxPass123!
"""
    files = {"file": ("users.csv", io.BytesIO(old_6_col_csv.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/users/generate-bulk/validate", files=files, headers=auth_headers["admin"])
    assert response.status_code == 400
    data = response.json()
    code = data.get("error", {}).get("code") or data.get("detail", {}).get("code")
    assert code == "INVALID_CSV_HEADER"


def test_bulk_csv_validate_invalid_headers(client: TestClient, auth_headers: dict):
    bad_header_csv = """nama,nik_ktp,email,org,unit,pass,pfx
User Satu,9111222233334444,user1@mkri.go.id,MKRI,TTE,Password123!,PfxPass123!
"""
    files = {"file": ("users.csv", io.BytesIO(bad_header_csv.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/users/generate-bulk/validate", files=files, headers=auth_headers["admin"])
    assert response.status_code == 400
    data = response.json()
    code = data.get("error", {}).get("code") or data.get("detail", {}).get("code")
    assert code == "INVALID_CSV_HEADER"


def test_bulk_csv_generate_execution(client: TestClient, auth_headers: dict):
    str_suffix = uuid.uuid4().hex[:6]
    nik1 = f"9333444455{random.randint(100000, 999999):06d}"
    nik2 = f"9444555566{random.randint(100000, 999999):06d}"

    csv_content = f"""name,nik,email,organization,ou,password,pfx_pass
Bulk User 1 {str_suffix},{nik1},bulk1_{str_suffix}@mkri.go.id,MKRI,TTE,Password123!,PfxPass123!
Bulk User 2 {str_suffix},{nik2},bulk2_{str_suffix}@mkri.go.id,MKRI,TTE,Password123!,PfxPass123!
"""
    mock_pki_bulk_response = {
        "results": [
            {
                "nik": nik1,
                "status": "SUCCESS",
                "metadata": {
                    "serial_number": f"SER-BLK-1-{str_suffix}",
                    "subject": f"CN=Bulk User 1 {str_suffix}",
                    "issuer": "Intermediate CA",
                    "fingerprint_sha256": f"FINGERPRINTBLK1{str_suffix}00000000000000000000000000000000000000"[:64],
                    "certificate_path": f"/path/{nik1}.crt",
                    "p12_reference": f"/path/{nik1}.p12",
                    "issued_at": "2026-10-01T00:00:00Z",
                    "expires_at": "2028-10-01T00:00:00Z",
                }
            },
            {
                "nik": nik2,
                "status": "SUCCESS",
                "metadata": {
                    "serial_number": f"SER-BLK-2-{str_suffix}",
                    "subject": f"CN=Bulk User 2 {str_suffix}",
                    "issuer": "Intermediate CA",
                    "fingerprint_sha256": f"FINGERPRINTBLK2{str_suffix}00000000000000000000000000000000000000"[:64],
                    "certificate_path": f"/path/{nik2}.crt",
                    "p12_reference": f"/path/{nik2}.p12",
                    "issued_at": "2026-10-01T00:00:00Z",
                    "expires_at": "2028-10-01T00:00:00Z",
                }
            }
        ]
    }

    files = {"file": ("users.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    with patch("app.api.endpoints.users.pki_engine.generate_bulk", return_value=mock_pki_bulk_response):
        response = client.post("/api/v1/users/generate-bulk", files=files, headers=auth_headers["admin"])
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total"] == 2
        assert data["data"]["success"] == 2
        assert data["data"]["failed"] == 0


def test_regenerate_certificate_uses_default_passphrase(client: TestClient, auth_headers: dict, seed_users: dict):
    target_user = seed_users["user"]
    mock_stage_res = {
        "staging_token": "token-xyz",
        "target_user_dir": "/path/dir",
        "target_archive_p12": "/path/archive.p12",
        "metadata": {
            "serial_number": "SER-REGEN-123",
            "subject": f"CN={target_user.name}",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "certificate_path": "/path/cert.crt",
            "p12_reference": "/path/cert.p12",
            "issued_at": "2026-10-01T00:00:00Z",
            "expires_at": "2028-10-01T00:00:00Z",
        }
    }

    with patch("app.api.endpoints.users.pki_engine.regenerate_stage", return_value=mock_stage_res) as mock_stage, \
         patch("app.api.endpoints.users.pki_engine.regenerate_commit", return_value={"status": "SUCCESS"}):
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["new_certificate"]["serial_number"] == "SER-REGEN-123"

        # Verify that default passphrase Mkri006! was used
        call_args = mock_stage.call_args[0][0]
        assert call_args["pfx_password"] == "Mkri006!"

        # Verify no secret leak in response text
        assert "Mkri006!" not in res.text
        assert "12345678" not in res.text


def test_change_user_pfx_passphrase(client: TestClient, auth_headers: dict, seed_users: dict):
    target_user = seed_users["user"]
    with patch("app.api.endpoints.users.pki_engine.change_p12_passphrase_admin", return_value={"status": "SUCCESS"}):
        res = client.post(
            f"/api/v1/users/{target_user.id}/pfx-password",
            json={"new_password": "NewSecretPass123!", "confirm_password": "NewSecretPass123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["message"] == "Passphrase berhasil diubah"
        assert "NewSecretPass123!" not in res.text

