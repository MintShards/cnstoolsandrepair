from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
import re


class SourcingRecipient(BaseModel):
    email: str = Field(..., max_length=200)
    name: Optional[str] = Field(None, max_length=200)
    supplier_id: Optional[str] = None

    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v):
        if not v or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', v.strip()):
            raise ValueError('Invalid email address')
        return v.strip().lower()


class SourcingPart(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    part_number: Optional[str] = Field(None, max_length=100)
    quantity: int = Field(default=1, gt=0)
    repair_id: Optional[str] = None
    request_number: Optional[str] = None
    tool_index: Optional[int] = None
    part_index: Optional[int] = None


class SourcingRequest(BaseModel):
    recipients: List[SourcingRecipient] = Field(..., min_length=1)
    parts: List[SourcingPart] = Field(..., min_length=1)
    message: Optional[str] = Field(None, max_length=2000)
    subject: Optional[str] = Field(None, max_length=200)


class SourcingQueueItem(BaseModel):
    repair_id: str
    request_number: str
    tool_index: int
    tool_id: str
    tool_type: str
    tool_brand: Optional[str] = None
    tool_model: Optional[str] = None
    part_index: int
    part: dict


class SourcingLogEntry(BaseModel):
    id: str
    sent_at: datetime
    recipients: List[dict]
    parts: List[dict]
    subject: str
    message: Optional[str] = None
    status: str
    sent_count: int
    failed_count: int
    errors: List[dict]
