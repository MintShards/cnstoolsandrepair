import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.config import settings


async def save_upload_file(file: UploadFile) -> str:
    """Save uploaded file and return filename"""

    # Validate file extension
    file_ext = file.filename.split(".")[-1].lower()
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
