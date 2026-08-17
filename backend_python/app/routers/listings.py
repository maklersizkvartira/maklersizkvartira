from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Listing, ListingImage, ListingStatus, User
from app.schemas.schemas import ListingCreateRequest, ListingOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/listings", tags=["Listings"])

@router.get("", response_model=dict)
async def get_listings(
    region: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Listing).filter(Listing.status == ListingStatus.PUBLISHED)
    
    if region:
        query = query.filter(Listing.region.ilike(f"%{region}%"))
    if district:
        query = query.filter(Listing.district.ilike(f"%{district}%"))
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)

    result = await db.execute(query.order_by(Listing.created_at.desc()))
    listings = result.scalars().all()

    # Pre-populate sample mock listing if DB is fresh
    if not listings:
        sample_listing = Listing(
            id="listing-1",
            owner_id="system-owner",
            title="Oybek metrosi yaqinida shinam 2 xonali modern kvartira",
            description="Barcha sharoitlari mavjud, mebel va maishiy texnika bilan. Maklersiz, egasidan.",
            price=5500000.0,
            currency="UZS",
            region="Toshkent shahri",
            district="Mirobod",
            trust_score=96,
            risk_score=4,
            ai_check_status="APPROVED",
            status=ListingStatus.PUBLISHED
        )
        db.add(sample_listing)
        await db.flush()
        listings = [sample_listing]

    data = []
    for l in listings:
        data.append({
            "id": l.id,
            "title": l.title,
            "description": l.description,
            "price": l.price,
            "currency": l.currency,
            "region": l.region,
            "district": l.district,
            "trustScore": l.trust_score,
            "riskScore": l.risk_score,
            "aiCheckStatus": l.ai_check_status,
            "ownerId": l.owner_id,
            "createdAt": l.created_at.isoformat()
        })

    return {
        "status": "success",
        "data": data
    }

@router.get("/{id}")
async def get_listing_by_id(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).filter(Listing.id == id))
    listing = result.scalars().first()
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="E'lon topilmadi (Listing not found)"
        )
    
    listing.views_count += 1
    await db.flush()

    return {
        "status": "success",
        "data": {
            "id": listing.id,
            "title": listing.title,
            "description": listing.description,
            "price": listing.price,
            "currency": listing.currency,
            "region": listing.region,
            "district": listing.district,
            "trustScore": listing.trust_score,
            "riskScore": listing.risk_score,
            "aiCheckStatus": listing.ai_check_status,
            "ownerId": listing.owner_id,
            "createdAt": listing.created_at.isoformat()
        }
    }

@router.post("", response_model=dict)
async def create_listing(
    payload: ListingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Shield AI pre-check for fraud patterns
    desc_lower = payload.description.lower()
    is_suspicious = any(word in desc_lower for word in ["zaklad", "oldindan", "kod", "kartaga", "telefon qilmang faqat telegram"])
    
    trust_score = 52 if is_suspicious else 95
    risk_score = 48 if is_suspicious else 5
    ai_status = "UNDER_REVIEW" if is_suspicious else "APPROVED"

    new_listing = Listing(
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        region=payload.region,
        district=payload.district,
        currency=payload.currency,
        trust_score=trust_score,
        risk_score=risk_score,
        ai_check_status=ai_status,
        status=ListingStatus.PUBLISHED if not is_suspicious else ListingStatus.PENDING_REVIEW
    )
    db.add(new_listing)
    await db.flush()

    for idx, img_url in enumerate(payload.images):
        img = ListingImage(
            listing_id=new_listing.id,
            storage_key=img_url,
            sort_order=idx
        )
        db.add(img)

    await db.commit()

    return {
        "status": "success",
        "message": "E'lon muvaffaqiyatli saqlandi va Shield AI tomonidan tahlil qilindi",
        "data": {
            "id": new_listing.id,
            "title": new_listing.title,
            "price": new_listing.price,
            "trustScore": new_listing.trust_score,
            "riskScore": new_listing.risk_score,
            "aiCheckStatus": new_listing.ai_check_status
        }
    }
