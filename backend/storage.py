"""
Measure X — Storage Abstraction Subsystem.

Provides unified storage abstraction supporting:
1. Supabase Storage in production (via SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY).
2. Local filesystem storage (storage/uploads/) for local development and offline environments.

Preserves exact API contracts for document and inspection evidence uploads/downloads.
"""

import os
import io
import json
import urllib.request
import urllib.error
from pathlib import Path
from typing import Tuple, Optional, Union
from fastapi import HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")
STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "measurex-storage")

BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_UPLOAD_ROOT = Path(os.environ.get("FILE_STORAGE_PATH", BASE_DIR / "storage" / "uploads"))


def is_supabase_configured() -> bool:
    """Returns True if Supabase Storage environment credentials are provided."""
    return bool(SUPABASE_URL and SUPABASE_KEY)


def get_local_upload_root() -> Path:
    """Returns local upload root, ensuring directory exists."""
    p = LOCAL_UPLOAD_ROOT
    try:
        p.mkdir(parents=True, exist_ok=True)
    except (OSError, PermissionError):
        pass
    return p


def _get_supabase_headers(content_type: str = "application/octet-stream") -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true"
    }


def save_upload_file(
    category: str,
    filename: str,
    content: bytes,
    content_type: str = "application/octet-stream"
) -> Tuple[str, str]:
    """
    Saves an uploaded file to Supabase Storage in production, or local disk in development.
    Returns (storage_path_or_url, public_or_download_url).
    """
    clean_name = filename.lstrip("/")
    object_path = f"{category}/{clean_name}"

    if is_supabase_configured():
        upload_endpoint = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{object_path}"
        headers = _get_supabase_headers(content_type=content_type)
        try:
            req = urllib.request.Request(
                upload_endpoint,
                data=content,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                if 200 <= resp.status < 300:
                    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{object_path}"
                    return object_path, public_url
        except urllib.error.HTTPError as he:
            # If POST fails with 400 (duplicate/exists), try PUT to upsert
            if he.code in (400, 409):
                try:
                    req_put = urllib.request.Request(
                        upload_endpoint,
                        data=content,
                        headers=headers,
                        method="PUT"
                    )
                    with urllib.request.urlopen(req_put, timeout=20) as resp_put:
                        if 200 <= resp_put.status < 300:
                            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{object_path}"
                            return object_path, public_url
                except Exception:
                    pass
        except Exception:
            # Fallback to local storage if Supabase API is temporarily unreachable
            pass

    # Local Development Storage Fallback
    target_dir = get_local_upload_root() / category
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except (OSError, PermissionError):
        pass

    target_path = target_dir / filename
    try:
        with open(target_path, "wb") as f:
            f.write(content)
        return str(target_path), str(target_path)
    except (OSError, PermissionError):
        # Fallback to /tmp if current dir is non-writable
        fallback_dir = Path("/tmp/measurex/uploads") / category
        fallback_dir.mkdir(parents=True, exist_ok=True)
        fallback_path = fallback_dir / filename
        with open(fallback_path, "wb") as f:
            f.write(content)
        return str(fallback_path), str(fallback_path)


def get_file_bytes(storage_path: str) -> Optional[bytes]:
    """Retrieves file bytes from Supabase Storage or local disk."""
    if not storage_path:
        return None

    # Check if storage_path is a full HTTP(S) URL
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        try:
            req = urllib.request.Request(storage_path)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read()
        except Exception:
            return None

    # Check Supabase Storage if configured and path is relative object_path
    if is_supabase_configured() and not os.path.isabs(storage_path):
        clean_path = storage_path.lstrip("/")
        supabase_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{clean_path}"
        try:
            req = urllib.request.Request(
                supabase_url,
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read()
        except Exception:
            pass

    # Check local filesystem
    p = Path(storage_path)
    if p.is_file():
        try:
            with open(p, "rb") as f:
                return f.read()
        except Exception:
            return None

    # Check relative to local upload root
    local_p = get_local_upload_root() / storage_path
    if local_p.is_file():
        try:
            with open(local_p, "rb") as f:
                return f.read()
        except Exception:
            return None

    return None


def file_exists(storage_path: str) -> bool:
    """Checks whether an uploaded file exists in Supabase Storage or local disk."""
    if not storage_path:
        return False

    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        try:
            req = urllib.request.Request(storage_path, method="HEAD")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return 200 <= resp.status < 400
        except Exception:
            return False

    if is_supabase_configured() and not os.path.isabs(storage_path):
        clean_path = storage_path.lstrip("/")
        url = f"{SUPABASE_URL}/storage/v1/object/info/public/{STORAGE_BUCKET}/{clean_path}"
        try:
            req = urllib.request.Request(url, headers={"apikey": SUPABASE_KEY})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            pass

    p = Path(storage_path)
    if p.is_file():
        return True

    local_p = get_local_upload_root() / storage_path
    return local_p.is_file()


def serve_file(
    storage_path: str,
    filename: Optional[str] = None,
    mime_type: Optional[str] = None
) -> Response:
    """
    Returns an appropriate FastAPI response for viewing/downloading an uploaded file:
    - RedirectResponse if hosted on Supabase Storage / external CDN
    - FileResponse if stored on disk
    """
    if not storage_path:
        raise HTTPException(status_code=404, detail="File path not specified.")

    # Full HTTP(S) URL
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return RedirectResponse(url=storage_path)

    # Supabase relative object path
    if is_supabase_configured() and not os.path.isabs(storage_path):
        clean_path = storage_path.lstrip("/")
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{clean_path}"
        return RedirectResponse(url=public_url)

    # Local disk file
    p = Path(storage_path)
    if not p.is_file():
        local_p = get_local_upload_root() / storage_path
        if local_p.is_file():
            p = local_p
        else:
            raise HTTPException(status_code=404, detail="Document file not found on server")

    return FileResponse(
        path=str(p),
        media_type=mime_type or "application/octet-stream",
        filename=filename or p.name
    )


def delete_file(storage_path: str) -> bool:
    """Deletes an uploaded file from Supabase Storage or local disk."""
    if not storage_path:
        return False

    # Supabase Storage delete
    if is_supabase_configured():
        clean_path = storage_path
        if clean_path.startswith("http://") or clean_path.startswith("https://"):
            prefix = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/"
            if clean_path.startswith(prefix):
                clean_path = clean_path[len(prefix):]
        if not os.path.isabs(clean_path):
            del_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}"
            payload = json.dumps({"prefixes": [clean_path]}).encode("utf-8")
            try:
                req = urllib.request.Request(
                    del_url,
                    data=payload,
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json"
                    },
                    method="DELETE"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if 200 <= resp.status < 300:
                        return True
            except Exception:
                pass

    # Local disk delete
    p = Path(storage_path)
    if p.is_file():
        try:
            p.unlink()
            return True
        except Exception:
            return False

    local_p = get_local_upload_root() / storage_path
    if local_p.is_file():
        try:
            local_p.unlink()
            return True
        except Exception:
            return False

    return False
