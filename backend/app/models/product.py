from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
import re


class ProductCategory(str, Enum):
    """Categories for tools we SELL.

    Deliberately separate from ToolCategory (app/models/tool.py), which
    describes the tools we REPAIR. The two lists overlap but are maintained
    independently — a tool we service is not necessarily one we stock.
    """
    AIR_TOOLS = "air_tools"
    HYDRAULIC = "hydraulic"
    LIFTING = "lifting"


class ProductResponse(BaseModel):
    id: str
    brand: str = ""
    model: str = ""
    name: str
    category: str
    product_group: str = ""
    spec_line: str = ""
    description: str = ""
    image_url: Optional[str] = None
    # Supplier part number. Shown on the card as "Item #" so customers can quote
    # it, and it's what staff look the tool up by in Zoho when pricing.
    sku: str = ""
    featured: bool = False
    active: bool = True
    display_order: int = 999


class ProductQuoteItem(BaseModel):
    """One line on a product quote request."""
    product_id: str = Field(default="", max_length=50)
    name: str = Field(..., min_length=1, max_length=250)
    brand: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    sku: str = Field(default="", max_length=40)
    quantity: int = Field(default=1, gt=0, le=999)


class ProductQuoteCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=200)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    phone: str = Field(..., min_length=12, max_length=12, pattern=r'^\d{3}-\d{3}-\d{4}$')
    notes: Optional[str] = Field(None, max_length=2000)
    items: List[ProductQuoteItem] = Field(..., min_length=1, max_length=25)

    @field_validator('phone')
    @classmethod
    def validate_phone_format(cls, v: str) -> str:
        """Validate phone number format (###-###-####)"""
        if not re.match(r'^\d{3}-\d{3}-\d{4}$', v):
            raise ValueError('Phone number must be in format: ###-###-#### (e.g., 604-555-0123)')
        return v


class ProductQuoteResponse(BaseModel):
    id: str
    quote_number: str = "PQ-LEGACY"
    company_name: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: str
    notes: Optional[str] = None
    items: List[ProductQuoteItem] = []
    status: str = "new"
    created_at: datetime
    updated_at: datetime
    email_sent: bool = True
