#!/usr/bin/env python3
"""Flip existing customer repair photos in Spaces to private ACL.

New uploads under quotes/ and repairs/ are private as of the photo-privacy
change; this migrates the objects uploaded before it. The admin UI and the
email services already fetch through presigned URLs, so flipping ACLs does
not break anything that shipped with that change — it only cuts off
anonymous public access.

Public prefixes (gallery/, products/, brands/, hero/, parts_library/,
email-templates/) are never touched.

On the droplet:
    docker exec cns-backend-prod python scripts/make_repair_photos_private.py            # dry run
    docker exec cns-backend-prod python scripts/make_repair_photos_private.py --apply

Usage:
    python scripts/make_repair_photos_private.py            # dry run: list what would change
    python scripts/make_repair_photos_private.py --apply    # set ACL=private on each object
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings  # noqa: E402

APPLY = "--apply" in sys.argv
PRIVATE_PREFIXES = ("quotes/", "repairs/")


def main():
    if not settings.use_spaces:
        print("USE_SPACES is false — this environment stores photos locally; nothing to migrate.")
        return

    import boto3

    client = boto3.client(
        "s3",
        region_name=settings.spaces_region,
        endpoint_url=settings.spaces_endpoint,
        aws_access_key_id=settings.spaces_key,
        aws_secret_access_key=settings.spaces_secret,
    )

    print(f"bucket: {settings.spaces_bucket} ({settings.spaces_endpoint})")
    total = 0
    flipped = 0
    failed = 0
    for prefix in PRIVATE_PREFIXES:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.spaces_bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                total += 1
                if APPLY:
                    try:
                        client.put_object_acl(
                            Bucket=settings.spaces_bucket, Key=key, ACL="private"
                        )
                        flipped += 1
                        print(f"  private: {key}")
                    except Exception as e:
                        failed += 1
                        print(f"  FAILED:  {key} — {e}")
                else:
                    print(f"  would flip: {key}")

    if APPLY:
        print(f"done: {flipped}/{total} objects set private, {failed} failed")
    else:
        print(f"dry run: {total} object(s) under {PRIVATE_PREFIXES} would be set private. "
              f"Re-run with --apply to do it.")


main()
