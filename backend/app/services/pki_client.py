import httpx
from typing import Dict, Any, List
from app.core.config import settings
from fastapi import HTTPException, status

class PKIServiceClient:
    def __init__(self):
        self.base_url = f"{settings.PKI_SERVICE_URL.rstrip('/')}/internal/pki"
        self.headers = {
            "Authorization": f"Bearer {settings.PKI_SERVICE_TOKEN}"
        }

    def generate_single(self, data: dict) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/generate",
                    json=data,
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def generate_bulk(self, requests: List[dict]) -> Dict[str, Any]:
        try:
            timeout = max(30.0, float(len(requests) * 30.0))
            with httpx.Client(timeout=timeout) as client:
                response = client.post(
                    f"{self.base_url}/generate-bulk",
                    json={"requests": requests},
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def change_p12_passphrase_user(self, nik: str, old_password: str, new_password: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/change-p12-passphrase/user",
                    json={
                        "nik": nik,
                        "old_password": old_password,
                        "new_password": new_password
                    },
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def change_p12_passphrase_admin(self, nik: str, new_password: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/change-p12-passphrase/admin",
                    json={
                        "nik": nik,
                        "new_password": new_password
                    },
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def delete_user_materials(self, nik: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.delete(
                    f"{self.base_url}/user/{nik}",
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def regenerate_stage(self, data: dict) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/regenerate-stage",
                    json=data,
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def regenerate_commit(self, staging_token: str, target_user_dir: str, target_archive_p12: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/regenerate-commit",
                    json={
                        "staging_token": staging_token,
                        "target_user_dir": target_user_dir,
                        "target_archive_p12": target_archive_p12
                    },
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

    def regenerate_cleanup(self, staging_token: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/regenerate-cleanup",
                    json={"staging_token": staging_token},
                    headers=self.headers
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "PKI Service Error")
                )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"PKI Service unavailable: {str(exc)}"
            )

pki_client = PKIServiceClient()

