from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
import re
import uuid


class RepairStatus(str, Enum):
    RECEIVED = "received"
    DISMANTLED = "dismantled"
    QUOTATION_SENT = "quotation_sent"
    APPROVED = "approved"
    DECLINED = "declined"
    RETURNED = "returned"
    CLOSED = "closed"
    ABANDONED = "abandoned"
    PARTS_ORDERED = "parts_ordered"
    PARTS_RECEIVED = "parts_received"
    IN_REPAIR = "in_repair"
    TESTING = "testing"
    READY_FOR_PICKUP = "ready_for_pickup"
    COMPLETED = "completed"


class RepairSource(str, Enum):
    ONLINE_REQUEST = "online_request"
    WALK_IN = "walk_in"


class Priority(str, Enum):
    STANDARD = "standard"
    RUSH = "rush"
    URGENT = "urgent"


class PartStatus(str, Enum):
    PENDING = "pending"
    ORDERED = "ordered"
    RECEIVED = "received"
    INSTALLED = "installed"


class PartItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(default=1, gt=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    status: PartStatus = PartStatus.PENDING


class StatusHistoryEntry(BaseModel):
    status: RepairStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(None, max_length=1000)


class ToolItemCreate(BaseModel):
    tool_type: str = Field(..., min_length=1, max_length=100)
    brand: str = Field(..., min_length=1, max_length=100)
    model_number: str = Field(..., min_length=1, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    quantity: int = Field(default=1, gt=0, le=1000)
    remarks: Optional[str] = Field(None, max_length=2000)
    parts: List[PartItem] = Field(default_factory=list)
    labour_hours: Optional[float] = Field(None, ge=0)
    hourly_rate: Optional[float] = Field(None, ge=0)
    priority: Priority = Priority.STANDARD
    warranty: bool = False
    zoho_quote_ref: Optional[str] = Field(None, max_length=100)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    photos: List[str] = Field(default_factory=list)
    date_received: datetime = Field(default_factory=datetime.utcnow)
    estimated_completion: Optional[datetime] = None

    @field_validator('tool_type', 'brand', 'model_number', mode='before')
    @classmethod
    def capitalize_fields(cls, v):
        if v:
            return v.strip().title()
        return v


class ToolItemUpdate(BaseModel):
    tool_type: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, min_length=1, max_length=100)
    model_number: Optional[str] = Field(None, min_length=1, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = Field(None, gt=0, le=1000)
    remarks: Optional[str] = Field(None, max_length=2000)
    parts: Optional[List[PartItem]] = None
    labour_hours: Optional[float] = Field(None, ge=0)
    hourly_rate: Optional[float] = Field(None, ge=0)
    priority: Optional[Priority] = None
    warranty: Optional[bool] = None
    zoho_quote_ref: Optional[str] = Field(None, max_length=100)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    estimated_completion: Optional[datetime] = None

    @field_validator('tool_type', 'brand', 'model_number', mode='before')
    @classmethod
    def capitalize_fields(cls, v):
        if v:
            return v.strip().title()
        return v


class ToolStatusUpdate(BaseModel):
    status: RepairStatus
    notes: Optional[str] = Field(None, max_length=1000)
    estimated_completion: Optional[datetime] = None


class ToolItem(ToolItemCreate):
    tool_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: RepairStatus = RepairStatus.RECEIVED
    date_completed: Optional[datetime] = None
    status_history: List[StatusHistoryEntry] = Field(default_factory=list)


class ToolItemResponse(BaseModel):
    tool_id: str
    tool_type: str
    brand: str
    model_number: str
    serial_number: Optional[str] = None
    quantity: int
    remarks: Optional[str] = None
    parts: List[PartItem] = Field(default_factory=list)
    labour_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    priority: Priority
    warranty: bool
    zoho_quote_ref: Optional[str] = None
    assigned_technician: Optional[str] = None
    photos: List[str]
    status: RepairStatus
    date_received: datetime
    estimated_completion: Optional[datetime] = None
    date_completed: Optional[datetime] = None
    status_history: List[StatusHistoryEntry]


class RepairJobCreate(BaseModel):
    customer_id: Optional[str] = None
    company_name: Optional[str] = Field(None, max_length=200)
    contact_person: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)
    source: RepairSource = RepairSource.WALK_IN
    source_quote_id: Optional[str] = None
    tools: List[ToolItemCreate] = Field(..., min_length=1)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone_format(cls, v):
        if v is None:
            return v
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class RepairJobUpdate(BaseModel):
    customer_id: Optional[str] = None
    company_name: Optional[str] = Field(None, max_length=200)
    contact_person: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone_format(cls, v):
        if v is None:
            return v
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class RepairJobResponse(BaseModel):
    id: str
    request_number: str
    customer_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    customer_notes: Optional[str] = None
    source: RepairSource
    source_quote_id: Optional[str] = None
    tools: List[ToolItemResponse]
    created_at: datetime
    updated_at: datetime
