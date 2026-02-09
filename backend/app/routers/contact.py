from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/contact", tags=["contact"])


class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    phone: str
    message: str


@router.post("/", status_code=200)
async def send_contact_message(contact: ContactMessage):
    """Send contact form message"""

    # TODO: Implement email sending or store in database
    # For now, just return success
    # In production, you would send email to team

    return {
        "success": True,
        "message": "Thank you for contacting us. We will get back to you soon!"
    }
