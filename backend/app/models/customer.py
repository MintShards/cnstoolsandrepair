from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class CustomerCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=200)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    phone: str = Field(..., min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('company_name', 'address', 'customer_notes', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

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
    phone: Optional[str] = Field(None, min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('company_name', 'address', 'customer_notes', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

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
    email: str
    phone: str
    address: Optional[str] = None
    customer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
