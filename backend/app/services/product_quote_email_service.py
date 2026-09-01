import logging
import traceback

from app.config import settings as app_settings
from app.services.resend_client import send_email_via_resend
from app.services.email_service import format_pst_datetime
from app.services import email_layout as L

logger = logging.getLogger(__name__)

# Tool sales get their own sender so a product enquiry is instantly
# distinguishable from a repair request (request@) or a work order (service@).
FROM_ADDRESS = "CNS Tool Repair Sales <sales@cnstoolrepair.com>"
REPLY_EMAIL = "sales@cnstoolrepair.com"
ROLE_LABEL = "Tool & Equipment Sales"


def _item_label(item: dict) -> str:
    """'JET IW34HDA' — whatever identifies the tool, minus the name."""
    return " ".join(p for p in [item.get("brand"), item.get("model")] if p)


def _build_html(quote: dict, submitted_time: str, total_units: int) -> str:
    customer_name = f"{quote['first_name']} {quote['last_name']}"
    quote_number = quote.get("quote_number", "PQ-?")
    items = quote.get("items", [])
    phone = quote["phone"]
    email = quote["email"]

    first = items[0]["name"] if items else "a tool"
    more = f" +{len(items) - 1} more" if len(items) > 1 else ""
    unit_label = "unit" if total_units == 1 else "units"
    preheader = f"{total_units} {unit_label} · {first}{more} · {phone}"

    details = L.field_rows([
        ("Company", L.esc(quote["company_name"]) if quote.get("company_name") else ""),
        ("Contact", L.esc(customer_name)),
        ("Phone", L.link(f"tel:{phone.replace('-', '')}", phone)),
        ("Email", L.link(f"mailto:{email}", email)),
    ])

    rows = ""
    for item in items:
        label = _item_label(item)
        label_html = (
            f'<div style="color:{L.ORANGE};font-size:11px;font-weight:700;'
            f'text-transform:uppercase;letter-spacing:0.06em;">{L.esc(label)}</div>'
            if label else ""
        )
        sku_html = (
            f'<div style="color:{L.MUTED};font-size:12px;padding-top:3px;">Item #{L.esc(item["sku"])}</div>'
            if item.get("sku") else ""
        )
        rows += f"""
        <tr>
          <td style="padding:12px 12px 12px 0;border-bottom:1px solid {L.LINE};vertical-align:top;">
            {label_html}
            <div style="color:{L.INK};font-size:15px;font-weight:700;padding-top:2px;">{L.esc(item['name'])}</div>
            {sku_html}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid {L.LINE};vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:{L.BLUE};color:#ffffff;font-size:14px;font-weight:700;
                         padding:4px 12px;border-radius:999px;">&times;{L.esc(item.get('quantity', 1))}</span>
          </td>
        </tr>"""

    notes = L.callout("Customer notes", quote["notes"]) if quote.get("notes") else ""

    item_word = "item" if len(items) == 1 else "items"
    unit_word = "unit" if total_units == 1 else "units"
    requested = L.section_label(
        f"Requested — {len(items)} {item_word}, {total_units} {unit_word}"
    )

    body = f"""
    <div style="padding:24px 28px 0;">
      {details}
    </div>

    <div style="padding:22px 28px 0;">
      {requested}
      <table style="width:100%;border-collapse:collapse;">
        <tbody>{rows}
        </tbody>
      </table>
      {notes}
    </div>"""

    return L.shell(
        preheader=preheader,
        eyebrow="Tools for Sale",
        heading=f"Quote Request {quote_number}",
        timestamp=submitted_time,
        body=body,
        from_email=REPLY_EMAIL,
        role_label=ROLE_LABEL,
        logo_url=app_settings.email_logo_url,
    )


def _build_text(quote: dict, submitted_time: str, total_units: int) -> str:
    """Plain-text fallback for clients that don't render HTML."""

    lines = [
        f"TOOL QUOTE REQUEST {quote.get('quote_number', 'PQ-?')}",
        f"Submitted: {submitted_time}",
        "",
        "CUSTOMER",
    ]
    if quote.get("company_name"):
        lines.append(f"  Company: {quote['company_name']}")
    lines += [
        f"  Contact: {quote['first_name']} {quote['last_name']}",
        f"  Phone:   {quote['phone']}",
        f"  Email:   {quote['email']}",
        "",
        "REQUESTED",
    ]

    for item in quote.get("items", []):
        label = _item_label(item)
        detail = f" ({label})" if label else ""
        sku = f" [Item #{item['sku']}]" if item.get("sku") else ""
        lines.append(f"  {item.get('quantity', 1)} x {item['name']}{detail}{sku}")

    lines.append(f"  Total: {total_units} unit{'s' if total_units != 1 else ''}")

    if quote.get("notes"):
        lines += ["", "CUSTOMER NOTES", f"  {quote['notes']}"]

    lines += [
        "",
        f"CNS Tool Repair - {L.TAGLINE}",
        f"{REPLY_EMAIL} | {L.PHONE} | {L.WEBSITE}",
        ROLE_LABEL,
    ]

    return "\n".join(lines)


async def send_product_quote_notification(quote: dict) -> bool:
    """Email the shop when a customer requests a quote on tools for sale."""

    quote_number = quote.get("quote_number", "PQ-?")

    try:
        submitted_time = format_pst_datetime(quote["created_at"])
        items = quote.get("items", [])
        total_units = sum(item.get("quantity", 1) for item in items)

        subject_name = quote.get("company_name") or f"{quote['first_name']} {quote['last_name']}"
        summary = f"{len(items)} item{'s' if len(items) != 1 else ''}"

        payload = {
            "from": FROM_ADDRESS,
            "to": [app_settings.sales_notification_email or app_settings.notification_email],
            # Replying goes straight back to the customer, as with repair requests.
            "reply_to": f"{quote['first_name']} {quote['last_name']} <{quote['email']}>",
            "subject": f"Tool Quote {quote_number}: {subject_name} - {summary}",
            "html": _build_html(quote, submitted_time, total_units),
            "text": _build_text(quote, submitted_time, total_units),
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
