import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Role(str, enum.Enum):
    TENANT = "TENANT"
    OWNER = "OWNER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"
    PENDING = "PENDING"

class ListingStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    PUBLISHED = "PUBLISHED"
    PAUSED = "PAUSED"
    REJECTED = "REJECTED"
    RENTED = "RENTED"

class VerificationLevelType(str, enum.Enum):
    PHONE = "PHONE"
    PASSPORT = "PASSPORT"
    SELFIE = "SELFIE"
    CADASTRE = "CADASTRE"
    PREMIUM_OWNER = "PREMIUM_OWNER"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    role = Column(Enum(Role), default=Role.TENANT, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    trust_score = Column(Integer, default=10)
    risk_score = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    owner_profile = relationship("OwnerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="owner")
    verifications = relationship("Verification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="actor")

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    city = Column(String, nullable=True)
    district = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")

class OwnerProfile(Base):
    __tablename__ = "owner_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    owner_type = Column(String, default="INDIVIDUAL")
    verified_properties_count = Column(Integer, default=0)
    successful_rentals = Column(Integer, default=0)
    broker_risk_score = Column(Integer, default=0) # 0-100% broker probability
    trust_level = Column(String, default="GREEN")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="owner_profile")

class Property(Base):
    __tablename__ = "properties"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    property_type = Column(String, default="APARTMENT")
    rooms = Column(Integer, default=1)
    area = Column(Float, default=0.0)
    floor = Column(Integer, default=1)
    total_floors = Column(Integer, default=1)
    price = Column(Float, nullable=False)
    deposit = Column(Float, default=0.0)
    region = Column(String, nullable=False)
    district = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    listings = relationship("Listing", back_populates="property")

class Listing(Base):
    __tablename__ = "listings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id = Column(String, ForeignKey("properties.id", ondelete="CASCADE"), nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ListingStatus), default=ListingStatus.PUBLISHED)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Float, nullable=False)
    trust_score = Column(Integer, default=50)
    risk_score = Column(Integer, default=0)
    ai_check_status = Column(String, default="APPROVED")
    views_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    contact_count = Column(Integer, default=0)
    region = Column(String, default="Toshkent shahri")
    district = Column(String, default="Mirobod")
    currency = Column(String, default="UZS")
    published_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="listings")
    property = relationship("Property", back_populates="listings")
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan")

class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id = Column(String, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    storage_key = Column(String, nullable=False)
    hash = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    ai_risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    listing = relationship("Listing", back_populates="images")

class Verification(Base):
    __tablename__ = "verifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(VerificationLevelType), nullable=False)
    status = Column(String, default="PENDING")
    document_url = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="verifications")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reporter_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_type = Column(String, nullable=False) # LISTING or USER
    target_id = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="OPEN")
    priority = Column(String, default="MEDIUM")
    ai_risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    entity_type = Column(String, nullable=False) # LISTING, IMAGE, BROKER
    entity_id = Column(String, nullable=False)
    model = Column(String, default="shield-ai-v1.2")
    risk_score = Column(Integer, nullable=False)
    confidence = Column(Float, default=0.95)
    reasons_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    actor = relationship("User", back_populates="audit_logs")

class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
