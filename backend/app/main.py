from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi_csrf_protect import CsrfProtect
from fastapi_csrf_protect.exceptions import CsrfProtectError
from pydantic import BaseModel
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import quotes, tools, brands, industries, contact, gallery
from app.routers import settings as settings_router, auth, about_content, home_content, industries_content, contact_content


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    await connect_to_mongo()

    # Create uploads directory if it doesn't exist
    from pathlib import Path
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    print(f"Uploads directory: {Path(settings.upload_dir).absolute()}")

    yield
    # Shutdown
    await close_mongo_connection()


# CSRF Settings
class CsrfSettings(BaseModel):
    secret_key: str = settings.jwt_secret_key
    cookie_samesite: str = "lax"
    cookie_secure: bool = settings.environment == "production"  # Auto-enable in production


@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings()


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="CNS Tools and Repair API",
    description="Backend API for CNS Tools and Repair website",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CSRF exception handler
@app.exception_handler(CsrfProtectError)
async def csrf_protect_exception_handler(request: Request, exc: CsrfProtectError):
    return {"detail": "CSRF token validation failed"}

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        print(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        import traceback
        print(f"Request error: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        raise

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for serving uploaded files
try:
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    print(f"Mounted uploads directory: {settings.upload_dir}")
except Exception as e:
    print(f"Failed to mount uploads directory: {str(e)}")

# Include routers
app.include_router(quotes.router)
app.include_router(tools.router)
app.include_router(brands.router)
app.include_router(industries.router)
app.include_router(contact.router)
app.include_router(gallery.router)
app.include_router(settings_router.router)
app.include_router(auth.router)
app.include_router(about_content.router)
app.include_router(home_content.router)
app.include_router(industries_content.router)
app.include_router(contact_content.router)


@app.get("/api/csrf-token")
async def get_csrf_token(request: Request):
    """Generate CSRF token for form submissions"""
    try:
        csrf_protect = CsrfProtect()
        csrf_token, signed_token = csrf_protect.generate_csrf_tokens()
        response = {"csrf_token": csrf_token}
        # Set CSRF cookie
        csrf_protect.set_csrf_cookie(signed_token, response)
        return response
    except Exception as e:
        # Fallback if CSRF protection fails (development mode)
        print(f"CSRF token generation failed: {str(e)}")
        return {"csrf_token": "dev-token"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CNS Tools and Repair API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
