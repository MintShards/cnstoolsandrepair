from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.config import settings
from app.models.quote import Quote


async def send_quote_notification(quote: Quote) -> bool:
    """Send email notification to team when new quote is submitted"""

    # Email body
    body = f"""
New Quote Request Received

Company Details:
- Company Name: {quote.company_name}
- Contact Person: {quote.contact_person}
- Email: {quote.email}
- Phone: {quote.phone}

Tool Information:
- Tool Type: {quote.tool_type}
- Brand: {quote.tool_brand}
- Model: {quote.tool_model}
- Quantity: {quote.quantity}
- Urgency Level: {quote.urgency_level.upper()}

Problem Description:
{quote.problem_description}

Photos Uploaded: {len(quote.photos)}
{chr(10).join(f"- {photo}" for photo in quote.photos) if quote.photos else "No photos uploaded"}

Quote ID: {quote.id}
Submitted: {quote.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")}

---
CNS Tools and Repair
Automated Quote Notification System
    """

    try:
        # Create SendGrid message
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject=f"New Quote Request from {quote.company_name}",
            plain_text_content=body
        )

        # Send email via SendGrid
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        print(f"Email sent! Status code: {response.status_code}")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False
