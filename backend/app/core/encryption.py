"""
Fernet Encryption Utility

Encrypts/decrypts sensitive values (e.g. OpenAI API keys) using
AES-128-CBC via Fernet. The key is derived from SECRET_KEY (SHA256 + base64).
"""

import base64
import hashlib

from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_value(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()
