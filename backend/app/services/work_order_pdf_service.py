import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fpdf import FPDF

logger = logging.getLogger(__name__)

_FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")

_PACIFIC = ZoneInfo("America/Vancouver")

SOURCE_LABELS = {
    "online_request": "Online Request",
    "drop_off": "Drop-off",
    "phone_in": "Phone-in",
    "email": "Email",
}

PRIORITY_LABELS = {
    "rush": "RUSH",
    "urgent": "URGENT",
}

PART_STATUS_LABELS = {
    "pending": "Pending",
    "ordered": "Ordered",
    "received": "Received",
    "installed": "Installed",
}

STATUS_LABELS = {
    "received": "Received",
    "diagnosed": "Diagnosed",
    "quoted": "Quoted",
    "approved": "Approved",
    "parts_pending": "Parts Pending",
    "in_repair": "In Repair",
    "ready": "Ready",
    "invoiced": "Invoiced",
    "completed": "Completed",
    "declined": "Declined",
    "beyond_economical_repair": "Beyond Economical Repair",
    "abandoned": "Abandoned",
    "closed": "Closed",
}


_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt_date(dt) -> str:
    """Format date as 'May 31, 2026' (short month, matching formatDateShortPacific)."""
    if dt is None:
        return "\u2014"  # em-dash like PrintWorkOrder
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    pacific_dt = dt.astimezone(_PACIFIC)
    return f"{_SHORT_MONTHS[pacific_dt.month - 1]} {pacific_dt.day}, {pacific_dt.year}"


def _fmt_datetime_now() -> str:
    """Format current time as 'Jun 1, 2026, 12:04 AM' (matching formatDatePacific)."""
    now = datetime.now(_PACIFIC)
    hour = now.hour
    minute = now.minute
    am_pm = "AM" if hour < 12 else "PM"
    display_hour = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)
    return f"{_SHORT_MONTHS[now.month - 1]} {now.day}, {now.year}, {display_hour}:{minute:02d} {am_pm}"


def _safe(val) -> str:
    """Convert value to a latin-1 safe string for fpdf2 built-in fonts."""
    if val is None:
        return ""
    text = str(val)
    # Replace common Unicode characters that latin-1 can't encode
    replacements = {
        "\u2014": "--",   # em-dash
        "\u2013": "-",    # en-dash
        "\u2018": "'",    # left single quote
        "\u2019": "'",    # right single quote
        "\u201c": '"',    # left double quote
        "\u201d": '"',    # right double quote
        "\u2026": "...",  # ellipsis
        "\u2022": "*",    # bullet
        "\u00a0": " ",    # non-breaking space
        "\u200b": "",     # zero-width space
    }
    for char, repl in replacements.items():
        text = text.replace(char, repl)
    # Fallback: replace any remaining non-latin-1 chars
    text = text.encode("latin-1", errors="replace").decode("latin-1")
    return text


class WorkOrderPDF(FPDF):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.set_auto_page_break(auto=True, margin=16.5)
        # Register Russo One font for company name header
        russo_path = os.path.join(_FONTS_DIR, "RussoOne-Regular.ttf")
        if os.path.isfile(russo_path):
            self.add_font("RussoOne", "", russo_path, uni=True)
            self._has_russo = True
        else:
            self._has_russo = False

    def header(self):
        pass  # Custom header drawn per page in generate

    def footer(self):
        pass

    def rounded_rect(self, x, y, w, h, r, style="D"):
        """Draw a rectangle with rounded corners. r = corner radius in mm."""
        from fpdf.enums import RenderStyle, Corner
        style_map = {"D": RenderStyle.D, "F": RenderStyle.F, "DF": RenderStyle.DF}
        rs = style_map.get(style, RenderStyle.D)
        corners = (Corner.TOP_LEFT, Corner.TOP_RIGHT, Corner.BOTTOM_RIGHT, Corner.BOTTOM_LEFT)
        self._draw_rounded_rect(x, y, w, h, rs, corners, r)


def generate_work_order_pdf(job: dict, business_info: dict = None, service_agreement: dict = None) -> bytes:
    """
    Generate a work order PDF for the given repair job.
    Returns PDF bytes.

    job: RepairJobResponse as dict
    business_info: dict with keys: companyName, phone, email, address (street)
    service_agreement: dict with 'sections' list from service_agreement collection
    """
    bi = business_info or {}
    company_name = bi.get("companyName") or bi.get("company_name") or "CNS Tool Repair"
    biz_address = (bi.get("address") or {})
    if isinstance(biz_address, dict):
        street = biz_address.get("street") or ""
        city = biz_address.get("city") or ""
        province = biz_address.get("province") or ""
        postal = biz_address.get("postalCode") or biz_address.get("postal_code") or ""
        # Match PrintWorkOrder.jsx: "street, city, province postalCode, country"
        province_postal = f"{province} {postal}".strip() if postal else province
        biz_addr_line = ", ".join(filter(None, [street, city, province_postal, "Canada"]))
    else:
        biz_addr_line = _safe(biz_address)
    biz_phone = bi.get("phone") or ""
    biz_email = bi.get("email") or ""

    wo_number = job.get("request_number") or "--"
    source_raw = job.get("source") or "drop_off"
    source_label = SOURCE_LABELS.get(source_raw, source_raw.replace("_", " ").title())
    print_date = _fmt_datetime_now()

    # Customer info
    cust_company = _safe(job.get("company_name"))
    first_name = _safe(job.get("first_name"))
    last_name = _safe(job.get("last_name"))
    cust_contact = f"{first_name} {last_name}".strip()
    cust_email = _safe(job.get("email"))
    cust_phone = _safe(job.get("phone"))
    cust_address = _safe(job.get("address"))

    tools = job.get("tools") or []

    # ─── Build PDF ───────────────────────────────────────────────
    # Browser prints US Letter (8.5" × 11"), not A4
    pdf = WorkOrderPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_margins(16.5, 17.8, 16.5)
    pdf.add_page()

    page_w = pdf.w - pdf.l_margin - pdf.r_margin  # usable width
    lm = pdf.l_margin

    # ── Header (matches PrintWorkOrder.jsx) ──────────────────────
    # Browser print renders CSS px ≈ 0.85 × PDF pt (Helvetica wider than Segoe UI)

    # Company name (left, Russo One font like PrintWorkOrder, black)
    hdr_y = pdf.t_margin  # start at top margin
    if pdf._has_russo:
        pdf.set_font("RussoOne", "", 15.5)  # CSS 20px
    else:
        pdf.set_font("Helvetica", "B", 15.5)
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(lm, hdr_y)
    pdf.cell(page_w * 0.6, 7, company_name.upper(), ln=0)

    # WO number (right, bold large, black, monospace-style)
    pdf.set_font("Courier", "B", 16.5)  # CSS 22px
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(lm + page_w * 0.6, hdr_y)
    pdf.cell(page_w * 0.4, 7, wo_number, align="R", ln=1)

    # Address line
    sub_y = hdr_y + 8
    pdf.set_font("Helvetica", "", 9)  # CSS 11px
    pdf.set_text_color(51, 51, 51)  # #333
    pdf.set_xy(lm, sub_y)
    pdf.cell(page_w * 0.6, 4, biz_addr_line, ln=0)

    # Date (right)
    pdf.set_xy(lm + page_w * 0.6, sub_y)
    pdf.cell(page_w * 0.4, 4, print_date, align="R", ln=1)

    # Phone/email line
    sub_y2 = sub_y + 4
    pdf.set_xy(lm, sub_y2)
    contact_line = " · ".join(filter(None, [biz_phone, biz_email]))
    pdf.cell(page_w * 0.6, 4, contact_line, ln=0)

    # Source (right)
    pdf.set_xy(lm + page_w * 0.6, sub_y2)
    pdf.cell(page_w * 0.4, 4, f"Source: {source_label}", align="R", ln=1)

    # Divider (2px solid black like PrintWorkOrder)
    div_y = sub_y2 + 7
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.5)
    pdf.line(lm, div_y, lm + page_w, div_y)
    pdf.set_line_width(0.2)
    pdf.set_y(div_y + 5)

    # ── Customer Information ─────────────────────────────────────
    y = pdf.get_y()
    pdf.set_font("Helvetica", "B", 8.5)  # section-title: CSS 10px
    pdf.set_text_color(85, 85, 85)  # #555
    pdf.set_xy(lm, y)
    pdf.cell(page_w, 4, "CUSTOMER INFORMATION", ln=1)

    pdf.set_draw_color(204, 204, 204)  # #ccc
    pdf.line(lm, pdf.get_y(), lm + page_w, pdf.get_y())
    pdf.ln(3)

    # Grid: Company | Contact | Email
    col_w = page_w / 3
    y = pdf.get_y()
    fields_row1 = [
        ("COMPANY", cust_company or "--"),
        ("CONTACT", cust_contact or "--"),
        ("EMAIL", cust_email or "--"),
    ]
    for i, (label, value) in enumerate(fields_row1):
        pdf.set_font("Helvetica", "B", 8.5)  # field-label: CSS 10px
        pdf.set_text_color(85, 85, 85)  # #555
        pdf.set_xy(lm + i * col_w, y)
        pdf.cell(col_w, 3.5, label, ln=0)

    pdf.ln(3.5)
    y2 = pdf.get_y()
    for i, (label, value) in enumerate(fields_row1):
        pdf.set_font("Helvetica", "", 8.75)  # body default: CSS 12px
        pdf.set_text_color(0, 0, 0)  # #000
        pdf.set_xy(lm + i * col_w, y2)
        pdf.cell(col_w, 4, value, ln=0)

    pdf.ln(5)

    # Row 2: Phone | Address (if present)
    y3 = pdf.get_y()
    pdf.set_font("Helvetica", "B", 8.5)  # field-label: CSS 10px
    pdf.set_text_color(85, 85, 85)  # #555
    pdf.set_xy(lm, y3)
    pdf.cell(col_w, 3.5, "PHONE", ln=0)
    if cust_address:
        pdf.set_xy(lm + col_w, y3)
        pdf.cell(col_w * 2, 3.5, "ADDRESS", ln=0)
    pdf.ln(3.5)

    y4 = pdf.get_y()
    pdf.set_font("Helvetica", "", 10)  # body default: CSS 12px
    pdf.set_text_color(0, 0, 0)  # #000
    pdf.set_xy(lm, y4)
    pdf.cell(col_w, 4, cust_phone or "--", ln=0)
    if cust_address:
        pdf.set_xy(lm + col_w, y4)
        pdf.cell(col_w * 2, 4, cust_address, ln=0)
    pdf.ln(6)

    # ── Tools ────────────────────────────────────────────────────
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 8.5)  # section-title: CSS 10px
    pdf.set_text_color(85, 85, 85)  # #555
    pdf.cell(page_w, 4, f"TOOLS ({len(tools)})", ln=1)
    pdf.set_draw_color(204, 204, 204)  # #ccc
    pdf.line(lm, pdf.get_y(), lm + page_w, pdf.get_y())
    pdf.ln(3)

    for idx, tool in enumerate(tools, start=1):
        brand = _safe(tool.get("brand"))
        model_number = _safe(tool.get("model_number"))
        tool_type = _safe(tool.get("tool_type"))
        quantity = tool.get("quantity") or 1
        serial = _safe(tool.get("serial_number"))
        priority = tool.get("priority") or "standard"
        warranty = tool.get("warranty") or False
        date_received = tool.get("date_received")
        est_completion = tool.get("estimated_completion")
        technician = _safe(tool.get("assigned_technician"))
        zoho_ref = _safe(tool.get("zoho_ref"))
        remarks = _safe(tool.get("remarks"))
        status = tool.get("status") or "received"

        # Tool card
        card_y = pdf.get_y()
        pdf.set_fill_color(255, 255, 255)
        pdf.set_draw_color(204, 204, 204)  # #ccc
        pdf.set_line_width(0.2)

        # Tool header: #num box + "Brand Model · Type ×Qty · S/N: xxx" + badges
        # Matches PrintWorkOrder.jsx tool-header layout
        card_pad = 4  # internal padding mm (CSS: padding 12px ~ 4.2mm)
        num_box = 7   # #num square size

        # #num box (bg:#f5f5f5, border:#ccc, rounded)
        num_x = lm + card_pad
        num_y = card_y + card_pad
        pdf.set_fill_color(245, 245, 245)
        pdf.set_draw_color(204, 204, 204)
        pdf.rounded_rect(num_x, num_y, num_box, num_box, 2, style="DF")  # border-radius: 6px ~ 2mm
        pdf.set_font("Helvetica", "B", 9)  # tool-num: CSS 11px
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(num_x, num_y)
        pdf.cell(num_box, num_box, f"#{idx}", align="C")

        # Title on one line: "Brand Model · Type ×Qty · S/N: xxx"
        # Bold part: "Brand Model", then normal: " · Type ×Qty · S/N: xxx"
        title_x = num_x + num_box + 3
        title_y = num_y + 1
        pdf.set_xy(title_x, title_y)
        bold_part = f"{brand} {model_number}".strip()
        pdf.set_font("Helvetica", "B", 10)  # tool-title strong: CSS 13px
        pdf.set_text_color(0, 0, 0)
        bold_w = pdf.get_string_width(bold_part)
        pdf.cell(bold_w, 5, bold_part, ln=0)

        # Muted part after bold, same line
        muted_parts = []
        if tool_type:
            muted_parts.append(tool_type)
        if quantity > 1:
            muted_parts.append(f"x {quantity}")
        if serial:
            muted_parts.append(f"S/N: {serial}")
        if muted_parts:
            muted_str = " · " + " · ".join(muted_parts)
            pdf.set_font("Helvetica", "", 10)  # tool-title .muted: CSS 13px
            pdf.set_text_color(51, 51, 51)  # #333
            pdf.cell(0, 5, muted_str, ln=0)

        # Badges (right-aligned, same row as title)
        has_badges = priority in PRIORITY_LABELS or warranty
        if has_badges:
            badge_x = lm + page_w - card_pad
            badges = []
            if warranty:
                badges.append(("Warranty", False))
            if priority in PRIORITY_LABELS:
                badges.append((PRIORITY_LABELS[priority], priority == "urgent"))
            for blabel, is_filled in reversed(badges):
                pdf.set_font("Helvetica", "B", 8.5)  # badge: CSS 10px
                bw = pdf.get_string_width(blabel) + 8
                badge_x -= bw
                pdf.set_xy(badge_x, title_y)
                pdf.set_draw_color(0, 0, 0)
                if is_filled:
                    pdf.set_fill_color(0, 0, 0)
                    pdf.set_text_color(255, 255, 255)
                else:
                    pdf.set_fill_color(255, 255, 255)
                    pdf.set_text_color(0, 0, 0)
                pdf.cell(bw, 5, blabel, fill=True, border=1, align="C", ln=0)
                badge_x -= 2

        pdf.set_y(card_y + card_pad + num_box + 4.5)

        # Details grid: Received | Est. Completion | Technician | Zoho Ref
        detail_y = pdf.get_y()
        dcol_w = page_w / 4
        labels_row = ["RECEIVED", "EST. COMPLETION", "TECHNICIAN", "ZOHO REF"]
        values_row = [
            _safe(_fmt_date(date_received)),
            _safe(_fmt_date(est_completion)),
            technician or "--",
            zoho_ref or "--",
        ]

        for i, lbl in enumerate(labels_row):
            pdf.set_font("Helvetica", "B", 8.5)  # field-label: CSS 10px
            pdf.set_text_color(85, 85, 85)  # #555
            pdf.set_xy(lm + card_pad + i * dcol_w, detail_y)
            pdf.cell(dcol_w, 3.5, lbl, ln=0)

        pdf.ln(3.5)
        val_y = pdf.get_y()
        for i, val in enumerate(values_row):
            pdf.set_font("Helvetica", "", 8.75)  # body default: CSS 12px
            pdf.set_text_color(0, 0, 0)  # #000
            pdf.set_xy(lm + card_pad + i * dcol_w, val_y)
            pdf.cell(dcol_w, 4, val, ln=0)

        pdf.ln(4)

        # Remarks
        if remarks:
            rem_y = pdf.get_y()
            pdf.set_font("Helvetica", "B", 8.5)  # field-label: CSS 10px
            pdf.set_text_color(85, 85, 85)  # #555
            pdf.set_xy(lm, rem_y)
            pdf.cell(page_w, 3.5, "REMARKS", ln=1)
            pdf.set_font("Helvetica", "", 9)  # remarks: CSS 11px
            pdf.set_text_color(0, 0, 0)  # #000
            pdf.set_xy(lm, pdf.get_y())
            pdf.multi_cell(page_w, 4.5, remarks)

        # Parts table (matches PrintWorkOrder.jsx — 11px body, 10px uppercase header)
        parts = [p for p in (tool.get("parts") or []) if (p.get("name") or "").strip()]
        if parts:
            pdf.ln(2)
            tbl_x = lm + card_pad  # indent table inside card padding
            tbl_w = page_w - card_pad * 2  # table width inside card
            col_widths = [tbl_w * 0.47, tbl_w * 0.07, tbl_w * 0.10, tbl_w * 0.15, tbl_w * 0.11, tbl_w * 0.10]
            headers = ["PART", "QTY", "PRICE", "SUPPLIER", "STATUS", "TOTAL"]
            aligns = ["L", "C", "R", "L", "C", "R"]
            # Header row
            pdf.set_font("Helvetica", "B", 7.5)  # parts-table th: CSS 9px
            pdf.set_text_color(51, 51, 51)  # #333
            pdf.set_fill_color(255, 255, 255)  # white
            pdf.set_draw_color(204, 204, 204)  # #ccc
            for ci, hdr in enumerate(headers):
                pdf.set_x(tbl_x + sum(col_widths[:ci]))
                pdf.cell(col_widths[ci], 7, hdr, border=1, fill=True, align=aligns[ci], ln=0)
            pdf.ln()

            # Data rows
            parts_total = 0.0
            for p in parts:
                p_name = _safe(p.get("name"))
                p_num = _safe(p.get("part_number"))
                p_label = f"{p_name} - {p_num}" if p_num else p_name
                p_qty = p.get("quantity") or 1
                p_price = p.get("price")
                p_supplier = _safe(p.get("supplier")) or "--"
                p_status = _safe(PART_STATUS_LABELS.get(p.get("status", ""), p.get("status", "")))
                if p_price is not None and p_price != "":
                    price_val = float(p_price)
                    line_total = price_val * p_qty
                    parts_total += line_total
                    price_str = f"${price_val:.2f}"
                    total_str = f"${line_total:.2f}"
                else:
                    price_str = "--"
                    total_str = "--"

                pdf.set_font("Helvetica", "", 8)  # parts-table body: CSS 10px
                pdf.set_text_color(0, 0, 0)
                pdf.set_fill_color(255, 255, 255)  # reset fill to white so header grey doesn't bleed
                pdf.set_draw_color(204, 204, 204)  # #ccc
                row_data = [p_label, str(p_qty), price_str, p_supplier, p_status, total_str]
                for ci, val in enumerate(row_data):
                    pdf.set_x(tbl_x + sum(col_widths[:ci]))
                    pdf.cell(col_widths[ci], 7, val, border=1, fill=True, align=aligns[ci], ln=0)
                pdf.ln()

            # Subtotal row
            if parts_total > 0:
                pdf.set_font("Helvetica", "B", 9)  # match parts-table body
                pdf.set_text_color(0, 0, 0)
                pdf.set_draw_color(226, 232, 240)  # #e2e8f0
                sub_w = sum(col_widths[:5])
                pdf.set_x(tbl_x)
                pdf.cell(sub_w, 6, "Parts Subtotal", border="T", align="R", ln=0)
                pdf.cell(col_widths[5], 6, f"${parts_total:.2f}", border="T", align="R", ln=1)

        # Close card border (#ccc matching PrintWorkOrder)
        card_bottom = pdf.get_y() + 3.5
        pdf.set_draw_color(204, 204, 204)  # #ccc
        pdf.rounded_rect(lm, card_y, page_w, card_bottom - card_y, 3)  # border-radius: 8px ~ 3mm
        pdf.set_y(card_bottom + 4)

    # ── Service Agreement (matches PrintWorkOrder.jsx terms styling) ──
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 7.5)  # terms-title: CSS 9px
    pdf.set_text_color(85, 85, 85)  # #555
    pdf.cell(page_w, 3.5, "SERVICE AGREEMENT", ln=1)
    pdf.ln(1.5)

    if service_agreement and service_agreement.get("sections"):
        sections = service_agreement["sections"]
    else:
        # Fallback default
        sections = [
            {
                "title": "WARRANTY COVERAGE",
                "items": [
                    "A 1-month warranty is provided on all parts replaced and labour performed, under normal use and conditions.",
                    "Warranty does not cover: normal wear and tear, misuse, improper use, poor maintenance (including air supply issues), accidental or external damage, or parts or components not listed on this work order.",
                    "Warranty is void if the tool is opened, modified, or repaired by anyone other than CNS Tool Repair.",
                    "All warranty claims require in-shop inspection. Our technicians will assess whether the failure is covered.",
                ],
            },
            {
                "title": "AIR SUPPLY REQUIREMENTS",
                "items": [
                    "Tools must be operated with clean, dry, regulated air at 90 PSI.",
                    "Minimum 3/8\" air hose required. For high-demand tools, 1/2\" hose is strongly recommended.",
                    "Operating outside these requirements may cause poor performance, premature wear, or damage - and will void the warranty.",
                ],
            },
            {
                "title": "GENERAL",
                "items": [
                    "CNS Tool Repair is not liable for pre-existing damage identified at intake and noted on this work order, or damage unrelated to the repair performed.",
                    "Estimates are provided free of charge. If a repair is declined, the tool will be returned in a disassembled state. Reassembly is not included. Do not attempt to operate a disassembled tool - doing so may cause injury or further damage.",
                    "Unclaimed tools after 30 days will be considered abandoned and may be disposed of or sold to recover costs.",
                ],
            },
        ]

    for section in sections:
        title = _safe(section.get("title")).upper()
        items = section.get("items") or []

        pdf.set_font("Helvetica", "B", 7.5)  # terms-sub: CSS 9px
        pdf.set_text_color(85, 85, 85)  # #555
        pdf.cell(page_w, 3.5, title, ln=1)
        pdf.ln(0.5)

        for i, item in enumerate(items, start=1):
            pdf.set_font("Helvetica", "", 6.75)  # terms: CSS 9px
            pdf.set_text_color(51, 51, 51)  # #333
            # Items from MongoDB are {"text": "..."} dicts; fallback items are plain strings
            item_text = item.get("text") if isinstance(item, dict) else item
            prefix = f"{i}. "
            prefix_w = pdf.get_string_width(prefix) + 0.5
            pdf.set_x(lm)
            pdf.cell(prefix_w, 4, prefix, ln=0)
            pdf.multi_cell(page_w - prefix_w, 4, _safe(item_text))

        pdf.ln(2.5)

    # ── Signature Line (matches PrintWorkOrder.jsx) ──────────────
    pdf.ln(4)
    sig_x = lm + page_w * 0.55
    sig_width = page_w * 0.45
    sig_y = pdf.get_y() + 5
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.3)
    pdf.line(sig_x, sig_y, sig_x + sig_width, sig_y)
    pdf.set_font("Helvetica", "", 8.5)  # signature-box: CSS 10px
    pdf.set_text_color(51, 51, 51)  # #333
    pdf.set_xy(sig_x, sig_y + 1.5)
    pdf.cell(sig_width, 3.5, "Customer Signature & Date", align="L")

    return bytes(pdf.output())
