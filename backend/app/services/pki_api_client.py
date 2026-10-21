import os
import re
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.exceptions import AppException

class PKIEngineError(AppException):
    def __init__(self, message: str, code: str = "PKI_ENGINE_ERROR", status_code: int = 502):
        if status_code is None:
            if code in ["INVALID_INPUT", "INVALID_IDENTIFIER"]:
                status_code = 400
            elif code in [
                "PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR", "TIMEOUT",
                "ARTIFACT_ERROR", "CERTIFICATE_VALIDATION_FAILED",
                "P12_VALIDATION_FAILED", "P12_NOT_FOUND", "PKI_SERVICE_UNAVAILABLE"
            ]:
                status_code = 502
            else:
                status_code = 500
        super().__init__(code=code, message=message, status_code=status_code)

class PKIApiClient:
    """
    Internal HTTP Client communicating with Container B (PKI Service / Certificate Issuer).
    Enforces secret isolation, strict timeouts, error mapping, and timing-safe token delivery.
    """
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self._base_url = (base_url or getattr(settings, "PKI_SERVICE_URL", "http://pki_service:8001")).rstrip("/")
        self._token = token or getattr(settings, "PKI_SERVICE_TOKEN", "dev-internal-pki-secret-token-2026")
        self._timeout = httpx.Timeout(
            connect=5.0,
            read=float(getattr(settings, "PKI_TIMEOUT", 60)),
            write=10.0,
            pool=5.0
        )

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Internal-Token": self._token,
            "User-Agent": "DigitalSignaturePlatform-Backend/1.0"
        }

    def _handle_response(self, response: httpx.Response) -> Any:
        try:
            payload = response.json()
        except Exception:
            payload = None

        if response.is_success:
            if isinstance(payload, dict) and "data" in payload:
                return payload["data"]
            return payload

        # Extract structured error from PKI Service
        err_code = "PKI_ENGINE_ERROR"
        err_msg = f"PKI Service error with status HTTP {response.status_code}"
        
        if isinstance(payload, dict):
            if "detail" in payload:
                detail = payload["detail"]
                if isinstance(detail, dict):
                    err_code = detail.get("code", err_code)
                    err_msg = detail.get("message", err_msg)
                elif isinstance(detail, str):
                    err_msg = detail
            elif "error" in payload:
                err_info = payload["error"]
                if isinstance(err_info, dict):
                    err_code = err_info.get("code", err_code)
                    err_msg = err_info.get("message", err_msg)
                elif isinstance(err_info, str):
                    err_msg = err_info

        raise PKIEngineError(message=err_msg, code=err_code, status_code=response.status_code)

    def _post(self, endpoint: str, json_data: dict, custom_timeout: Optional[float] = None) -> Any:
        url = f"{self._base_url}{endpoint}"
        timeout = httpx.Timeout(connect=5.0, read=custom_timeout, write=10.0, pool=5.0) if custom_timeout else self._timeout
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=json_data, headers=self._headers())
                return self._handle_response(resp)
        except httpx.ConnectError:
            raise PKIEngineError("PKI Service is currently unreachable.", code="PKI_SERVICE_UNAVAILABLE", status_code=502)
        except httpx.TimeoutException:
            raise PKIEngineError("PKI Service request timed out.", code="TIMEOUT", status_code=504)
        except httpx.RequestError as e:
            raise PKIEngineError(f"PKI Service communication error: {str(e)}", code="PKI_SERVICE_UNAVAILABLE", status_code=502)

    def _delete(self, endpoint: str) -> Any:
        url = f"{self._base_url}{endpoint}"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.delete(url, headers=self._headers())
                return self._handle_response(resp)
        except httpx.ConnectError:
            raise PKIEngineError("PKI Service is currently unreachable.", code="PKI_SERVICE_UNAVAILABLE", status_code=502)
        except httpx.TimeoutException:
            raise PKIEngineError("PKI Service request timed out.", code="TIMEOUT", status_code=504)
        except httpx.RequestError as e:
            raise PKIEngineError(f"PKI Service communication error: {str(e)}", code="PKI_SERVICE_UNAVAILABLE", status_code=502)

    def health_check(self) -> bool:
        url = f"{self._base_url}/health"
        try:
            with httpx.Client(timeout=httpx.Timeout(3.0)) as client:
                resp = client.get(url)
                return resp.status_code == 200
        except Exception:
            return False

    def generate_single(self, name: Any = None, nik: str = None, email: str = None, organization: str = None, ou: str = None, pfx_password: str = None, data: dict = None, **kwargs) -> dict:
        req_data = {}
        if isinstance(name, dict):
            req_data = name
        elif data is not None:
            req_data = data
        else:
            req_data = {
                "name": name,
                "nik": nik,
                "email": email,
                "organization": organization,
                "ou": ou,
                "pfx_password": pfx_password
            }
        req_data.update(kwargs)
        # Ensure mandatory keys and default credentials
        for k in ["name", "nik", "email", "organization", "ou"]:
            if k not in req_data or req_data[k] is None:
                req_data[k] = ""
        if not req_data.get("pfx_password"):
            req_data["pfx_password"] = getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
        return self._post("/internal/v1/pki/certificates/single", req_data)

    def generate_bulk(self, requests: list) -> dict:
        if not requests:
            return {"results": []}
        normalized = []
        for r in requests:
            d = dict(r if isinstance(r, dict) else r.model_dump())
            if not d.get("pfx_password"):
                d["pfx_password"] = getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
            normalized.append(d)
        
        custom_timeout = max(60.0, float(len(requests) * 30))
        return self._post(
            "/internal/v1/pki/certificates/bulk",
            {"requests": normalized},
            custom_timeout=custom_timeout
        )

    def regenerate_stage(self, name: Any = None, nik: str = None, email: str = None, organization: str = None, ou: str = None, pfx_password: str = None, data: dict = None, **kwargs) -> dict:
        req_data = {}
        if isinstance(name, dict):
            req_data = name
        elif data is not None:
            req_data = data
        else:
            req_data = {
                "name": name,
                "nik": nik,
                "email": email,
                "organization": organization,
                "ou": ou,
                "pfx_password": pfx_password
            }
        req_data.update(kwargs)
        for k in ["name", "nik", "email", "organization", "ou"]:
            if k not in req_data or req_data[k] is None:
                req_data[k] = ""
        if not req_data.get("pfx_password"):
            req_data["pfx_password"] = getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
        return self._post("/internal/v1/pki/certificates/regenerate/stage", req_data)

    def regenerate_commit(self, staging_token: str, target_user_dir: str, target_archive_p12: str) -> bool:
        res = self._post("/internal/v1/pki/certificates/regenerate/commit", {
            "staging_token": staging_token,
            "target_user_dir": target_user_dir,
            "target_archive_p12": target_archive_p12
        })
        return True

    def regenerate_cleanup(self, staging_token: str) -> bool:
        try:
            self._post("/internal/v1/pki/certificates/regenerate/cleanup", {
                "staging_token": staging_token
            })
        except Exception:
            pass
        return True

    def change_p12_passphrase_user(self, nik: str, old_password: str, new_password: str) -> bool:
        self._post("/internal/v1/pki/passphrase/user", {
            "nik": nik,
            "old_password": old_password,
            "new_password": new_password
        })
        return True

    def change_p12_passphrase_admin(self, nik: str, new_password: str) -> bool:
        self._post("/internal/v1/pki/passphrase/admin", {
            "nik": nik,
            "new_password": new_password
        })
        return True

    def delete_user_materials(self, nik: str) -> dict:
        nik_safe = re.sub(r'[^0-9]', '', nik)
        return self._delete(f"/internal/v1/pki/materials/{nik_safe}")

# Global singleton client instance
pki_api_client = PKIApiClient()

# Functional aliases matching previous interface
generate_single = pki_api_client.generate_single
generate_bulk = pki_api_client.generate_bulk
regenerate_stage = pki_api_client.regenerate_stage
regenerate_commit = pki_api_client.regenerate_commit
regenerate_cleanup = pki_api_client.regenerate_cleanup
change_p12_passphrase_user = pki_api_client.change_p12_passphrase_user
change_p12_passphrase_admin = pki_api_client.change_p12_passphrase_admin
delete_user_materials = pki_api_client.delete_user_materials
delete_user_pki_materials = pki_api_client.delete_user_materials
