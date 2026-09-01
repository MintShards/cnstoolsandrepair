"""Shared HTML shell for the notification emails the shop receives.

Repair requests, contact messages and tool-sale quotes all use this, so the
three read as one system. It also matters for replies: Reply-To on these is
the customer, so hitting Reply quotes the whole message back to them — the
shell therefore carries nothing internal, and its footer matches the Gmail
signature the reply itself will be signed with.
"""

import html

BLUE = "#1152d4"
ORANGE = "#f97316"
INK = "#111827"
MUTED = "#6b7280"
LINE = "#e5e7eb"

TAGLINE = "Industrial Pneumatic Tool Repair & Maintenance"
PHONE = "778-488-0777"
WEBSITE = "cnstoolrepair.com"


def esc(value) -> str:
    """HTML-escape any value (incl. quotes) for safe interpolation into email HTML."""
    return html.escape(str(value if value is not None else ""), quote=True)


def field_rows(pairs) -> str:
    """A two-column detail table: [(label, value_html), ...]. Falsy values are skipped."""
    rows = ""
    for label, value in pairs:
        if not value:
            continue
        rows += f"""
          <tr>
            <td style="padding:0 0 6px;color:{MUTED};font-size:13px;width:78px;vertical-align:top;">{esc(label)}</td>
            <td style="padding:0 0 6px;color:{INK};font-size:15px;font-weight:700;">{value}</td>
          </tr>"""
    return f'<table style="width:100%;border-collapse:collapse;">{rows}\n      </table>'


def link(href: str, text: str) -> str:
    return f'<a href="{esc(href)}" style="color:{BLUE};text-decoration:none;font-weight:700;">{esc(text)}</a>'


def section_label(text: str) -> str:
    return (
        f'<div style="color:{MUTED};font-size:11px;font-weight:700;text-transform:uppercase;'
        f'letter-spacing:0.08em;padding-bottom:6px;">{esc(text)}</div>'
    )


def callout(label: str, body: str) -> str:
    """Orange-bordered block — used for the customer's own words."""
    return f"""
      <div style="margin:24px 0 0;padding:14px 16px;background:#fff7ed;border-left:4px solid {ORANGE};border-radius:6px;">
        <div style="color:{ORANGE};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">{esc(label)}</div>
        <p style="margin:6px 0 0;color:#7c2d12;font-size:14px;line-height:1.6;white-space:pre-wrap;">{esc(body)}</p>
      </div>"""


def _footer(from_email: str, role_label: str, logo_url: str) -> str:
    logo_block = ""
    if logo_url:
        logo_block = (
            f'<img src="{esc(logo_url)}" alt="CNS Tool Repair" '
            f'style="height:30px;width:auto;display:block;margin-bottom:10px;" />'
        )

    return f"""
    <div style="padding:26px 28px 28px;">
      <hr style="border:none;border-top:1px solid {LINE};margin:0 0 20px;" />
      {logo_block}
      <p style="margin:8px 0 4px;color:#374151;font-size:12px;font-weight:700;">{esc(TAGLINE)}</p>
      <p style="margin:0;color:{MUTED};font-size:12px;line-height:1.8;">
        &#128231; <a href="mailto:{esc(from_email)}" style="color:{BLUE};text-decoration:none;">{esc(from_email)}</a><br>
        &#128222; {esc(PHONE)}<br>
        &#127760; <a href="https://{esc(WEBSITE)}" style="color:{BLUE};text-decoration:none;">{esc(WEBSITE)}</a>
      </p>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">{esc(role_label)}</p>
    </div>"""


def shell(
    *,
    preheader: str,
    eyebrow: str,
    heading: str,
    timestamp: str,
    body: str,
    from_email: str,
    role_label: str,
    logo_url: str = "",
) -> str:
    """Wrap `body` (already-escaped HTML) in the house header and footer.

    preheader is the line Gmail shows beside the subject in the inbox list.
    """
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{esc(preheader)}</div>

  <div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12);">

    <div style="background:{BLUE};padding:22px 28px;">
      <div style="color:#bfdbfe;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">{esc(eyebrow)}</div>
      <div style="color:#ffffff;font-size:24px;font-weight:700;padding-top:4px;">{esc(heading)}</div>
      <div style="color:#bfdbfe;font-size:13px;padding-top:6px;">{esc(timestamp)}</div>
    </div>

{body}

    {_footer(from_email, role_label, logo_url)}

  </div>
</body>
</html>"""
