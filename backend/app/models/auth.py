from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr


class LoginRequest(BaseModel):
    """Admin login request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")


class LoginResponse(BaseModel):
    """Admin login response"""
    access_token: str
    token_type: str = "bearer"


class User(BaseModel):
    """User model"""
    id: str = Field(..., alias="_id")
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        populate_by_name = True


class TokenData(BaseModel):
    """JWT token payload data"""
    email: Optional[str] = None
    role: Optional[str] = None
