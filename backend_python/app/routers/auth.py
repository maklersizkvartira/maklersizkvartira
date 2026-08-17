from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    security_bearer
)
from app.models.models import User, Profile, OwnerProfile, OtpVerification, Role, UserStatus, AuditLog
from app.schemas.schemas import (
    OtpSendRequest, OtpSendResponse,
    OtpVerifyRequest, OtpVerifyResponse,
    UserRegisterRequest, UserLoginRequest, GoogleAuthRequest, TokenResponse,
    TokenRefreshRequest, UserMeResponse, ProfileOut
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token mazmuni noto'g'ri (Invalid token payload)"
        )
    
    result = await db.execute(
        select(User).options(selectinload(User.profile)).filter(User.id == user_id)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foydalanuvchi topilmadi (User not found)"
        )
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akkaunt faol emas yoki bloklangan (User account is not active)"
        )
    return user

@router.post("/otp/send", response_model=OtpSendResponse)
async def send_otp(payload: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    code = "1234"  # Default test code, expandable to real SMS gateway (PlaySMS/Eskiz)
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    otp = OtpVerification(phone=phone, code=code, expires_at=expires_at)
    db.add(otp)
    await db.flush()

    return OtpSendResponse(
        status="success",
        message=f"SMS OTP code {code} sent to {phone}",
        otp_id=otp.id
    )

@router.post("/otp/verify", response_model=OtpVerifyResponse)
async def verify_otp(payload: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    code = payload.code.strip()

    result = await db.execute(
        select(OtpVerification)
        .filter(OtpVerification.phone == phone, OtpVerification.code == code)
        .order_by(OtpVerification.created_at.desc())
    )
    otp = result.scalars().first()

    if not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMS OTP kod noto'g'ri (Incorrect OTP code)"
        )

    otp.is_verified = True
    await db.flush()

    return OtpVerifyResponse(
        status="success",
        message="SMS OTP muvaffaqiyatli tasdiqlandi",
        verified=True
    )

@router.post("/register", response_model=TokenResponse)
async def register_user(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    
    # Check if user already exists
    existing_user_result = await db.execute(select(User).filter(User.phone == phone))
    if existing_user_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ushbu telefon raqam allaqachon ro'yxatdan o'tgan (Phone number already registered)"
        )

    # Hash password securely
    hashed_pwd = get_password_hash(payload.password)

    # Create User
    new_user = User(
        phone=phone,
        password_hash=hashed_pwd,
        role=payload.role,
        status=UserStatus.ACTIVE,
        trust_score=20,  # Phone OTP verified bonus (+10 -> 20)
        risk_score=0,
        is_verified=True
    )
    db.add(new_user)
    await db.flush()

    # Create Profile
    new_profile = Profile(
        user_id=new_user.id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        city="Toshkent"
    )
    db.add(new_profile)

    # If role is OWNER, create OwnerProfile
    if payload.role == Role.OWNER:
        new_owner = OwnerProfile(
            user_id=new_user.id,
            owner_type="INDIVIDUAL",
            trust_level="GREEN"
        )
        db.add(new_owner)

    # Log Audit Event
    audit = AuditLog(
        actor_id=new_user.id,
        action="USER_REGISTER",
        target_type="USER",
        target_id=new_user.id
    )
    db.add(audit)

    await db.commit()

    # Create JWT Tokens
    access_token = create_access_token(subject=new_user.id, role=new_user.role.value)
    refresh_token = create_refresh_token(subject=new_user.id, role=new_user.role.value)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=new_user.id,
        phone=new_user.phone,
        role=new_user.role,
        first_name=new_profile.first_name,
        last_name=new_profile.last_name,
        trust_score=new_user.trust_score
    )

@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    
    result = await db.execute(
        select(User).options(selectinload(User.profile)).filter(User.phone == phone)
    )
    user = result.scalars().first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telefon raqami yoki parol noto'g me (Invalid phone or password)"
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akkaunt bloklangan yoki muvaqqat to'xtatilgan"
        )

    first_name = user.profile.first_name if user.profile else "Foydalanuvchi"
    last_name = user.profile.last_name if user.profile else ""

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

    # Log Login Audit
    audit = AuditLog(
        actor_id=user.id,
        action="USER_LOGIN",
        target_type="USER",
        target_id=user.id
    )
    db.add(audit)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        phone=user.phone,
        role=user.role,
        first_name=first_name,
        last_name=last_name,
        trust_score=user.trust_score
    )

@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    
    # Check if user exists by email
    result = await db.execute(
        select(User).options(selectinload(User.profile)).filter(User.email == email)
    )
    user = result.scalars().first()

    if not user:
        # Register new Google User
        name_parts = payload.name.strip().split(' ')
        first_name = name_parts[0] if name_parts[0] else "Google"
        last_name = name_parts[1] if len(name_parts) > 1 else "User"

        user = User(
            phone=f"+google_{payload.uid[:10]}",
            email=email,
            password_hash=None,
            role=Role.TENANT,
            status=UserStatus.ACTIVE,
            trust_score=30, # Google OAuth verified bonus
            risk_score=0,
            is_verified=True
        )
        db.add(user)
        await db.flush()

        profile = Profile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            avatar=payload.avatar,
            city="Toshkent"
        )
        db.add(profile)
        
        audit = AuditLog(
            actor_id=user.id,
            action="GOOGLE_REGISTER",
            target_type="USER",
            target_id=user.id
        )
        db.add(audit)
        await db.commit()
    else:
        audit = AuditLog(
            actor_id=user.id,
            action="GOOGLE_LOGIN",
            target_type="USER",
            target_id=user.id
        )
        db.add(audit)
        await db.commit()

    first_name = user.profile.first_name if user.profile else "Google"
    last_name = user.profile.last_name if user.profile else "User"

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        phone=user.phone,
        role=user.role,
        first_name=first_name,
        last_name=last_name,
        trust_score=user.trust_score
    )


@router.post("/refresh")
async def refresh_tokens(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faqat Refresh Token qabul qilinadi"
        )
    
    user_id = decoded.get("sub")
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    new_access_token = create_access_token(subject=user.id, role=user.role.value)
    new_refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserMeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    profile_data = None
    if current_user.profile:
        profile_data = ProfileOut(
            first_name=current_user.profile.first_name,
            last_name=current_user.profile.last_name,
            avatar=current_user.profile.avatar,
            city=current_user.profile.city,
            district=current_user.profile.district
        )
    
    return UserMeResponse(
        id=current_user.id,
        phone=current_user.phone,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        trust_score=current_user.trust_score,
        risk_score=current_user.risk_score,
        is_verified=current_user.is_verified,
        profile=profile_data
    )
