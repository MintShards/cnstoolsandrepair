from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, Attachment, FileContent, FileName, FileType, Disposition
from app.config import settings as app_settings
from app.models.quote import Quote
from app.routers.settings import DEFAULT_SETTINGS
from datetime import timedelta
import base64
import requests
import traceback


def format_pst_datetime(utc_dt) -> str:
    """Convert UTC datetime to Pacific Time (PST/PDT) and format for readability"""
    # Pacific timezone is UTC-8 (PST) or UTC-7 (PDT)
    # Simplified: Use UTC-8 for now (can add pytz for full DST support later)
    pst_offset = timedelta(hours=-8)
    pst_dt = utc_dt + pst_offset

    # Format: March 17, 2026 at 1:33 AM PST
    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']

    month = month_names[pst_dt.month - 1]
    day = pst_dt.day
    year = pst_dt.year
    hour = pst_dt.hour
    minute = pst_dt.minute

    # Convert 24hr to 12hr format
    am_pm = "AM" if hour < 12 else "PM"
    display_hour = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)

    return f"{month} {day}, {year} at {display_hour}:{minute:02d} {am_pm} PST"


async def send_quote_notification(quote: Quote, business_settings: dict = None) -> bool:
    """Send email notification to team when new quote is submitted"""

    # Extract business info from settings (with fallback to DEFAULT_SETTINGS)
    if business_settings and "contact" in business_settings:
        city = business_settings["contact"]["address"]["city"]
        province = business_settings["contact"]["address"]["province"]
        business_email = business_settings["contact"]["email"]
    else:
        city = DEFAULT_SETTINGS["contact"]["address"]["city"]
        province = DEFAULT_SETTINGS["contact"]["address"]["province"]
        business_email = DEFAULT_SETTINGS["contact"]["email"]

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

    try:
        # Create SendGrid message (plain text only) - body built after attachment processing
        message = Mail(
            from_email=app_settings.sendgrid_from_email,
            to_emails=app_settings.notification_email,
            subject=f"New Request #{quote.request_number}: {subject_name} - {tool_summary}"
        )

        # Set Reply-To to customer's email for easy response
        message.reply_to = Email(quote.email, quote.contact_person)

        # Attach photos as email attachments (with fallback for production)
        attachment_errors = []
        if quote.photos:
            attachments = []
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
                    # Log detailed error for debugging production issues
                    error_msg = f"Failed to attach photo {photo}: {str(e)}"
                    print(f"⚠️ Photo Attachment Error: {error_msg}")
                    print(f"📍 Photo URL attempted: {photo_url if 'photo_url' in locals() else 'URL not constructed'}")
                    print(f"📋 Traceback:\n{traceback.format_exc()}")

                    # Track failed photos
                    attachment_errors.append(photo)
                    # Continue with other photos even if one fails
                    continue

            # Add all successful attachments to message
            if attachments:
                message.attachment = attachments

        # Build photo section for email body (after attachment processing)
        if quote.photos:
            successful_count = len(quote.photos) - len(attachment_errors)
            failed_count = len(attachment_errors)

            if failed_count == 0:
                # All photos attached successfully
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached"
            elif successful_count > 0:
                # Some photos attached, some failed
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached\n"
                photo_text += f"  ⚠️  {failed_count} photo{'s' if failed_count > 1 else ''} could not be attached - view in admin dashboard"
            else:
                # All photos failed
                photo_text = f"  ⚠️  {len(quote.photos)} photo{'s' if len(quote.photos) > 1 else ''} uploaded but could not be attached - view in admin dashboard"
        else:
            photo_text = "  📷 No photos"

        # Build final email body with photo status
        body = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST #{quote.request_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{tools_section}
PHOTOS:
{photo_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CNS Tools and Repair | {city}, {province}
{business_email}
"""

        # Set email body
        message.plain_text_content = body

        # Send email via SendGrid
        sg = SendGridAPIClient(app_settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"✅ Email sent! Status code: {response.status_code}")
        print(f"📧 Request: #{quote.request_number} | Customer: {subject_name}")
        if attachment_errors:
            print(f"⚠️  {len(attachment_errors)} photo(s) failed to attach but email sent successfully")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False
