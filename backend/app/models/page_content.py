from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AboutContentUpdate(BaseModel):
    """Schema for updating about page content"""
    page_heading: str = Field(..., min_length=1, max_length=200)
    company_story: str = Field(..., min_length=1, max_length=5000)
    mission_statement: str = Field(..., min_length=1, max_length=1000)
    team_description: str = Field(..., min_length=1, max_length=2000)


class AboutContent(AboutContentUpdate):
    """Full about content document (singleton)"""
    id: str = Field(alias="_id")
    updated_at: datetime = Field(default_factory=datetime.utcnow, alias="updatedAt")

    class Config:
        populate_by_name = True


class AboutContentResponse(BaseModel):
    """API response schema for about content"""
    page_heading: Optional[str] = "Industrial pneumatic tool repair and maintenance services in Surrey, BC"
    company_story: str
    mission_statement: str
    team_description: str
    updated_at: datetime

    class Config:
        populate_by_name = True


class SocialMediaModel(BaseModel):
    """Social media links"""
    facebook: str = Field(default="", max_length=500)
    linkedin: str = Field(default="", max_length=500)
    instagram: str = Field(default="", max_length=500)


# ============================================================================
# HOME PAGE CONTENT MODELS
# ============================================================================

class HeroSectionModel(BaseModel):
    """Hero section content"""
    headline: str = Field(..., min_length=1, max_length=300)
    subheadline: str = Field(..., min_length=1, max_length=500)
    industries_badge: str = Field(..., min_length=1, max_length=200, alias="industriesBadge")
    location_text: str = Field(..., min_length=1, max_length=200, alias="locationText")
    primary_button_text: str = Field(..., min_length=1, max_length=100, alias="primaryButtonText")
    secondary_button_text: str = Field(..., min_length=1, max_length=100, alias="secondaryButtonText")

    class Config:
        populate_by_name = True


class TrustBadgeModel(BaseModel):
    """Trust badge item for QuickFacts section"""
    icon: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    color: str = Field(..., min_length=1, max_length=50)  # Tailwind color class
    display_order: int = Field(default=0)


class QuickFactsModel(BaseModel):
    """Quick facts section content"""
    trust_badges: List[TrustBadgeModel] = Field(default_factory=list, alias="trustBadges")

    class Config:
        populate_by_name = True


class HomePageSEOModel(BaseModel):
    """SEO meta tags for home page"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=500)
    keywords: str = Field(..., min_length=1, max_length=500)


class RepairProcessIntroModel(BaseModel):
    """Repair Process Intro section content"""
    label: str = Field(..., min_length=1, max_length=50)
    heading: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)


class WhyChooseUsFeatureModel(BaseModel):
    """Individual feature card in Why Choose Us section"""
    icon: str = Field(..., min_length=1, max_length=50)  # Material Symbol icon name
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    display_order: int = Field(default=0)


class WhyChooseUsModel(BaseModel):
    """Why Choose Us section content"""
    label: str = Field(..., min_length=1, max_length=50)
    heading: str = Field(..., min_length=1, max_length=200)
    subheading: str = Field(..., min_length=1, max_length=500)
    features: List[WhyChooseUsFeatureModel] = Field(default_factory=list)


class HowItWorksStepModel(BaseModel):
    """Individual step in How It Works section"""
    number: int = Field(..., ge=1, le=10)
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    display_order: int = Field(default=0)


class HowItWorksModel(BaseModel):
    """How It Works section content"""
    label: str = Field(..., min_length=1, max_length=50)
    heading: str = Field(..., min_length=1, max_length=200)
    steps: List[HowItWorksStepModel] = Field(default_factory=list)
    note: str = Field(..., min_length=1, max_length=500)


class IndustrialUseCasesModel(BaseModel):
    """Industrial Use Cases section content"""
    label: str = Field(..., min_length=1, max_length=50)
    heading: str = Field(..., min_length=1, max_length=200)
    subtitle: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1, max_length=1000)


class ServiceAreaModel(BaseModel):
    """Service Area section content"""
    description: Optional[str] = Field(None, min_length=1, max_length=1000)  # Optional - auto-generated on frontend
    highlighted_cities: List[str] = Field(default_factory=list, alias="highlightedCities")
    region: str = Field(..., min_length=1, max_length=200)

    class Config:
        populate_by_name = True


class FinalCTAModel(BaseModel):
    """Final CTA section content"""
    heading: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=500)
    primary_button_text: str = Field(..., min_length=1, max_length=100, alias="primaryButtonText")
    secondary_button_text: str = Field(..., min_length=1, max_length=100, alias="secondaryButtonText")

    class Config:
        populate_by_name = True


class HomePageTestimonialModel(BaseModel):
    """Testimonial model for home page content"""
    company: Optional[str] = Field(None, max_length=200)
    person: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(default="person", max_length=100)  # Walk-in customer icon
    industry_name: Optional[str] = Field(default="", max_length=100, alias="industryName")
    quote: str = Field(..., min_length=1, max_length=1000)  # Required field
    location: Optional[str] = Field(None, max_length=100)

    class Config:
        populate_by_name = True


class HomePageContentUpdate(BaseModel):
    """Schema for updating home page content (admin use)"""
    seo: HomePageSEOModel
    hero: HeroSectionModel
    quick_facts: QuickFactsModel = Field(..., alias="quickFacts")
    repair_process_intro: RepairProcessIntroModel = Field(..., alias="repairProcessIntro")
    why_choose_us: WhyChooseUsModel = Field(..., alias="whyChooseUs")
    how_it_works: HowItWorksModel = Field(..., alias="howItWorks")
    industrial_use_cases: IndustrialUseCasesModel = Field(..., alias="industrialUseCases")
    service_area: ServiceAreaModel = Field(..., alias="serviceArea")
    final_cta: FinalCTAModel = Field(..., alias="finalCta")
    testimonials: List[HomePageTestimonialModel] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class HomePageContentResponse(BaseModel):
    """API response schema for home page content"""
    seo: HomePageSEOModel
    hero: HeroSectionModel
    quick_facts: QuickFactsModel = Field(..., alias="quickFacts")
    repair_process_intro: RepairProcessIntroModel = Field(..., alias="repairProcessIntro")
    why_choose_us: WhyChooseUsModel = Field(..., alias="whyChooseUs")
    how_it_works: HowItWorksModel = Field(..., alias="howItWorks")
    industrial_use_cases: IndustrialUseCasesModel = Field(..., alias="industrialUseCases")
    service_area: ServiceAreaModel = Field(..., alias="serviceArea")
    final_cta: FinalCTAModel = Field(..., alias="finalCta")
    testimonials: List[HomePageTestimonialModel] = Field(default_factory=list)
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


# ============================================================================
# INDUSTRIES PAGE CONTENT MODELS
# ============================================================================

class IndustryItemModel(BaseModel):
    """Individual industry item"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    icon: str = Field(default="business", max_length=50)
    tool_badges: List[str] = Field(default_factory=list, alias="toolBadges")
    display_order: int = Field(default=0)

    class Config:
        populate_by_name = True


class IndustriesPageHeroModel(BaseModel):
    """Hero section for industries page"""
    label: str = Field(..., min_length=1, max_length=100)
    heading: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=500)


class IndustriesPageContentUpdate(BaseModel):
    """Schema for updating industries page content"""
    hero: IndustriesPageHeroModel
    industries: List[IndustryItemModel] = Field(default_factory=list)


class IndustriesPageContentResponse(BaseModel):
    """API response schema for industries page content"""
    hero: IndustriesPageHeroModel
    industries: List[IndustryItemModel]
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True
