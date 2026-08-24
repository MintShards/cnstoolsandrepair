from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, EmailStr


class LoginRequest(BaseModel):
    """Admin login request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")


class LoginResponse(BaseModel):
    """Admin login response.

    The JWT is delivered as an httpOnly cookie, not in the body, so it is never
    exposed to JavaScript. The body only confirms success and the user's role.
    """
    success: bool = True
    role: Optional[str] = None
    token_type: str = "cookie"


class User(BaseModel):
    """User model"""
    id: str = Field(..., alias="_id")
    email: EmailStr
    role: str
    is_active: bool
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: datetime

    class Config:
        populate_by_name = True


class TokenData(BaseModel):
    """JWT token payload data"""
    email: Optional[str] = None
    role: Optional[str] = None


# --- Sales Rep CRUD models ---

class SalesRepCreate(BaseModel):
    """Create a new sales rep account"""
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")


class SalesRepUpdate(BaseModel):
    """Update a sales rep account (all fields optional)"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, description="Leave blank to keep current password")


class SalesRepResponse(BaseModel):
    """Sales rep public data returned by the API"""
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    is_active: bool
    created_at: datetime
    total_visits: int = 0
    total_routes: int = 0


# --- Staff (shop admin accounts) CRUD models ---

class StaffCreate(BaseModel):
    """Create a new shop account. `technician` = bench access (Repair Tracker
    + Workspace); `staff` adds the sales routes; `admin` adds the website CMS
    and account management."""
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    role: Literal["staff", "technician", "admin"] = "staff"


class StaffUpdate(BaseModel):
    """Update a staff account (all fields optional; password = admin reset,
    role = access-level change)"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, description="Leave blank to keep current password")
    role: Optional[Literal["staff", "technician", "admin"]] = None


class RoleChangeRequest(BaseModel):
    """Set any account's role — the admin-only cross-kind role switch.
    Unlike StaffUpdate.role this includes `sales`, because it can convert
    accounts across the shop/sales boundary."""
    role: Literal["admin", "staff", "technician", "sales"]


class StaffResponse(BaseModel):
    """Staff account public data. `name` is the display fallback (handles
    legacy accounts created before first/last names existed)."""
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class ChangePasswordRequest(BaseModel):
    """Self-service password change for the logged-in user"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")
