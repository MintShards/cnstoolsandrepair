from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PushKeys(BaseModel):
    p256dh: str = Field(..., min_length=10, max_length=200)
    auth: str = Field(..., min_length=10, max_length=100)


class PushSubscriptionIn(BaseModel):
    """What PushSubscription.toJSON() gives the browser, plus the device label."""
    endpoint: str = Field(..., min_length=10, max_length=2000)
    keys: PushKeys
    expiration_time: Optional[int] = None
    user_agent: Optional[str] = Field(None, max_length=300)

    @field_validator("endpoint")
    @classmethod
    def https_only(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Push endpoints must be https URLs")
        return v


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2000)
