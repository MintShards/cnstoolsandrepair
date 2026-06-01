import base64
import logging
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import settings as app_settings
from app.services.resend_client import send_email_via_resend
from app.services.work_order_pdf_service import generate_work_order_pdf

logger = logging.getLogger(__name__)

MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024  # 20 MB total


def _resolve_template_variables(text: str, job: dict) -> str:
    """Replace {work_order_number}, {customer_name}, {company_name} in template strings."""
    first = job.get("first_name") or ""
    last = job.get("last_name") or ""
    customer_name = f"{first} {last}".strip() or "Valued Customer"
    company_name = job.get("company_name") or customer_name

    variables = defaultdict(str, {
        "work_order_number": job.get("request_number") or "",
        "customer_name": customer_name,
        "company_name": company_name,
    })
    try:
        return text.format_map(variables)
    except Exception:
        return text


def _build_work_order_email_html(job: dict, template: dict, custom_message: Optional[str] = None) -> str:
    """Build the HTML body for a work order email (matches Zoho invoice template style)."""
    t = template or {}

    greeting_raw = t.get("greeting") or "Hi {customer_name},"
    greeting = _resolve_template_variables(greeting_raw, job)

    body_text = t.get("body_text") or t.get("bodyText") or (
        "Thank you for bringing your tool(s) in for service. "
        "Please find your work order attached. We will be in touch once our technician "
        "has had a chance to assess your equipment."
    )
    closing_text = t.get("closing_text") or t.get("closingText") or (
        "If you have any questions, feel free to reply to this email or give us a call."
    )
    footer_phone = t.get("footer_phone") or t.get("footerPhone") or "(236) 885-9782"
    footer_website = t.get("footer_website") or t.get("footerWebsite") or "cnstoolrepair.com"

    logo_url = "https://cnstoolsandrepair-photos.sfo3.digitaloceanspaces.com/email-templates/cns-logo.png"

    wo_number = job.get("request_number") or ""
    tools = job.get("tools") or []
    tool_count = len(tools)

    # Build tools summary table rows
    tool_rows = ""
    for idx, tool in enumerate(tools, start=1):
        brand = tool.get("brand") or ""
        model = tool.get("model_number") or ""
        tool_type = tool.get("tool_type") or ""
        qty = tool.get("quantity") or 1
        tool_rows += f"""
                        <tr>
                            <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;color:#334155;text-align:center;">{idx}</td>
                            <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600;">{brand}</td>
                            <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;color:#1e293b;">{model}</td>
                            <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;color:#1e293b;">{tool_type}</td>
                            <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;color:#1e293b;text-align:center;">{qty}</td>
                        </tr>"""

    custom_message_block = ""
    if custom_message and custom_message.strip():
        custom_message_block = f"""
            <div style="border-left:3px solid #FF2400;padding:4px 0 4px 16px;margin:0 0 24px;">
                <p style="margin:0;color:#1e293b;line-height:1.6;font-size:15px;">{custom_message.strip()}</p>
            </div>"""

    tool_label = f"{tool_count} Tool{'s' if tool_count != 1 else ''} Received"

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<div style="background:#f6f6f8;padding:20px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;">

        <!-- Header: Logo + Tagline -->
        <div style="background:#ffffff;padding:24px 32px;border-bottom:4px solid #1152d4;">
            <table border="0" cellspacing="0" cellpadding="0" width="100%">
                <tbody>
                    <tr>
                        <td style="vertical-align:middle;">
                            <img src="{logo_url}" alt="CNS Tool Repair" style="width:200px;height:auto;display:block;" width="200" />
                        </td>
                        <td style="vertical-align:middle;text-align:right;color:#FF2400;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">
                            Pneumatic Repair &amp; Service
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Info Bar: Work Order Number -->
        <div style="background:#f1f5f9;padding:18px 32px;border-bottom:1px solid #e2e8f0;">
            <table border="0" cellspacing="0" cellpadding="0" width="100%">
                <tbody>
                    <tr>
                        <td style="color:#334155;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
                            Work Order
                        </td>
                        <td style="color:#1e293b;font-size:18px;font-weight:700;text-align:right;">
                            {wo_number}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Body -->
        <div style="padding:36px 32px 8px;color:#1e293b;line-height:1.6;font-size:15px;">
            <p style="margin:0 0 16px;">{greeting}</p>
            <p style="margin:0 0 24px;">{body_text}</p>

            {custom_message_block}

            <!-- Tools Summary -->
            <p style="margin:0 0 6px;"><span style="color:#1152d4;"><b>{tool_label}</b></span></p>
        </div>

        <div style="padding:0 32px 32px;">
            <div style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;" border="0" cellspacing="0" cellpadding="0">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:10px 24px;text-align:center;font-size:11px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">#</th>
                            <th style="padding:10px 24px;text-align:left;font-size:11px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Brand</th>
                            <th style="padding:10px 24px;text-align:left;font-size:11px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Model</th>
                            <th style="padding:10px 24px;text-align:left;font-size:11px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Type</th>
                            <th style="padding:10px 24px;text-align:center;font-size:11px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Qty</th>
                        </tr>
                    </thead>
                    <tbody>{tool_rows}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Attachment Note -->
        <div style="padding:0 32px 32px;color:#1e293b;font-size:14px;line-height:1.6;">
            <div style="border-left:3px solid #FF2400;padding:4px 0 4px 16px;">
                The full work order PDF is attached to this email along with any tool photos.
            </div>
        </div>

        <!-- Closing -->
        <div style="padding:0 32px 32px;color:#1e293b;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 24px;">{closing_text}</p>
            <p style="margin:0 0 4px;">Thanks,</p>
            <p style="margin:0;"><span style="color:#334155;font-size:13px;">CNS Tool Repair</span></p>
            <div style="color:#334155;font-size:13px;">{footer_phone}</div>
            <div><span style="color:#334155;font-size:13px;">{footer_website}</span></div>
        </div>

        <!-- Gmail clip prevention -->
        <div style="display:none;max-height:0;overflow:hidden;">&#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</div>

        <!-- Footer -->
        <div style="background:#f1f5f9;padding:20px 32px;text-align:center;color:#334155;font-size:11px;letter-spacing:0.5px;line-height:1.8;border-top:1px solid #e2e8f0;">
            CNS Tool Repair &nbsp;&middot;&nbsp; Surrey, BC<br>
            <a style="color:#1152d4;text-decoration:none;font-weight:600;letter-spacing:1px;" href="https://{footer_website}">{footer_website}</a>
        </div>

    </div>
</div>
</body>
</html>"""


async def _collect_tool_photos(job: dict) -> list:
    """
    Fetch all tool photos from storage, base64-encode them.
    Returns list of Resend attachment dicts. Skips failures and enforces 20MB total limit.
    """
    attachments = []
    total_bytes = 0
    photo_index = 0

    for tool in (job.get("tools") or []):
        for photo_path in (tool.get("photos") or []):
            photo_index += 1
            photo_url = None
            try:
                if app_settings.use_spaces:
                    photo_url = photo_path if photo_path.startswith("http") else f"{app_settings.upload_base_url}/{photo_path}"
                else:
                    photo_url = photo_path if photo_path.startswith("http") else f"{app_settings.upload_base_url}/uploads/{photo_path}"

                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(photo_url)
                resp.raise_for_status()
                data = resp.content

                if total_bytes + len(data) > MAX_ATTACHMENT_BYTES:
                    logger.info(f"Skipping photo {photo_index} ({len(data)} bytes) — would exceed 20MB email limit")
                    continue

                total_bytes += len(data)
                encoded = base64.b64encode(data).decode()
                file_ext = photo_path.split(".")[-1].lower() if "." in photo_path else "jpg"
                mime_types = {
                    "jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "png": "image/png", "webp": "image/webp",
                }
                mime_type = mime_types.get(file_ext, "image/jpeg")
                attachments.append({
                    "filename": f"tool-photo-{photo_index}.{file_ext}",
                    "content": encoded,
                    "type": mime_type,
                })
            except Exception as e:
                url_info = photo_url or "URL not constructed"
                logger.error(f"Failed to fetch photo {photo_path}: {e} | URL: {url_info}\n{traceback.format_exc()}")

    return attachments


async def send_work_order_email(
    db,
    job: dict,
    template: dict,
    business_info: dict,
    service_agreement: dict,
    recipient_email: Optional[str] = None,
    subject_override: Optional[str] = None,
    custom_message: Optional[str] = None,
    sent_by: Optional[str] = None,
) -> dict:
    """
    Generate and send the work order email for a repair job.

    Returns {"success": bool, "sent_to": str, "error": str|None}
    Also appends a record to the repair job's work_order_emails_sent array in MongoDB.
    """
    to_email = (recipient_email or "").strip() or (job.get("email") or "").strip()
    if not to_email:
        return {"success": False, "sent_to": None, "error": "No recipient email address available"}

    wo_number = job.get("request_number") or "Work Order"
    t = template or {}

    # Resolve subject
    if subject_override and subject_override.strip():
        subject = subject_override.strip()
    else:
        default_subject_raw = t.get("default_subject") or t.get("defaultSubject") or "Your Work Order {work_order_number} - CNS Tool Repair"
        subject = _resolve_template_variables(default_subject_raw, job)

    # Sender
    from_email = (t.get("from_email") or t.get("fromEmail") or "").strip() or "service@cnstoolrepair.com"
    from_name = (t.get("from_name") or t.get("fromName") or "").strip() or "CNS Tool Repair"

    # CC / BCC
    cc_raw = (t.get("cc") or "").strip()
    bcc_raw = (t.get("bcc") or "").strip()
    cc_list = [e.strip() for e in cc_raw.split(",") if e.strip()] if cc_raw else []
    bcc_list = [e.strip() for e in bcc_raw.split(",") if e.strip()] if bcc_raw else []

    # Customer display name for To header
    first = job.get("first_name") or ""
    last = job.get("last_name") or ""
    cust_name = f"{first} {last}".strip()
    to_display = f"{cust_name} <{to_email}>" if cust_name else to_email

    # Generate PDF
    try:
        pdf_bytes = generate_work_order_pdf(job, business_info, service_agreement)
        pdf_encoded = base64.b64encode(pdf_bytes).decode()
        pdf_filename = f"{wo_number}.pdf"
    except Exception as e:
        logger.error(f"PDF generation failed for {wo_number}: {e}\n{traceback.format_exc()}")
        return {"success": False, "sent_to": to_email, "error": f"PDF generation failed: {str(e)}"}

    # Collect photos
    photo_attachments = await _collect_tool_photos(job)

    # Build attachments list: PDF first, then photos
    attachments = [
        {
            "filename": pdf_filename,
            "content": pdf_encoded,
            "type": "application/pdf",
        }
    ] + photo_attachments

    # Build HTML body
    html_body = _build_work_order_email_html(job, t, custom_message)

    # Build Resend payload
    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_display],
        "reply_to": from_email,
        "subject": subject,
        "html": html_body,
        "attachments": attachments,
    }
    if cc_list:
        payload["cc"] = cc_list
    if bcc_list:
        payload["bcc"] = bcc_list

    result = await send_email_via_resend(payload)

    # Log to MongoDB
    log_entry = {
        "sent_at": datetime.utcnow(),
        "sent_to": to_email,
        "sent_by": sent_by or "admin",
        "cc": cc_list,
        "bcc": bcc_list,
        "subject": subject,
        "photo_count": len(photo_attachments),
        "success": result["success"],
        "error": result.get("error"),
    }
    try:
        from bson import ObjectId
        await db.repairs.update_one(
            {"_id": ObjectId(job["id"])},
            {"$push": {"work_order_emails_sent": log_entry}}
        )
    except Exception as e:
        logger.error(f"Failed to log work order email send for job {job.get('id')}: {e}")

    if result["success"]:
        logger.info(
            f"Work order email sent: {wo_number} → {to_email} "
            f"(PDF + {len(photo_attachments)} photo(s))"
        )
        return {"success": True, "sent_to": to_email, "error": None}
    else:
        logger.error(f"Work order email failed for {wo_number}: {result.get('error')}")
        return {"success": False, "sent_to": to_email, "error": result.get("error") or "Send failed"}
