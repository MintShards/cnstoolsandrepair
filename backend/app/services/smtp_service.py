import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


def _build_sourcing_email_html(
    parts: List[dict],
    message: Optional[str],
    recipient_name: Optional[str],
    template: Optional[dict] = None,
) -> str:
    """Build the HTML body for a parts sourcing email."""
    t = template or {}
    greeting_word = t.get("greeting") or "Hi"
    body_text = t.get("body_text") or "We would like to request pricing and availability for the parts listed below. When you have a moment, please reply with your best price and estimated lead time for any items you are able to supply. We truly appreciate your time and assistance."
    closing_text = t.get("closing_text") or "Thank you for your time. We look forward to hearing from you."
    footer_tagline = t.get("footer_tagline") or "Industrial Pneumatic Tool Repair & Maintenance"
    footer_email = t.get("footer_email") or "purchasing@cnstoolrepair.com"
    footer_phone = t.get("footer_phone") or "778-488-0777"
    footer_website = t.get("footer_website") or "cnstoolrepair.com"
    footer_label = t.get("footer_label") or "Supplier & Parts Inquiries"

    greeting = f"{greeting_word},"

    rows = ""
    for part in parts:
        name = part.get("name", "")
        part_number = part.get("part_number") or "—"
        quantity = part.get("quantity", 1)
        rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">{name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;">{part_number}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{quantity}</td>
        </tr>"""

    custom_message_block = ""
    if message and message.strip():
        custom_message_block = f"""
        <div style="margin:24px 0;padding:16px;background:#f3f4f6;border-radius:8px;border-left:4px solid #1152d4;">
          <p style="margin:0;color:#374151;line-height:1.6;">{message.strip()}</p>
        </div>"""

    if settings.email_logo_url:
        logo_block = f'<img src="{settings.email_logo_url}" alt="CNS Tool Repair" style="height:42px;width:auto;display:block;margin-bottom:8px;" />'
    else:
        logo_block = ''

    # Escape ampersands for HTML
    footer_tagline_html = footer_tagline.replace("&", "&amp;")
    footer_label_html = footer_label.replace("&", "&amp;")

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1152d4;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CNS Tool Repair</h1>
      <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">Parts Pricing Request</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 8px;color:#111827;font-size:15px;">{greeting}</p>
      <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
        {body_text}
      </p>

      <!-- Parts Table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Part Name</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Part Number</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
          </tr>
        </thead>
        <tbody>{rows}
        </tbody>
      </table>

      {custom_message_block}

      <p style="margin:24px 0 0;color:#374151;line-height:1.6;">
        {closing_text}
      </p>
    </div>

    <!-- Gmail clip prevention: hidden whitespace to push content above trimming threshold -->
    <div style="display:none;max-height:0;overflow:hidden;">&#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</div>

    <!-- Footer -->
    <div style="padding:24px 32px 28px;">
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
      {logo_block}
      <p style="margin:8px 0 4px;color:#374151;font-size:12px;font-weight:700;">{footer_tagline_html}</p>
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.8;">
        &#128231; <a href="mailto:{footer_email}" style="color:#1152d4;text-decoration:none;">{footer_email}</a><br>
        &#128222; {footer_phone}<br>
        &#127760; <a href="https://{footer_website}" style="color:#1152d4;text-decoration:none;">{footer_website}</a>
      </p>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">{footer_label_html}</p>
    </div>

  </div>
</body>
</html>"""


async def send_sourcing_email(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    parts: List[dict],
    message: Optional[str] = None,
    template: Optional[dict] = None,
) -> bool:
    """Send a single sourcing email to one recipient. Returns True on success."""
    html_body = _build_sourcing_email_html(parts, message, to_name, template=template)

    t = template or {}

    from_email = (t.get("from_email") or "").strip() or settings.smtp_from_email
    from_name = (t.get("from_name") or "").strip() or settings.smtp_from_name

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
    msg["Reply-To"] = from_email

    # Add CC/BCC from template settings
    cc_raw = (t.get("cc") or "").strip()
    bcc_raw = (t.get("bcc") or "").strip()
    cc_list = [e.strip() for e in cc_raw.split(",") if e.strip()] if cc_raw else []
    bcc_list = [e.strip() for e in bcc_raw.split(",") if e.strip()] if bcc_raw else []
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    msg.attach(MIMEText(html_body, "html"))

    # Build full recipient list for SMTP envelope
    all_recipients = [to_email] + cc_list + bcc_list

    try:
        await aiosmtplib.send(
            msg,
            recipients=all_recipients,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=True,
        )
        logger.info(f"Sourcing email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send sourcing email to {to_email}: {e}")
        return False


async def send_bulk_sourcing_emails(
    recipients: List[dict],
    parts: List[dict],
    subject: str,
    message: Optional[str] = None,
    template: Optional[dict] = None,
) -> dict:
    """
    Send one sourcing email per recipient. Each recipient gets their own email.
    Returns a summary: {"sent": [...], "failed": [...]}
    """
    sent = []
    failed = []

    for recipient in recipients:
        to_email = recipient.get("email", "").strip()
        to_name = (recipient.get("name") or "").strip() or None

        if not to_email:
            failed.append({"email": to_email, "error": "Empty email address"})
            continue

        success = await send_sourcing_email(
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            parts=parts,
            message=message,
            template=template,
        )

        if success:
            sent.append({"email": to_email, "name": to_name})
        else:
            failed.append({"email": to_email, "error": "SMTP send failed"})

    return {"sent": sent, "failed": failed}
