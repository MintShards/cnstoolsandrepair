from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.task import TaskPriority, UserRef, YMD_PATTERN

MessageType = Literal["post", "call"]


class CallInfo(BaseModel):
    """Who phoned, captured when a customer call is logged."""
    caller_name: str = Field(..., min_length=1, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)

    @field_validator("caller_name", "company", "phone", mode="before")
    def strip_and_blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class SpawnTaskInfo(BaseModel):
    """Optional follow-up task created in the same motion as a call log."""
    title: str = Field(..., min_length=1, max_length=200)
    details: Optional[str] = Field(None, max_length=5000)
    assignee_id: Optional[str] = None
    priority: TaskPriority = "normal"
    due_date: Optional[str] = Field(None, pattern=YMD_PATTERN)

    @field_validator("title", "details", "assignee_id", "due_date", mode="before")
    def strip_and_blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class MessageCreate(BaseModel):
    type: MessageType = "post"
    body: str = Field(..., min_length=1, max_length=5000)
    important: bool = False
    call: Optional[CallInfo] = None
    repair_id: Optional[str] = None
    spawn_task: Optional[SpawnTaskInfo] = None

    @field_validator("body", "repair_id", mode="before")
    def strip_and_blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def call_fields_match_type(self):
        if self.type == "call" and self.call is None:
            raise ValueError("Call logs need caller details")
        if self.type == "post":
            self.call = None
        return self


class SpawnedTaskRef(BaseModel):
    id: str
    title: str


class MessageResponse(BaseModel):
    id: str
    type: MessageType
    body: str
    author: UserRef
    pinned: bool = False
    important: bool = False
    call: Optional[CallInfo] = None
    repair_id: Optional[str] = None
    request_number: Optional[str] = None
    task_id: Optional[str] = None
    read_by: List[str] = []
    acknowledged_by: List[str] = []
    created_at: datetime
    # Populated only on create-with-spawn responses
    task: Optional[SpawnedTaskRef] = None


class PinRequest(BaseModel):
    pinned: bool
