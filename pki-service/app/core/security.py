import secrets
from fastapi import Header, HTTPException, status
from app.core.config import settings

def verify_internal_token(
    x_internal_token: str = Header(None, alias="X-Internal-Token"),
    authorization: str = Header(None)
):
    token = x_internal_token
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED_SERVICE", "message": "Missing internal authentication token."}
        )

    expected = settings.PKI_SERVICE_TOKEN
    # Timing-safe comparison to prevent timing attacks
    if not secrets.compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN_SERVICE", "message": "Invalid internal authentication token."}
        )
    return True
