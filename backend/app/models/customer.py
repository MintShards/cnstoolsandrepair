from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
import re

# A profile's other addresses — the people at a company who also want the
# work order (accounts payable, the site office…). `email` stays the main
# one: it is the address a customer is found by and the one copied onto
# their work orders. The Send Work Order window lists the others ticked
# beside it, so one email goes to all of them.
MAX_ADDITIONAL_EMAILS = 10


def _drop_blank_emails(v):
    """Empty rows from the form are not addresses; drop them before validation."""
    if isinstance(v, (list, tuple)):
        return [e.strip() if isinstance(e, str) else e
                for e in v if not (isinstance(e, str) and not e.strip())]
    return v


def normalize_additional_emails(emails, main_email: Optional[str] = None) -> List[str]:
    """Lower-cased and de-duplicated, in the order typed, never the main email."""
    main = (main_email or "").strip().lower()
    out: List[str] = []
    for e in emails or []:
        addr = str(e).strip().lower()
        if addr and addr != main and addr not in out:
            out.append(addr)
    return out


class CustomerCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=200)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    additional_emails: List[EmailStr] = Field(default_factory=list, max_length=MAX_ADDITIONAL_EMAILS)
    phone: str = Field(..., min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('company_name', 'address', 'customer_notes', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('additional_emails', mode='before')
    @classmethod
    def drop_blank_emails(cls, v):
        return _drop_blank_emails(v) or []

    @field_validator('phone')
    @classmethod
    def validate_phone_format(cls, v: str) -> str:
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class CustomerUpdate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=200)
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    # Left out of the request = untouched (the work order dialog's customer
    # form does not send it); a list, even an empty one, replaces what is there.
    additional_emails: Optional[List[EmailStr]] = Field(None, max_length=MAX_ADDITIONAL_EMAILS)
    phone: Optional[str] = Field(None, min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('company_name', 'address', 'customer_notes', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('additional_emails', mode='before')
    @classmethod
    def drop_blank_emails(cls, v):
        return _drop_blank_emails(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone_format(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class CustomerResponse(BaseModel):
    id: str
    company_name: Optional[str] = None
    first_name: str
    last_name: str
    # Optional: customers converted from route-management prospects may not
    # have contact details yet — the tracker's own create form still requires
    # them, but reads must tolerate the converted ones.
    email: Optional[str] = None
    # Profiles from before the field existed simply have none.
    additional_emails: List[str] = Field(default_factory=list)
    phone: Optional[str] = None
    address: Optional[str] = None
    customer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('additional_emails', mode='before')
    @classmethod
    def none_is_no_emails(cls, v):
        return v or []
