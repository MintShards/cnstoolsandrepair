from datetime import datetime
from typing import List, Optional

import re

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Zones
# ---------------------------------------------------------------------------

# A business counts as "covered" if it was visited within this many days. Coverage
# is always computed from visit dates, never stored — a stored "done" flag would
# keep claiming done months after the area actually needed revisiting.
COVERAGE_WINDOW_DAYS = 90


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    # Zones nest exactly one level: a top-level zone has parent_id None.
    parent_id: Optional[str] = None

    @field_validator('description', 'parent_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    # An explicit null promotes a child back to top-level, so the router keys on
    # presence in model_dump(exclude_unset=True) rather than on None.
    parent_id: Optional[str] = None

    @field_validator('description', 'parent_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ZoneResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    child_count: int = 0
    # Distinct businesses across this zone and its children.
    business_count: int = 0
    # Assigned to this zone itself, so a parent's arithmetic reads correctly.
    direct_business_count: int = 0
    covered_count: int = 0
    # None (not 0) when the zone has no businesses — coverage is undefined, and a
    # 0% bar on an empty zone reads as a problem that isn't there.
    coverage_pct: Optional[int] = None
    coverage_window_days: int = COVERAGE_WINDOW_DAYS
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Businesses (prospects)
# ---------------------------------------------------------------------------

INTEREST_LEVELS = ("cold", "warm", "hot")


def _clean_zone_ids(v):
    """Drop blanks and duplicates while preserving the order given."""
    if v is None:
        return v
    if isinstance(v, str):          # tolerate a bare id
        v = [v]
    seen, out = set(), []
    for z in v:
        z = (z or "").strip()
        if z and z not in seen:
            seen.add(z)
            out.append(z)
    return out


class BusinessCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    google_maps_link: str = Field(..., min_length=1, max_length=2000)
    # A business can sit in more than one zone — a shop on a boundary road often
    # gets worked from either side.
    zone_ids: List[str] = Field(..., min_length=1)
    contact_first_name: Optional[str] = Field(None, max_length=50)
    contact_last_name: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=12)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    interest_level: str = Field("cold", pattern="^(cold|warm|hot)$")

    @field_validator('zone_ids', mode='before')
    @classmethod
    def normalise_zone_ids(cls, v):
        return _clean_zone_ids(v)

    @field_validator('contact_first_name', 'contact_last_name', 'address', 'notes', 'email', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class BusinessUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    google_maps_link: Optional[str] = Field(None, min_length=1, max_length=2000)
    zone_ids: Optional[List[str]] = Field(None, min_length=1)
    contact_first_name: Optional[str] = Field(None, max_length=50)
    contact_last_name: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=12)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    interest_level: Optional[str] = Field(None, pattern="^(cold|warm|hot)$")

    @field_validator('zone_ids', mode='before')
    @classmethod
    def normalise_zone_ids(cls, v):
        return _clean_zone_ids(v)

    @field_validator('contact_first_name', 'contact_last_name', 'address', 'notes', 'email', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class BusinessResponse(BaseModel):
    id: str
    company_name: str
    google_maps_link: str
    zone_ids: List[str] = []
    zone_names: List[str] = []               # populated at query time
    contact_first_name: Optional[str] = None
    contact_last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    interest_level: str = "cold"
    last_visited_at: Optional[datetime] = None
    visit_count: int = 0
    customer_id: Optional[str] = None        # set when converted to repair tracker customer
    created_by: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Route stops (embedded in Route)
# ---------------------------------------------------------------------------

class RouteStop(BaseModel):
    business_id: str
    order: int = Field(..., ge=0)
    completed: bool = False
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class RouteCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')   # YYYY-MM-DD
    zone_id: Optional[str] = None
    stops: List[RouteStop] = []
    assigned_to: Optional[str] = None    # user_id; None = assign to self
    saved_route_id: Optional[str] = None  # set when Start stamps a run from a saved route

    @field_validator('name', 'saved_route_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class RouteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    zone_id: Optional[str] = None
    stops: Optional[List[RouteStop]] = None
    assigned_to: Optional[str] = None

    @field_validator('name', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class RouteStopDetail(BaseModel):
    """RouteStop with populated business info for display"""
    business_id: str
    order: int
    completed: bool = False
    completed_at: Optional[datetime] = None
    company_name: Optional[str] = None
    google_maps_link: Optional[str] = None
    interest_level: Optional[str] = None
    # Enough contact context to work the stop without opening the business:
    # the address also feeds multi-stop Google Maps navigation links.
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class RouteResponse(BaseModel):
    id: str
    name: Optional[str] = None
    date: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    stops: List[RouteStopDetail] = []
    stops_total: int = 0
    stops_completed: int = 0
    assigned_to: str
    assigned_to_name: Optional[str] = None   # populated at query time
    created_by: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Saved routes (standing, reusable business lists)
# ---------------------------------------------------------------------------
#
# A saved route is a curated, ORDERED list of businesses that lives under a
# zone. Starting one stamps out a normal dated route (a "run") for the runner —
# progress, visits, and coverage all keep working on runs, untouched.

def _clean_business_ids(v):
    """Drop blanks and duplicates while preserving the order given."""
    if v is None:
        return []
    seen, out = set(), []
    for b in v:
        b = (b or "").strip()
        if b and b not in seen:
            seen.add(b)
            out.append(b)
    return out


class SavedRouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    zone_id: Optional[str] = None
    business_ids: List[str] = []

    @field_validator('zone_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('business_ids', mode='before')
    @classmethod
    def normalise_business_ids(cls, v):
        return _clean_business_ids(v)


class SavedRouteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    zone_id: Optional[str] = None
    business_ids: Optional[List[str]] = None

    @field_validator('zone_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('business_ids', mode='before')
    @classmethod
    def normalise_business_ids(cls, v):
        if v is None:
            return None
        return _clean_business_ids(v)


class SavedRouteBusiness(BaseModel):
    """Just enough of each member business for list rows and the editor."""
    id: str
    company_name: Optional[str] = None
    interest_level: Optional[str] = None


class SavedRouteResponse(BaseModel):
    id: str
    name: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None          # populated at query time
    business_ids: List[str] = []
    businesses: List[SavedRouteBusiness] = []  # populated, in list order
    business_count: int = 0
    # Derived, never stored: coverage mirrors zone coverage (members visited
    # within the window), sweeps count fully-completed runs started from this
    # route. coverage_pct is None when the route has no members — undefined,
    # not 0%.
    covered_count: int = 0
    coverage_pct: Optional[int] = None
    coverage_window_days: int = COVERAGE_WINDOW_DAYS
    times_swept: int = 0
    created_by: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Visits
# ---------------------------------------------------------------------------

class VisitCreate(BaseModel):
    business_id: str
    route_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=5000)
    interest_level: str = Field("cold", pattern="^(cold|warm|hot)$")
    follow_up_date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    follow_up_note: Optional[str] = Field(None, max_length=500)

    @field_validator('notes', 'follow_up_note', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('follow_up_date', mode='before')
    @classmethod
    def empty_date_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class VisitUpdate(BaseModel):
    notes: Optional[str] = Field(None, max_length=5000)
    interest_level: Optional[str] = Field(None, pattern="^(cold|warm|hot)$")
    follow_up_date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    follow_up_note: Optional[str] = Field(None, max_length=500)

    @field_validator('notes', 'follow_up_note', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('follow_up_date', mode='before')
    @classmethod
    def empty_date_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class VisitResponse(BaseModel):
    id: str
    business_id: str
    business_name: Optional[str] = None      # populated at query time
    route_id: Optional[str] = None
    rep_id: str
    rep_name: Optional[str] = None           # populated at query time
    notes: Optional[str] = None
    interest_level: str
    follow_up_date: Optional[str] = None
    follow_up_note: Optional[str] = None
    visited_at: datetime
    # Enough business contact context to act on a follow-up (call, navigate)
    # without a detour through the businesses tab. Populated at query time.
    business_phone: Optional[str] = None
    business_maps_link: Optional[str] = None
    business_address: Optional[str] = None


# ---------------------------------------------------------------------------
# Business → Customer conversion
# ---------------------------------------------------------------------------

class ConvertToCustomerRequest(BaseModel):
    """The 7 fields passed to the repair tracker customer record.
    Visit history, interest level, and all route management data stays in route management.
    """
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    company_name: str = Field(..., min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=12)
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('email', 'address', 'notes', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if not re.match(phone_pattern, v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v
