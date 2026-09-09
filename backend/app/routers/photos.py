import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import settings
from app.dependencies.auth import require_staff_or_admin
from app.services.file_service import generate_presigned_photo_url, spaces_key_from_url

router = APIRouter(prefix="/api/photos", tags=["photos"])
logger = logging.getLogger(__name__)


@router.get("/view", dependencies=[Depends(require_staff_or_admin)])
async def view_photo(src: str = Query(..., max_length=1000)):
    """Redirect a stored photo string to something the browser can fetch.

    Customer repair photos live private in Spaces (PIPEDA safeguards), so
    the admin UI points its <img> tags here instead of at the raw URL; each
    request 302s to a fresh short-lived presigned URL, which also sidesteps
    expiry in long-lived admin tabs. The stored strings in the database and
    API responses never change shape — deletion flows depend on that.

    Dev (USE_SPACES=false) stores bare filenames: those redirect to the
    local /uploads static mount, so one frontend code path serves both.
    """
    if settings.use_spaces:
        key = spaces_key_from_url(src)
        if not key:
            raise HTTPException(status_code=400, detail="Not a stored photo URL")
        return RedirectResponse(url=generate_presigned_photo_url(src), status_code=302)

    # Local mode: src is a bare uuid filename. Refuse anything path-shaped.
    if "/" in src or "\\" in src or ".." in src:
        raise HTTPException(status_code=400, detail="Invalid photo filename")
    return RedirectResponse(url=f"/uploads/{src}", status_code=302)
