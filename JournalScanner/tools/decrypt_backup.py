#!/usr/bin/env python3
"""Decrypt Journal Scanner cloud backups (.enc files) off-device.

The app encrypts uploads with AES-256-GCM. The recovery key is shown in
Settings → Encryption → Show recovery key (base64).

Usage:
    pip install cryptography
    python3 decrypt_backup.py <recovery-key-base64> <file.enc> [more.enc ...]

Each input file is written next to the original without the .enc suffix.
File format matches Apple CryptoKit's AES.GCM combined representation:
12-byte nonce || ciphertext || 16-byte tag.
"""
import base64
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("Missing dependency: pip install cryptography")


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    key = base64.b64decode(sys.argv[1])
    if len(key) != 32:
        sys.exit("Recovery key must decode to 32 bytes (AES-256)")
    aes = AESGCM(key)

    for arg in sys.argv[2:]:
        path = Path(arg)
        blob = path.read_bytes()
        nonce, rest = blob[:12], blob[12:]
        ciphertext, tag = rest[:-16], rest[-16:]
        plaintext = aes.decrypt(nonce, ciphertext + tag, None)

        out = path.with_suffix("") if path.suffix == ".enc" else path.with_name(path.name + ".dec")
        out.write_bytes(plaintext)
        print(f"decrypted {path} -> {out}")


if __name__ == "__main__":
    main()
