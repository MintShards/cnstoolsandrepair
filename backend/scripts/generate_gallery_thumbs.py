"""Backfill grid thumbnails for existing gallery photos.

Downloads each gallery photo missing a thumb_url, generates an ~800px JPEG
variant, stores it alongside the originals (Spaces when USE_SPACES=true,
local uploads/ otherwise), and sets thumb_url on the document.

Run from the backend directory with its virtualenv:
    python scripts/generate_gallery_thumbs.py

For production, run on the droplet where the prod .env (Spaces credentials
and prod MONGODB_URL) is available.
"""
import sys
import uuid
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

sys.path.append(str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageOps  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from app.config import settings  # noqa: E402

MAX_SIZE = 800
JPEG_QUALITY = 82


def make_thumb(data: bytes) -> bytes:
    image = Image.open(BytesIO(data))
    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    image.thumbnail((MAX_SIZE, MAX_SIZE))
    out = BytesIO()
    image.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def store_thumb(data: bytes) -> str:
    filename = f"{uuid.uuid4()}.jpg"
    if settings.use_spaces:
        import boto3

        client = boto3.client(
            "s3",
            region_name=settings.spaces_region,
            endpoint_url=settings.spaces_endpoint,
            aws_access_key_id=settings.spaces_key,
            aws_secret_access_key=settings.spaces_secret,
        )
        key = f"gallery/thumbs/{filename}"
        client.upload_fileobj(
            BytesIO(data),
            settings.spaces_bucket,
            key,
            ExtraArgs={"ACL": "public-read", "ContentType": "image/jpeg"},
        )
        return f"{settings.spaces_endpoint}/{settings.spaces_bucket}/{key}"

    path = Path(settings.upload_dir) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return filename


def load_original(image_url: str) -> bytes:
    if image_url.startswith("http"):
        with urlopen(image_url) as response:
            return response.read()
    return (Path(settings.upload_dir) / image_url).read_bytes()


def main():
    db = MongoClient(settings.mongodb_url)[settings.database_name]
    query = {"$or": [{"thumb_url": {"$exists": False}}, {"thumb_url": None}]}
    photos = list(db.gallery_photos.find(query))
    print(f"Database: {settings.database_name} | USE_SPACES={settings.use_spaces}")
    print(f"{len(photos)} photo(s) need thumbnails")

    ok = failed = 0
    for photo in photos:
        image_url = photo.get("image_url", "")
        try:
            original = load_original(image_url)
            thumb = make_thumb(original)
            thumb_url = store_thumb(thumb)
            db.gallery_photos.update_one({"_id": photo["_id"]}, {"$set": {"thumb_url": thumb_url}})
            print(f"  ok   {image_url} -> {thumb_url} ({len(original) // 1024}KB -> {len(thumb) // 1024}KB)")
            ok += 1
        except Exception as e:
            print(f"  FAIL {image_url}: {e}")
            failed += 1

    print(f"Done: {ok} ok, {failed} failed")


if __name__ == "__main__":
    main()
