from pydantic import BaseModel, Field
from typing import Optional


class Hero(BaseModel):
    label: str = Field(default="Get In Touch", max_length=50)
    heading: str = Field(default="Contact CNS Tool Repair", max_length=100)
    description: str = Field(default="Have questions about pneumatic tool repair or maintenance? Contact our Surrey workshop or request a repair assessment below.", max_length=500)


class ContactContentUpdate(BaseModel):
    hero: Optional[Hero] = None


class ContactContentResponse(BaseModel):
    hero: Hero

    class Config:
        from_attributes = True
