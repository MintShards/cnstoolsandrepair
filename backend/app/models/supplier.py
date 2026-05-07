from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_name(cls, v):
        if v:
            return v.strip().title()
        return v


class SupplierResponse(BaseModel):
    id: str
    name: str
    active: bool
    created_at: datetime
