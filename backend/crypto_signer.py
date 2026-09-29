"""
Measure X — Cryptographic Asymmetric Digital Signature Subsystem
Implements:
- RSA 2048-bit asymmetric digital signing (OIML D31 & Legal Metrology statutory integrity)
- Deterministic canonical certificate payload serialization
- Asymmetric signature generation via backend private key
- Constant-time asymmetric signature verification via backend public key
- Zero private key leakage to frontend or public APIs
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.exceptions import InvalidSignature

# Configuration
KEY_DIR = Path(os.environ.get("DIGITAL_SIGNATURE_KEY_DIR", Path(__file__).resolve().parent / "keys"))
PRIVATE_KEY_PATH = Path(os.environ.get("DIGITAL_SIGNATURE_PRIVATE_KEY_PATH", KEY_DIR / "measurex_private_key.pem"))
PUBLIC_KEY_PATH = Path(os.environ.get("DIGITAL_SIGNATURE_PUBLIC_KEY_PATH", KEY_DIR / "measurex_public_key.pem"))
KEY_ID = os.environ.get("DIGITAL_SIGNATURE_KEY_ID", "MX-KEY-2026-V1")
SIGNATURE_ALGORITHM = "RSA-SHA256"


def ensure_keypair():
    """Generates RSA 2048-bit keypair if not already present on disk (local development only)."""
    # In production on Vercel, key comes from env variable
    if os.environ.get("DIGITAL_SIGNATURE_PRIVATE_KEY_PEM"):
        return

    try:
        KEY_DIR.mkdir(parents=True, exist_ok=True)
        if not PRIVATE_KEY_PATH.exists() or not PUBLIC_KEY_PATH.exists():
            # Generate new 2048-bit RSA key
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048
            )
            # Serialize private key
            pem_private = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            with open(PRIVATE_KEY_PATH, "wb") as f:
                f.write(pem_private)
            try:
                os.chmod(PRIVATE_KEY_PATH, 0o600)
            except Exception:
                pass

            # Serialize public key
            pem_public = private_key.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            with open(PUBLIC_KEY_PATH, "wb") as f:
                f.write(pem_public)
    except (OSError, PermissionError):
        # Gracefully handle read-only file systems (e.g. Vercel serverless)
        pass


def load_private_key():
    # Priority 1: DIGITAL_SIGNATURE_PRIVATE_KEY_PEM environment variable (Production)
    env_pem = os.environ.get("DIGITAL_SIGNATURE_PRIVATE_KEY_PEM")
    if env_pem:
        clean_pem = env_pem.strip().replace("\\n", "\n").encode("utf-8")
        return serialization.load_pem_private_key(clean_pem, password=None)

    # Priority 2: Local disk file (Development)
    ensure_keypair()
    if PRIVATE_KEY_PATH.exists():
        with open(PRIVATE_KEY_PATH, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)

    raise RuntimeError("Private signing key not configured. Set DIGITAL_SIGNATURE_PRIVATE_KEY_PEM environment variable.")


def load_public_key():
    # Priority 1: DIGITAL_SIGNATURE_PUBLIC_KEY_PEM environment variable
    env_pub = os.environ.get("DIGITAL_SIGNATURE_PUBLIC_KEY_PEM")
    if env_pub:
        clean_pub = env_pub.strip().replace("\\n", "\n").encode("utf-8")
        return serialization.load_pem_public_key(clean_pub)

    # Priority 2: Public key from disk
    if PUBLIC_KEY_PATH.exists():
        with open(PUBLIC_KEY_PATH, "rb") as f:
            return serialization.load_pem_public_key(f.read())

    # Priority 3: Derive from private key in env
    if os.environ.get("DIGITAL_SIGNATURE_PRIVATE_KEY_PEM"):
        priv = load_private_key()
        return priv.public_key()

    ensure_keypair()
    if PUBLIC_KEY_PATH.exists():
        with open(PUBLIC_KEY_PATH, "rb") as f:
            return serialization.load_pem_public_key(f.read())

    raise RuntimeError("Public verification key not found.")


def canonical_certificate_payload(cert_data: Optional[Dict[str, Any]] = None, **kwargs) -> str:
    """
    Creates a deterministic, canonically ordered JSON serialization of statutory certificate data.
    Ensures that verification is stable regardless of key order or formatting differences.
    Accepts dictionary or keyword arguments.
    """
    data = dict(cert_data or {})
    data.update(kwargs)
    canonical_dict = {
        "certificate_id": str(data.get("id") or data.get("certificate_id") or data.get("cert_id") or ""),
        "instrument_id": str(data.get("instrument_id") or data.get("instrumentId") or ""),
        "serial_number": str(data.get("serial_number") or data.get("serialNumber") or ""),
        "instrument_type": str(data.get("instrument_type") or data.get("instrumentType") or ""),
        "manufacturer": str(data.get("manufacturer") or ""),
        "model": str(data.get("model") or ""),
        "capacity": str(data.get("capacity") or ""),
        "owner_reference": str(data.get("owner_name") or data.get("ownerName") or ""),
        "verification_date": str(data.get("verification_date") or data.get("verificationDate") or ""),
        "valid_until": str(data.get("valid_until") or data.get("validUntil") or ""),
        "verifier_id": str(data.get("officer_id") or data.get("officerId") or ""),
        "verifier_type": str(data.get("verifier_type") or data.get("verifierType") or "LMO").upper(),
        "seal_number": str(data.get("wire_seal_number") or data.get("wireSealNumber") or ""),
        "status_version": "2026.1"
    }
    # Deterministic compact JSON (sorted keys, no spaces)
    return json.dumps(canonical_dict, sort_keys=True, separators=(',', ':'))


def sign_certificate_payload(canonical_json: str) -> Tuple[str, str]:
    """
    Signs the canonical certificate payload using the server's private RSA key with PKCS#1 v1.5 + SHA-256.
    Returns (base64_signature, key_id).
    """
    private_key = load_private_key()
    signature_bytes = private_key.sign(
        canonical_json.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    sig_b64 = base64.b64encode(signature_bytes).decode("ascii")
    return sig_b64, KEY_ID


def verify_certificate_signature(canonical_json: str, base64_signature: str) -> bool:
    """
    Verifies the RSA-SHA256 signature against the canonical certificate payload using the public key.
    Returns True if authentic and untampered; False otherwise.
    """
    if not base64_signature:
        return False
    try:
        public_key = load_public_key()
        sig_bytes = base64.b64decode(base64_signature.encode("ascii"))
        public_key.verify(
            sig_bytes,
            canonical_json.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True
    except (InvalidSignature, ValueError, Exception):
        return False


def get_public_key_pem() -> str:
    """Returns the public key in PEM format for transparency / public verification audits."""
    env_pub = os.environ.get("DIGITAL_SIGNATURE_PUBLIC_KEY_PEM")
    if env_pub:
        return env_pub.strip()

    if PUBLIC_KEY_PATH.exists():
        with open(PUBLIC_KEY_PATH, "r", encoding="utf-8") as f:
            return f.read()

    pub = load_public_key()
    return pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("utf-8")
