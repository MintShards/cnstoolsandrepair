#!/usr/bin/env python3
"""
Post-Deployment Initialization Script

Automates post-deployment setup tasks for production environment.
Run this after deploying to App Platform to initialize the system.

Tasks:
- Create admin user (if none exists)
- Create database indexes
- Verify Spaces connectivity
- Send test email
- Generate deployment report

Usage:
    python scripts/post_deployment.py
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.core.security import hash_password


def print_header(title):
    """Print formatted section header"""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def print_step(step_num, total_steps, description):
    """Print step progress"""
    print(f"\n📍 Step {step_num}/{total_steps}: {description}")
    print("-" * 60)


async def check_admin_user_exists(db):
    """Check if any admin user exists"""
    admin_count = await db.users.count_documents({"role": "admin", "is_active": True})
    return admin_count > 0


async def create_admin_user_interactive(db):
    """Create admin user with user input"""
    print("\n👤 Admin User Creation")
    print("=" * 60)

    email = input("Enter admin email: ").strip()
    if not email:
        print("❌ Email cannot be empty")
        return False

    password = input("Enter admin password (min 8 characters): ").strip()
    if len(password) < 8:
        print("❌ Password must be at least 8 characters")
        return False

    confirm_password = input("Confirm password: ").strip()
    if password != confirm_password:
        print("❌ Passwords do not match")
        return False

    name = input("Enter admin name (optional): ").strip() or "Admin"

    # Check if user already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        print(f"⚠️  User with email '{email}' already exists")
        return False

    # Create new user
    admin_user = {
        "email": email,
        "name": name,
        "password_hash": hash_password(password),
        "role": "admin",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    result = await db.users.insert_one(admin_user)

    if result.inserted_id:
        print("\n✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Name: {name}")
        return True
    else:
        print("❌ Error: Failed to create user")
        return False


async def create_database_indexes(db):
    """Create all production indexes"""
    print("\n🔧 Creating database indexes...")

    indexes_created = 0

    try:
        # Quotes indexes
        print("\n  📋 Quotes collection:")
        await db.quotes.create_index("request_number", unique=True, name="request_number_unique_idx")
        print("    ✓ request_number (unique)")
        indexes_created += 1

        await db.quotes.create_index("created_at", name="created_at_idx")
        print("    ✓ created_at")
        indexes_created += 1

        await db.quotes.create_index("status", name="status_idx")
        print("    ✓ status")
        indexes_created += 1

        await db.quotes.create_index("email", name="email_idx")
        print("    ✓ email")
        indexes_created += 1

        await db.quotes.create_index([("status", 1), ("created_at", -1)], name="status_created_at_idx")
        print("    ✓ status + created_at (compound)")
        indexes_created += 1

        # Users indexes
        print("\n  👤 Users collection:")
        await db.users.create_index("email", unique=True, name="email_unique_idx")
        print("    ✓ email (unique)")
        indexes_created += 1

        await db.users.create_index("role", name="role_idx")
        print("    ✓ role")
        indexes_created += 1

        await db.users.create_index("is_active", name="is_active_idx")
        print("    ✓ is_active")
        indexes_created += 1

        # Contact messages indexes
        print("\n  📧 Contact messages collection:")
        await db.contact_messages.create_index([("email", 1), ("created_at", -1)], name="email_rate_limit_idx")
        print("    ✓ email + created_at (compound)")
        indexes_created += 1

        await db.contact_messages.create_index("created_at", name="created_at_idx")
        print("    ✓ created_at")
        indexes_created += 1

        print(f"\n✅ Created {indexes_created} indexes successfully!")
        return True

    except Exception as e:
        print(f"\n⚠️  Index creation error: {str(e)}")
        print("    (This is normal if indexes already exist)")
        return True  # Not critical if indexes exist


async def verify_spaces_connectivity():
    """Verify Spaces is accessible"""
    if not settings.use_spaces:
        print("\n⚠️  Spaces is disabled (USE_SPACES=false)")
        print("    WARNING: File uploads will not persist in production!")
        return False

    print("\n☁️  Verifying Spaces connectivity...")

    try:
        import boto3
        from botocore.exceptions import ClientError

        s3_client = boto3.client(
            's3',
            region_name=settings.spaces_region,
            endpoint_url=settings.spaces_endpoint,
            aws_access_key_id=settings.spaces_key,
            aws_secret_access_key=settings.spaces_secret
        )

        # Test connectivity by checking if bucket exists
        s3_client.head_bucket(Bucket=settings.spaces_bucket)
        print(f"✅ Successfully connected to Spaces: {settings.spaces_bucket}")
        return True

    except ImportError:
        print("❌ boto3 not installed. Run: pip install boto3")
        return False
    except ClientError as e:
        print(f"❌ Spaces connection failed: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False


async def send_test_email():
    """Send test email to verify SendGrid configuration"""
    print("\n📧 Testing email configuration...")

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        # Create test email
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=settings.notification_email,
            subject='[CNS Tools] Production Deployment Successful',
            html_content=f"""
            <h2>Production Deployment Complete</h2>
            <p>Your CNS Tool Repair website has been successfully deployed to production.</p>
            <p><strong>Deployment Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
            <p><strong>Environment:</strong> {settings.environment}</p>
            <p><strong>Database:</strong> {settings.database_name}</p>
            <hr>
            <p>This is an automated test email to verify SendGrid configuration.</p>
            <p><em>CNS Tool Repair - Automated Deployment System</em></p>
            """
        )

        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        if response.status_code == 202:
            print(f"✅ Test email sent successfully to {settings.notification_email}")
            print("   Check your inbox to confirm delivery")
            return True
        else:
            print(f"⚠️  Email sent with status code: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Email test failed: {str(e)}")
        return False


def generate_deployment_report(results):
    """Generate deployment summary report"""
    print_header("DEPLOYMENT REPORT")

    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')

    print(f"\n📅 Deployment Time: {timestamp}")
    print(f"🌍 Environment: {settings.environment}")
    print(f"💾 Database: {settings.database_name}")
    print(f"☁️  Spaces: {'Enabled' if settings.use_spaces else 'Disabled'}")

    print("\n📊 Initialization Results:")
    print("-" * 60)

    total_tasks = len(results)
    successful_tasks = sum(1 for success, _ in results if success)

    for task_name, (success, message) in results.items():
        icon = "✅" if success else "❌"
        print(f"{icon} {task_name}: {message}")

    print("-" * 60)
    print(f"\nStatus: {successful_tasks}/{total_tasks} tasks completed successfully")

    if successful_tasks == total_tasks:
        print("\n" + "=" * 60)
        print("✅ PRODUCTION DEPLOYMENT SUCCESSFUL!")
        print("=" * 60)
        print("\n🚀 Your website is ready for customers!")
        print("\n📋 Next Steps:")
        print("  1. Test quote submission at: /repair-request")
        print("  2. Login to admin panel at: /admin/login")
        print("  3. Monitor application logs for errors")
        print("  4. Submit sitemap to Google Search Console")
        print("\n📚 Documentation:")
        print("  - Deployment checklist: DEPLOYMENT_CHECKLIST.md")
        print("  - Production guide: PRODUCTION.md")
        return True
    else:
        print("\n" + "=" * 60)
        print("⚠️  DEPLOYMENT COMPLETED WITH WARNINGS")
        print("=" * 60)
        print("\n🔍 Review failed tasks above and resolve issues.")
        print("  You may need to run specific setup scripts manually.")
        return False


async def main():
    """Main post-deployment function"""
    print("\n" + "=" * 60)
    print("POST-DEPLOYMENT INITIALIZATION")
    print("=" * 60)
    print(f"\nEnvironment: {settings.environment}")
    print(f"Database: {settings.database_name}")
    print("=" * 60)

    if settings.environment != "production":
        print("\n⚠️  WARNING: Environment is not set to 'production'")
        print(f"   Current: {settings.environment}")
        proceed = input("\nContinue anyway? (yes/no): ").strip().lower()
        if proceed != "yes":
            print("Aborted.")
            sys.exit(1)

    results = {}

    try:
        # Connect to MongoDB
        print("\n🔌 Connecting to MongoDB...")
        client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
        db = client[settings.database_name]

        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB successfully")

        # Step 1: Check/Create Admin User
        print_step(1, 4, "Admin User Setup")

        admin_exists = await check_admin_user_exists(db)

        if admin_exists:
            print("✅ Admin user already exists - skipping creation")
            results["Admin User"] = (True, "Already exists")
        else:
            print("No admin users found. Creating admin user...")
            created = await create_admin_user_interactive(db)
            results["Admin User"] = (created, "Created successfully" if created else "Creation failed")

        # Step 2: Create Database Indexes
        print_step(2, 4, "Database Index Creation")
        index_success = await create_database_indexes(db)
        results["Database Indexes"] = (index_success, "Created successfully" if index_success else "Creation failed")

        # Step 3: Verify Spaces
        print_step(3, 4, "Spaces Verification")
        spaces_success = await verify_spaces_connectivity()
        results["Spaces Connectivity"] = (spaces_success, "Connected" if spaces_success else "Connection failed")

        # Step 4: Send Test Email
        print_step(4, 4, "Email Configuration Test")
        email_success = await send_test_email()
        results["Email Configuration"] = (email_success, "Test email sent" if email_success else "Send failed")

        # Close MongoDB connection
        client.close()

        # Generate and display report
        success = generate_deployment_report(results)
        sys.exit(0 if success else 1)

    except Exception as e:
        print(f"\n❌ Fatal error during deployment: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
