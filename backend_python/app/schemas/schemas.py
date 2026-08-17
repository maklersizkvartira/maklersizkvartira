from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.models import Role, UserStatus, ListingStatus, VerificationLevelType

# OTP Schemas
class OtpSendRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")

class OtpSendResponse(BaseModel):
    status: str = "success"
    message: str
    otp_id: str

class OtpVerifyRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")
    code: str = Field(..., example="1234")

class OtpVerifyResponse(BaseModel):
    status: str = "success"
    message: str
    verified: bool

# Auth Register & Login Schemas
class UserRegisterRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")
    code: str = Field(..., example="1234")
    first_name: str = Field(..., example="Alisher")
    last_name: str = Field(..., example="Valiyev")
    password: str = Field(..., min_length=6, example="SecurePass123!")
    role: Role = Role.TENANT

class UserLoginRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")
    password: str = Field(..., example="SecurePass123!")

class GoogleAuthRequest(BaseModel):
    email: str = Field(..., example="user@gmail.com")
    name: str = Field(..., example="Alisher Valiyev")
    avatar: Optional[str] = None
    uid: str = Field(..., example="google-uid-12345")
    id_token: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    phone: str
    role: Role
    first_name: str
    last_name: str
    trust_score: int

class TokenRefreshRequest(BaseModel):
    refresh_token: str

# User & Profile Schemas
class ProfileOut(BaseModel):
    first_name: str
    last_name: str
    avatar: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None

class UserMeResponse(BaseModel):
    id: str
    phone: str
    email: Optional[str] = None
    role: Role
    status: UserStatus
    trust_score: int
    risk_score: int
    is_verified: bool
    profile: Optional[ProfileOut] = None

# Listing Schemas
class ListingCreateRequest(BaseModel):
    title: str = Field(..., example="Oybek metrosi yaqinida 2 xonali kvartira")
    description: str = Field(..., example="Barcha sharoitlari bor, faqat ijarachilar uchun. Egasi o'zim.")
    price: float = Field(..., example=5500000)
    region: str = Field("Toshkent shahri", example="Toshkent shahri")
    district: str = Field("Mirobod", example="Mirobod")
    currency: str = Field("UZS", example="UZS")
    images: List[str] = Field(default_factory=list)

class ListingOut(BaseModel):
    id: str
    title: str
    description: str
    price: float
    currency: str
    region: str
    district: str
    trust_score: int
    risk_score: int
    ai_check_status: str
    owner_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# AI Risk Scan Schemas
class AIScanRequest(BaseModel):
    description: str
    images: List[str] = Field(default_factory=list)

class AIScanResponse(BaseModel):
    status: str = "success"
    ai_analysis: dict

# Verification Schemas
class VerificationSubmitRequest(BaseModel):
    type: VerificationLevelType
    document_url: Optional[str] = None

class VerificationResponse(BaseModel):
    status: str = "success"
    message: str
    verification_id: str
    xp_earned: int = 50
