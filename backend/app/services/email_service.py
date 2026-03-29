import logging
import base64
import requests
import traceback
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, Attachment, FileContent, FileName, FileType, Disposition, Content
from app.config import settings as app_settings
from app.models.quote import Quote
from app.routers.settings import DEFAULT_SETTINGS
from datetime import timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


def format_pst_datetime(utc_dt) -> str:
    """Convert UTC datetime to Pacific Time (PST/PDT) and format for readability"""
    # Convert UTC to Pacific timezone (automatically handles PST/PDT)
    pacific_tz = ZoneInfo("America/Vancouver")  # Surrey, BC is in Pacific timezone

    # Ensure utc_dt is timezone-aware (UTC)
    if utc_dt.tzinfo is None:
        from datetime import timezone
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)

    # Convert to Pacific time
    pacific_dt = utc_dt.astimezone(pacific_tz)

    # Format: March 17, 2026 at 1:33 AM PDT (or PST depending on date)
    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']

    month = month_names[pacific_dt.month - 1]
    day = pacific_dt.day
    year = pacific_dt.year
    hour = pacific_dt.hour
    minute = pacific_dt.minute

    # Convert 24hr to 12hr format
    am_pm = "AM" if hour < 12 else "PM"
    display_hour = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)

    # Determine if DST is in effect (PDT vs PST)
    tz_name = pacific_dt.strftime('%Z')  # Returns 'PST' or 'PDT'

    return f"{month} {day}, {year} at {display_hour}:{minute:02d} {am_pm} {tz_name}"


async def send_quote_notification(quote: Quote, business_settings: dict = None) -> bool:
    """Send email notification to team when new quote is submitted"""

    # Extract business info from settings (with fallback to DEFAULT_SETTINGS)
    try:
        if business_settings and "contact" in business_settings and "address" in business_settings["contact"]:
            city = business_settings["contact"]["address"]["city"]
            province = business_settings["contact"]["address"]["province"]
        else:
            city = DEFAULT_SETTINGS["contact"]["address"]["city"]
            province = DEFAULT_SETTINGS["contact"]["address"]["province"]
    except (KeyError, TypeError):
        # Fallback if settings structure is invalid
        city = DEFAULT_SETTINGS["contact"]["address"]["city"]
        province = DEFAULT_SETTINGS["contact"]["address"]["province"]

    # Format submission time
    submitted_time = format_pst_datetime(quote.created_at)

    # Build customer section (show company only if provided)
    customer_section = "CUSTOMER:\n"
    if quote.company_name:
        customer_section += f"  Company: {quote.company_name}\n"
    customer_section += f"  Contact: {quote.contact_person}\n"
    customer_section += f"  Phone: {quote.phone}\n"
    customer_section += f"  Email: {quote.email}"

    # Build tools section (loop through all tools)
    tools_section = ""
    for idx, tool in enumerate(quote.tools, start=1):
        tools_section += f"\nTOOL {idx}:\n"
        tools_section += f"  Type: {tool.tool_type}\n"
        tools_section += f"  Brand: {tool.tool_brand}\n"
        tools_section += f"  Model: {tool.tool_model}\n"
        tools_section += f"  Quantity: {tool.quantity}\n"
        tools_section += f"  Problem: {tool.problem_description}\n"

    # Build photo section (photos will be attachments) - placeholder, updated after processing
    photo_text = ""

    # Subject line (use company if available, otherwise contact person)
    subject_name = quote.company_name if quote.company_name else quote.contact_person

    # Subject includes tool count
    tool_count = len(quote.tools)
    tool_summary = f"{tool_count} tool{'s' if tool_count > 1 else ''}"

    # Initialize photo text (will be updated after processing attachments)
    photo_text_initial = "  ⏳ Processing photos..."

    # Build initial email body (will be updated with final photo status)
    body_template = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST #{request_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{tools_section}
PHOTOS:
{photo_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CNS Tool Repair | {city}, {province}
"""

    try:
        # Create SendGrid message (content will be set after processing attachments)
        message = Mail(
            from_email=Email("request@cnstoolrepair.com", "Request"),
            to_emails=app_settings.notification_email,
            subject=f"New Request #{quote.request_number}: {subject_name} - {tool_summary}"
        )

        # Set Reply-To to customer's email for easy response
        message.reply_to = Email(quote.email, quote.contact_person)

        # Attach photos as email attachments (with fallback for production)
        # SendGrid has a 30MB total email limit; cap attachments at 20MB raw (base64 adds ~33%)
        MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024  # 20MB raw = ~27MB base64
        attachment_errors = []
        skipped_photos = 0
        if quote.photos:
            attachments = []
            total_attachment_bytes = 0
            for idx, photo in enumerate(quote.photos, start=1):
                try:
                    # Get photo URL (handle both Spaces URLs and local paths)
                    if app_settings.use_spaces:
                        # Production: Photos in Digital Ocean Spaces
                        photo_url = photo if photo.startswith('http') else f'{app_settings.upload_base_url}/{photo}'
                    else:
                        # Development: Local file system
                        photo_url = photo if photo.startswith('http') else f'{app_settings.upload_base_url}/uploads/{photo}'

                    # Download photo from Spaces or local server (increased timeout for production)
                    response_photo = requests.get(photo_url, timeout=30)
                    response_photo.raise_for_status()
                    photo_data = response_photo.content

                    # Check if adding this photo would exceed the attachment limit
                    if total_attachment_bytes + len(photo_data) > MAX_ATTACHMENT_BYTES:
                        skipped_photos += 1
                        logger.info(f"Skipping photo {idx} ({len(photo_data)} bytes) - would exceed email size limit")
                        continue

                    total_attachment_bytes += len(photo_data)

                    # Encode as base64
                    encoded = base64.b64encode(photo_data).decode()

                    # Determine file extension and MIME type
                    file_ext = photo.split('.')[-1].lower() if '.' in photo else 'jpg'
                    mime_types = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'webp': 'image/webp'
                    }
                    mime_type = mime_types.get(file_ext, 'image/jpeg')

                    # Create attachment
                    attachment = Attachment(
                        file_content=FileContent(encoded),
                        file_name=FileName(f"tool-photo-{idx}.{file_ext}"),
                        file_type=FileType(mime_type),
                        disposition=Disposition('attachment')
                    )
                    attachments.append(attachment)

                except Exception as e:
                    url_attempted = photo_url if 'photo_url' in locals() else 'URL not constructed'
                    logger.error(
                        f"Failed to attach photo {photo}: {str(e)} | URL: {url_attempted}\n{traceback.format_exc()}"
                    )

                    # Track failed photos
                    attachment_errors.append(photo)
                    # Continue with other photos even if one fails
                    continue

            # Add all successful attachments to message
            if attachments:
                message.attachment = attachments

        # Build photo section for email body (after attachment processing)
        if quote.photos:
            successful_count = len(quote.photos) - len(attachment_errors) - skipped_photos
            failed_count = len(attachment_errors)

            if failed_count == 0 and skipped_photos == 0:
                # All photos attached successfully
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached"
            elif successful_count > 0:
                # Some photos attached, some failed or skipped
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached"
                if skipped_photos > 0:
                    photo_text += f"\n  ℹ️  {skipped_photos} photo{'s' if skipped_photos > 1 else ''} too large for email - view in admin dashboard"
                if failed_count > 0:
                    photo_text += f"\n  ⚠️  {failed_count} photo{'s' if failed_count > 1 else ''} could not be attached - view in admin dashboard"
            else:
                # All photos failed or skipped
                photo_text = f"  ⚠️  {len(quote.photos)} photo{'s' if len(quote.photos) > 1 else ''} uploaded but could not be attached - view in admin dashboard"
        else:
            photo_text = "  📷 No photos"

        # Build final email body with photo status using template
        body = body_template.format(
            request_number=quote.request_number,
            submitted_time=submitted_time,
            customer_section=customer_section,
            tools_section=tools_section,
            photo_text=photo_text,
            city=city,
            province=province,
        )

        # Set email body content (required by SendGrid, must be set exactly once)
        message.content = Content("text/plain", body)

        # Send email via SendGrid
        sg = SendGridAPIClient(app_settings.sendgrid_api_key)
        response = sg.send(message)

        logger.info(f"Email sent. Status: {response.status_code} | Request: #{quote.request_number} | Customer: {subject_name}")
        if attachment_errors:
            logger.warning(f"{len(attachment_errors)} photo(s) failed to attach but email sent successfully")
        return True
    except Exception as e:
        extra = ""
        if hasattr(e, 'body'):
            extra += f" | SendGrid body: {e.body}"
        if hasattr(e, 'status_code'):
            extra += f" | SendGrid status: {e.status_code}"
        logger.error(
            f"Failed to send email for request #{quote.request_number}: {str(e)}{extra}\n{traceback.format_exc()}"
        )
        return False
