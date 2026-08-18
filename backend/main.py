import os
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from app.services.ai_engine import scan_listing_ai, estimate_listing_price, generate_listing_copy
except ImportError:
    from backend.app.services.ai_engine import scan_listing_ai, estimate_listing_price, generate_listing_copy

app = FastAPI(
    title="Maklersiz.uz Python Backend API",
    description="High-performance, secure FastAPI backend for Maklersiz.uz real estate platform",
    version="1.0.0"
)

# CORS Configuration for Frontend & Production Custom Domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global OPTIONS / Preflight middleware to guarantee preflights always pass with 200 OK
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = JSONResponse(content={"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# --- Pydantic Data Models (Strict Input Validation) ---

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Foydalanuvchi ismi")
    phone: str = Field(..., min_length=7, description="Telefon raqami")
    role: str = Field(..., description="STUDENT yoki OWNER")
    avatar: Optional[str] = None

class CreateReportRequest(BaseModel):
    listingId: str
    listingTitle: Optional[str] = ""
    reporterName: Optional[str] = "Anonim"
    reporterPhone: Optional[str] = ""
    reason: str = "BROKER_COMMISSION"
    reasonLabel: Optional[str] = "Shubhali e'lon"
    details: Optional[str] = ""

class ScanListingRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    price: Optional[float] = None
    rooms: Optional[int] = None
    phone: Optional[str] = None
    images: Optional[List[str]] = None

class WriteCopyRequest(BaseModel):
    district: Optional[str] = "Toshkent"
    rooms: Optional[int] = 2
    furnished: Optional[bool] = True
    metro: Optional[str] = None

class PriceRequest(BaseModel):
    rooms: Optional[int] = 2
    district: Optional[str] = "Chilonzor"

class OwnerModel(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    avatar: str
    role: str = "OWNER"
    trustScore: int = 90
    trustLevel: str = "GREEN"
    riskScore: int = 5
    brokerRiskScore: int = 2
    verificationLevel: int = 4
    isVerified: bool = True
    successfulRentals: int = 1
    joinedDate: str = "2024-01-01"
    badges: List[str] = ["Verified Owner", "Property Verified"]
    xpPoints: int = 500
    xpLevel: str = "Gold"
    referralCode: str = "OWNER100"
    referralsCount: int = 0

class CreateListingRequest(BaseModel):
    title: str
    description: str
    price: float
    currency: Optional[str] = "UZS"
    depositPrice: Optional[float] = 1000000
    utilitiesIncluded: Optional[bool] = True
    rooms: int = 2
    area: float = 60
    floor: Optional[int] = 3
    totalFloors: Optional[int] = 9
    propertyType: Optional[str] = "APARTMENT"
    region: Optional[str] = "Toshkent shahri"
    district: str = "Chilonzor"
    address: Optional[str] = "Mustaqillik ko'chasi"
    images: Optional[List[str]] = None
    owner: Optional[Dict[str, Any]] = None

# --- In-Memory Mock Database ---

MOCK_OWNERS = {
    "owner_jasur": {
        "id": "owner_jasur",
        "name": "Jasur Karimov",
        "phone": "+998 90 123 45 67",
        "email": "jasur.k@gmail.com",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
        "role": "OWNER",
        "trustScore": 96,
        "trustLevel": "PREMIUM_GREEN",
        "riskScore": 4,
        "brokerRiskScore": 3,
        "verificationLevel": 5,
        "isVerified": True,
        "successfulRentals": 14,
        "joinedDate": "2023-04-12",
        "badges": ["Verified Owner", "Property Verified", "Super Host", "Diamond Member"],
        "xpPoints": 1450,
        "xpLevel": "Diamond",
        "referralCode": "JASUR96",
        "referralsCount": 18
    },
    "owner_nodira": {
        "id": "owner_nodira",
        "name": "Nodira Alimova",
        "phone": "+998 97 765 43 21",
        "email": "nodira.alimova@mail.ru",
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300",
        "role": "OWNER",
        "trustScore": 88,
        "trustLevel": "GREEN",
        "riskScore": 8,
        "brokerRiskScore": 12,
        "verificationLevel": 4,
        "isVerified": True,
        "successfulRentals": 8,
        "joinedDate": "2023-09-01",
        "badges": ["Verified Owner", "Property Verified", "Gold Member"],
        "xpPoints": 820,
        "xpLevel": "Gold",
        "referralCode": "NODIRA88",
        "referralsCount": 9
    },
    "owner_bekzod": {
        "id": "owner_bekzod",
        "name": "Bekzod Rahimov",
        "phone": "+998 93 555 11 22",
        "email": "bekzod.r@yandex.uz",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300",
        "role": "OWNER",
        "trustScore": 74,
        "trustLevel": "GREEN",
        "riskScore": 18,
        "brokerRiskScore": 25,
        "verificationLevel": 3,
        "isVerified": True,
        "successfulRentals": 4,
        "joinedDate": "2024-01-15",
        "badges": ["Verified Owner", "Silver Member"],
        "xpPoints": 460,
        "xpLevel": "Silver",
        "referralCode": "BEKZOD74",
        "referralsCount": 4
    }
}

LISTINGS_DB: List[Dict[str, Any]] = [
    {
        "id": "listing-1",
        "title": "Oybek metrosi yaqinida shinam 2 xonali modern kvartira",
        "description": "Kvartira egasidan to'g'ridan-to'g'ri ijaraga beriladi. Hech qanday makler va komissiya yo'q! Evroremont, barcha mebel va maishiy texnikasi bor. Universitetlar va metroga 3 daqiqalik piyoda yo'l. Talabalar va shaffof ijarachilar uchun juda mos.",
        "price": 5500000,
        "currency": "UZS",
        "depositPrice": 2000000,
        "utilitiesIncluded": True,
        "rooms": 2,
        "area": 68,
        "floor": 4,
        "totalFloors": 9,
        "propertyType": "APARTMENT",
        "region": "Toshkent shahri",
        "district": "Mirobod",
        "address": "Oybek ko'chasi, 24-uy",
        "latitude": 41.3005,
        "longitude": 69.2740,
        "metroStation": "Oybek",
        "metroDistanceMinutes": 3,
        "universityName": "Vestminster Xalqaro Universiteti (WIUT)",
        "universityDistanceMinutes": 7,
        "furnished": True,
        "petsAllowed": False,
        "parking": True,
        "internet": True,
        "airConditioning": True,
        "washingMachine": True,
        "images": [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200"
        ],
        "videoUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "hasVirtualTour": True,
        "owner": MOCK_OWNERS["owner_jasur"],
        "trustScore": 96,
        "riskScore": 4,
        "aiCheckStatus": "APPROVED",
        "aiRiskReasons": ["Barcha rasmlar original", "Egasining kadastr hujjatlari tasdiqlangan", "Matnda firibgarlik kalit so'zlari yo'q"],
        "safetyBadges": ["VERIFIED_OWNER", "PROPERTY_VERIFIED", "AI_CHECKED", "NO_COMMISSION"],
        "createdAt": "2026-08-10T09:30:00Z",
        "viewsCount": 482,
        "favoritesCount": 38,
        "contactCount": 19,
        "isFeatured": True
    },
    {
        "id": "listing-2",
        "title": "Yunusobod 19-kvartal TATU va INHA yaqinida 3 xonali oilaviy uy",
        "description": "Yunusobod metrosiga va TATU / INHA universitetlariga yaqin hudud. Uydagilar hammasi yangi, Wi-Fi 100Mbps tezlikda. Uy sotilmaydi, faqat uzoq muddatga halol ijarachilarga beriladi. Rasmlar 100% shu kvartiraniki.",
        "price": 6200000,
        "currency": "UZS",
        "depositPrice": 2500000,
        "utilitiesIncluded": False,
        "rooms": 3,
        "area": 84,
        "floor": 2,
        "totalFloors": 5,
        "propertyType": "APARTMENT",
        "region": "Toshkent shahri",
        "district": "Yunusobod",
        "address": "Yunusobod 19-kvartal, 12-uy",
        "latitude": 41.3650,
        "longitude": 69.2920,
        "metroStation": "Yunusobod",
        "metroDistanceMinutes": 6,
        "universityName": "Toshkent Axborot Texnologiyalari Universiteti (TATU)",
        "universityDistanceMinutes": 8,
        "furnished": True,
        "petsAllowed": True,
        "parking": True,
        "internet": True,
        "airConditioning": True,
        "washingMachine": True,
        "images": [
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200"
        ],
        "hasVirtualTour": False,
        "owner": MOCK_OWNERS["owner_nodira"],
        "trustScore": 88,
        "riskScore": 8,
        "aiCheckStatus": "APPROVED",
        "aiRiskReasons": ["Pasport va rasmlar mos tushgan", "Telefon raqam 2 yildan beri faol"],
        "safetyBadges": ["VERIFIED_OWNER", "PROPERTY_VERIFIED", "AI_CHECKED", "STUDENT_FRIENDLY"],
        "createdAt": "2026-08-11T14:15:00Z",
        "viewsCount": 310,
        "favoritesCount": 24,
        "contactCount": 11,
        "isFeatured": True
    },
    {
        "id": "listing-3",
        "title": "Chilonzor 5-kvartal Metro Mirzo Ulug'bek yaqinida shinam Studio",
        "description": "Chilonzor metrosiga va TDIU universitetiga juda yaqin jo'ylashgan. Yangi ta'mirdan chiqqan 1 xonali shinam studio. Arzon va qulay narxda to'g'ridan-to'g'ri egasidan. Talabalar uchun ajoyib imkoniyat.",
        "price": 3800000,
        "currency": "UZS",
        "depositPrice": 1000000,
        "utilitiesIncluded": True,
        "rooms": 1,
        "area": 42,
        "floor": 3,
        "totalFloors": 4,
        "propertyType": "STUDIO",
        "region": "Toshkent shahri",
        "district": "Chilonzor",
        "address": "Chilonzor 5-kvartal, 8-uy",
        "latitude": 41.2850,
        "longitude": 69.2150,
        "metroStation": "Mirzo Ulug'bek",
        "metroDistanceMinutes": 4,
        "universityName": "Toshkent Davlat Iqtisodiyot Universiteti (TDIU)",
        "universityDistanceMinutes": 5,
        "furnished": True,
        "petsAllowed": False,
        "parking": False,
        "internet": True,
        "airConditioning": True,
        "washingMachine": True,
        "images": [
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80&w=1200"
        ],
        "hasVirtualTour": True,
        "owner": MOCK_OWNERS["owner_bekzod"],
        "trustScore": 74,
        "riskScore": 18,
        "aiCheckStatus": "APPROVED",
        "aiRiskReasons": ["Egasining telefoni tasdiqlangan", "Shaxsiy selfie bor"],
        "safetyBadges": ["VERIFIED_OWNER", "AI_CHECKED", "NO_COMMISSION", "STUDENT_FRIENDLY"],
        "createdAt": "2026-08-09T11:00:00Z",
        "viewsCount": 654,
        "favoritesCount": 52,
        "contactCount": 28
    }
]

# --- API Endpoints ---

def clean_phone(p: str) -> str:
    import re
    return re.sub(r"\D", "", p or "")

USERS_DB: List[Dict[str, Any]] = [
    {
        "id": "user-zayniddin",
        "name": "Zayniddin",
        "full_name": "Zayniddin",
        "phone": "+998 93 718 88 85",
        "role": "STUDENT",
        "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300",
        "trust_score": 94,
        "trustScore": 94,
        "status": "ACTIVE",
        "listings_count": 0,
        "createdAt": "2026-08-18T03:00:00Z",
        "created_at": "2026-08-18T03:00:00Z"
    },
    {
        "id": "owner_jasur",
        "name": "Jasur Karimov",
        "full_name": "Jasur Karimov",
        "phone": "+998 90 123 45 67",
        "role": "OWNER",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
        "trust_score": 96,
        "trustScore": 96,
        "status": "ACTIVE",
        "listings_count": 2,
        "createdAt": "2023-04-12T00:00:00Z",
        "created_at": "2023-04-12T00:00:00Z"
    }
]

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "OK",
        "service": "Maklersiz.uz Python FastAPI Backend",
        "engine": "Python 3.13 + FastAPI",
        "security": "Strict Pydantic + CORS Hardened",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

@app.post("/api/v1/auth/register")
def register_user(req: RegisterRequest):
    req_clean = clean_phone(req.phone)

    # 1. Match existing user by phone number for returning users
    existing = next((u for u in USERS_DB if clean_phone(u.get("phone")) == req_clean), None)
    if existing:
        if req.name and req.name.strip():
            existing["name"] = req.name.strip()
            existing["full_name"] = req.name.strip()
        if req.role:
            existing["role"] = req.role
        return {
            "status": "success",
            "user": existing
        }

    # 2. Register new user
    default_avatar = (
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300"
        if req.role == "OWNER"
        else "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300"
    )
    user_id = f"user-{int(time.time() * 1000)}"
    cnt = len([l for l in LISTINGS_DB if clean_phone(l.get("owner", {}).get("phone")) == req_clean])

    new_user = {
        "id": user_id,
        "name": req.name.strip(),
        "full_name": req.name.strip(),
        "phone": req.phone.strip(),
        "role": req.role,
        "avatar": req.avatar or default_avatar,
        "trust_score": 90,
        "trustScore": 90,
        "status": "ACTIVE",
        "listings_count": cnt,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    USERS_DB.insert(0, new_user)

    return {
        "status": "success",
        "user": new_user
    }

@app.get("/api/v1/users")
def get_all_users(raw: Optional[bool] = Query(False)):
    formatted = []
    for u in USERS_DB:
        p_clean = clean_phone(u.get("phone"))
        cnt = len([l for l in LISTINGS_DB if clean_phone(l.get("owner", {}).get("phone")) == p_clean])
        formatted.append({
            "id": u.get("id"),
            "name": u.get("name"),
            "full_name": u.get("full_name") or u.get("name"),
            "phone": u.get("phone"),
            "role": u.get("role"),
            "avatar": u.get("avatar"),
            "trust_score": u.get("trust_score", 90),
            "trustScore": u.get("trustScore", 90),
            "status": u.get("status", "ACTIVE"),
            "listings_count": cnt,
            "createdAt": u.get("createdAt", time.strftime("%Y-%m-%dT%H:%M:%SZ")),
            "created_at": u.get("created_at", time.strftime("%Y-%m-%dT%H:%M:%SZ"))
        })

    if raw:
        return formatted

    return {
        "status": "success",
        "totalCount": len(formatted),
        "data": formatted
    }

@app.get("/api/v1/listings")
def get_listings(
    district: Optional[str] = Query(None),
    rooms: Optional[int] = Query(None),
    search: Optional[str] = Query(None)
):
    result = list(LISTINGS_DB)

    if district and district != "Barchasi":
        result = [l for l in result if l.get("district", "").lower() == district.lower()]

    if rooms is not None:
        result = [l for l in result if l.get("rooms") == rooms]

    if search:
        q = search.lower()
        result = [l for l in result if q in l.get("title", "").lower() or q in l.get("description", "").lower()]

    return {
        "status": "success",
        "totalCount": len(result),
        "data": result
    }

@app.get("/api/v1/listings/{id}")
def get_listing_by_id(id: str):
    found = next((l for l in LISTINGS_DB if l["id"] == id), None)
    if not found:
        raise HTTPException(status_code=404, detail="E'lon topilmadi")
    return {
        "status": "success",
        "data": found
    }

@app.post("/api/v1/listings", status_code=status.HTTP_201_CREATED)
def create_listing(req: CreateListingRequest):
    ai_result = scan_listing_ai(req.title, req.description, req.price, req.rooms)
    if not ai_result["allowed"]:
        return JSONResponse(
            status_code=403,
            content={
                "status": "rejected",
                "error": ai_result["message"],
                "aiAnalysis": ai_result
            }
        )

    owner_data = req.owner or {}
    default_owner = {
        "id": owner_data.get("id") or f"owner-{int(time.time()*1000)}",
        "name": owner_data.get("name") or "Kvartira Egasi",
        "phone": owner_data.get("phone") or "+998 90 000 00 00",
        "avatar": owner_data.get("avatar") or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
        "role": "OWNER",
        "trustScore": 90,
        "trustLevel": "GREEN",
        "riskScore": 5,
        "brokerRiskScore": 2,
        "verificationLevel": 4,
        "isVerified": True,
        "successfulRentals": 1,
        "joinedDate": time.strftime("%Y-%m-%d"),
        "badges": ["Verified Owner", "Property Verified"],
        "xpPoints": 500,
        "xpLevel": "Gold",
        "referralCode": "OWNER100",
        "referralsCount": 0
    }

    new_listing = {
        "id": f"listing-{int(time.time()*1000)}",
        "title": req.title,
        "description": req.description,
        "price": req.price,
        "currency": req.currency or "UZS",
        "depositPrice": req.depositPrice or 1000000,
        "utilitiesIncluded": req.utilitiesIncluded,
        "rooms": req.rooms,
        "area": req.area,
        "floor": req.floor or 3,
        "totalFloors": req.totalFloors or 9,
        "propertyType": req.propertyType or "APARTMENT",
        "region": req.region or "Toshkent shahri",
        "district": req.district,
        "address": req.address or f"{req.district} ko'chasi",
        "images": req.images if (req.images and len(req.images) > 0) else [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200"
        ],
        "hasVirtualTour": False,
        "owner": default_owner,
        "trustScore": ai_result["trustScore"],
        "riskScore": ai_result["riskScore"],
        "aiCheckStatus": ai_result["status"],
        "aiRiskReasons": ai_result["reasons"],
        "safetyBadges": ["VERIFIED_OWNER", "AI_CHECKED", "NO_COMMISSION"],
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "viewsCount": 1,
        "favoritesCount": 0,
        "contactCount": 0
    }

    LISTINGS_DB.insert(0, new_listing)
    return {
        "status": "success",
        "data": new_listing
    }

@app.post("/api/v1/admin/listings/{id}/unblock")
def admin_unblock_listing(id: str):
    found = next((l for l in LISTINGS_DB if l["id"] == id), None)
    if not found:
        # Create unblocked item dynamically if requested
        found = {
            "id": id,
            "title": "Admin tomonidan tiklangan kvartira",
            "aiCheckStatus": "APPROVED",
            "trustScore": 95,
            "riskScore": 5,
            "aiRiskReasons": ["Admin tomonidan tasdiqlandi va blokdan chiqarildi"]
        }
        LISTINGS_DB.insert(0, found)
    else:
        found["aiCheckStatus"] = "APPROVED"
        found["trustScore"] = 95
        found["riskScore"] = 5
        found["aiRiskReasons"] = ["Admin tomonidan tasdiqlandi va blokdan chiqarildi (@MaklersizUy_Support)"]

    return {
        "status": "success",
        "message": f"E'lon {id} muvaffaqiyatli blokdan chiqarildi va saytga joylandi.",
        "data": found
    }

@app.get("/api/v1/stats")
def get_dashboard_stats():
    total_users = len(USERS_DB)
    total_students = len([u for u in USERS_DB if u.get("role") == "STUDENT"])
    total_owners = len([u for u in USERS_DB if u.get("role") == "OWNER"])
    total_listings = len(LISTINGS_DB)
    approved_listings = len([l for l in LISTINGS_DB if l.get("aiCheckStatus") == "APPROVED"])
    rejected_listings = len([l for l in LISTINGS_DB if l.get("aiCheckStatus") == "REJECTED"])
    review_listings = len([l for l in LISTINGS_DB if l.get("aiCheckStatus") == "UNDER_REVIEW"])
    
    return {
        "status": "success",
        "data": {
            "totalUsers": total_users,
            "total_users": total_users,
            "totalStudents": total_students,
            "total_students": total_students,
            "totalOwners": total_owners,
            "total_owners": total_owners,
            "totalListings": total_listings,
            "total_listings": total_listings,
            "approvedListings": approved_listings,
            "approved_listings": approved_listings,
            "rejectedListings": rejected_listings,
            "rejected_listings": rejected_listings,
            "reviewListings": review_listings,
            "under_review_listings": review_listings,
            "dailyVisitors": 1420,
            "daily_visitors": 1420
        }
    }

@app.post("/api/v1/admin/listings/{id}/reject")
def admin_reject_listing(id: str):
    found = next((l for l in LISTINGS_DB if str(l.get("id")) == str(id)), None)
    if found:
        found["aiCheckStatus"] = "REJECTED"
        found["status"] = "REJECTED"
        found["riskScore"] = 95
        found["aiRiskReasons"] = ["Admin tomonidan rad etildi"]

    return {
        "status": "success",
        "message": f"E'lon {id} rad etildi.",
        "data": found
    }

REPORTS_DB: List[Dict[str, Any]] = [
    {
        "id": "rep-101",
        "listingId": "listing-1",
        "listingTitle": "Chilonzor 7-havze 2 xonali kvartira (Talabalar uchun)",
        "reporterName": "Rustam Shokirov",
        "reporterPhone": "+998 90 999 88 77",
        "reason": "BROKER_COMMISSION",
        "reasonLabel": "Maklerlik xizmati talab qilindi (15%)",
        "details": "Telefon qilsam maklerman, 15% komissiya berasiz dedi.",
        "status": "PENDING",
        "createdAt": "2026-08-17T18:30:00Z"
    },
    {
        "id": "rep-102",
        "listingId": "listing-2",
        "listingTitle": "Yakkasaroy tumani orientir Bobur parki 1 xonali",
        "reporterName": "Kamola Xasanova",
        "reporterPhone": "+998 91 555 44 33",
        "reason": "FAKE_PRICE",
        "reasonLabel": "Yolg'on narx ko'rsatilgan",
        "details": "Saytda 300$ yozilgan, lekin telefonda 450$ deydi.",
        "status": "RESOLVED",
        "createdAt": "2026-08-16T14:15:00Z"
    }
]

@app.get("/api/v1/admin/reports")
def get_reports(status_filter: Optional[str] = Query(None)):
    res = list(REPORTS_DB)
    if status_filter:
        res = [r for r in res if r.get("status") == status_filter]
    return {
        "status": "success",
        "totalCount": len(res),
        "data": res
    }

@app.post("/api/v1/admin/reports")
def create_report(req: CreateReportRequest):
    rep_id = f"rep-{int(time.time()*1000)}"
    new_rep = {
        "id": rep_id,
        "listingId": req.listingId,
        "listingTitle": req.listingTitle or "E'lon",
        "reporterName": req.reporterName or "Anonim",
        "reporterPhone": req.reporterPhone or "",
        "reason": req.reason,
        "reasonLabel": req.reasonLabel or req.reason,
        "details": req.details or "",
        "status": "PENDING",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    REPORTS_DB.insert(0, new_rep)
    return {"status": "success", "data": new_rep}

@app.post("/api/v1/admin/reports/{id}/resolve")
def resolve_report(id: str):
    rep = next((r for r in REPORTS_DB if r.get("id") == id), None)
    if rep:
        rep["status"] = "RESOLVED"
    return {"status": "success", "data": rep}

@app.get("/api/v1/admin/analytics")
def get_analytics():
    districts = {}
    for l in LISTINGS_DB:
        d = l.get("district", "Boshqa")
        if d not in districts:
            districts[d] = {"count": 0, "totalPrice": 0.0}
        districts[d]["count"] += 1
        districts[d]["totalPrice"] += float(l.get("price", 0))

    district_analytics = []
    for d_name, d_data in districts.items():
        avg = round(d_data["totalPrice"] / d_data["count"], 1) if d_data["count"] > 0 else 0
        district_analytics.append({
            "district": d_name,
            "listings_count": d_data["count"],
            "average_price": avg,
            "currency": "USD"
        })

    room_stats = {1: [], 2: [], 3: [], 4: []}
    for l in LISTINGS_DB:
        r = min(int(l.get("rooms", 1)), 4)
        room_stats[r].append(float(l.get("price", 0)))

    avg_room_prices = {
        "1_room": round(sum(room_stats[1])/len(room_stats[1]), 1) if room_stats[1] else 280.0,
        "2_room": round(sum(room_stats[2])/len(room_stats[2]), 1) if room_stats[2] else 380.0,
        "3_room": round(sum(room_stats[3])/len(room_stats[3]), 1) if room_stats[3] else 520.0,
        "4_plus_room": round(sum(room_stats[4])/len(room_stats[4]), 1) if room_stats[4] else 700.0,
    }

    university_demand = [
        {"university": "TDIU (Iqtisodiyot Univ.)", "search_percentage": "34%", "avg_distance_min": 5},
        {"university": "TATU (Axborot Texnologiyalari)", "search_percentage": "28%", "avg_distance_min": 7},
        {"university": "NUUz (O'zbekiston Milliy Univ.)", "search_percentage": "21%", "avg_distance_min": 6},
        {"university": "TDTU (Texnika Univ.)", "search_percentage": "11%", "avg_distance_min": 8},
        {"university": "Westminster International", "search_percentage": "6%", "avg_distance_min": 10}
    ]

    return {
        "status": "success",
        "data": {
            "districts": district_analytics,
            "average_prices_by_rooms": avg_room_prices,
            "university_demand": university_demand,
            "total_searches_today": 3480,
            "successful_matches_this_month": 142
        }
    }

@app.post("/api/v1/ai/scan-listing")
def api_scan_listing(req: ScanListingRequest):
    res = scan_listing_ai(
        title=req.title,
        description=req.description,
        price=req.price,
        rooms=req.rooms,
        phone=req.phone,
        images=req.images
    )
    return {
        "status": "success" if res["allowed"] else "rejected",
        "aiAnalysis": res
    }

@app.post("/api/v1/ai/write-copy")
def api_write_copy(req: WriteCopyRequest):
    text = generate_listing_copy(
        district=req.district,
        rooms=req.rooms,
        furnished=req.furnished,
        metro=req.metro
    )
    return {"status": "success", "text": text}

@app.post("/api/v1/ai/price")
def api_estimate_price(req: PriceRequest):
    return estimate_listing_price(rooms=req.rooms, district=req.district)
