import os
import re
import shutil
import logging
from pathlib import Path
from typing import Optional, List, Tuple
from app.core.config import BASE_DIR, settings

logger = logging.getLogger(__name__)


def get_local_pki_dirs() -> Tuple[Path, Path]:
    """
    Mengambil path direktori sign-api/p12 dan pki/issued pada sistem berkas lokal.
    Mendukung konfigurasi Docker container maupun eksekusi langsung di host lokal.
    """
    # 1. Archive P12 directory (sign-api/p12)
    env_p12 = getattr(settings, "P12_ARCHIVE_DIR", None) or os.getenv("P12_ARCHIVE_DIR")
    if env_p12 and Path(env_p12).exists():
        archive_dir = Path(env_p12).resolve()
    else:
        archive_dir = (BASE_DIR / "sign-api" / "p12").resolve()

    # 2. PKI Issued directory (pki/issued)
    env_issued = getattr(settings, "ISSUED_DIR", None) or os.getenv("ISSUED_DIR")
    if env_issued and Path(env_issued).exists():
        issued_dir = Path(env_issued).resolve()
    else:
        issued_dir = (BASE_DIR / "pki" / "issued").resolve()

    return archive_dir, issued_dir


def cleanup_local_pki_materials(nik: str, cert_paths: Optional[List[str]] = None) -> List[str]:
    """
    Menghapus seluruh berkas fisik PKI (.p12, .crt, .key, .csr, .pfx, -meta.txt, dan foldernya)
    terkait NIK atau path sertifikat tertentu pada sistem berkas lokal (fail-safe cleanup).
    
    Returns:
        List path file atau direktori yang berhasil dihapus.
    """
    nik_safe = re.sub(r"[^0-9]", "", str(nik or ""))
    deleted_items: List[str] = []

    archive_dir, issued_dir = get_local_pki_dirs()

    # 1. Hapus arsip .p12 di sign-api/p12/{nik_safe}.p12
    if nik_safe and archive_dir.exists():
        target_p12 = archive_dir / f"{nik_safe}.p12"
        if target_p12.is_file():
            try:
                target_p12.unlink()
                deleted_items.append(str(target_p12))
                logger.info(f"Deleted archive P12: {target_p12}")
            except Exception as e:
                logger.warning(f"Failed to delete {target_p12}: {e}")

    # 2. Cari direktori pengguna di pki/issued/
    candidate_dirs = set()

    if issued_dir.exists():
        # a. Berdasarkan file {nik_safe}.p12 di dalam subfolder issued
        if nik_safe:
            for p12_file in issued_dir.glob(f"*/{nik_safe}.p12"):
                candidate_dirs.add(p12_file.parent.resolve())

            # b. Berdasarkan metadata file *-meta.txt yang mencantumkan NIK
            for meta_file in issued_dir.glob("*/*-meta.txt"):
                try:
                    content = meta_file.read_text(encoding="utf-8", errors="ignore")
                    # Cocokkan format baris NIK pada meta.txt
                    if re.search(rf"NIK\s*:\s*{nik_safe}\b", content):
                        candidate_dirs.add(meta_file.parent.resolve())
                except Exception:
                    pass

    # c. Tambahkan direktori dari cert_paths jika disediakan (dari tabel database)
    if cert_paths:
        for p in cert_paths:
            if not p:
                continue
            path_obj = Path(p)
            if not path_obj.is_absolute():
                path_obj = BASE_DIR / path_obj
            path_obj = path_obj.resolve()

            # Hapus file secara langsung jika ada
            if path_obj.is_file():
                try:
                    path_obj.unlink()
                    deleted_items.append(str(path_obj))
                except Exception:
                    pass

            # Jika file berada di bawah direktori pki/issued, masukkan parent foldernya
            try:
                if issued_dir.exists() and (issued_dir == path_obj.parent.parent or issued_dir in path_obj.parents):
                    candidate_dirs.add(path_obj.parent.resolve())
            except Exception:
                pass

    # 3. Bersihkan seluruh file dalam direktori kandidat dan hapus foldernya
    for out_dir in candidate_dirs:
        try:
            # Keamanan: Pastikan hanya menghapus subdirektori langsung dari issued_dir
            if out_dir.is_dir() and out_dir.parent == issued_dir and out_dir != issued_dir:
                for child in list(out_dir.iterdir()):
                    try:
                        child.unlink()
                        deleted_items.append(str(child))
                    except Exception as ce:
                        logger.warning(f"Failed to delete file {child}: {ce}")
                try:
                    out_dir.rmdir()
                    deleted_items.append(str(out_dir))
                    logger.info(f"Removed directory: {out_dir}")
                except Exception:
                    # Fallback jika masih ada sisa file tersembunyi
                    shutil.rmtree(out_dir, ignore_errors=True)
                    deleted_items.append(str(out_dir))
        except Exception as e:
            logger.warning(f"Failed cleaning directory {out_dir}: {e}")

    return deleted_items
