"""Bills — supplier bills and counter receipts (the buying side).

Named "bills" on purpose: "invoice" already means the CUSTOMER invoice in
this app (tracker status `invoiced`, `zoho_invoice_number`). Zoho Books stays
the accounting system; a bill here is the shop's operational record — what
came in, what is still owed, which work order it belonged to, with the
paper attached. Admin only.
"""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.repair import ActorRef
from app.models.task import YMD_PATTERN

BillStatus = Literal["unpaid", "paid", "disputed", "void"]
# A bill is logged as owed or as already paid (counter receipt) — never
# straight into disputed/void.
BillCreateStatus = Literal["unpaid", "paid"]
BillCategory = Literal["parts", "consumables", "tools_equipment", "services", "other"]
PaymentMethod = Literal["card", "e_transfer", "cheque", "cash", "account"]
Currency = Literal["CAD", "USD"]
# What a bill line paid for. "part" feeds a work order's parts cost; the rest
# are its additional expenses (freight, sublet machining, anything else).
BillLineKind = Literal["part", "shipping", "outsourced", "other"]

BILL_LINE_KIND_LABELS = {
    "part": "Part", "shipping": "Shipping & freight",
    "outsourced": "Outsourced work", "other": "Other",
}

BILL_STATUS_LABELS = {
    "unpaid": "Unpaid", "paid": "Paid", "disputed": "Disputed", "void": "Void",
}
BILL_CATEGORY_LABELS = {
    "parts": "Parts", "consumables": "Consumables", "tools_equipment": "Tools & equipment",
    "services": "Services", "other": "Other",
}

# paid → void is deliberately absent: a mis-entered paid bill is undone first
# (paid → unpaid → void) so the history shows what happened.
ALLOWED_BILL_TRANSITIONS = {
    "unpaid": {"paid", "disputed", "void"},
    "disputed": {"unpaid", "paid", "void"},
    "paid": {"unpaid"},
    "void": {"unpaid"},
}

PAYMENT_FIELDS = ("paid_date", "payment_method", "payment_reference")


def validate_bill_transition(current: str, new: str) -> None:
    """Raise ValueError (message lists the allowed targets) on a bad move."""
    if new == current:
        raise ValueError(f"Bill is already {BILL_STATUS_LABELS.get(current, current)}")
    allowed = ALLOWED_BILL_TRANSITIONS.get(current, set())
    if new not in allowed:
        options = ", ".join(BILL_STATUS_LABELS[s] for s in sorted(allowed)) or "nothing"
        raise ValueError(
            f"Cannot change {BILL_STATUS_LABELS.get(current, current)} to "
            f"{BILL_STATUS_LABELS.get(new, new)}. Allowed: {options}"
        )


def blank_to_none(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def money_2dp(v):
    """Empty strings clear; everything else is stored at two decimals."""
    if v is None or v == "":
        return None
    return round(float(v), 2)


class BillLine(BaseModel):
    description: str = Field(..., min_length=1, max_length=300)
    part_number: Optional[str] = Field(None, max_length=100)
    quantity: float = Field(1, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    # Computed server-side from quantity × unit_price; never trusted from the client.
    line_total: Optional[float] = None
    repair_id: Optional[str] = None
    request_number: Optional[str] = None  # snapshot, set by the router
    kind: BillLineKind = "part"
    # Which tool on that work order the line was for; None = shared by the
    # whole job. tool_label is a snapshot set by the router.
    tool_id: Optional[str] = None
    tool_label: Optional[str] = None

    @field_validator("description", "part_number", "repair_id", "request_number",
                     "tool_id", "tool_label", mode="before")
    def strip_andblank_to_none(cls, v):
        return blank_to_none(v)

    @field_validator("kind", mode="before")
    def default_kind(cls, v):
        return blank_to_none(v) or "part"

    @field_validator("unit_price", "line_total", mode="before")
    def money(cls, v):
        return money_2dp(v)


class BillAttachment(BaseModel):
    url: str
    kind: Literal["image", "pdf"]
    filename: Optional[str] = None
    uploaded_at: datetime
    by: Optional[ActorRef] = None


class BillStatusHistoryEntry(BaseModel):
    status: BillStatus
    timestamp: datetime
    notes: Optional[str] = None
    by: Optional[ActorRef] = None


class BillCreate(BaseModel):
    supplier_id: Optional[str] = None
    # Required when there is no supplier_id (one-off vendor); with an id the
    # router snapshots the supplier's current name instead.
    supplier_name: Optional[str] = Field(None, max_length=200)
    vendor_invoice_number: Optional[str] = Field(None, max_length=100)
    category: BillCategory = "parts"
    status: BillCreateStatus = "unpaid"
    bill_date: Optional[str] = Field(None, pattern=YMD_PATTERN)   # router defaults to today
    due_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    paid_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=100)
    subtotal: Optional[float] = Field(None, ge=0)
    gst: Optional[float] = Field(None, ge=0)
    pst: Optional[float] = Field(None, ge=0)
    total: float = Field(..., gt=0)
    currency: Currency = "CAD"
    lines: List[BillLine] = Field(default_factory=list, max_length=50)
    zoho_bill_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("supplier_id", "supplier_name", "vendor_invoice_number", "bill_date",
                     "due_date", "paid_date", "payment_reference", "zoho_bill_number",
                     "notes", mode="before")
    def strip_andblank_to_none(cls, v):
        return blank_to_none(v)

    @field_validator("subtotal", "gst", "pst", "total", mode="before")
    def money(cls, v):
        return money_2dp(v)

    @model_validator(mode="after")
    def supplier_and_payment_rules(self):
        if not self.supplier_id and not self.supplier_name:
            raise ValueError("Supplier is required")
        if self.status != "paid" and any(getattr(self, f) is not None for f in PAYMENT_FIELDS):
            raise ValueError("Mark the bill paid to set payment details")
        return self


class BillUpdate(BaseModel):
    """Partial update. Fields left unset are untouched; an explicit null
    clears an optional field. Status, attachments and history have their
    own routes so every change lands in the history."""
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = Field(None, max_length=200)
    vendor_invoice_number: Optional[str] = Field(None, max_length=100)
    category: Optional[BillCategory] = None
    bill_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    due_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    paid_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=100)
    subtotal: Optional[float] = Field(None, ge=0)
    gst: Optional[float] = Field(None, ge=0)
    pst: Optional[float] = Field(None, ge=0)
    total: Optional[float] = Field(None, gt=0)
    currency: Optional[Currency] = None
    lines: Optional[List[BillLine]] = Field(None, max_length=50)
    zoho_bill_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("supplier_id", "supplier_name", "vendor_invoice_number", "bill_date",
                     "due_date", "paid_date", "payment_reference", "zoho_bill_number",
                     "notes", mode="before")
    def strip_andblank_to_none(cls, v):
        return blank_to_none(v)

    @field_validator("subtotal", "gst", "pst", "total", mode="before")
    def money(cls, v):
        return money_2dp(v)


class BillStatusUpdate(BaseModel):
    status: BillStatus
    notes: Optional[str] = Field(None, max_length=1000)
    paid_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=100)

    @field_validator("notes", "paid_date", "payment_reference", mode="before")
    def strip_andblank_to_none(cls, v):
        return blank_to_none(v)


class BillResponse(BaseModel):
    id: str
    bill_number: str
    supplier_id: Optional[str] = None
    supplier_name: str
    vendor_invoice_number: Optional[str] = None
    category: BillCategory
    status: BillStatus
    bill_date: str
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    subtotal: Optional[float] = None
    gst: Optional[float] = None
    pst: Optional[float] = None
    total: float
    currency: Currency = "CAD"
    lines: List[BillLine] = []
    attachments: List[BillAttachment] = []
    zoho_bill_number: Optional[str] = None
    notes: Optional[str] = None
    status_history: List[BillStatusHistoryEntry] = []
    created_by: Optional[ActorRef] = None
    created_at: datetime
    updated_at: datetime
