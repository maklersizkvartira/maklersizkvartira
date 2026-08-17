import os
from pydantic import BaseModel

def get_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./maklersiz.db")
    # Railway PostgreSQL fix: replace postgres:// or postgresql:// with postgresql+asyncpg://
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    if raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+asyncpg://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw_url

class Settings(BaseModel):
    PROJECT_NAME: str = "Maklersiz.uz Python Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Security & Auth Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "maklersiz_uz_super_secret_jwt_key_2026_safe_hash_token")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # 7 days
    
    # Database Settings
    DATABASE_URL: str = get_database_url()
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
