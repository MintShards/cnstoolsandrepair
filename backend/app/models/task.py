from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

TaskStatus = Literal["todo", "in_progress", "done"]
TaskPriority = Literal["normal", "high", "urgent"]
TaskRecurrence = Literal["none", "daily", "weekly", "monthly"]

# Shop-local calendar date, same convention as visits.follow_up_date
YMD_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class UserRef(BaseModel):
    """Embedded snapshot of the acting/assigned user at write time."""
    user_id: str
    name: str


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    details: Optional[str] = Field(None, max_length=5000)
    status: TaskStatus = "todo"
    priority: TaskPriority = "normal"
    due_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    assignee_id: Optional[str] = None
    repair_id: Optional[str] = None
    recurrence: TaskRecurrence = "none"

    @field_validator("title", "details", "due_date", "assignee_id", "repair_id", mode="before")
    def strip_and_blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def recurrence_needs_due_date(self):
        if self.recurrence != "none" and not self.due_date:
            raise ValueError("Recurring tasks need a due date")
        return self


class TaskUpdate(BaseModel):
    """Partial update. Fields left unset are untouched; an explicit null clears
    due_date / assignee_id / repair_id / details."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    details: Optional[str] = Field(None, max_length=5000)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[str] = Field(None, pattern=YMD_PATTERN)
    assignee_id: Optional[str] = None
    repair_id: Optional[str] = None
    recurrence: Optional[TaskRecurrence] = None

    @field_validator("title", "details", "due_date", "assignee_id", "repair_id", mode="before")
    def strip_and_blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class TaskResponse(BaseModel):
    id: str
    title: str
    details: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    repair_id: Optional[str] = None
    request_number: Optional[str] = None
    recurrence: TaskRecurrence = "none"
    spawned_from: Optional[str] = None
    source_message_id: Optional[str] = None
    created_by: UserRef
    completed_by: Optional[UserRef] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BatchCompleteRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1, max_length=100)


class BatchCompleteResult(BaseModel):
    id: str
    success: bool
    error: Optional[str] = None


class BatchCompleteResponse(BaseModel):
    results: List[BatchCompleteResult]
    success_count: int
    failure_count: int
