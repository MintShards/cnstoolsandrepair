from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Admin login request"""
    password: str = Field(..., min_length=1, description="Admin password")


class LoginResponse(BaseModel):
    """Admin login response"""
    success: bool
    token: str
    message: str = "Login successful"
