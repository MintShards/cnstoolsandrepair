from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str
    database_name: str = "cnstoolsandrepair_db_dev"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Email - Resend
    resend_api_key: str
    sendgrid_from_email: str = "noreply@cnstoolrepair.com"  # kept for backwards compat, unused
    notification_email: str

    # File Upload
    max_file_size: int = 10485760  # 10MB
    allowed_extensions: str = "jpg,jpeg,png,webp"
    upload_dir: str = "uploads"
    upload_base_url: str = "http://localhost:8000"  # For production: https://yourdomain.com or Digital Ocean Spaces URL

    # Digital Ocean Spaces (S3-compatible object storage)
    spaces_region: str = "nyc3"
    spaces_bucket: str = "cnstoolsandrepair-photos"
    spaces_key: str = ""  # Set in .env
    spaces_secret: str = ""  # Set in .env
    spaces_endpoint: str = "https://nyc3.digitaloceanspaces.com"
    use_spaces: bool = False  # Set to True to enable Spaces (requires credentials)

    # Environment
    environment: str = "development"

    # JWT Authentication
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 8

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip() for ext in self.allowed_extensions.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
