#!/usr/bin/env python3
import subprocess
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SCRIPT_SINGLE = BASE_DIR / "bangkitkan_single.sh"
SCRIPT_BULK   = BASE_DIR / "bangkitkan_banyak.sh"

app = FastAPI()
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "output": None}
    )


# ===============================
# SINGLE USER (INTERAKTIF)
# ===============================
@app.post("/single", response_class=HTMLResponse)
def bangkitkan_single(
    request: Request,
    org: str = Form(...),
    ou: str = Form(...),
    cn: str = Form(...),
    email: str = Form(...),
    nik: str = Form(...),
    pfx_pass: str = Form(...)
):

    stdin_data = "\n".join([
    org,        # ORG_NAME
    ou,         # OU
    cn,         # CN
    email,      # EMAIL
    "",         # DAYS (kosong → pakai DEFAULT_DAYS)
    nik,        # NIK
    pfx_pass    # PFX_PASS
    ]) + "\n"


    result = subprocess.run(
        ["bash", str(SCRIPT_SINGLE)],
        input=stdin_data,
        capture_output=True,
        text=True
    )

    output = (result.stdout or "") + (result.stderr or "")

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "output": output
        }
    )


# ===============================
# BULK CSV
# ===============================
@app.post("/bulk", response_class=HTMLResponse)
def bangkitkan_bulk(
    request: Request,
    file: UploadFile = File(...)
):
    csv_path = UPLOAD_DIR / file.filename
    with csv_path.open("wb") as f:
        f.write(file.file.read())

    result = subprocess.run(
        ["bash", str(SCRIPT_BULK), str(csv_path)],
        capture_output=True,
        text=True
    )

    output = (result.stdout or "") + (result.stderr or "")

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "output": output
        }
    )
