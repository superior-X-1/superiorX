"""
Measure X — Production Standards-Compliant QR Code Generation Subsystem
Implements:
- ISO/IEC 18004 standards-compliant QR code generation
- Generates high-resolution PNG data URLs and raw binary streams
- Encodes statutory public verification URLs scannable by Android/iOS native cameras
- Zero simulated or decorative fake SVG matrices
"""

import os
import io
import base64
from typing import Tuple

import qrcode
from qrcode.constants import ERROR_CORRECT_M

# Configuration
DEFAULT_PUBLIC_BASE = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")


def build_verification_url(certificate_id: str, base_url: str = None) -> str:
    """Builds the canonical public verification URL encoded into the QR code."""
    host = (base_url or DEFAULT_PUBLIC_BASE).rstrip("/")
    return f"{host}/#verify?cert={certificate_id}"


def generate_qr_code_png_bytes(content: str) -> bytes:
    """Generates standard binary PNG bytes for a given string content."""
    qr = qrcode.QRCode(
        version=None, # auto-fit
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#062F28", back_color="#FFFFFF")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_qr_data_url(content: str) -> str:
    """Generates a standard data:image/png;base64,... data URI scannable by any camera or scanner."""
    png_bytes = generate_qr_code_png_bytes(content)
    b64_str = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def generate_certificate_qr(certificate_id: str, base_url: str = None, *args, **kwargs) -> Tuple[str, str]:
    """
    Generates statutory certificate QR code.
    Returns (verification_url, qr_data_url).
    """
    verify_url = build_verification_url(certificate_id, base_url if isinstance(base_url, str) and base_url.startswith("http") else None)
    qr_data_url = generate_qr_data_url(verify_url)
    return verify_url, qr_data_url
