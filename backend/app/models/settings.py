from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from app.models.page_content import SocialMediaModel


class AnnouncementType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"


class AddressModel(BaseModel):
    street: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    province: str = Field(..., min_length=2, max_length=50)
    postal_code: str = Field(default="", max_length=20, alias="postalCode")
    country: str = Field(default="Canada", max_length=100)

    class Config:
        populate_by_name = True


class ContactModel(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    phone_link: str = Field(..., min_length=10, max_length=20, alias="phoneLink")
    email: EmailStr
    address: AddressModel

    class Config:
        populate_by_name = True


class HoursModel(BaseModel):
    weekdays: str = Field(..., min_length=1, max_length=200)
    weekend: str = Field(..., min_length=1, max_length=200)
    timezone: str = Field(default="PST", max_length=10)


class HeroModel(BaseModel):
    headline: str = Field(..., min_length=1, max_length=300)
    subheadline: str = Field(..., min_length=1, max_length=500)
    industries: List[str] = Field(default_factory=list)


class ServiceItemModel(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    icon: str = Field(..., min_length=1, max_length=50)


class BrandItemModel(BaseModel):
    """Brand/manufacturer that we service"""
    name: str = Field(..., min_length=1, max_length=100)
    logo_url: str = Field(..., alias="logoUrl")  # Path to uploaded logo file
    authorized: bool = Field(default=False)  # Authorized repair center status
    display_order: int = Field(default=0, alias="displayOrder")
    active: bool = Field(default=True)  # Whether brand is active/visible in carousel

    class Config:
        populate_by_name = True


class AnnouncementModel(BaseModel):
    enabled: bool = Field(default=False)
    message: str = Field(default="", max_length=500)
    type: AnnouncementType = Field(default=AnnouncementType.INFO)


class MapConfigModel(BaseModel):
    embed_url: str = Field(..., alias="embedUrl")
    directions_url: str = Field(..., alias="directionsUrl")

    class Config:
        populate_by_name = True


class ClaimsModel(BaseModel):
    tool_types_serviced: str = Field(default="20+", alias="toolTypesServiced")
    quality_standard: str = Field(default="Quality", alias="qualityStandard")
    response_time: str = Field(default="Same-day", alias="responseTime")
    technicians: str = Field(default="Factory-Trained")

    class Config:
        populate_by_name = True


class BusinessSettingsUpdate(BaseModel):
    """Schema for updating business settings (admin use)"""
    contact: ContactModel
    hours: HoursModel
    hero: HeroModel
    services: List[ServiceItemModel] = Field(default_factory=list)
    brands: List[BrandItemModel] = Field(default_factory=list)
    announcement: Optional[AnnouncementModel] = Field(default_factory=AnnouncementModel)
    service_area: str = Field(default="Metro Vancouver", alias="serviceArea")
    map: MapConfigModel
    claims: Optional[ClaimsModel] = Field(default_factory=ClaimsModel)
    social: Optional[SocialMediaModel] = Field(default_factory=SocialMediaModel)

    class Config:
        populate_by_name = True


class BusinessSettings(BusinessSettingsUpdate):
    """Full business settings document with metadata"""
    id: str = Field(alias="_id")
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    updated_at: datetime = Field(default_factory=datetime.utcnow, alias="updatedAt")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "active": True,
                "contact": {
                    "phone": "(604) 555-0123",
                    "phoneLink": "6045550123",
                    "email": "info@cnstoolsandrepair.com",
                    "address": {
                        "street": "Surrey, BC, Canada",
                        "city": "Surrey",
                        "province": "BC",
                        "postalCode": "",
                        "country": "Canada"
                    }
                },
                "hours": {
                    "weekdays": "Monday - Friday: 8:00 AM - 5:00 PM",
                    "weekend": "Saturday - Sunday: Closed",
                    "timezone": "PST"
                },
                "hero": {
                    "headline": "Expert Pneumatic Tool Repair & Maintenance",
                    "subheadline": "B2B industrial repair services in Surrey, BC.",
                    "industries": ["Automotive", "Railway", "Construction"]
                },
                "services": [],
                "announcement": {
                    "enabled": False,
                    "message": "",
                    "type": "info"
                },
                "serviceArea": "Metro Vancouver",
                "map": {
                    "embedUrl": "https://www.google.com/maps/embed?pb=...",
                    "directionsUrl": "https://www.google.com/maps/dir/?api=1&destination=Surrey,BC"
                },
                "claims": {
                    "toolTypesServiced": "20+",
                    "qualityStandard": "Quality",
                    "responseTime": "Same-day",
                    "technicians": "Factory-Trained"
                },
                "createdAt": "2024-02-08T10:00:00Z",
                "updatedAt": "2024-02-08T10:00:00Z"
            }
        }


class BusinessSettingsResponse(BaseModel):
    """Public API response schema"""
    contact: ContactModel
    hours: HoursModel
    hero: HeroModel
    services: List[ServiceItemModel]
    brands: List[BrandItemModel] = Field(default_factory=list)
    announcement: AnnouncementModel
    service_area: str = Field(alias="serviceArea")
    map: MapConfigModel
    claims: ClaimsModel
    social: Optional[SocialMediaModel] = Field(default_factory=SocialMediaModel)

    class Config:
        populate_by_name = True
