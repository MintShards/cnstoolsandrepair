"""Diagnosis codes — the shop's internal library of common tool problems.

One code per problem per tool type (HJ-03 "Lifts but will not hold"), holding
what the wall chart shows — the symptom, the likely causes and the technician
checks — plus the repair, the parts it needs and the quote wording. Applying a
code on the tracker fills a finding and the tool's Parts list, so the same
thing is never typed twice. Internal use only: nothing here prints on a
document a customer gets.

The code string is `<prefix>-<number>` (two digits minimum: HJ-01, HJ-12,
HJ-123). The prefix is suggested from the tool type and editable; the number
is the next free one for that prefix, so a retired code's number never comes
back.
"""
import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.repair import ActorRef

GENERAL_TOOL_TYPE = "GENERAL"   # codes that apply to every tool
GENERAL_PREFIX = "GEN"

# The wall chart's sections, in chart order. A code sits in one of them and
# under one tool type within it (IMPACT WRENCH inside AIR TOOLS); GENERAL
# holds the few codes that apply to anything.
CATEGORIES = [
    "AIR TOOLS",
    "HYDRAULIC TOOLS",
    "ELECTRIC TOOLS",
    "LIFTING TOOLS",
    "DRAIN CAMERAS",
    "CORDLESS TOOLS",
    "GENERAL",
]


def suggest_prefix(tool_type: str) -> str:
    """HYDRAULIC JACK → HJ, GRINDER → GR, PIPE INSPECTION CAMERA → PIC, GENERAL → GEN."""
    words = [w for w in re.split(r"[^A-Za-z0-9]+", (tool_type or "").strip()) if w]
    if not words:
        return GENERAL_PREFIX
    if len(words) == 1:
        word = words[0].upper()
        return GENERAL_PREFIX if word == GENERAL_TOOL_TYPE else word[:2]
    return "".join(w[0] for w in words).upper()[:4]


def format_code(prefix: str, number: int) -> str:
    return f"{prefix}-{number:02d}"


def _clean_list(value, limit: int = 20, max_len: int = 300) -> List[str]:
    """Lists arrive as arrays or as pasted lines; blanks dropped, order kept."""
    if value is None:
        return []
    if isinstance(value, str):
        value = value.splitlines()
    out = []
    for item in value:
        text = str(item).strip()
        if text:
            out.append(text[:max_len])
    return out[:limit]


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class CodePart(BaseModel):
    """A part the repair needs, by generic name — the part number comes from
    the model's parts library when the code is applied to a tool."""
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(1, gt=0, le=1000)

    @field_validator('name', mode='before')
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class DiagnosisCodeBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    category: str = Field("GENERAL", max_length=40)                  # wall-chart section
    tool_type: str = Field(..., min_length=1, max_length=100)
    prefix: str = Field(..., min_length=1, max_length=6, pattern=r"^[A-Za-z0-9]+$")
    title: str = Field(..., min_length=1, max_length=200)            # symptom / problem
    likely_causes: List[str] = Field(default_factory=list)
    technician_checks: List[str] = Field(default_factory=list)
    solution: Optional[str] = Field(None, max_length=1000)           # the repair
    parts: List[CodePart] = Field(default_factory=list)
    quote_note: Optional[str] = Field(None, max_length=1000)         # what we tell the customer

    @field_validator('category', mode='before')
    @classmethod
    def check_category(cls, v):
        value = (v.strip().upper() if isinstance(v, str) else "") or "GENERAL"
        if value not in CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(CATEGORIES)}")
        return value

    @field_validator('tool_type', 'prefix', mode='before')
    @classmethod
    def upper_strip(cls, v):
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator('title', mode='before')
    @classmethod
    def strip_title(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator('likely_causes', 'technician_checks', mode='before')
    @classmethod
    def clean_lists(cls, v):
        return _clean_list(v)

    @field_validator('solution', 'quote_note', mode='before')
    @classmethod
    def clean_texts(cls, v):
        return _clean_text(v)

    @field_validator('parts')
    @classmethod
    def cap_parts(cls, v):
        return v[:30]


class DiagnosisCodeCreate(DiagnosisCodeBase):
    number: Optional[int] = Field(None, ge=1, le=9999)   # None = next free for the prefix
    active: bool = True


class DiagnosisCodeUpdate(BaseModel):
    """Partial update: only the fields sent change. Changing prefix or number
    renumbers the code; the router keeps it unique."""
    model_config = ConfigDict(protected_namespaces=())

    category: Optional[str] = Field(None, max_length=40)
    tool_type: Optional[str] = Field(None, min_length=1, max_length=100)
    prefix: Optional[str] = Field(None, min_length=1, max_length=6, pattern=r"^[A-Za-z0-9]+$")
    number: Optional[int] = Field(None, ge=1, le=9999)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    likely_causes: Optional[List[str]] = None
    technician_checks: Optional[List[str]] = None
    solution: Optional[str] = Field(None, max_length=1000)
    parts: Optional[List[CodePart]] = None
    quote_note: Optional[str] = Field(None, max_length=1000)
    active: Optional[bool] = None

    @field_validator('category', mode='before')
    @classmethod
    def check_category(cls, v):
        if v is None:
            return None
        value = v.strip().upper() if isinstance(v, str) else v
        if value not in CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(CATEGORIES)}")
        return value

    @field_validator('tool_type', 'prefix', mode='before')
    @classmethod
    def upper_strip(cls, v):
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator('title', mode='before')
    @classmethod
    def strip_title(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator('likely_causes', 'technician_checks', mode='before')
    @classmethod
    def clean_lists(cls, v):
        return None if v is None else _clean_list(v)

    @field_validator('solution', 'quote_note', mode='before')
    @classmethod
    def clean_texts(cls, v):
        return _clean_text(v)

    @field_validator('parts')
    @classmethod
    def cap_parts(cls, v):
        return None if v is None else v[:30]


class DiagnosisCodeResponse(DiagnosisCodeBase):
    id: str
    code: str
    number: int
    active: bool = True
    usage_count: int = 0          # findings on repair tools that came from this code (derived)
    created_by: Optional[ActorRef] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
