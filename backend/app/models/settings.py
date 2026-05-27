from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from app.models.page_content import SocialMediaModel, SocialMediaItemModel


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


class SourcingEmailTemplateModel(BaseModel):
    default_subject: str = Field(
        default="Parts Pricing Request - CNS Tool Repair",
        max_length=200,
        alias="defaultSubject",
    )
    greeting: str = Field(
        default="Hi",
        max_length=50,
    )
    body_text: str = Field(
        default="We would like to request pricing and availability for the parts listed below. When you have a moment, please reply with your best price and estimated lead time for any items you are able to supply. We truly appreciate your time and assistance.",
        max_length=2000,
        alias="bodyText",
    )
    closing_text: str = Field(
        default="Thank you for your time. We look forward to hearing from you.",
        max_length=500,
        alias="closingText",
    )
    footer_tagline: str = Field(
        default="Industrial Pneumatic Tool Repair & Maintenance",
        max_length=200,
        alias="footerTagline",
    )
    footer_email: str = Field(
        default="purchasing@cnstoolrepair.com",
        max_length=100,
        alias="footerEmail",
    )
    footer_phone: str = Field(
        default="778-488-0777",
        max_length=30,
        alias="footerPhone",
    )
    footer_website: str = Field(
        default="cnstoolrepair.com",
        max_length=100,
        alias="footerWebsite",
    )
    footer_label: str = Field(
        default="Supplier & Parts Inquiries",
        max_length=100,
        alias="footerLabel",
    )
    from_email: str = Field(
        default="",
        max_length=200,
        alias="fromEmail",
    )
    from_name: str = Field(
        default="",
        max_length=100,
        alias="fromName",
    )
    cc: str = Field(
        default="",
        max_length=500,
    )
    bcc: str = Field(
        default="",
        max_length=500,
    )

    class Config:
        populate_by_name = True


class BusinessSettingsUpdate(BaseModel):
    """Schema for updating business settings (admin use)"""
    contact: ContactModel
    hours: HoursModel
    hero: HeroModel
    services: List[ServiceItemModel] = Field(default_factory=list)
    announcement: Optional[AnnouncementModel] = Field(default_factory=AnnouncementModel)
    service_area: str = Field(default="Metro Vancouver", alias="serviceArea")
    map: MapConfigModel
    claims: Optional[ClaimsModel] = Field(default_factory=ClaimsModel)
    social: Optional[SocialMediaModel] = Field(default_factory=SocialMediaModel)  # Legacy field
    social_media: List[SocialMediaItemModel] = Field(default_factory=list, alias="socialMedia")  # New array field
    stale_days: int = Field(default=3, ge=1, le=30, alias="staleDays")  # Configurable stale threshold
    default_markup_percentage: float = Field(default=30.0, ge=0, le=500, alias="defaultMarkupPercentage")  # Default parts markup %
    sourcing_email_template: Optional[SourcingEmailTemplateModel] = Field(default_factory=SourcingEmailTemplateModel, alias="sourcingEmailTemplate")

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
                    "email": "info@cnstoolrepair.com",
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
    announcement: AnnouncementModel
    service_area: str = Field(alias="serviceArea")
    map: MapConfigModel
    claims: ClaimsModel
    social: Optional[SocialMediaModel] = Field(default_factory=SocialMediaModel)  # Legacy field
    social_media: List[SocialMediaItemModel] = Field(default_factory=list, alias="socialMedia")  # New array field
    stale_days: int = Field(default=3, alias="staleDays")
    default_markup_percentage: float = Field(default=30.0, alias="defaultMarkupPercentage")
    sourcing_email_template: Optional[SourcingEmailTemplateModel] = Field(default_factory=SourcingEmailTemplateModel, alias="sourcingEmailTemplate")

    class Config:
        populate_by_name = True
