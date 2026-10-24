import csv
import io
import re
from typing import Dict, Any, List, Set
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.core.config import settings
from app.schemas.user import validate_password_policy

CSV_EXPECTED_HEADERS = ["name", "nik", "email", "organization", "ou", "password", "pfx_pass"]


def parse_and_validate_bulk_csv(content: str, db: Session) -> Dict[str, Any]:
    """
    Mem-parse dan memvalidasi konten CSV untuk pembuatan pengguna massal (bulk generation).
    Mendukung header standar 7 kolom maupun alternatif 6 kolom.
    """
    # Strip potential UTF-8 BOM
    if content.startswith('\ufeff'):
        content = content[1:]

    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CSV", "message": "CSV file is empty"}
        )

    # Validate Header: support both standard 7-col and alternative 6-col (org,ou,cn,email,nik,pfx_pass)
    raw_header = [h.strip() for h in rows[0]]
    header_lower = [h.lower() for h in raw_header]

    is_standard_7col = (raw_header == CSV_EXPECTED_HEADERS or header_lower == [h.lower() for h in CSV_EXPECTED_HEADERS])
    is_alt_6col = (header_lower in (
        ["org", "ou", "cn", "email", "nik", "pfx_pass"],
        ["organization", "ou", "cn", "email", "nik", "pfx_pass"]
    ))

    if not (is_standard_7col or is_alt_6col):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CSV_HEADER", "message": f"CSV header must be: {','.join(CSV_EXPECTED_HEADERS)} or org,ou,cn,email,nik,pfx_pass"}
        )

    data_rows = rows[1:]
    if not data_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_CSV_DATA", "message": "CSV contains no data rows"}
        )

    parsed_rows: List[Dict[str, Any]] = []
    seen_names: Set[str] = set()
    seen_niks: Set[str] = set()
    seen_emails: Set[str] = set()

    row_idx = 0
    for r in data_rows:
        # Skip completely blank lines
        if not r or (len(r) == 1 and not r[0].strip()):
            continue

        row_idx += 1
        errors: List[str] = []

        expected_cols = 7 if is_standard_7col else 6
        if len(r) != expected_cols:
            errors.append(f"Expected {expected_cols} columns, got {len(r)}")
            parsed_rows.append({
                "row": row_idx,
                "nik": r[1].strip() if len(r) > 1 else "",
                "valid": False,
                "errors": errors,
                "data": None
            })
            continue

        if is_standard_7col:
            name, nik, email, org, ou, password, pfx_pass = [col.strip() for col in r]
        else:
            # org, ou, cn, email, nik, pfx_pass
            org, ou, name, email, nik, pfx_pass = [col.strip() for col in r]
            password = ""

        # Check forbidden characters (\t, \r, \n)
        for field_name, field_val in [
            ("name", name), ("nik", nik), ("email", email),
            ("organization", org), ("ou", ou), ("password", password),
            ("pfx_pass", pfx_pass)
        ]:
            if "\t" in field_val or "\r" in field_val or "\n" in field_val:
                errors.append(f"Field '{field_name}' contains forbidden tab or newline characters")

        # Required fields
        if not name:
            errors.append("Field 'name' is required")
        if not nik:
            errors.append("Field 'nik' is required")
        if not email:
            errors.append("Field 'email' is required")
        if not org:
            errors.append("Field 'organization' is required")
        if not ou:
            errors.append("Field 'ou' is required")

        # Automatic default credentials when empty
        if not password:
            password = settings.DEFAULT_USER_PASS
        if not pfx_pass:
            pfx_pass = settings.DEFAULT_PFX_PASS

        # NIK format
        if nik and not re.match(r"^[0-9]{16}$", nik):
            errors.append("NIK must be exactly 16 digits")

        # Email format
        if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            errors.append("Invalid email format")

        # Name and Email equality check
        if name and email and name.strip().lower() == email.strip().lower():
            errors.append("Nama dan email tidak boleh sama")

        # Password policy
        if password:
            pwd_errs = validate_password_policy(password)
            errors.extend(pwd_errs)

        # Duplicate check in CSV
        if name:
            name_lower = name.strip().lower()
            if name_lower in seen_names:
                errors.append("Duplicate name in CSV")
            else:
                seen_names.add(name_lower)

        if nik:
            if nik in seen_niks:
                errors.append("Duplicate NIK in CSV")
            else:
                seen_niks.add(nik)

        if email:
            email_lower = email.strip().lower()
            if email_lower in seen_emails:
                errors.append("Duplicate email in CSV")
            else:
                seen_emails.add(email_lower)

        # Duplicate check in DB
        if name and not any("name" in e.lower() or "nama" in e.lower() for e in errors):
            existing_user_name = db.query(User).filter(func.lower(User.name) == func.lower(name.strip())).first()
            if existing_user_name:
                errors.append("Name already exists in database")

        if nik and not any("NIK" in e for e in errors):
            existing_user_nik = db.query(User).filter(User.nik == nik.strip()).first()
            if existing_user_nik:
                errors.append("NIK already exists in database")

        if email and not any("email" in e.lower() for e in errors):
            existing_user_email = db.query(User).filter(func.lower(User.email) == func.lower(email.strip())).first()
            if existing_user_email:
                errors.append("Email already exists in database")

        is_valid = len(errors) == 0
        parsed_rows.append({
            "row": row_idx,
            "nik": nik,
            "valid": is_valid,
            "errors": errors if not is_valid else [],
            "data": {
                "name": name,
                "nik": nik,
                "email": email,
                "organization": org,
                "ou": ou,
                "password": password,
                "pfx_pass": pfx_pass
            } if is_valid else None
        })

    return {
        "total": len(parsed_rows),
        "valid": sum(1 for r in parsed_rows if r["valid"]),
        "invalid": sum(1 for r in parsed_rows if not r["valid"]),
        "rows": parsed_rows
    }
