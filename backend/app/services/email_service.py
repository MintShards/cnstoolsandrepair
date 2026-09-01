import logging
import base64
import traceback
import httpx
from app.config import settings as app_settings
from app.models.quote import Quote
from app.routers.settings import DEFAULT_SETTINGS
from app.services.resend_client import send_email_via_resend
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


def format_pst_datetime(utc_dt) -> str:
    """Convert UTC datetime to Pacific Time (PST/PDT) and format for readability"""
    pacific_tz = ZoneInfo("America/Vancouver")

    if utc_dt.tzinfo is None:
        from datetime import timezone
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)

    pacific_dt = utc_dt.astimezone(pacific_tz)

    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']

    month = month_names[pacific_dt.month - 1]
    day = pacific_dt.day
    year = pacific_dt.year
    hour = pacific_dt.hour
    minute = pacific_dt.minute

    am_pm = "AM" if hour < 12 else "PM"
    display_hour = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)
    tz_name = pacific_dt.strftime('%Z')

    return f"{month} {day}, {year} at {display_hour}:{minute:02d} {am_pm} {tz_name}"


REPAIR_REPLY_EMAIL = "service@cnstoolrepair.com"
REPAIR_ROLE_LABEL = "Repair & Service"


def _build_request_html(quote: Quote, submitted_time: str, photo_note: str) -> str:
    """House-styled body for the repair request alert.

    Customer-safe: Reply-To is the customer, so this gets quoted back to them.
    """
    from app.services import email_layout as L

    customer_name = f"{quote.first_name} {quote.last_name}"
    tool_count = len(quote.tools)
    total_units = sum(t.quantity for t in quote.tools)

    first_tool = quote.tools[0] if quote.tools else None
    first_desc = (
        " ".join(p for p in [first_tool.tool_brand, first_tool.tool_type] if p)
        if first_tool else "a tool"
    )
    more = f" +{tool_count - 1} more" if tool_count > 1 else ""
    unit_label = "unit" if total_units == 1 else "units"
    preheader = f"{total_units} {unit_label} · {first_desc}{more} · {quote.phone}"

    details = L.field_rows([
        ("Company", L.esc(quote.company_name) if quote.company_name else ""),
        ("Contact", L.esc(customer_name)),
        ("Phone", L.link(f"tel:{quote.phone.replace('-', '')}", quote.phone)),
        ("Email", L.link(f"mailto:{quote.email}", quote.email)),
        ("Address", L.esc(quote.address) if quote.address else ""),
    ])

    rows = ""
    for tool in quote.tools:
        label = " ".join(p for p in [tool.tool_brand, tool.tool_model] if p)
        label_html = (
            f'<div style="color:{L.ORANGE};font-size:11px;font-weight:700;'
            f'text-transform:uppercase;letter-spacing:0.06em;">{L.esc(label)}</div>'
            if label else ""
        )
        rows += f"""
        <tr>
          <td style="padding:12px 12px 12px 0;border-bottom:1px solid {L.LINE};vertical-align:top;">
            {label_html}
            <div style="color:{L.INK};font-size:15px;font-weight:700;padding-top:2px;">{L.esc(tool.tool_type)}</div>
            <div style="color:{L.MUTED};font-size:13px;line-height:1.6;padding-top:4px;">{L.esc(tool.problem_description)}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid {L.LINE};vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:{L.BLUE};color:#ffffff;font-size:14px;font-weight:700;
                         padding:4px 12px;border-radius:999px;">&times;{L.esc(tool.quantity)}</span>
          </td>
        </tr>"""

    photo_html = ""
    if photo_note:
        photo_html = (
            f'<p style="margin:16px 0 0;color:{L.MUTED};font-size:13px;">{L.esc(photo_note)}</p>'
        )

    item_word = "item" if tool_count == 1 else "items"
    unit_word = "unit" if total_units == 1 else "units"
    tools_label = L.section_label(
        f"Tools — {tool_count} {item_word}, {total_units} {unit_word}"
    )

    body = f"""
    <div style="padding:24px 28px 0;">
      {details}
    </div>

    <div style="padding:22px 28px 0;">
      {tools_label}
      <table style="width:100%;border-collapse:collapse;">
        <tbody>{rows}
        </tbody>
      </table>
      {photo_html}
    </div>"""

    return L.shell(
        preheader=preheader,
        eyebrow="Repair Request",
        heading=f"Request {quote.request_number}",
        timestamp=submitted_time,
        body=body,
        from_email=REPAIR_REPLY_EMAIL,
        role_label=REPAIR_ROLE_LABEL,
        logo_url=app_settings.email_logo_url,
    )


async def send_quote_notification(quote: Quote, business_settings: dict = None) -> bool:
    """Send email notification to team when new quote is submitted"""

    try:
        if business_settings and "contact" in business_settings and "address" in business_settings["contact"]:
            city = business_settings["contact"]["address"]["city"]
            province = business_settings["contact"]["address"]["province"]
        else:
            city = DEFAULT_SETTINGS["contact"]["address"]["city"]
            province = DEFAULT_SETTINGS["contact"]["address"]["province"]
    except (KeyError, TypeError):
        city = DEFAULT_SETTINGS["contact"]["address"]["city"]
        province = DEFAULT_SETTINGS["contact"]["address"]["province"]

    submitted_time = format_pst_datetime(quote.created_at)

    customer_section = "CUSTOMER:\n"
    if quote.company_name:
        customer_section += f"  Company: {quote.company_name}\n"
    customer_section += f"  Contact: {quote.first_name} {quote.last_name}\n"
    customer_section += f"  Phone: {quote.phone}\n"
    customer_section += f"  Email: {quote.email}"
    if quote.address:
        customer_section += f"\n  Address: {quote.address}"

    tools_section = ""
    for idx, tool in enumerate(quote.tools, start=1):
        tools_section += f"\nTOOL {idx}:\n"
        tools_section += f"  Type: {tool.tool_type}\n"
        tools_section += f"  Brand: {tool.tool_brand}\n"
        tools_section += f"  Model: {tool.tool_model}\n"
        tools_section += f"  Quantity: {tool.quantity}\n"
        tools_section += f"  Problem: {tool.problem_description}\n"

    subject_name = quote.company_name if quote.company_name else f"{quote.first_name} {quote.last_name}"
    tool_count = len(quote.tools)
    tool_summary = f"{tool_count} tool{'s' if tool_count > 1 else ''}"

    body_template = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST #{request_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: {submitted_time}

{customer_section}
{tools_section}
PHOTOS:
{photo_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CNS Tool Repair | {city}, {province}
"""

    try:
        # Build attachments
        MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
        attachment_errors = []
        skipped_photos = 0
        attachments = []

        if quote.photos:
            total_attachment_bytes = 0
            for idx, photo in enumerate(quote.photos, start=1):
                try:
                    if app_settings.use_spaces:
                        photo_url = photo if photo.startswith('http') else f'{app_settings.upload_base_url}/{photo}'
                    else:
                        photo_url = photo if photo.startswith('http') else f'{app_settings.upload_base_url}/uploads/{photo}'

                    async with httpx.AsyncClient(timeout=30) as http_client:
                        response_photo = await http_client.get(photo_url)
                    response_photo.raise_for_status()
                    photo_data = response_photo.content

                    if total_attachment_bytes + len(photo_data) > MAX_ATTACHMENT_BYTES:
                        skipped_photos += 1
                        logger.info(f"Skipping photo {idx} ({len(photo_data)} bytes) - would exceed email size limit")
                        continue

                    total_attachment_bytes += len(photo_data)
                    encoded = base64.b64encode(photo_data).decode()

                    file_ext = photo.split('.')[-1].lower() if '.' in photo else 'jpg'
                    mime_types = {
                        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                        'png': 'image/png', 'webp': 'image/webp'
                    }
                    mime_type = mime_types.get(file_ext, 'image/jpeg')

                    attachments.append({
                        "filename": f"tool-photo-{idx}.{file_ext}",
                        "content": encoded,
                        "type": mime_type,
                    })

                except Exception as e:
                    url_attempted = photo_url if 'photo_url' in locals() else 'URL not constructed'
                    logger.error(f"Failed to attach photo {photo}: {str(e)} | URL: {url_attempted}\n{traceback.format_exc()}")
                    attachment_errors.append(photo)
                    continue

        # Build photo text for body
        if quote.photos:
            successful_count = len(quote.photos) - len(attachment_errors) - skipped_photos
            failed_count = len(attachment_errors)
            if failed_count == 0 and skipped_photos == 0:
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached"
            elif successful_count > 0:
                photo_text = f"  📎 {successful_count} photo{'s' if successful_count > 1 else ''} attached"
                if skipped_photos > 0:
                    photo_text += f"\n  ℹ️  {skipped_photos} photo{'s' if skipped_photos > 1 else ''} too large for email - view in admin dashboard"
                if failed_count > 0:
                    photo_text += f"\n  ⚠️  {failed_count} photo{'s' if failed_count > 1 else ''} could not be attached - view in admin dashboard"
            else:
                photo_text = f"  ⚠️  {len(quote.photos)} photo{'s' if len(quote.photos) > 1 else ''} uploaded but could not be attached - view in admin dashboard"
        else:
            photo_text = "  📷 No photos"

        body = body_template.format(
            request_number=quote.request_number,
            submitted_time=submitted_time,
            customer_section=customer_section,
            tools_section=tools_section,
            photo_text=photo_text,
            city=city,
            province=province,
        )

        html_body = _build_request_html(
            quote=quote,
            submitted_time=submitted_time,
            photo_note=photo_text.strip().lstrip("📎ℹ️⚠️📷 ").strip(),
        )

        # Send via Resend API
        payload = {
            "from": "Request <request@cnstoolrepair.com>",
            "to": [app_settings.service_notification_email or app_settings.notification_email],
            "reply_to": f"{quote.first_name} {quote.last_name} <{quote.email}>",
            "subject": f"New Request #{quote.request_number}: {subject_name} - {tool_summary}",
            "html": html_body,
            "text": body,
        }

        if attachments:
            payload["attachments"] = attachments

        result = await send_email_via_resend(payload)

        if result["success"]:
            logger.info(f"Email sent. Request: #{quote.request_number} | Customer: {subject_name}")
            if attachment_errors:
                logger.warning(f"{len(attachment_errors)} photo(s) failed to attach but email sent successfully")
            return True
        else:
            logger.error(f"Resend API error for request #{quote.request_number}: {result['error']}")
            return False

    except Exception as e:
        logger.error(f"Failed to send email for request #{quote.request_number}: {str(e)}\n{traceback.format_exc()}")
        return False
