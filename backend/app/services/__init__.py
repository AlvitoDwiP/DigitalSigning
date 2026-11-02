# Services package initialization (Foundation layer)
import sys
from .audit import record_audit
from .sign import pdf_signer
from .pki import (
    pki_api_client,
    pki_cleanup,
    certificate_counter,
    bulk_user_importer,
)

# Alias backward compatibility for legacy imports
sys.modules["app.services.pdf_signer"] = pdf_signer
sys.modules["app.services.pki_api_client"] = pki_api_client
sys.modules["app.services.pki_cleanup"] = pki_cleanup
sys.modules["app.services.certificate_counter"] = certificate_counter
sys.modules["app.services.bulk_user_importer"] = bulk_user_importer

__all__ = [
    "record_audit",
    "pdf_signer",
    "pki_api_client",
    "pki_cleanup",
    "certificate_counter",
    "bulk_user_importer",
]
