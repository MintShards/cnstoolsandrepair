"""The work order PDF the customer email attaches.

It is the print's own HTML — PrintWorkOrder.jsx builds it in the browser and
the Send Work Order modal posts it with the send request — rendered by
WeasyPrint. One layout, so the emailed copy and Print / Save as PDF can
never drift (the old fpdf2 redraw of the page did, every time the print
changed).

The HTML never reaches the network from here: the Google Fonts link it
carries for Russo One is dropped and the bundled TTF used instead, and the
fetcher refuses every other URL. Letter paper, like the browser's print.
"""
import logging
import os
import re
from urllib.parse import unquote, urlparse

from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration
from weasyprint.urls import default_url_fetcher

logger = logging.getLogger(__name__)

_FONTS_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts"))
_RUSSO_ONE = os.path.join(_FONTS_DIR, "RussoOne-Regular.ttf")

_GOOGLE_FONTS_LINK = re.compile(r"<link[^>]+fonts\.googleapis\.com[^>]*>", re.IGNORECASE)

# Injected as the document's last <style>, so these win over the print
# sheet's own rules (a stylesheet passed from outside would not: author
# styles beat user styles): the bundled display font, and the paper size
# the sheet leaves at `auto`, which the browser resolves to the shop's
# locale — Letter.
_PRINT_CSS = f"""
@font-face {{ font-family: 'Russo One'; src: url('file://{_RUSSO_ONE}'); }}
@page {{ size: Letter; margin: 10mm; }}
"""


def _fetcher(url, timeout=10, ssl_context=None):
    """Bundled fonts and inline data only — no http(s), no other files."""
    if url.startswith("file://"):
        # The URL layer percent-encodes the path (a space in a dev checkout
        # arrives as %20); compare the real filesystem path.
        path = os.path.realpath(unquote(urlparse(url).path))
        if path.startswith(_FONTS_DIR + os.sep) and os.path.isfile(path):
            with open(path, "rb") as f:
                return {"string": f.read(), "mime_type": "font/ttf"}
    elif url.startswith("data:"):
        return default_url_fetcher(url, timeout=timeout, ssl_context=ssl_context)
    raise ValueError(f"The work order PDF does not fetch external resources: {url[:120]}")


def generate_work_order_pdf(work_order_html: str) -> bytes:
    """Render the posted work order HTML (PrintWorkOrder.jsx's full document) to PDF bytes."""
    html = _GOOGLE_FONTS_LINK.sub("", work_order_html or "")
    extra = f"<style>{_PRINT_CSS}</style>"
    html = html.replace("</head>", f"{extra}</head>", 1) if "</head>" in html else extra + html
    # One font configuration for the whole render, so the injected
    # @font-face is the one the page's text is shaped with.
    font_config = FontConfiguration()
    document = HTML(string=html, base_url=None, url_fetcher=_fetcher)
    return document.write_pdf(font_config=font_config)
