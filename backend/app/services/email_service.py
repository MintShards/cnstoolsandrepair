from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, Attachment, FileContent, FileName, FileType, Disposition
from app.config import settings
from app.models.quote import Quote
from datetime import timedelta
import base64
import requests


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


async def send_quote_notification(quote: Quote) -> bool:
    """Send email notification to team when new quote is submitted"""

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

    # Build photo section (photos will be attachments)
    if quote.photos:
        photo_count = len(quote.photos)
        photo_text = f"  📎 {photo_count} photo{'s' if photo_count > 1 else ''} attached"
    else:
        photo_text = "  📷 No photos"

    # Subject line (use company if available, otherwise contact person)
    subject_name = quote.company_name if quote.company_name else quote.contact_person

    # Subject includes tool count
    tool_count = len(quote.tools)
    tool_summary = f"{tool_count} tool{'s' if tool_count > 1 else ''}"

    # Plain text email body
    body = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST #{quote.request_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{tools_section}
PHOTOS:
{photo_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Reply to contact customer | Call {quote.phone}

CNS Tools and Repair | Surrey, BC
cnstoolsandrepair@gmail.com
"""

    try:
        # Create SendGrid message (plain text only)
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject=f"New Request #{quote.request_number}: {subject_name} - {tool_summary}",
            plain_text_content=body
        )

        # Set Reply-To to customer's email for easy response
        message.reply_to = Email(quote.email, quote.contact_person)

        # Attach photos as email attachments
        if quote.photos:
            attachments = []
            for idx, photo in enumerate(quote.photos, start=1):
                try:
                    # Get photo URL (handle both Spaces URLs and local paths)
                    photo_url = photo if photo.startswith('http') else f'{settings.upload_base_url}/uploads/{photo}'

                    # Download photo from Spaces or local server
                    response_photo = requests.get(photo_url, timeout=10)
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
                    print(f"Warning: Failed to attach photo {photo}: {str(e)}")
                    # Continue with other photos even if one fails
                    continue

            # Add all attachments to message
            if attachments:
                message.attachment = attachments

        # Send email via SendGrid
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"Email sent! Status code: {response.status_code}")
        print(f"Request: #{quote.request_number} | Customer: {subject_name}")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False
