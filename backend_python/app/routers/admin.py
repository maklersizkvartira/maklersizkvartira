from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.models import User, Role, Report, Verification, Listing
from app.routers.auth import get_current_user
from app.schemas.schemas import VerificationSubmitRequest, VerificationResponse

router = APIRouter(prefix="/api/v1/admin", tags=["Admin & Moderation"])

def require_admin(user: User = Depends(get_current_user)):
    if user.role not in [Role.ADMIN, Role.MODERATOR, Role.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat Admin va Moderatorlar kirishi mumkin (Admin or Moderator role required)"
        )
    return user

@router.get("/fraud")
async def get_fraud_signals(current_user: User = Depends(require_admin)):
    return {
        "status": "success",
        "signals": [
            {
                "id": "fraud-501",
                "type": "DUPLICATE_IMAGE",
                "title": "Internetdan olingan rasm aniqlandi",
                "riskScore": 88,
                "detectedAt": datetime.utcnow().isoformat(),
            },
            {
                "id": "fraud-502",
                "type": "SUSPICIOUS_BROKER",
                "title": "Ketma-ket 12 ta e'lon joylangan (Makler ehtimoli 85%)",
                "riskScore": 85,
                "detectedAt": datetime.utcnow().isoformat(),
            }
        ]
    }

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
        verified_at=datetime.utcnow()
    )
    db.add(new_verif)
    
    # Reward XP / Trust score boost
    current_user.trust_score = min(100, current_user.trust_score + 20)
    current_user.is_verified = True
    
    await db.commit()

    return VerificationResponse(
        status="success",
        message="Hujjat muvaffaqiyatli tasdiqlandi. Trust score oshirildi (+20)",
        verification_id=new_verif.id,
        xp_earned=50
    )
