import html
import logging
import traceback

from app.config import settings as app_settings
from app.services.resend_client import send_email_via_resend
from app.services.email_service import format_pst_datetime

logger = logging.getLogger(__name__)

# Tool sales get their own sender so a product enquiry is instantly
# distinguishable from a repair request (request@) or a work order (service@).
FROM_ADDRESS = "CNS Tool Repair Sales <sales@cnstoolrepair.com>"

# NOTE: this email goes to the shop, but Reply-To is the customer — so hitting
# Reply quotes this whole message back to them. Keep the body customer-safe:
# no internal instructions, no admin links, no cost or margin.

BLUE = "#1152d4"
ORANGE = "#f97316"
INK = "#111827"
MUTED = "#6b7280"
LINE = "#e5e7eb"

# Same block the sourcing emails and the Gmail "Sales Signature" use, so the
# automated email and a manual reply from sales@ sign off identically.
FOOTER_TAGLINE = "Industrial Pneumatic Tool Repair & Maintenance"
FOOTER_EMAIL = "sales@cnstoolrepair.com"
FOOTER_PHONE = "778-488-0777"
FOOTER_WEBSITE = "cnstoolrepair.com"
FOOTER_LABEL = "Tool & Equipment Sales"


def _esc(value) -> str:
    """HTML-escape any value (incl. quotes) for safe interpolation into email HTML."""
    return html.escape(str(value if value is not None else ""), quote=True)


def _item_label(item: dict) -> str:
    """'JET IW34HDA' — whatever identifies the tool, minus the name."""
    return " ".join(p for p in [item.get("brand"), item.get("model")] if p)


def _build_html(quote: dict, submitted_time: str, total_units: int) -> str:
    customer_name = f"{quote['first_name']} {quote['last_name']}"
    company = quote.get("company_name")
    phone = quote["phone"]
    email = quote["email"]
    quote_number = quote.get("quote_number", "PQ-?")
    items = quote.get("items", [])

    # The line Gmail shows next to the subject in the inbox list
    first = items[0]["name"] if items else "a tool"
    more = f" +{len(items) - 1} more" if len(items) > 1 else ""
    preheader = _esc(f"{total_units} unit{'s' if total_units != 1 else ''} · {first}{more} · {phone}")

    company_row = ""
    if company:
        company_row = f"""
          <tr>
            <td style="padding:0 0 6px;color:{MUTED};font-size:13px;width:78px;">Company</td>
            <td style="padding:0 0 6px;color:{INK};font-size:15px;font-weight:700;">{_esc(company)}</td>
          </tr>"""

    rows = ""
    for item in items:
        label = _item_label(item)
        label_html = (
            f'<div style="color:{ORANGE};font-size:11px;font-weight:700;'
            f'text-transform:uppercase;letter-spacing:0.06em;">{_esc(label)}</div>'
            if label else ""
        )
        sku_html = (
            f'<div style="color:{MUTED};font-size:12px;padding-top:3px;">Item #{_esc(item["sku"])}</div>'
            if item.get("sku") else ""
        )

        rows += f"""
        <tr>
          <td style="padding:12px 12px 12px 0;border-bottom:1px solid {LINE};vertical-align:top;">
            {label_html}
            <div style="color:{INK};font-size:15px;font-weight:700;padding-top:2px;">{_esc(item['name'])}</div>
            {sku_html}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid {LINE};vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:{BLUE};color:#ffffff;font-size:14px;font-weight:700;
                         padding:4px 12px;border-radius:999px;">&times;{_esc(item.get('quantity', 1))}</span>
          </td>
        </tr>"""

    notes_block = ""
    if quote.get("notes"):
        notes_block = f"""
      <div style="margin:24px 0 0;padding:14px 16px;background:#fff7ed;border-left:4px solid {ORANGE};border-radius:6px;">
        <div style="color:{ORANGE};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Customer notes</div>
        <p style="margin:6px 0 0;color:#7c2d12;font-size:14px;line-height:1.6;">{_esc(quote['notes'])}</p>
      </div>"""

    logo_block = ""
    if app_settings.email_logo_url:
        logo_block = (
            f'<img src="{_esc(app_settings.email_logo_url)}" alt="CNS Tool Repair" '
            f'style="height:30px;width:auto;display:block;margin-bottom:10px;" />'
        )

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{preheader}</div>

  <div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12);">

    <!-- Header -->
    <div style="background:{BLUE};padding:22px 28px;">
      <div style="color:#bfdbfe;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">Tools for Sale</div>
      <div style="color:#ffffff;font-size:24px;font-weight:700;padding-top:4px;">Quote Request {_esc(quote_number)}</div>
      <div style="color:#bfdbfe;font-size:13px;padding-top:6px;">{_esc(submitted_time)}</div>
    </div>

    <!-- Customer -->
    <div style="padding:24px 28px 0;">
      <table style="width:100%;border-collapse:collapse;">
        {company_row}
        <tr>
          <td style="padding:0 0 6px;color:{MUTED};font-size:13px;width:78px;">Contact</td>
          <td style="padding:0 0 6px;color:{INK};font-size:15px;font-weight:700;">{_esc(customer_name)}</td>
        </tr>
        <tr>
          <td style="padding:0 0 6px;color:{MUTED};font-size:13px;">Phone</td>
          <td style="padding:0 0 6px;font-size:15px;">
            <a href="tel:{_esc(phone.replace('-', ''))}" style="color:{BLUE};text-decoration:none;font-weight:700;">{_esc(phone)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0;color:{MUTED};font-size:13px;">Email</td>
          <td style="padding:0;font-size:15px;">
            <a href="mailto:{_esc(email)}" style="color:{BLUE};text-decoration:none;font-weight:700;">{_esc(email)}</a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding:22px 28px 0;">
      <div style="color:{MUTED};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:4px;">
        Requested &mdash; {len(items)} item{'s' if len(items) != 1 else ''}, {total_units} unit{'s' if total_units != 1 else ''}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>{rows}
        </tbody>
      </table>
      {notes_block}
    </div>

    <!-- Footer -->
    <div style="padding:26px 28px 28px;">
      <hr style="border:none;border-top:1px solid {LINE};margin:0 0 20px;" />
      {logo_block}
      <p style="margin:8px 0 4px;color:#374151;font-size:12px;font-weight:700;">{_esc(FOOTER_TAGLINE)}</p>
      <p style="margin:0;color:{MUTED};font-size:12px;line-height:1.8;">
        &#128231; <a href="mailto:{FOOTER_EMAIL}" style="color:{BLUE};text-decoration:none;">{FOOTER_EMAIL}</a><br>
        &#128222; {FOOTER_PHONE}<br>
        &#127760; <a href="https://{FOOTER_WEBSITE}" style="color:{BLUE};text-decoration:none;">{FOOTER_WEBSITE}</a>
      </p>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">{_esc(FOOTER_LABEL)}</p>
    </div>

  </div>
</body>
</html>"""


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
        f"CNS Tool Repair - {FOOTER_TAGLINE}",
        f"{FOOTER_EMAIL} | {FOOTER_PHONE} | {FOOTER_WEBSITE}",
        FOOTER_LABEL,
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
