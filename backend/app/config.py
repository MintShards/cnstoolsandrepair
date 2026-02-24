from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str
    database_name: str = "cnstoolsandrepair_db_dev"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Email - SendGrid
    sendgrid_api_key: str
    sendgrid_from_email: str
    notification_email: str

    # File Upload
    max_file_size: int = 5242880  # 5MB
    allowed_extensions: str = "jpg,jpeg,png,webp"
    upload_dir: str = "uploads"

    # Environment
    environment: str = "development"

    # Admin Authentication
    admin_password: str

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
