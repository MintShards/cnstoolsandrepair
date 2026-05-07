from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class TechnicianCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator('name', mode='before')
    @classmethod
    def uppercase_name(cls, v):
        if v:
            return v.strip().upper()
        return v


class TechnicianResponse(BaseModel):
    id: str
    name: str
    active: bool
    created_at: datetime
