from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import User, Role, UserStatus, Report, Verification, Listing, ListingStatus, AuditLog
from app.routers.auth import get_current_user
from app.schemas.schemas import (
    UserOut, UserStatusUpdateRequest,
    VerificationSubmitRequest, VerificationResponse, VerificationReviewRequest,
    ListingModerateRequest
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin & Moderation"])

def require_admin(user: User = Depends(get_current_user)) -> User:
    """Ensure current user has ADMIN, MODERATOR, or SUPER_ADMIN role."""
    if user.role not in [Role.ADMIN, Role.MODERATOR, Role.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat Admin va Moderatorlar kirishi mumkin (Admin or Moderator role required)"
        )
    return user

# User Management Endpoints
@router.get("/users", response_model=dict)
async def list_users(
    role: Optional[Role] = Query(None),
    user_status: Optional[UserStatus] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    query = select(User).options(selectinload(User.profile))
    if role:
        query = query.filter(User.role == role)
    if user_status:
        query = query.filter(User.status == user_status)

    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()

    user_list = []
    for u in users:
        user_list.append({
            "id": u.id,
            "phone": u.phone,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "trustScore": u.trust_score,
            "riskScore": u.risk_score,
            "isVerified": u.is_verified,
            "firstName": u.profile.first_name if u.profile else None,
            "lastName": u.profile.last_name if u.profile else None,
            "createdAt": u.created_at.isoformat()
        })

    return {
        "status": "success",
        "total": len(user_list),
        "users": user_list
    }

@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.id == user_id))
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foydalanuvchi topilmadi"
        )

    target_user.status = payload.status
    
    audit = AuditLog(
        actor_id=current_user.id,
        action=f"ADMIN_UPDATE_USER_STATUS_{payload.status}",
        target_type="USER",
        target_id=target_user.id
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "success",
        "message": f"Foydalanuvchi holati {payload.status} ga o'zgartirildi",
        "user_id": target_user.id,
        "new_status": target_user.status
    }

# Fraud Signals Endpoint
@router.get("/fraud")
async def get_fraud_signals(current_user: User = Depends(require_admin)):
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "status": "success",
        "signals": [
            {
                "id": "fraud-501",
                "type": "DUPLICATE_IMAGE",
                "title": "Internetdan olingan rasm aniqlandi",
                "riskScore": 88,
                "detectedAt": now_iso,
            },
            {
                "id": "fraud-502",
                "type": "SUSPICIOUS_BROKER",
                "title": "Ketma-ket 12 ta e'lon joylangan (Makler ehtimoli 85%)",
                "riskScore": 85,
                "detectedAt": now_iso,
            }
        ]
    }

# User Reports Endpoint
@router.get("/reports")
async def get_reports(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Report).order_by(Report.created_at.desc()))
    reports = result.scalars().all()
    
    return {
        "status": "success",
        "reports": [
            {
                "id": r.id,
                "reporterId": r.reporter_id,
                "targetType": r.target_type,
                "targetId": r.target_id,
                "reason": r.reason,
                "description": r.description,
                "status": r.status,
                "priority": r.priority,
                "createdAt": r.created_at.isoformat()
            }
            for r in reports
        ]
    }

# Verification Queue & Moderation
@router.get("/verifications")
async def get_verifications_queue(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Verification).order_by(Verification.created_at.desc()))
    verifications = result.scalars().all()

    return {
        "status": "success",
        "verifications": [
            {
                "id": v.id,
                "userId": v.user_id,
                "type": v.type,
                "status": v.status,
                "documentUrl": v.document_url,
                "createdAt": v.created_at.isoformat()
            }
            for v in verifications
        ]
    }

@router.post("/verifications/{verification_id}/review")
async def review_verification(
    verification_id: str,
    payload: VerificationReviewRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Verification).filter(Verification.id == verification_id))
    verif = result.scalars().first()

    if not verif:
        raise HTTPException(status_code=404, detail="Verifikatsiya so'rovi topilmadi")

    verif.status = payload.action
    verif.verified_at = datetime.now(timezone.utc)

    if payload.action == "APPROVED":
        # Reward trust score boost to target user
        user_res = await db.execute(select(User).filter(User.id == verif.user_id))
        target_user = user_res.scalars().first()
        if target_user:
            target_user.trust_score = min(100, target_user.trust_score + 25)
            target_user.is_verified = True

    await db.commit()

    return {
        "status": "success",
        "message": f"Verifikatsiya holati {payload.action} deb yangilandi",
        "verification_id": verif.id
    }

# Submit user document (Available for logged-in user or admin)
@router.post("/verifications/submit", response_model=VerificationResponse)
async def submit_user_verification(
    payload: VerificationSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_verif = Verification(
        user_id=current_user.id,
        type=payload.type,
        status="APPROVED",
        document_url=payload.document_url,
        verified_at=datetime.now(timezone.utc)
    )
    db.add(new_verif)
    
    current_user.trust_score = min(100, current_user.trust_score + 20)
    current_user.is_verified = True
    
    await db.commit()

    return VerificationResponse(
        status="success",
        message="Hujjat muvaffaqiyatli tasdiqlandi. Trust score oshirildi (+20)",
        verification_id=new_verif.id,
        xp_earned=50
    )
