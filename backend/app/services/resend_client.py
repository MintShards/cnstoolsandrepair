import asyncio
import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# Status codes that indicate a transient failure worth retrying
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# Backoff delays in seconds between retry attempts (3 attempts = 2 waits)
_BACKOFF_DELAYS = [1, 3, 9]


async def send_email_via_resend(
    payload: dict,
    max_retries: int = 3,
    timeout: float = 30.0,
) -> dict:
    """
    Send an email via Resend API with automatic retry on transient failures.

    Retries on: 429, 500, 502, 503, 504, timeouts, and connection errors.
    Does NOT retry on other 4xx errors (permanent failures: bad key, invalid payload).

    Returns:
        {
            "success": bool,
            "status_code": int | None,  # last HTTP status code, or None on network error
            "error": str | None,        # error description on failure, None on success
        }
    """
    last_status_code: Optional[int] = None
    last_error: Optional[str] = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            last_status_code = response.status_code

            if response.status_code in (200, 201):
                return {"success": True, "status_code": response.status_code, "error": None}

            # Permanent failure — don't retry
            if response.status_code not in _RETRYABLE_STATUS_CODES:
                last_error = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"Resend permanent failure (attempt {attempt + 1}): {last_error}")
                return {"success": False, "status_code": response.status_code, "error": last_error}

            # Transient failure — log and retry
            last_error = f"HTTP {response.status_code}: {response.text}"
            logger.warning(f"Resend transient failure (attempt {attempt + 1}/{max_retries}): {last_error}")

        except httpx.TimeoutException as e:
            last_error = f"Timeout: {e}"
            last_status_code = None
            logger.warning(f"Resend timeout (attempt {attempt + 1}/{max_retries}): {last_error}")

        except httpx.ConnectError as e:
            last_error = f"Connection error: {e}"
            last_status_code = None
            logger.warning(f"Resend connection error (attempt {attempt + 1}/{max_retries}): {last_error}")

        except Exception as e:
            last_error = f"Unexpected error: {e}"
            last_status_code = None
            logger.error(f"Resend unexpected error (attempt {attempt + 1}/{max_retries}): {last_error}")
            # Don't retry unexpected errors
            return {"success": False, "status_code": None, "error": last_error}

        # Wait before retrying (no wait after the last attempt)
        if attempt < max_retries - 1:
            delay = _BACKOFF_DELAYS[attempt] if attempt < len(_BACKOFF_DELAYS) else _BACKOFF_DELAYS[-1]
            await asyncio.sleep(delay)

    logger.error(f"Resend failed after {max_retries} attempts. Last error: {last_error}")
    return {"success": False, "status_code": last_status_code, "error": last_error}
