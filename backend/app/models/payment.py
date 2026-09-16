"""Payments — money IN: what customers actually paid on Zoho invoices,
entered by hand when the money lands.

Received-only by design: an invoice still waiting on the customer stays
visible on the tracker as an `invoiced` tool, and Zoho Books keeps the
receivable. Logging it here twice would only drift. Admin only, like bills.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.bill import Currency, PaymentMethod, blank_to_none, money_2dp
from app.models.repair import ActorRef
from app.models.task import YMD_PATTERN


class PaymentCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    repair_id: Optional[str] = None            # optional work-order link
    zoho_invoice_number: Optional[str] = Field(None, max_length=100)
    amount: float = Field(..., gt=0)
    currency: Currency = "CAD"
    received_date: Optional[str] = Field(None, pattern=YMD_PATTERN)   # router defaults to today
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("customer_name", "repair_id", "zoho_invoice_number", "received_date",
                     "payment_reference", "notes", mode="before")
    def strip_and_blank_to_none(cls, v):
        return blank_to_none(v)

    @field_validator("amount", mode="before")
    def money(cls, v):
        return money_2dp(v)


class PaymentUpdate(BaseModel):
    """Partial update; an explicit null clears an optional field."""
    customer_name: Optional[str] = Field(None, min_length=1, max_length=200)
    repair_id: Optional[str] = None
    zoho_invoice_number: Optional[str] = Field(None, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[Currency] = None
    received_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("customer_name", "repair_id", "zoho_invoice_number", "received_date",
                     "payment_reference", "notes", mode="before")
    def strip_and_blank_to_none(cls, v):
        return blank_to_none(v)

    @field_validator("amount", mode="before")
    def money(cls, v):
        return money_2dp(v)


class PaymentResponse(BaseModel):
    id: str
    payment_number: str
    customer_name: str
    repair_id: Optional[str] = None
    request_number: Optional[str] = None       # snapshot of the linked work order
    zoho_invoice_number: Optional[str] = None
    amount: float
    currency: Currency = "CAD"
    received_date: str
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[ActorRef] = None
    created_at: datetime
    updated_at: datetime
