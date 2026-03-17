from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email
from app.config import settings
from app.models.quote import Quote
from datetime import timedelta


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

    # Build photo section (compact with indentation)
    if quote.photos:
        photo_links = "\n".join([f"  📷 {settings.upload_base_url}/uploads/{photo}" for photo in quote.photos])
    else:
        photo_links = "  📷 No photos"

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

    # Subject line (use company if available, otherwise contact person)
    subject_name = quote.company_name if quote.company_name else quote.contact_person

    # Subject includes tool count
    tool_count = len(quote.tools)
    tool_summary = f"{tool_count} tool{'s' if tool_count > 1 else ''}"

    # Compact email body with clear field separation
    body = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST #{quote.request_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{tools_section}
PHOTOS:
{photo_links}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Reply to contact customer | Call {quote.phone}

CNS Tools and Repair | Surrey, BC
cnstoolsandrepair@gmail.com
"""

    try:
        # Create SendGrid message with Reply-To
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject=f"New Request #{quote.request_number}: {subject_name} - {tool_summary}",
            plain_text_content=body
        )

        # Set Reply-To to customer's email for easy response
        # When you click Reply, it will go to the customer's email
        message.reply_to = Email(quote.email, quote.contact_person)

        # Send email via SendGrid
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"Email sent! Status code: {response.status_code}")
        print(f"Request: #{quote.request_number} | Customer: {subject_name}")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False
