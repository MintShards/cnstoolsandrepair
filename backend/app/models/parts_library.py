from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Dict, List, Optional
from datetime import datetime


class LibraryBrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    short_code: Optional[str] = Field(None, max_length=10)
    website: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_name(cls, v):
        if v:
            return v.strip().upper()
        return v

    @field_validator('short_code', mode='before')
    @classmethod
    def uppercase_short_code(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('website', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class LibraryBrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_code: Optional[str] = Field(None, max_length=10)
    website: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_name(cls, v):
        if v:
            return v.strip().upper()
        return v

    @field_validator('short_code', mode='before')
    @classmethod
    def uppercase_short_code(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('website', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class LibraryBrandResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    name: str
    short_code: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    active: bool
    model_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────


class LibraryModelCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    specifications: Optional[str] = Field(None, max_length=2000)
    discontinued: bool = False
    retail_price: Optional[float] = Field(None, ge=0)

    @field_validator('name', 'category', mode='before')
    @classmethod
    def capitalize_field(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('specifications', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('retail_price', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v


class LibraryModelUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    specifications: Optional[str] = Field(None, max_length=2000)
    discontinued: Optional[bool] = None
    retail_price: Optional[float] = Field(None, ge=0)

    @field_validator('name', 'category', mode='before')
    @classmethod
    def capitalize_field(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('specifications', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('retail_price', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v


class LibraryModelResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    brand_id: str
    brand_name: Optional[str] = None
    name: str
    category: Optional[str] = None
    specifications: Optional[str] = None
    diagram_urls: List[str] = []
    diagram_labels: Dict[str, str] = {}
    discontinued: bool
    retail_price: Optional[float] = None
    active: bool
    part_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────


class CompatGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', mode='before')
    @classmethod
    def strip_name(cls, v):
        if v:
            return v.strip()
        return v

    @field_validator('description', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class CompatGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', mode='before')
    @classmethod
    def strip_name(cls, v):
        if v:
            return v.strip()
        return v

    @field_validator('description', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class CompatGroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    active: bool
    part_count: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────


class LibraryPartCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    part_number: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    brand_id: str = Field(..., min_length=1)
    model_ids: List[str] = Field(default_factory=list)
    compatibility_group_ids: List[str] = Field(default_factory=list)
    suggested_suppliers: List[str] = Field(default_factory=list)
    cost: Optional[float] = Field(None, ge=0)
    suggested_price: Optional[float] = Field(None, ge=0)
    market_price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    quantity_on_hand: int = Field(default=0, ge=0)
    reorder_point: int = Field(default=0, ge=0)
    reorder_quantity: int = Field(default=0, ge=0)
    location: Optional[str] = Field(None, max_length=100)

    @field_validator('part_number', mode='before')
    @classmethod
    def strip_part_number(cls, v):
        if v:
            return v.strip().upper()
        return v

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_field(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('notes', 'location', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('cost', 'suggested_price', 'market_price', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v


class LibraryPartUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    part_number: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    brand_id: Optional[str] = None
    model_ids: Optional[List[str]] = None
    compatibility_group_ids: Optional[List[str]] = None
    suggested_suppliers: Optional[List[str]] = None
    cost: Optional[float] = Field(None, ge=0)
    suggested_price: Optional[float] = Field(None, ge=0)
    market_price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    quantity_on_hand: Optional[int] = Field(None, ge=0)
    reorder_point: Optional[int] = Field(None, ge=0)
    reorder_quantity: Optional[int] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=100)

    @field_validator('part_number', mode='before')
    @classmethod
    def strip_part_number(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('name', mode='before')
    @classmethod
    def capitalize_field(cls, v):
        if v and isinstance(v, str):
            return v.strip().upper()
        return v or None

    @field_validator('notes', 'location', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('cost', 'suggested_price', 'market_price', mode='before')
    @classmethod
    def empty_string_to_none_float(cls, v):
        if v == '' or v is None:
            return None
        return v


class StockAdjustment(BaseModel):
    delta: int
    reason: str = Field(..., min_length=1, max_length=500)


class LibraryPartResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    part_number: str
    name: str
    brand_id: str
    brand_name: Optional[str] = None
    model_ids: List[str] = []
    model_names: List[str] = []
    compatibility_group_ids: List[str] = []
    compatibility_group_names: List[str] = []
    diagram_urls: List[str] = []
    suggested_suppliers: List[str] = []
    cost: Optional[float] = None
    suggested_price: Optional[float] = None
    market_price: Optional[float] = None
    notes: Optional[str] = None
    quantity_on_hand: int = 0
    reorder_point: int = 0
    reorder_quantity: int = 0
    location: Optional[str] = None
    low_stock: bool = False
    active: bool
    created_at: datetime
    updated_at: datetime


class CompatiblePartsGroup(BaseModel):
    group: CompatGroupResponse
    parts: List[LibraryPartResponse]


class CompatiblePartsResponse(BaseModel):
    part: LibraryPartResponse
    compatibility_groups: List[CompatiblePartsGroup]
