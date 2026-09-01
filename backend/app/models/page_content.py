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


class SocialMediaItemModel(BaseModel):
    """Individual social media platform item"""
    platform: str = Field(..., min_length=1, max_length=50)  # e.g., "LinkedIn", "Facebook"
    icon: str = Field(..., min_length=1, max_length=50)  # e.g., "linkedin", "facebook"
    url: str = Field(default="", max_length=500)  # Social media profile URL
    order: int = Field(default=0, ge=0)  # Display order

class SocialMediaModel(BaseModel):
    """Legacy social media links (deprecated - use array instead)"""
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
    primary_button_text: str = Field(..., min_length=1, max_length=100, alias="primaryButtonText")
    secondary_button_text: str = Field(..., min_length=1, max_length=100, alias="secondaryButtonText")
    hero_image_url: Optional[str] = Field(None, max_length=500, alias="heroImageUrl")

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


# ============================================================================
# Tools for Sale (/products) page
# ============================================================================

class ProductsPageHeroModel(BaseModel):
    """Hero section for the Tools for Sale page"""
    label: str = Field(..., min_length=1, max_length=100)
    heading: str = Field(..., min_length=1, max_length=120)
    # Shown instead of `heading` on narrow phones, where the longer wording wraps
    short_heading: str = Field(default="Products", max_length=40, alias="shortHeading")
    description: str = Field(..., min_length=1, max_length=600)
    availability_note: str = Field(default="", max_length=160, alias="availabilityNote")

    class Config:
        populate_by_name = True


class ProductCategoryLabelModel(BaseModel):
    """Display names for one product category.

    `key` matches ProductCategory in models/product.py and is not editable —
    only how it is worded on the page.
    """
    key: str = Field(..., max_length=40)
    label: str = Field(..., min_length=1, max_length=60)   # filter pill
    heading: str = Field(..., min_length=1, max_length=80)  # section heading

    class Config:
        populate_by_name = True


class ProductsQuotePanelModel(BaseModel):
    """Copy inside the quote request slide-over"""
    title: str = Field(default="Request a Quote", max_length=80)
    footnote: str = Field(default="", max_length=200)
    success_heading: str = Field(default="Request Sent", max_length=80, alias="successHeading")
    success_note: str = Field(default="", max_length=300, alias="successNote")

    class Config:
        populate_by_name = True


class ProductsFooterCtaModel(BaseModel):
    """The 'don't see what you need' line under the catalogue"""
    text: str = Field(default="", max_length=300)
    phone_label: str = Field(default="", max_length=60, alias="phoneLabel")
    phone_number: str = Field(default="", max_length=40, alias="phoneNumber")
    message_label: str = Field(default="", max_length=60, alias="messageLabel")

    class Config:
        populate_by_name = True


class ProductsPageSEOModel(BaseModel):
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=500)
    keywords: str = Field(default="", max_length=500)


class ProductsPageContentUpdate(BaseModel):
    """Schema for updating Tools for Sale page content"""
    hero: ProductsPageHeroModel
    categories: List[ProductCategoryLabelModel] = Field(default_factory=list)
    all_label: str = Field(default="All Tools", max_length=60, alias="allLabel")
    # Rendered after the count, e.g. "23 tools in stock or available to order"
    section_note: str = Field(default="", max_length=120, alias="sectionNote")
    quote_panel: ProductsQuotePanelModel = Field(
        default_factory=ProductsQuotePanelModel, alias="quotePanel"
    )
    footer_cta: ProductsFooterCtaModel = Field(
        default_factory=ProductsFooterCtaModel, alias="footerCta"
    )
    seo: ProductsPageSEOModel = Field(default_factory=ProductsPageSEOModel)

    class Config:
        populate_by_name = True


class ProductsPageContentResponse(ProductsPageContentUpdate):
    """API response schema for Tools for Sale page content"""
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True
