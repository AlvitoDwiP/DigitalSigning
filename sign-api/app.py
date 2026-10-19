#!/usr/bin/env python3
"""
FastAPI Sign API - endesive (annotation + image appearance, no border)

Fitur:
- /sign  : tanda tangan PDF pakai PKCS#12 (.p12), visual = gambar upload (tanpa border)
- /certs : daftar .p12 di folder yang diizinkan
- /health: cek status

Depedensi:
  pip install fastapi "uvicorn[standard]" endesive cryptography attrs Pillow tzlocal
"""

import io
import os
import re
import string
import secrets
from tempfile import NamedTemporaryFile
from pathlib import Path
from typing import Optional, List, Tuple
from secrets import token_hex
from datetime import datetime, timezone

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse, JSONResponse

from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat import backends
from endesive.pdf import cms

from fastapi.middleware.cors import CORSMiddleware

# =========================
# CONFIG
# =========================
_BASE_DIR = Path(__file__).resolve().parent
_DEFAULT_P12 = _BASE_DIR / "p12"
_SYSADMIN_P12 = Path("/home/sysadmin/sign-api(well3)/p12")

def _determine_p12_dir() -> Path:
    env_dir = os.getenv("ALLOWED_P12_DIR")
    if env_dir:
        p = Path(env_dir).expanduser().resolve()
        if p.is_dir():
            return p
    if _SYSADMIN_P12.is_dir():
        return _SYSADMIN_P12
    if _DEFAULT_P12.is_dir():
        return _DEFAULT_P12
    alt_p12 = _BASE_DIR.parent / "sign-api" / "p12"
    if alt_p12.is_dir():
        return alt_p12
    return _DEFAULT_P12

CONFIG = {
    "ALLOWED_P12_DIR": str(_determine_p12_dir()),
    "API_KEY": os.getenv("API_KEY", "rahasia-super"),
    "ENABLE_CERT_LIST": os.getenv("ENABLE_CERT_LIST", "true").lower() in ("true", "1", "yes"),
    "MAX_UPLOAD_BYTES": int(os.getenv("MAX_UPLOAD_BYTES", 20 * 1024 * 1024)),  # 20 MB
    # Output filename: "plain" | "short3" (default) | "unique"
    "FILENAME_STRATEGY": os.getenv("FILENAME_STRATEGY", "short3"),
    "ALLOW_EMPTY_P12_PASSWORD": os.getenv("ALLOW_EMPTY_P12_PASSWORD", "false").lower() in ("true", "1", "yes"),
}

ALLOWED_P12_DIR = CONFIG["ALLOWED_P12_DIR"]
API_KEY = CONFIG["API_KEY"]
ENABLE_CERT_LIST = CONFIG["ENABLE_CERT_LIST"]
MAX_UPLOAD_BYTES = int(CONFIG["MAX_UPLOAD_BYTES"])
FILENAME_STRATEGY = CONFIG.get("FILENAME_STRATEGY", "short3")
ALLOW_EMPTY_P12_PASSWORD = bool(CONFIG.get("ALLOW_EMPTY_P12_PASSWORD", False))

app = FastAPI(title="endesive Sign API", version="1.0.0", description="Digital Signature API for PDF Documents")

# CORS Middleware for local & web integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Auth =====
def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True

@app.get("/health")
def health():
    p12_dir = _determine_p12_dir()
    return {
        "status": "ok",
        "app": "endesive Sign API",
        "p12_dir_found": p12_dir.is_dir(),
        "p12_count": len([p for p in p12_dir.iterdir() if p.suffix.lower() == ".p12"]) if p12_dir.is_dir() else 0
    }

# ===== Utils =====
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")

def _sanitize_p12_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="p12_name wajib diisi.")
    if "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="p12_name tidak boleh mengandung path.")
    if not _SAFE_NAME.fullmatch(name):
        raise HTTPException(status_code=400, detail="p12_name mengandung karakter tidak valid.")
    if not name.lower().endswith(".p12"):
        name += ".p12"
    return name

def _nik_to_p12_name(nik: str) -> str:
    nik = (nik or "").strip()
    if not re.fullmatch(r"\d{16}", nik):
        raise HTTPException(status_code=400, detail="nik harus 16 digit.")
    return f"{nik}.p12"

def _resolve_p12_path_from_name(p12_name: str) -> Path:
    base = _determine_p12_dir()
    if not base.exists() or not base.is_dir():
        raise HTTPException(status_code=500, detail="Direktori P12 tidak ditemukan.")
    target = (base / _sanitize_p12_name(p12_name)).resolve()
    try:
        target.relative_to(base)
    except Exception:
        raise HTTPException(status_code=403, detail="p12_name merujuk ke luar direktori yang diizinkan.")
    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"P12 tidak ditemukan: {target.name}")
    return target

_ALNUM = string.ascii_lowercase + string.digits
def _build_out_filename(stem: str) -> str:
    if FILENAME_STRATEGY == "plain":
        return f"{stem}_sign.pdf"
    if FILENAME_STRATEGY == "short3":
        code = "".join(secrets.choice(_ALNUM) for _ in range(3))
        return f"{stem}_sign_{code}.pdf"
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    rnd = token_hex(3)
    return f"{stem}_sign_{ts}_{rnd}.pdf"

def _parse_box4(
    llx: Optional[float], lly: Optional[float],
    urx: Optional[float], ury: Optional[float]
) -> Optional[Tuple[float, float, float, float]]:
    if None in (llx, lly, urx, ury):
        return None
    try:
        x0 = float(llx); y0 = float(lly); x1 = float(urx); y1 = float(ury)
    except Exception:
        raise HTTPException(status_code=400, detail="Koordinat harus numerik.")
    if x1 < x0: x0, x1 = x1, x0
    if y1 < y0: y0, y1 = y1, y0
    if x1 <= x0 or y1 <= y0:
        raise HTTPException(status_code=400, detail="urx>llx dan ury>lly wajib.")
    return (x0, y0, x1, y1)

def _load_pkcs12(p12_path: Path, password: Optional[str]):
    pwd = password if password is not None else ""
    if pwd == "":
        if not ALLOW_EMPTY_P12_PASSWORD:
            raise HTTPException(status_code=400, detail="Password P12 kosong tidak diizinkan oleh server.")
    try:
        with open(p12_path, "rb") as f:
            key, cert, othercerts = pkcs12.load_key_and_certificates(
                f.read(),
                None if pwd == "" else pwd.encode("utf-8"),
                backends.default_backend()
            )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid P12 password atau PKCS#12 tidak valid.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal memuat PKCS#12: {type(e).__name__}: {e}")
    if key is None or cert is None:
        raise HTTPException(status_code=400, detail="PKCS#12 tidak memuat private key & certificate.")
    return key, cert, (othercerts or [])

def _sign_with_endesive(
    pdf_bytes: bytes,
    p12_path: Path,
    p12_password: Optional[str],
    page_idx: int,
    rect: Tuple[float, float, float, float],
    image_path: Optional[str],
    reason: str,
    location: str,
) -> bytes:
    key, cert, othercerts = _load_pkcs12(p12_path, p12_password)
    x0, y0, x1, y1 = rect
    w = max(0.0, x1 - x0)
    h = max(0.0, y1 - y0)

    signingdate = datetime.now(timezone.utc).strftime("D:%Y%m%d%H%M%S+00'00'")

    if image_path is None:
        # fallback: tetap annotation borderless, tanpa gambar (kosong)
        # manual appearance kosong = rect transparan
        signature_manual = []
        manual_images = {}
    else:
        signature_manual = [['image', 'sigimg', 0, 0, w, h, True, True]]
        manual_images = {'sigimg': image_path}

    dct = {
        "auto_sigfield": True,
        "sigpage": max(0, page_idx),
        "signaturebox": (x0, y0, x1, y1),
        "signform": False,
        "sigfield": "TTE",

        # manual AP image-only (no border, no text)
        "signature_manual": signature_manual,
        "manual_images": manual_images,
        "manual_fonts": {},

        "aligned": 0,
        "sigflags": 3,
        "sigflagsft": 132,

        "reason": reason,
        "location": location,
        "contact": "",
        "signingdate": signingdate,
        "date": signingdate,
    }

    signed_tail = cms.sign(pdf_bytes, dct, key, cert, othercerts, "sha256")
    return pdf_bytes + signed_tail

# ===== Main endpoint =====
@app.post("/sign")
async def sign_pdf(
    pdf: UploadFile = File(..., description="PDF yang akan ditandatangani"),
    nik: str = Form(..., description="NIK 16 digit; dipakai sebagai nama file P12 (<NIK>.p12)"),
    p12_password_form: Optional[str] = Form(default=None),
    x_p12_password: Optional[str] = Header(default=None),

    # Visual (PNG/JPG) untuk appearance
    stamp: Optional[UploadFile] = File(default=None, description="PNG/JPG untuk visualisasi annotation"),

    # Posisi & ukuran
    page: int = Form(1, description="Halaman 1-based"),
    x: float = Form(36.0, description="Koordinat kiri-bawah (pt)"),
    y: float = Form(36.0, description="Koordinat kiri-bawah (pt)"),
    w: Optional[float] = Form(None, description="Lebar (pt)"),
    h: Optional[float] = Form(None, description="Tinggi (pt)"),
    size: Optional[float] = Form(None, description="Jika diisi, w=h=size (pt)"),

    # 4-koordinat (override x/y/w/h/size)
    llx: Optional[float] = Form(None, description="Lower-left X (pt)"),
    lly: Optional[float] = Form(None, description="Lower-left Y (pt)"),
    urx: Optional[float] = Form(None, description="Upper-right X (pt)"),
    ury: Optional[float] = Form(None, description="Upper-right Y (pt)"),

    trim_px: int = Form(0, description="Pangkas border gambar (px), 0=tanpa crop"),
    reason: str = Form("Digital Signature"),
    location: str = Form("Jakarta"),
    _auth_ok: bool = Depends(require_api_key),
):
    # Validasi PDF
    if pdf.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=415, detail="File harus PDF")
    data = await pdf.read()
    if not data:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Ukuran file > {MAX_UPLOAD_BYTES} bytes")

    # Hitung rect
    box4 = _parse_box4(llx, lly, urx, ury)
    if box4 is not None:
        x0, y0, x2, y2 = box4
    else:
        if size is not None and size > 0:
            W = H = float(size)
        else:
            W = float(w if w is not None else 150.0)
            H = float(h if h is not None else 150.0)
        x0, y0, x2, y2 = float(x), float(y), float(x) + W, float(y) + H

    # Siapkan file gambar (opsional)
    tmp_img_path: Optional[str] = None
    try:
        if stamp is not None:
            if stamp.content_type not in ("image/png", "image/jpeg", "image/jpg"):
                raise HTTPException(status_code=415, detail="Stamp harus PNG/JPG")
            ext = (Path(stamp.filename or "").suffix or "").lower()
            if not ext:
                ext = ".png" if stamp.content_type == "image/png" else ".jpg"
            tmp = NamedTemporaryFile(delete=False, suffix=ext)
            raw = await stamp.read()
            if not raw:
                raise HTTPException(status_code=400, detail="File stamp kosong")
            # optional trim pinggiran
            if trim_px and trim_px > 0:
                try:
                    from PIL import Image
                    with Image.open(io.BytesIO(raw)) as im:
                        w0, h0 = im.size
                        t = min(int(trim_px), max(w0 // 2 - 1, 0), max(h0 // 2 - 1, 0))
                        if t > 0:
                            im = im.crop((t, t, w0 - t, h0 - t))
                        im.save(tmp.name)
                except Exception:
                    tmp.write(raw); tmp.flush()
            else:
                tmp.write(raw); tmp.flush()
            tmp.close()
            tmp_img_path = tmp.name

        # P12 (map dari NIK)
        p12_name = _nik_to_p12_name(nik)
        p12_path = _resolve_p12_path_from_name(p12_name)
        p12_password = x_p12_password if x_p12_password is not None else p12_password_form

        # Sign (annotation + image-only, no border)
        out_bytes = _sign_with_endesive(
            pdf_bytes=data,
            p12_path=p12_path,
            p12_password=p12_password,
            page_idx=max(0, page - 1),
            rect=(x0, y0, x2, y2),
            image_path=tmp_img_path,
            reason=reason,
            location=location,
        )

    finally:
        if tmp_img_path and os.path.exists(tmp_img_path):
            try:
                os.remove(tmp_img_path)
            except Exception:
                pass

    # Output
    orig_name = (pdf.filename or "document.pdf").rsplit("/", 1)[-1]
    stem = Path(orig_name).stem
    out_name = _build_out_filename(stem)

    headers = {
        "Content-Disposition": f'attachment; filename="{out_name}"',
        "X-P12-Used": _sanitize_p12_name(_nik_to_p12_name(nik)),
        "X-Annotation": "endesive-manual-image",
        "X-Visible": "true" if stamp is not None else "false",
        "X-Filename-Strategy": FILENAME_STRATEGY,
    }
    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers=headers)

# ===== Optional: list available P12 =====
@app.get("/certs")
def list_p12_files(_auth_ok: bool = Depends(require_api_key)):
    if not ENABLE_CERT_LIST:
        raise HTTPException(status_code=404, detail="Endpoint dimatikan.")
    base = _determine_p12_dir()
    if not base.exists() or not base.is_dir():
        raise HTTPException(status_code=500, detail="ALLOWED_P12_DIR tidak valid.")
    files: List[str] = sorted(
        [p.name for p in base.iterdir() if p.is_file() and p.suffix.lower() == ".p12"]
    )
    return {"dir": str(base.resolve()), "count": len(files), "files": files}

# ===== Error handler =====
@app.exception_handler(RuntimeError)
async def runtime_error_handler(_, exc: RuntimeError):
    return JSONResponse(status_code=500, content={"detail": str(exc)})
