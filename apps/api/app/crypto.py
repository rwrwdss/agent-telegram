from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    raw = settings.session_encryption_key.strip()
    if not raw:
        # Deterministic dev key from payload secret — replace in production
        digest = hashlib.sha256(settings.payload_secret.encode()).digest()
        raw = base64.urlsafe_b64encode(digest).decode()
    if len(raw) == 44 and raw.endswith("="):
        key = raw.encode()
    else:
        key = base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())
    return Fernet(key)


def encrypt_session(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_session(cipher: str) -> str:
    return _fernet().decrypt(cipher.encode()).decode()


def generate_encryption_key() -> str:
    return Fernet.generate_key().decode()
