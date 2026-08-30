# README-5

> **Tarixiy hujjat.** Bu spetsifikatsiya loyiha hali Maklersiz.uz deb atalgan paytda yozilgan; hozirgi mahsulot [`README.md`](./README.md) da tasvirlangan va nizo bo'lsa README.md ustun turadi.

> Qurilgan arxitektura `README.md` ning "Architecture" bo'limida tasvirlangan; bu fayl esa boshida nima ko'zlangani yozib qoldirilgan hujjat.

# TECHNICAL ARCHITECTURE & FULL-STACK ENGINEERING

## 1. MAQSAD

Ushbu README platformaning texnik arxitekturasini belgilaydi.

Loyiha oddiy demo yoki landing page emas.

Production-ready, scalable va xavfsiz marketplace sifatida qurilishi kerak.

Platforma kelajakda:

* 10 000 foydalanuvchi
* 100 000 foydalanuvchi
* 1 000 000+ foydalanuvchi

darajasigacha kengaytirilishi mumkin bo'lgan arxitekturaga ega bo'lishi kerak.

---

# 2. DEVELOPMENT PRINCIPLE

Kod:

* Clean
* Modular
* Scalable
* Maintainable
* Secure
* Type-safe

bo'lishi kerak.

Hardcoded ma'lumotlardan foydalanmaslik.

Business logic komponentlarning ichiga aralashtirilmasligi kerak.

---

# 3. ARCHITECTURE

Boshlang'ich bosqichda:

Modular Monolith

ishlatilsin.

Kelajakda kerak bo'lsa:

Microservices

ga ajratish imkoniyati saqlansin.

---

# 4. FRONTEND

Frontend:

Next.js

TypeScript

Tailwind CSS

shadcn/ui

React Query / TanStack Query

Zustand

Framer Motion

---

# 5. FRONTEND PRINCIPLE

Frontend:

* Mobile First
* Responsive
* Accessible
* SEO Friendly
* Fast

bo'lishi kerak.

---

# 6. FRONTEND ROUTES

## Public

/

/search

/listing/[id]

/owner/[id]

/about

/safety

/how-it-works

---

## Authentication

/auth

/auth/login

/auth/register

/auth/verify

/auth/onboarding

---

## User

/dashboard

/profile

/favorites

/messages

/notifications

/referrals

/verification

/settings

---

## Owner

/owner/dashboard

/owner/listings

/owner/listings/create

/owner/listings/[id]/edit

/owner/verification

/owner/analytics

---

## Premium

/premium

/subscription

/payments

---

## Admin

/admin

/admin/users

/admin/listings

/admin/reports

/admin/verifications

/admin/fraud

/admin/reviews

/admin/analytics

/admin/settings

---

# 7. COMPONENT ARCHITECTURE

Components:

* Button
* Input
* Modal
* Drawer
* Card
* Badge
* Avatar
* Tabs
* Dropdown
* Toast
* Skeleton
* Pagination
* SearchBar
* FilterPanel
* ListingCard
* TrustScore
* VerificationBadge
* OwnerCard
* ReportModal
* ChatWindow

kabi reusable bo'lishi kerak.

---

# 8. DESIGN SYSTEM

Barcha komponentlar yagona design system'dan foydalanadi.

Color tokens.

Spacing tokens.

Typography tokens.

Radius tokens.

Shadow tokens.

Animation tokens.

Hardcoded random styling kamaytirilishi kerak.

---

# 9. BACKEND

Backend:

NestJS

TypeScript

Prisma ORM

PostgreSQL

Redis

BullMQ

WebSocket

---

# 10. BACKEND MODULES

AuthModule

UsersModule

ListingsModule

PropertyModule

VerificationModule

TrustModule

FraudModule

ModerationModule

ReviewsModule

ReportsModule

ChatModule

NotificationModule

ReferralModule

PremiumModule

PaymentModule

AnalyticsModule

AdminModule

AI Module

---

# 11. API ARCHITECTURE

REST API asosiy transport bo'ladi.

Kelajakda kerak bo'lsa:

GraphQL

qo'shilishi mumkin.

---

# 12. API VERSIONING

Barcha API:

/api/v1

orqali boshlansin.

Misol:

GET /api/v1/listings

---

# 13. AUTHENTICATION

Authentication:

Phone OTP

Google OAuth

bo'lishi mumkin.

---

# 14. SESSION

JWT:

Access Token

Refresh Token

ishlatilsin.

Refresh token secure storage'da saqlansin.

---

# 15. ROLE SYSTEM

Roles:

TENANT

OWNER

MODERATOR

ADMIN

SUPER_ADMIN

---

# 16. PERMISSION SYSTEM

Role-based access control.

Admin barcha ma'lumotga ega bo'lmasligi kerak.

Har bir action permission orqali tekshirilsin.

---

# 17. DATABASE

PostgreSQL.

ORM:

Prisma.

Database normalized va scalable bo'lishi kerak.

---

# 18. CORE DATABASE ENTITIES

Asosiy entities:

User

Profile

Role

Session

Listing

Property

ListingImage

Verification

TrustScore

RiskScore

Review

Report

Message

Conversation

Notification

Referral

Reward

Subscription

Payment

AuditLog

AIAnalysis

---

# 19. DATABASE PRINCIPLE

Har bir asosiy jadvalda:

id

createdAt

updatedAt

bo'lishi kerak.

Kerakli joylarda:

deletedAt

soft delete

ishlatilsin.

---

# 20. STORAGE

Rasmlar va videolar:

Cloudflare R2

yoki S3-compatible storage.

Database ichida media binary saqlanmasin.

---

# 21. IMAGE PROCESSING

Upload:

Original

↓

Optimization

↓

Thumbnail

↓

WebP/AVIF

↓

CDN

---

# 22. VIDEO PROCESSING

Video:

Upload

↓

Validation

↓

Compression

↓

Thumbnail

↓

CDN

---

# 23. SEARCH ENGINE

Boshlang'ich:

PostgreSQL Full Text Search

Kelajakda:

Elasticsearch / OpenSearch

---

# 24. SEARCH FILTERS

Search:

* Region
* District
* Price
* Rooms
* Metro
* University
* Furniture
* Pets
* Parking
* Internet
* Verified Owner
* Trust Score

---

# 25. SEARCH RANKING

Ranking:

1. Safety
2. Relevance
3. Trust
4. Location
5. Price
6. Freshness

---

# 26. CACHE

Redis.

Cache qilinadigan ma'lumotlar:

* Popular searches
* Popular listings
* User sessions
* Rate limits
* Temporary verification states

---

# 27. QUEUE SYSTEM

BullMQ.

Background jobs:

* Image processing
* AI analysis
* Notifications
* Email
* Analytics
* Trust recalculation
* Fraud analysis

---

# 28. WEBSOCKET

Real-time:

* Chat
* Notifications
* Admin alerts

uchun ishlatiladi.

---

# 29. CHAT SYSTEM

User ↔ Owner.

Features:

* Text
* Images
* Location
* Listing reference
* Report
* Block

---

# 30. NOTIFICATION ENGINE

Channels:

* In-app
* Push
* Telegram
* Email
* SMS

---

# 31. PAYMENT ARCHITECTURE

Payment provider abstraction yaratiladi.

Masalan:

PaymentService

↓

Provider Adapter

Shunda kelajakda payment provider almashtirish oson bo'ladi.

---

# 32. PREMIUM SYSTEM

Subscription:

FREE

PREMIUM

OWNER PRO

BUSINESS

---

# 33. ADMIN API

Admin API alohida permission bilan himoyalanadi.

Misol:

GET /api/v1/admin/users

GET /api/v1/admin/listings

GET /api/v1/admin/reports

---

# 34. AI SERVICE

AI provider backend ichiga qattiq bog'lanmasin.

Architecture:

AIService

↓

OpenAIAdapter

GeminiAdapter

FutureAdapter

---

# 35. AI JOB

Listing yaratilganda:

Listing Created

↓

Queue

↓

AI Analysis

↓

Risk Score

↓

Trust Update

↓

Moderation Decision

---

# 36. SECURITY

Majburiy:

* HTTPS
* Password hashing
* JWT security
* Rate limiting
* Input validation
* CSRF protection where applicable
* XSS protection
* SQL injection protection
* File validation
* MIME validation
* Secure headers

---

# 37. FILE SECURITY

Upload qilinadigan fayllar:

* File type
* File size
* MIME
* Extension
* Malware scanning where available

orqali tekshirilsin.

---

# 38. RATE LIMITING

Rate limit:

Login

OTP

Listing creation

Messages

Reports

API requests

uchun alohida sozlansin.

---

# 39. FRAUD PROTECTION

Frontend'dagi tekshiruv yetarli emas.

Barcha muhim verification backend'da qayta tekshirilishi kerak.

---

# 40. API VALIDATION

DTO validation:

class-validator

yoki boshqa type-safe validation.

Frontenddan kelgan ma'lumotga hech qachon ko'r-ko'rona ishonilmasin.

---

# 41. LOGGING

Structured logging.

Har bir muhim action:

* User
* Timestamp
* Action
* Result
* Request ID

bilan kuzatiladi.

Sensitive data log qilinmasin.

---

# 42. AUDIT LOG

Admin actions:

* User ban
* Listing delete
* Verification approve
* Report resolve
* Payment action

audit logga yoziladi.

---

# 43. ERROR HANDLING

Global error handling.

Frontend uchun:

Friendly error.

Backend uchun:

Structured error.

---

# 44. MONITORING

Production'da:

* Error monitoring
* API latency
* Database performance
* Queue health
* Storage usage
* Server health

monitor qilinadi.

---

# 45. ANALYTICS

Kuzatiladi:

* Page views
* Searches
* Listing views
* Favorites
* Contact clicks
* Successful rentals
* Referral conversions
* Premium conversions

---

# 46. SEO

Listing pages SEO friendly bo'lishi kerak.

Metadata:

* Title
* Description
* Open Graph
* Structured Data

---

# 47. PERFORMANCE

Maqsad:

Lighthouse:

90+

Core Web Vitals:

Good

Image optimization.

Lazy loading.

Code splitting.

Caching.

---

# 48. PWA

Platformani kelajakda:

Installable Web App

qilish uchun PWA architecture tayyor bo'lsin.

---

# 49. INTERNATIONALIZATION

Architecture:

i18n-ready.

Boshlang'ich:

Uzbek

Russian

English

---

# 50. LOCATION

Property location:

* Latitude
* Longitude
* Region
* District
* Address

saqlansin.

Aniq uy manzilini public qilish privacy talablariga bog'liq bo'lishi kerak.

---

# 51. MAP ARCHITECTURE

Map provider abstraction ishlatilsin.

Keyinchalik:

Yandex Maps

Google Maps

OpenStreetMap

o'rtasida almashtirish mumkin bo'lsin.

---

# 52. DEPLOYMENT

Frontend:

Vercel

Backend:

Railway / Render / AWS-compatible environment

Database:

Managed PostgreSQL

Storage:

Cloudflare R2 / S3

---

# 53. ENVIRONMENT

Environment:

Development

Staging

Production

alohida bo'lsin.

---

# 54. ENV VARIABLES

Secrets hech qachon kodga yozilmasin.

Masalan:

DATABASE_URL

JWT_SECRET

REDIS_URL

STORAGE_KEY

AI_API_KEY

PAYMENT_SECRET

---

# 55. CI/CD

GitHub Actions:

* Lint
* Type check
* Unit tests
* Build
* Integration tests
* Deployment

---

# 56. TESTING

Unit Tests

Integration Tests

E2E Tests

API Tests

Security Tests

---

# 57. CRITICAL E2E FLOWS

Majburiy testlar:

Register

↓

Verify

↓

Create Listing

↓

AI Check

↓

Publish

---

Tenant:

Search

↓

Open Listing

↓

Favorite

↓

Contact Owner

---

Owner:

Receive Message

↓

Respond

---

Report:

Report Listing

↓

AI Analysis

↓

Moderator

↓

Resolution

---

# 58. SCALABILITY

Boshlanishida:

Modular Monolith.

Traffic oshganda:

AI Service

Search Service

Notification Service

Chat Service

Media Service

alohida service'ga chiqarilishi mumkin.

---

# 59. API DOCUMENTATION

Swagger/OpenAPI.

Backend barcha endpointlarini hujjatlashtirsin.

---

# 60. CODE QUALITY

Kod:

* DRY
* SOLID
* Clean Architecture principles
* Strong typing

asosida yozilsin.

Keraksiz abstraction yaratmaslik.

---

# 61. FOLDER STRUCTURE

Frontend:

app/

components/

features/

lib/

hooks/

services/

stores/

types/

utils/

---

Backend:

src/

modules/

common/

config/

database/

guards/

interceptors/

pipes/

services/

---

# 62. BUSINESS LOGIC

Business logic:

Controller ichida yozilmasin.

Service layer yoki domain layer'da bo'lsin.

---

# 63. API RESPONSE FORMAT

Consistent response format.

Success:

data

meta

---

Error:

code

message

details

requestId

---

# 64. PAGINATION

Large datasets uchun:

Cursor pagination

afzal.

---

# 65. DATABASE INDEXES

Indexlar:

* phone
* email
* location
* price
* createdAt
* trustScore
* status
* ownerId

kabi querylarda kerakli joylarda qo'llanilsin.

---

# 66. SOFT DELETE

Muhim ma'lumotlar uchun:

soft delete.

Hard delete faqat qonuniy yoki privacy talablariga muvofiq amalga oshiriladi.

---

# 67. BACKUP

Database:

Automatic backups.

Recovery plan.

---

# 68. DISASTER RECOVERY

Production uchun:

* Backup
* Restore procedure
* Failure handling
* Monitoring

bo'lishi kerak.

---

# 69. ADMIN SECURITY

Admin:

2FA

Device/session management

IP/risk monitoring

Audit log

bilan himoyalansin.

---

# 70. FINAL IMPLEMENTATION RULE

Antigravity ushbu README asosida:

1. Architecture yaratadi.
2. Database structure yaratadi.
3. Backend modules yaratadi.
4. API yaratadi.
5. Frontend pages yaratadi.
6. Reusable components yaratadi.
7. Authentication yaratadi.
8. Search yaratadi.
9. Listing system yaratadi.
10. Verification integration yaratadi.
11. AI integration uchun abstraction yaratadi.
12. Admin architecture yaratadi.
13. Testing infrastructure yaratadi.
14. Deployment configuration tayyorlaydi.

---

# 71. IMPORTANT

Barcha texnologiyalarni faqat "chiroyli ko'rinishi uchun" qo'shmang.

Har bir texnologiya real muammoni hal qilishi kerak.

Agar MVP uchun Elasticsearch kerak bo'lmasa, PostgreSQL search bilan boshlash mumkin.

Agar microservice kerak bo'lmasa, modular monolith bilan boshlash kerak.

Arxitektura:

SIMPLE FIRST

SCALE WHEN NEEDED

tamoyiliga amal qilsin.

---

# 72. FINAL ARCHITECTURE PRINCIPLE

Platforma bugun kichik startup bo'lishi mumkin.

Lekin uning arxitekturasi ertaga katta kompaniyaga aylanish imkoniyatini cheklamasligi kerak.

Asosiy texnik prinsip:

FAST

SECURE

SCALABLE

MAINTAINABLE

TRUSTWORTHY

Uyiz.uz texnologik jihatdan oddiy e'lonlar sayti emas, balki kelajakdagi katta Rental Ecosystem uchun foundation sifatida qurilsin.
