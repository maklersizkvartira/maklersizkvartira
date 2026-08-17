import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, listings, ai, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables automatically on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown logic if any
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(ai.router)
app.include_router(admin.router)

# Root Endpoint
@app.get("/")
async def root():
    return {
        "message": "Maklersiz.uz Python Backend API - Railway Production Server Ready",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

# Health Check Endpoint
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "OK",
        "service": "Maklersiz.uz Python Backend Production API",
        "env": os.getenv("RAILWAY_ENVIRONMENT", "production"),
        "aiEngineStatus": "Active (Shield AI v1.2 Python Engine)",
        "security": "JWT + Password Hashing (PBKDF2/Bcrypt) + RBAC active"
    }

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Ichki server xatoligi yuz berdi",
            "detail": str(exc)
        }
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", settings.PORT))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
