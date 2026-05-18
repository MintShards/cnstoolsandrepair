from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, List
from datetime import datetime


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    contact_name: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    tags: List[str] = Field(default_factory=list)

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_name(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('contact_name', mode='before')
    @classmethod
    def capitalize_contact_name(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('email', mode='before')
    @classmethod
    def lowercase_email(cls, v):
        if v:
            return v.strip().lower()
        return v

    @field_validator('tags', mode='before')
    @classmethod
    def normalize_tags(cls, v):
        if isinstance(v, list):
            return [t.strip().lower() for t in v if isinstance(t, str) and t.strip()]
        return []


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    contact_name: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = None

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_name(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('contact_name', mode='before')
    @classmethod
    def capitalize_contact_name(cls, v):
        if v:
            return v.strip().title()
        return v

    @field_validator('email', mode='before')
    @classmethod
    def lowercase_email(cls, v):
        if v:
            return v.strip().lower()
        return v

    @field_validator('tags', mode='before')
    @classmethod
    def normalize_tags(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            return [t.strip().lower() for t in v if isinstance(t, str) and t.strip()]
        return []


class SupplierResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    active: bool
    created_at: datetime
