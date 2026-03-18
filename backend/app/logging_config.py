"""
Structured logging configuration for production

Provides JSON-formatted logs in production for easy parsing by log aggregators,
and human-readable logs in development for easier debugging.
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from app.config import settings


def setup_logging():
    """Configure structured JSON logging for production, readable format for development"""
    logger = logging.getLogger()

    # Remove default handlers
    logger.handlers = []

    if settings.environment == "production":
        # JSON format for production (for log aggregators like CloudWatch, Datadog, etc.)
        handler = logging.StreamHandler(sys.stdout)
        formatter = jsonlogger.JsonFormatter(
            '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
            rename_fields={
                "asctime": "timestamp",
                "levelname": "level",
                "pathname": "file",
                "lineno": "line"
            },
            datefmt='%Y-%m-%dT%H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    else:
        # Human-readable format for development
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    return logger


# Initialize logger
logger = setup_logging()


# Convenience functions for structured logging
def log_quote_created(request_number: str, customer_email: str, tool_count: int, photo_count: int):
    """Log quote creation event with structured data"""
    logger.info(
        "Quote created",
        extra={
            "event": "quote_created",
            "request_number": request_number,
            "customer_email": customer_email,
            "tool_count": tool_count,
            "photo_count": photo_count
        }
    )


def log_quote_deleted(request_number: str, admin_user: str = "unknown"):
    """Log quote deletion event"""
    logger.info(
        "Quote deleted",
        extra={
            "event": "quote_deleted",
            "request_number": request_number,
            "admin_user": admin_user
        }
    )


def log_email_notification(request_number: str, success: bool, error: str = None):
    """Log email notification attempt"""
    if success:
        logger.info(
            "Email notification sent",
            extra={
                "event": "email_sent",
                "request_number": request_number
            }
        )
    else:
        logger.error(
            "Email notification failed",
            extra={
                "event": "email_failed",
                "request_number": request_number,
                "error": error
            }
        )


def log_file_upload(filename: str, file_size: int, storage_type: str):
    """Log file upload event"""
    logger.info(
        "File uploaded",
        extra={
            "event": "file_uploaded",
            "filename": filename,
            "file_size_bytes": file_size,
            "storage_type": storage_type
        }
    )


def log_rate_limit_exceeded(ip_address: str, endpoint: str):
    """Log rate limit violation"""
    logger.warning(
        "Rate limit exceeded",
        extra={
            "event": "rate_limit_exceeded",
            "ip_address": ip_address,
            "endpoint": endpoint
        }
    )
