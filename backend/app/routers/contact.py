from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.config import settings
from app.database import get_database
from bson import ObjectId

router = APIRouter(prefix="/api/contact", tags=["contact"])


class ContactMessage(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=10, max_length=2000)


@router.post("/", status_code=200)
async def send_contact_message(contact: ContactMessage):
    """
    Send contact form message via email and store in database.
    Integrates with SendGrid for email delivery.
    """
    db = get_database()

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

    # Send email notification
    email_body = f"""
New Contact Form Submission

Contact Details:
- Name: {contact.name}
- Email: {contact.email}
- Phone: {contact.phone}

Subject: {contact.subject}

Message:
{contact.message}

---
Message ID: {str(result.inserted_id)}
Submitted: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}

CNS Tools and Repair
Automated Contact Form Notification
    """

    try:
        # Create SendGrid message
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject=f"Contact Form: {contact.subject}",
            plain_text_content=email_body
        )

        # Send email via SendGrid
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"Contact form email sent! Status code: {response.status_code}")
    except Exception as e:
        print(f"Failed to send contact email: {str(e)}")
        # Don't fail the request if email fails, message is already stored

    return {
        "success": True,
        "message": "Thank you for contacting us. We will get back to you soon!"
    }
