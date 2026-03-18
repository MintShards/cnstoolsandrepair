from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
import re


class QuoteStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    QUOTED = "quoted"
    COMPLETED = "completed"


class ToolEntry(BaseModel):
    """Individual tool entry within a quote request"""
    tool_type: str = Field(..., min_length=1, max_length=100)
    tool_brand: str = Field(..., min_length=1, max_length=100)
    tool_model: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(..., gt=0, le=1000)
    problem_description: str = Field(..., min_length=10, max_length=2000)


class QuoteCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=200)
    contact_person: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=12, max_length=12, pattern=r'^\d{3}-\d{3}-\d{4}$')
    tools: List[ToolEntry] = Field(..., min_length=1, max_length=5, description="List of tools (1-5)")
    photos: List[str] = Field(default_factory=list)

    @field_validator('phone')
    @classmethod
    def validate_phone_format(cls, v: str) -> str:
        """Validate phone number format (###-###-####)"""
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class Quote(QuoteCreate):
    id: str = Field(alias="_id")
    request_number: str = Field(..., description="User-friendly request ID (e.g., REQ-2026-0001)")
    status: QuoteStatus = QuoteStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "company_name": "Apex Manufacturing",
                "contact_person": "John Smith",
                "email": "john@apexmfg.com",
                "phone": "604-555-0123",
                "tools": [
                    {
                        "tool_type": "Impact Wrench",
                        "tool_brand": "Ingersoll Rand",
                        "tool_model": "2135TIMAX",
                        "quantity": 2,
                        "problem_description": "Loss of power and unusual noise during operation"
                    },
                    {
                        "tool_type": "Air Compressor",
                        "tool_brand": "DeWalt",
                        "tool_model": "D55146",
                        "quantity": 1,
                        "problem_description": "Won't start, makes clicking sound"
                    }
                ],
                "photos": ["photo1.jpg", "photo2.jpg"],
                "status": "pending",
                "created_at": "2024-02-08T10:00:00Z",
                "updated_at": "2024-02-08T10:00:00Z",
            }
        }


class QuoteUpdate(BaseModel):
    """Model for updating quote status"""
    status: QuoteStatus


class QuoteResponse(BaseModel):
    id: str
    request_number: str = "REQ-LEGACY"  # Default for legacy quotes without request numbers
    company_name: Optional[str] = None
    contact_person: str
    email: str
    phone: str
    tools: List[ToolEntry] = []  # Default to empty list for legacy quotes
    photos: List[str] = []  # Default to empty list for legacy quotes
    status: str = "pending"  # Default status
    created_at: datetime
    updated_at: datetime
    email_sent: bool = True  # Track if notification email was sent successfully
