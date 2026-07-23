from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
from zoneinfo import ZoneInfo
import re
import uuid


class RepairStatus(str, Enum):
    RECEIVED = "received"
    DIAGNOSED = "diagnosed"
    QUOTED = "quoted"
    APPROVED = "approved"
    DECLINED = "declined"
    PARTS_PENDING = "parts_pending"
    IN_REPAIR = "in_repair"
    READY = "ready"
    INVOICED = "invoiced"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    CLOSED = "closed"
    BEYOND_ECONOMICAL_REPAIR = "beyond_economical_repair"


ALLOWED_TRANSITIONS = {
    "received":                  {"diagnosed", "abandoned"},
    "diagnosed":                 {"quoted", "beyond_economical_repair", "received", "abandoned"},
    "quoted":                    {"approved", "declined", "diagnosed", "abandoned"},
    "approved":                  {"parts_pending", "in_repair", "quoted", "abandoned"},
    "declined":                  {"closed", "abandoned"},
    "beyond_economical_repair":  {"closed", "quoted", "abandoned"},
    "parts_pending": {"in_repair", "quoted", "approved", "abandoned"},
    "in_repair":     {"ready", "parts_pending", "approved", "abandoned"},
    "ready":         {"invoiced", "in_repair", "abandoned"},
    "invoiced":      {"completed", "ready", "abandoned"},
    "completed":     {"closed"},
    "abandoned":     {"closed"},
    "closed":        set(),
}

MAIN_STAGES = [
    "received", "diagnosed", "quoted", "approved",
    "parts_pending", "in_repair", "ready", "invoiced"
]


def validate_status_transition(current: str, new: str) -> bool:
    return new in ALLOWED_TRANSITIONS.get(current, set())


class RepairSource(str, Enum):
    ONLINE_REQUEST = "online_request"
    DROP_OFF = "drop_off"
    PHONE_IN = "phone_in"
    EMAIL = "email"


class Priority(str, Enum):
    STANDARD = "standard"
    RUSH = "rush"
    URGENT = "urgent"


class PartStatus(str, Enum):
    PENDING = "pending"
    ORDERED = "ordered"
    IN_STOCK = "in_stock"
    RECEIVED = "received"
    INSTALLED = "installed"


class PartItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(default=1, gt=0)
    price: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=200)
    order_link: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=500)
    status: PartStatus = PartStatus.PENDING
    order_date: Optional[datetime] = None
    eta: Optional[datetime] = None
    date_received: Optional[datetime] = None
    tracking: Optional[str] = Field(None, max_length=200)
    part_number: Optional[str] = Field(None, max_length=100)
    library_part_id: Optional[str] = Field(None, max_length=50)
    needs_sourcing: bool = False
    sourcing_emailed: bool = False

    @field_validator('price', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('name', 'supplier', 'part_number', 'library_part_id',
                     'tracking', 'order_link', 'notes', mode='before')
    @classmethod
    def strip_optional_strings(cls, v):
        # Part forms historically sent '' for unset fields; store None so
        # analytics/sourcing don't group on phantom empty values.
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v

    @field_validator('eta', 'order_date', 'date_received', mode='before')
    @classmethod
    def parse_date_string(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str) and len(v) == 10:
            # Date-only string like "2026-05-10" from <input type="date">
            return datetime.fromisoformat(v)
        return v


class StatusHistoryEntry(BaseModel):
    status: RepairStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(None, max_length=1000)


class ToolItemCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

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
    zoho_ref: Optional[str] = Field(None, max_length=100)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    photos: List[str] = Field(default_factory=list)
    date_received: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Vancouver")).replace(tzinfo=None))
    estimated_completion: Optional[datetime] = None

    @field_validator('tool_type', 'brand', 'model_number', mode='before')
    @classmethod
    def capitalize_fields(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('labour_hours', 'hourly_rate', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('estimated_completion', mode='before')
    @classmethod
    def parse_date_string(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str) and len(v) == 10:
            return datetime.fromisoformat(v)
        return v


class ToolItemUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

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
    zoho_ref: Optional[str] = Field(None, max_length=100)
    assigned_technician: Optional[str] = Field(None, max_length=100)
    estimated_completion: Optional[datetime] = None

    @field_validator('tool_type', 'brand', 'model_number', mode='before')
    @classmethod
    def capitalize_fields(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('labour_hours', 'hourly_rate', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('estimated_completion', mode='before')
    @classmethod
    def parse_date_string(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str) and len(v) == 10:
            return datetime.fromisoformat(v)
        return v


class ToolStatusUpdate(BaseModel):
    status: RepairStatus
    notes: Optional[str] = Field(None, max_length=1000)
    estimated_completion: Optional[datetime] = None

    @field_validator('estimated_completion', mode='before')
    @classmethod
    def parse_date_string(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str) and len(v) == 10:
            return datetime.fromisoformat(v)
        return v


class ToolItem(ToolItemCreate):
    tool_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: RepairStatus = RepairStatus.RECEIVED
    date_completed: Optional[datetime] = None
    status_history: List[StatusHistoryEntry] = Field(default_factory=list)


class ToolItemResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

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
    zoho_ref: Optional[str] = None
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
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=12, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    customer_notes: Optional[str] = Field(None, max_length=2000)
    source: RepairSource = RepairSource.DROP_OFF
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
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    customer_notes: Optional[str] = None
    source: RepairSource
    source_quote_id: Optional[str] = None
    tools: List[ToolItemResponse]
    work_order_emails_sent: Optional[List[dict]] = None
    created_at: datetime
    updated_at: datetime


class WorkOrderEmailSendRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    subject: Optional[str] = Field(None, max_length=300)
    custom_message: Optional[str] = Field(None, max_length=2000)


class BatchStatusItem(BaseModel):
    job_id: str
    tool_id: str
    new_status: RepairStatus
    notes: Optional[str] = Field(None, max_length=1000)


class BatchStatusRequest(BaseModel):
    items: List[BatchStatusItem] = Field(..., min_length=1, max_length=100)


class BatchStatusResult(BaseModel):
    job_id: str
    tool_id: str
    success: bool
    new_status: Optional[str] = None
    error: Optional[str] = None


class BatchStatusResponse(BaseModel):
    results: List[BatchStatusResult]
    success_count: int
    failure_count: int
