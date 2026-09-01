import logging
import traceback
from app.config import settings as app_settings
from app.services.resend_client import send_email_via_resend
from app.services.email_service import format_pst_datetime

logger = logging.getLogger(__name__)

# Tool sales get their own sender so a product enquiry is instantly
# distinguishable from a repair request (request@) or a work order (service@).
FROM_ADDRESS = "CNS Tool Repair Sales <sales@cnstoolrepair.com>"


async def send_product_quote_notification(quote: dict) -> bool:
    """Email the shop when a customer requests a quote on tools for sale."""

    quote_number = quote.get("quote_number", "PQ-?")

    try:
        submitted_time = format_pst_datetime(quote["created_at"])

        customer_section = "CUSTOMER:\n"
        if quote.get("company_name"):
            customer_section += f"  Company: {quote['company_name']}\n"
        customer_section += f"  Contact: {quote['first_name']} {quote['last_name']}\n"
        customer_section += f"  Phone: {quote['phone']}\n"
        customer_section += f"  Email: {quote['email']}"

        items_section = ""
        total_units = 0
        for idx, item in enumerate(quote.get("items", []), start=1):
            total_units += item.get("quantity", 1)
            items_section += f"\nITEM {idx}:\n"
            items_section += f"  Product: {item['name']}\n"
            if item.get("brand") or item.get("model"):
                items_section += f"  Brand/Model: {item.get('brand', '')} {item.get('model', '')}\n".replace("  \n", "\n")
            if item.get("sku"):
                items_section += f"  SKU: {item['sku']}\n"
            items_section += f"  Quantity: {item.get('quantity', 1)}\n"

        notes_section = f"\nNOTES:\n  {quote['notes']}\n" if quote.get("notes") else ""

        subject_name = quote.get("company_name") or f"{quote['first_name']} {quote['last_name']}"
        line_count = len(quote.get("items", []))
        summary = f"{line_count} item{'s' if line_count != 1 else ''}"

        body = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOL QUOTE REQUEST {quote_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{items_section}{notes_section}
  Total units requested: {total_units}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Price this in Zoho Books using the SKUs above.
CNS Tool Repair | Surrey, BC
"""

        payload = {
            "from": FROM_ADDRESS,
            "to": [app_settings.notification_email],
            # Replying goes straight back to the customer, as with repair requests.
            "reply_to": f"{quote['first_name']} {quote['last_name']} <{quote['email']}>",
            "subject": f"Tool Quote {quote_number}: {subject_name} - {summary}",
            "text": body,
        }

        result = await send_email_via_resend(payload)

        if result["success"]:
            logger.info(f"Product quote email sent. {quote_number} | Customer: {subject_name}")
            return True

        logger.error(f"Resend API error for product quote {quote_number}: {result['error']}")
        return False

    except Exception as e:
        logger.error(f"Failed to send product quote email {quote_number}: {str(e)}\n{traceback.format_exc()}")
        return False
