from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import quotes, tools, brands, industries, contact, gallery
from app.routers import settings as settings_router, auth
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    await connect_to_mongo()

    # Create uploads directory if it doesn't exist
    os.makedirs(settings.upload_dir, exist_ok=True)
    print(f"Uploads directory: {os.path.abspath(settings.upload_dir)}")

    yield
    # Shutdown
    await close_mongo_connection()


app = FastAPI(
    title="CNS Tools and Repair API",
    description="Backend API for CNS Tools and Repair website",
    version="1.0.0",
    lifespan=lifespan
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        print(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        print(f"Request error: {str(e)}")
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
