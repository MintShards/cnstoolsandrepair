"""Generate a VAPID key pair for Web Push and print the two .env lines.

Run once per environment and paste the output into backend/.env (dev) or
the droplet's .env (prod). The keys identify THIS server to the browsers'
push services; rotating them silently invalidates every existing device
subscription, so staff would need to enable notifications again.

    python scripts/generate_vapid_keys.py
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
private_raw = key.private_numbers().private_value.to_bytes(32, "big")
public_raw = key.public_key().public_bytes(
    serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
)

print("# Web Push (VAPID) — add to .env; never commit these")
print(f"VAPID_PUBLIC_KEY={_b64url(public_raw)}")
print(f"VAPID_PRIVATE_KEY={_b64url(private_raw)}")
print("VAPID_CLAIMS_EMAIL=mailto:service@cnstoolrepair.com")
