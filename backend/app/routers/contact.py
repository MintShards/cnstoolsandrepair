from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email
from app.config import settings
from app.database import get_database
from app.services.email_service import format_pst_datetime
from app.routers.settings import DEFAULT_SETTINGS
from slowapi import Limiter
from slowapi.util import get_remote_address
from bson import ObjectId

router = APIRouter(prefix="/api/contact", tags=["contact"])
limiter = Limiter(key_func=get_remote_address)


class ContactMessage(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=10, max_length=2000)


async def check_email_rate_limit(db, email: str, hours: int = 1, max_messages: int = 5):
    """
    Check if email has exceeded rate limit.
    Prevents email-based spam by tracking submissions per email address.
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)

    count = await db.contact_messages.count_documents({
        "email": email,
        "created_at": {"$gte": cutoff_time}
    })

    if count >= max_messages:
        raise HTTPException(
            status_code=429,
            detail=f"This email has sent {max_messages} messages in the last {hours} hour(s). Please try again later."
        )


@router.post("/", status_code=200)
@limiter.limit("3/hour")
async def send_contact_message(request: Request, contact: ContactMessage):
    """
    Send contact form message via email and store in database.
    Integrates with SendGrid for email delivery.

    Rate limits:
    - 3 messages per hour per IP address
    - 5 messages per hour per email address
    """
    db = get_database()

    # Check email-based rate limit (after IP check passes from decorator)
    await check_email_rate_limit(db, contact.email, hours=1, max_messages=5)

    # Fetch business settings for dynamic email footer
    business_settings = await db.settings.find_one({})
    if business_settings and "contact" in business_settings:
        city = business_settings["contact"]["address"]["city"]
        province = business_settings["contact"]["address"]["province"]
        business_email = business_settings["contact"]["email"]
    else:
        # Fallback to DEFAULT_SETTINGS if settings not found
        city = DEFAULT_SETTINGS["contact"]["address"]["city"]
        province = DEFAULT_SETTINGS["contact"]["address"]["province"]
        business_email = DEFAULT_SETTINGS["contact"]["email"]

    # Store message in database
    message_dict = contact.model_dump()
    message_dict["status"] = "new"
    message_dict["created_at"] = datetime.utcnow()
    message_dict["read"] = False

    try:
        result = await db.contact_messages.insert_one(message_dict)
    except Exception as e:
        print(f"Failed to store contact message: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save message")

    # Format submission time in PST
    submitted_time = format_pst_datetime(message_dict["created_at"])

    # Send email notification with enhanced formatting
    email_body = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT INQUIRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

CONTACT:
  Name: {contact.name}
  Phone: {contact.phone}
  Email: {contact.email}

SUBJECT:
  {contact.subject}

MESSAGE:
  {contact.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CNS Tools and Repair | {city}, {province}
{business_email}

Message ID: {str(result.inserted_id)}
"""

    try:
        # Create SendGrid message
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject=f"Contact Form: {contact.subject}",
            plain_text_content=email_body
        )

        # Set Reply-To to customer's email for easy response
        message.reply_to = Email(contact.email, contact.name)

        # Send email via SendGrid
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"Contact form email sent! Status code: {response.status_code}")
        print(f"Contact: {contact.name} | Subject: {contact.subject}")
    except Exception as e:
        print(f"Failed to send contact email: {str(e)}")
        # Don't fail the request if email fails, message is already stored

    return {
        "success": True,
        "message": "Thank you for contacting us. We will get back to you soon!"
    }
