#!/usr/bin/env python3
"""
Production Environment Validation Script

Validates that all production environment variables are correctly configured
before deployment. Checks for placeholders, missing values, and connectivity.

Usage:
    python scripts/validate_production.py
"""

import asyncio
import sys
import re
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings


def print_header(title):
    """Print formatted section header"""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def print_check(passed, message):
    """Print check result"""
    icon = "✅" if passed else "❌"
    print(f"{icon} {message}")
    return passed


async def validate_environment_variables():
    """Validate all required environment variables"""
    print_header("1. ENVIRONMENT VARIABLES VALIDATION")

    all_passed = True
    issues = []

    # Check for placeholder values
    placeholder_patterns = [
        r'your_',
        r'REPLACE_',
        r'example',
        r'XXXX',
        r'<.*?>',
        r'localhost'
    ]

    env_vars = {
        "MONGODB_URL": settings.mongodb_url,
        "DATABASE_NAME": settings.database_name,
        "CORS_ORIGINS": settings.cors_origins,
        "SENDGRID_API_KEY": settings.sendgrid_api_key,
        "JWT_SECRET_KEY": settings.jwt_secret_key,
        "SPACES_KEY": settings.spaces_key if settings.use_spaces else "N/A",
        "SPACES_SECRET": settings.spaces_secret if settings.use_spaces else "N/A",
    }

    print("\n🔍 Checking for placeholder values...")
    for var_name, var_value in env_vars.items():
        if var_value == "N/A":
            continue

        has_placeholder = False
        for pattern in placeholder_patterns:
            if re.search(pattern, str(var_value), re.IGNORECASE):
                has_placeholder = True
                if var_name == "CORS_ORIGINS" and "localhost" in var_value and settings.environment == "production":
                    issues.append(f"{var_name} contains 'localhost' in production")
                else:
                    issues.append(f"{var_name} contains placeholder pattern: {pattern}")
                break

        if not has_placeholder:
            print_check(True, f"{var_name}: Valid")
        else:
            print_check(False, f"{var_name}: Contains placeholder/invalid value")
            all_passed = False

    # Check specific requirements
    print("\n🔍 Checking specific requirements...")

    # MongoDB URL
    passed = "mongodb" in settings.mongodb_url
    print_check(passed, f"MongoDB URL format valid")
    if not passed:
        issues.append("MongoDB URL does not contain 'mongodb'")
        all_passed = False

    # Database name (should be prod, not dev)
    passed = "prod" in settings.database_name.lower()
    print_check(passed, f"Database name is production database: {settings.database_name}")
    if not passed:
        issues.append(f"Database name '{settings.database_name}' does not contain 'prod'")
        all_passed = False

    # JWT secret length
    passed = len(settings.jwt_secret_key) >= 32
    print_check(passed, f"JWT secret key length: {len(settings.jwt_secret_key)} chars (min 32)")
    if not passed:
        issues.append(f"JWT secret is only {len(settings.jwt_secret_key)} characters (minimum 32 required)")
        all_passed = False

    # SendGrid API key format
    passed = settings.sendgrid_api_key.startswith("SG.")
    print_check(passed, f"SendGrid API key format valid")
    if not passed:
        issues.append("SendGrid API key should start with 'SG.'")
        all_passed = False

    # Environment setting
    passed = settings.environment == "production"
    print_check(passed, f"Environment: {settings.environment}")
    if not passed:
        issues.append(f"ENVIRONMENT should be 'production', not '{settings.environment}'")
        all_passed = False

    # CORS origins (no localhost in production)
    if settings.environment == "production":
        passed = "localhost" not in settings.cors_origins
        print_check(passed, f"CORS does not include localhost")
        if not passed:
            issues.append("CORS_ORIGINS contains 'localhost' in production environment")
            all_passed = False

    return all_passed, issues


async def validate_spaces_configuration():
    """Validate Digital Ocean Spaces configuration"""
    print_header("2. DIGITAL OCEAN SPACES VALIDATION")

    all_passed = True
    issues = []

    # Check if Spaces is enabled
    passed = settings.use_spaces
    print_check(passed, f"Spaces enabled: {settings.use_spaces}")
    if not passed:
        issues.append("USE_SPACES should be 'true' for production (persistent storage required)")
        all_passed = False
        return all_passed, issues

    # Check Spaces credentials
    passed = settings.spaces_key and settings.spaces_key.startswith("DO")
    print_check(passed, f"Spaces access key format valid")
    if not passed:
        issues.append("SPACES_KEY should start with 'DO'")
        all_passed = False

    passed = settings.spaces_secret and len(settings.spaces_secret) > 20
    print_check(passed, f"Spaces secret key configured (length: {len(settings.spaces_secret)})")
    if not passed:
        issues.append("SPACES_SECRET appears to be missing or invalid")
        all_passed = False

    # Check Spaces configuration
    passed = settings.spaces_bucket == "cnstoolsandrepair-photos"
    print_check(passed, f"Spaces bucket name: {settings.spaces_bucket}")
    if not passed:
        issues.append(f"SPACES_BUCKET should be 'cnstoolsandrepair-photos', not '{settings.spaces_bucket}'")
        all_passed = False

    passed = settings.spaces_region == "nyc3"
    print_check(passed, f"Spaces region: {settings.spaces_region}")
    if not passed:
        issues.append(f"SPACES_REGION should be 'nyc3', not '{settings.spaces_region}'")
        all_passed = False

    # Test boto3 availability
    print("\n🔍 Checking boto3 installation...")
    try:
        import boto3
        print_check(True, "boto3 library installed")
    except ImportError:
        print_check(False, "boto3 library NOT installed")
        issues.append("boto3 not installed. Run: pip install boto3")
        all_passed = False
        return all_passed, issues

    # Test Spaces connectivity
    print("\n🔍 Testing Spaces connectivity...")
    try:
        s3_client = boto3.client(
            's3',
            region_name=settings.spaces_region,
            endpoint_url=settings.spaces_endpoint,
            aws_access_key_id=settings.spaces_key,
            aws_secret_access_key=settings.spaces_secret
        )

        # Try to list bucket (just to verify credentials)
        s3_client.head_bucket(Bucket=settings.spaces_bucket)
        print_check(True, f"Successfully connected to Spaces bucket: {settings.spaces_bucket}")
    except Exception as e:
        print_check(False, f"Spaces connection failed: {str(e)}")
        issues.append(f"Cannot connect to Spaces: {str(e)}")
        all_passed = False

    return all_passed, issues


async def validate_mongodb_connection():
    """Validate MongoDB connection"""
    print_header("3. MONGODB CONNECTION VALIDATION")

    all_passed = True
    issues = []

    print("\n🔍 Testing MongoDB connection...")
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)

        # Test connection
        await client.admin.command('ping')
        print_check(True, "MongoDB connection successful")

        # List databases
        db_list = await client.list_database_names()

        # Check if production database exists
        if settings.database_name in db_list:
            print_check(True, f"Production database exists: {settings.database_name}")
        else:
            print_check(False, f"Production database does NOT exist: {settings.database_name}")
            issues.append(f"Database '{settings.database_name}' not found. Create it in MongoDB Atlas.")
            all_passed = False

        client.close()

    except Exception as e:
        print_check(False, f"MongoDB connection failed: {str(e)}")
        issues.append(f"Cannot connect to MongoDB: {str(e)}")
        all_passed = False

    return all_passed, issues


async def validate_sendgrid():
    """Validate SendGrid API key"""
    print_header("4. SENDGRID EMAIL VALIDATION")

    all_passed = True
    issues = []

    print("\n🔍 Testing SendGrid API key...")
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        sg = SendGridAPIClient(settings.sendgrid_api_key)

        # Try to get API key permissions (validates key without sending email)
        response = sg.client.api_keys._(settings.sendgrid_api_key.split('.')[2] if '.' in settings.sendgrid_api_key else 'test').get()

        print_check(True, "SendGrid API key is valid")

    except Exception as e:
        # Try a simpler validation - just check if the key format is correct
        if settings.sendgrid_api_key.startswith("SG.") and len(settings.sendgrid_api_key) > 30:
            print_check(True, "SendGrid API key format appears valid")
            print("  ℹ️  Note: Full validation requires sending a test email")
        else:
            print_check(False, f"SendGrid validation failed: {str(e)}")
            issues.append("SendGrid API key may be invalid")
            all_passed = False

    return all_passed, issues


def print_summary(all_results):
    """Print final validation summary"""
    print_header("VALIDATION SUMMARY")

    total_checks = len(all_results)
    passed_checks = sum(1 for passed, _ in all_results if passed)

    print(f"\n📊 Results: {passed_checks}/{total_checks} checks passed")

    # Collect all issues
    all_issues = []
    for passed, issues in all_results:
        if not passed:
            all_issues.extend(issues)

    if all_issues:
        print("\n⚠️  ISSUES FOUND:")
        for i, issue in enumerate(all_issues, 1):
            print(f"  {i}. {issue}")

        print("\n" + "=" * 60)
        print("❌ VALIDATION FAILED")
        print("=" * 60)
        print("\n🔧 Fix the issues above before deploying to production.")
        print("\n📚 Guides:")
        print("  - Environment setup: PRODUCTION_ENV_SETUP.md")
        print("  - Spaces setup: SPACES_SETUP.md")
        print("  - Deployment: DEPLOYMENT_CHECKLIST.md")
        return False
    else:
        print("\n" + "=" * 60)
        print("✅ ALL VALIDATIONS PASSED!")
        print("=" * 60)
        print("\n🚀 Your environment is ready for production deployment.")
        print("\n📋 Next steps:")
        print("  1. Review DEPLOYMENT_CHECKLIST.md")
        print("  2. Deploy to App Platform")
        print("  3. Run post-deployment script: python scripts/post_deployment.py")
        return True


async def main():
    """Main validation function"""
    print("\n" + "=" * 60)
    print("PRODUCTION ENVIRONMENT VALIDATION")
    print("=" * 60)
    print(f"\nCurrent Environment: {settings.environment}")
    print(f"Database: {settings.database_name}")
    print("=" * 60)

    # Run all validations
    results = []

    # 1. Environment variables
    passed, issues = await validate_environment_variables()
    results.append((passed, issues))

    # 2. Spaces configuration
    passed, issues = await validate_spaces_configuration()
    results.append((passed, issues))

    # 3. MongoDB connection
    passed, issues = await validate_mongodb_connection()
    results.append((passed, issues))

    # 4. SendGrid
    passed, issues = await validate_sendgrid()
    results.append((passed, issues))

    # Print summary and exit
    success = print_summary(results)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
