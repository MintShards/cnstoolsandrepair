from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class UrgencyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class QuoteStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    QUOTED = "quoted"
    APPROVED = "approved"
    REJECTED = "rejected"


class QuoteCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    contact_person: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    tool_type: str = Field(..., min_length=1, max_length=100)
    tool_brand: str = Field(..., min_length=1, max_length=100)
    tool_model: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(..., gt=0, le=1000)
    problem_description: str = Field(..., min_length=10, max_length=2000)
    urgency_level: UrgencyLevel = UrgencyLevel.MEDIUM
    photos: List[str] = Field(default_factory=list)


class Quote(QuoteCreate):
    id: str = Field(alias="_id")
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
                "tool_type": "Impact Wrench",
                "tool_brand": "Ingersoll Rand",
                "tool_model": "2135TIMAX",
                "quantity": 3,
                "problem_description": "Loss of power and unusual noise during operation",
                "urgency_level": "high",
                "photos": ["photo1.jpg", "photo2.jpg"],
                "status": "pending",
                "created_at": "2024-02-08T10:00:00Z",
                "updated_at": "2024-02-08T10:00:00Z",
            }
        }


class QuoteResponse(BaseModel):
    id: str
    company_name: str
    contact_person: str
    email: str
    phone: str
    tool_type: str
    tool_brand: str
    tool_model: str
    quantity: int
    problem_description: str
    urgency_level: str
    photos: List[str]
    status: str
    created_at: datetime
    updated_at: datetime
