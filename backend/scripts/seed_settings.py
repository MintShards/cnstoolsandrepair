#!/usr/bin/env python3
"""
Seed Production Settings

Creates default settings document in production database
to fix homepage loading and admin dashboard issues.

Usage:
    python scripts/seed_settings.py
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


async def main():
    """Create default settings document"""

    print("\n" + "=" * 60)
    print("SEED PRODUCTION SETTINGS")
    print("=" * 60)
    print(f"\nDatabase: {settings.database_name}")

    try:
        # Connect to MongoDB
        print("\n🔌 Connecting to MongoDB...")
        client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
        db = client[settings.database_name]

        # Test connection
        await client.admin.command('ping')
        print("✅ Connected successfully")

        # Check if settings already exist
        existing = await db.settings.find_one({})
        if existing:
            print("\n⚠️  Settings document already exists!")
            print(f"   Company: {existing.get('company_name', 'Unknown')}")
            overwrite = input("\nOverwrite? (yes/no): ").strip().lower()
            if overwrite != "yes":
                print("Aborted.")
                client.close()
                sys.exit(0)
            # Delete existing
            await db.settings.delete_many({})

        # Create default settings document
        print("\n📝 Creating default settings...")

        default_settings = {
            # Company Information
            "company_name": "CNS Tools and Repair",
            "tagline": "Expert Pneumatic Tool Repair & Maintenance",

            # Contact Information
            "phone": "(604) 581-8930",
            "email": "contact@cnstoolsandrepair.com",
            "notification_email": "cnstoolsandrepair@gmail.com",

            # Address
            "address": {
                "street": "Unit 65 13335 115 Ave",
                "city": "Surrey",
                "province": "BC",
                "postal_code": "V3R 0R8",
                "country": "Canada"
            },

            # Business Hours
            "hours": {
                "weekdays": "Monday - Friday: 9:00 AM - 4:00 PM",
                "weekend": "Saturday - Sunday: Closed",
                "timezone": "PST"
            },

            # Service Area
            "service_area": "Metro Vancouver",

            # Map Configuration
            "map_embed_url": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d20858.147554763895!2d-122.8638754307069!3d49.195466912791005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5485d7823fdd1005%3A0xe9d616f8891ef184!2sCNS%20Tools%20And%20Repair!5e0!3m2!1sen!2sca!4v1772435502604!5m2!1sen!2sca",
            "map_directions_url": "https://www.google.com/maps/dir/?api=1&destination=CNS+Tools+And+Repair,13335+115+Ave,Surrey,BC+V3R+2X1",

            # Social Media (optional)
            "social": {
                "facebook": "",
                "linkedin": "",
                "instagram": ""
            },

            # Homepage Hero Section
            "hero": {
                "headline": "Expert Pneumatic Tool Repair & Maintenance",
                "subheadline": "Professional service for industrial pneumatic tools. Fast turnaround, factory-trained technicians.",
                "cta_text": "Get Free Quote",
                "cta_link": "/repair-request"
            },

            # Quick Facts
            "quick_facts": {
                "tool_types_serviced": "20+",
                "average_turnaround": "Quality",
                "response_time": "Professional",
                "technicians": "Factory-Trained",
                "client_count": "100+"
            },

            # About Section
            "about": {
                "headline": "Your Trusted Partner for Industrial Tool Repair",
                "description": "CNS Tools and Repair specializes in professional pneumatic tool repair and maintenance services. Our factory-trained technicians provide expert diagnosis and repair for a wide range of industrial tools, serving businesses across Metro Vancouver.",
                "points": [
                    "Factory-trained technicians with years of experience",
                    "Comprehensive repair services for all major brands",
                    "Quality workmanship with genuine parts",
                    "Serving 10+ industries across Metro Vancouver",
                    "On-site diagnosis and repair estimates"
                ]
            },

            # Services Overview
            "services_overview": {
                "headline": "Professional Pneumatic Tool Services",
                "description": "We repair and maintain a comprehensive range of pneumatic tools for industrial applications."
            },

            # Industries Overview
            "industries_overview": {
                "headline": "Industries We Serve",
                "description": "Trusted by businesses across multiple sectors for reliable tool repair services."
            },

            # Testimonials
            "testimonials": [
                {
                    "author": "Industrial Client",
                    "company": "Manufacturing Facility",
                    "text": "Professional service and quick turnaround. Our tools are back in operation faster than expected.",
                    "rating": 5
                },
                {
                    "author": "Fleet Manager",
                    "company": "Transportation Company",
                    "text": "Reliable repair services for our pneumatic tools. The technicians are knowledgeable and efficient.",
                    "rating": 5
                },
                {
                    "author": "Shop Owner",
                    "company": "Auto Repair Shop",
                    "text": "Fair pricing and honest assessments. They only recommend repairs that are truly necessary.",
                    "rating": 5
                }
            ],

            # Contact Page Content
            "contact": {
                "headline": "Get in Touch",
                "description": "Bring your tools to our Surrey location for professional diagnosis and repair. Walk-ins welcome during business hours.",
                "form_description": "Send us a message and we'll get back to you within 24 hours."
            },

            # Gallery Page Content
            "gallery": {
                "headline": "Our Work",
                "description": "Professional pneumatic tool repair and maintenance services"
            },

            # Metadata
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Insert settings
        result = await db.settings.insert_one(default_settings)

        if result.inserted_id:
            print("✅ Settings created successfully!")
            print("\n📋 Settings Summary:")
            print(f"   Company: {default_settings['company_name']}")
            print(f"   Phone: {default_settings['phone']}")
            print(f"   Email: {default_settings['email']}")
            print(f"   Address: {default_settings['address']['street']}, {default_settings['address']['city']}")
            print(f"   Service Area: {default_settings['service_area']}")

            print("\n✅ SETTINGS INITIALIZED!")
            print("\n🎉 Your website should now load correctly!")
            print("\n📋 Next Steps:")
            print("  1. Refresh homepage: https://cnstoolsandrepair.com")
            print("  2. Check admin dashboard: https://cnstoolsandrepair.com/admin/login")
            print("  3. Customize settings in admin panel")
        else:
            print("❌ Failed to create settings")
            sys.exit(1)

        # Close connection
        client.close()

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
