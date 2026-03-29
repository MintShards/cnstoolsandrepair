import uuid
import re
import logging
from pathlib import Path
from io import BytesIO
from fastapi import UploadFile, HTTPException
from PIL import Image
from app.config import settings

logger = logging.getLogger(__name__)

# Digital Ocean Spaces (S3-compatible) client
try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.warning("boto3 not installed. Spaces integration disabled.")


def get_spaces_client():
    """Get initialized Spaces client (lazy loading)"""
    if not BOTO3_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Spaces integration not available. Install boto3."
        )

    if not settings.use_spaces:
        raise HTTPException(
            status_code=500,
            detail="Spaces integration is disabled. Set USE_SPACES=true in .env"
        )

    if not settings.spaces_key or not settings.spaces_secret:
        raise HTTPException(
            status_code=500,
            detail="Spaces credentials not configured. Set SPACES_KEY and SPACES_SECRET in .env"
        )

    return boto3.client(
        's3',
        region_name=settings.spaces_region,
        endpoint_url=settings.spaces_endpoint,
        aws_access_key_id=settings.spaces_key,
        aws_secret_access_key=settings.spaces_secret
    )


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and other attacks"""
    if not filename:
        return "unknown"

    # Remove path separators and other dangerous characters
    filename = Path(filename).name
    # Keep only alphanumeric, dots, hyphens, underscores
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '', filename)

    # Limit length to 255 characters
    if len(sanitized) > 255:
        sanitized = sanitized[:255]

    # Ensure filename is not empty after sanitization
    if not sanitized or sanitized == '.':
        sanitized = "file"

    return sanitized


async def validate_image_file(contents: bytes, file_ext: str) -> bool:
    """Validate that file is actually an image by checking content"""
    try:
        # Try to open as image
        image = Image.open(BytesIO(contents))

        image_format = image.format.lower() if image.format else ""

        # Verify image format matches extension
        expected_formats = {
            'jpg': ['jpeg', 'jpg', 'mpo'],
            'jpeg': ['jpeg', 'jpg', 'mpo'],
            'png': ['png'],
            'webp': ['webp']
        }

        if file_ext in expected_formats:
            if image_format not in expected_formats[file_ext]:
                logger.info(f"Image validation failed: format mismatch ext={file_ext} format={image_format}")
                return False

        # Check dimensions BEFORE any integrity check
        if image.width < 10 or image.height < 10:
            logger.info(f"Image validation failed: image too small {image.width}x{image.height}")
            return False

        if image.width > 10000 or image.height > 10000:
            logger.info(f"Image validation failed: image too large {image.width}x{image.height}")
            return False

        # Decode pixel data as integrity check
        image.load()

        return True
    except Exception as e:
        logger.info(f"Image validation failed: {type(e).__name__}: {str(e)}")
        return False


async def upload_file_to_spaces(file: UploadFile, folder: str, contents: bytes, file_ext: str) -> str:
    """Upload file to Digital Ocean Spaces, return public URL"""
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    key = f"{folder}/{unique_filename}"

    try:
        s3_client = get_spaces_client()
        s3_client.upload_fileobj(
            BytesIO(contents),
            settings.spaces_bucket,
            key,
            ExtraArgs={'ACL': 'public-read', 'ContentType': f'image/{file_ext}'}
        )
        # Return full public URL
        return f"{settings.spaces_endpoint}/{settings.spaces_bucket}/{key}"
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Upload to Spaces failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error uploading to Spaces: {str(e)}")


async def save_upload_file(file: UploadFile, folder: str = "uploads") -> str:
    """
    Save uploaded file and return filename or URL.

    Args:
        file: The uploaded file
        folder: Folder name for organization (e.g., 'gallery', 'quotes')

    Returns:
        If USE_SPACES=true: Full Spaces URL (https://...)
        If USE_SPACES=false: Filename only (stored locally in uploads/)
    """

    # Sanitize original filename
    sanitized_original = sanitize_filename(file.filename) if file.filename else "unknown"

    # Validate file extension
    file_ext = sanitized_original.split(".")[-1].lower()
    if file_ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(settings.allowed_extensions_list)}"
        )

    # Check file size
    contents = await file.read()
    if len(contents) > settings.max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_file_size / 1024 / 1024}MB"
        )

    # Validate file content (verify it's actually an image)
    if not await validate_image_file(contents, file_ext):
        raise HTTPException(
            status_code=400,
            detail="Invalid image file. File content does not match declared type or is corrupted."
        )

    # Upload to Spaces if enabled, otherwise save locally
    if settings.use_spaces:
        return await upload_file_to_spaces(file, folder, contents, file_ext)
    else:
        # Local filesystem storage (development only)
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = Path(settings.upload_dir) / unique_filename

        # Ensure upload directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Save file
        with open(file_path, "wb") as f:
            f.write(contents)

        return unique_filename


async def delete_file_from_spaces(file_url: str) -> bool:
    """Delete file from Digital Ocean Spaces by URL"""
    try:
        # Extract key from URL (e.g., "gallery/uuid.jpg" from full URL)
        key = file_url.split(f"{settings.spaces_bucket}/")[-1]

        s3_client = get_spaces_client()
        s3_client.delete_object(Bucket=settings.spaces_bucket, Key=key)
        return True
    except ClientError as e:
        logger.error(f"Delete from Spaces failed: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error deleting from Spaces: {str(e)}")
        return False


async def delete_file(filename_or_url: str) -> bool:
    """
    Delete uploaded file from Spaces or local storage.

    Args:
        filename_or_url: Either a filename (local) or full Spaces URL

    Returns:
        True if deleted successfully, False otherwise
    """
    # Check if it's a Spaces URL
    if filename_or_url.startswith("https://") and settings.spaces_bucket in filename_or_url:
        return await delete_file_from_spaces(filename_or_url)
    else:
        # Local filesystem deletion
        try:
            file_path = Path(settings.upload_dir) / filename_or_url
            if file_path.exists():
                file_path.unlink()
                return True
            return False
        except Exception:
            return False
