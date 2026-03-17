import os
import uuid
import re
from pathlib import Path
from io import BytesIO
from fastapi import UploadFile, HTTPException
from PIL import Image
from app.config import settings


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and other attacks"""
    if not filename:
        return "unknown"

    # Remove path separators and other dangerous characters
    filename = os.path.basename(filename)
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

        # Verify image format matches extension
        image_format = image.format.lower() if image.format else ""
        expected_formats = {
            'jpg': ['jpeg', 'jpg'],
            'jpeg': ['jpeg', 'jpg'],
            'png': ['png'],
            'webp': ['webp']
        }

        if file_ext in expected_formats:
            if image_format not in expected_formats[file_ext]:
                return False

        # Verify image
        image.verify()

        # Check dimensions (reject suspiciously small images)
        if image.width < 10 or image.height < 10:
            return False

        # Check dimensions (reject suspiciously large images - potential DOS)
        if image.width > 10000 or image.height > 10000:
            return False

        return True
    except Exception as e:
        print(f"Image validation failed: {str(e)}")
        return False


async def save_upload_file(file: UploadFile) -> str:
    """Save uploaded file and return filename"""

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

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = Path(settings.upload_dir) / unique_filename

    # Ensure upload directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)

    return unique_filename


def delete_file(filename: str) -> bool:
    """Delete uploaded file"""
    try:
        file_path = Path(settings.upload_dir) / filename
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    except Exception:
        return False
