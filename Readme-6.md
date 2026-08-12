README-6 — DATABASE & ADMIN PANEL SYSTEM

Project: Maklersiz.uz
Purpose: Database architecture, admin panel, moderation, analytics, operations and platform management.

1. MAQSAD

Ushbu README platformaning ichki boshqaruv tizimini belgilaydi.

Admin panel oddiy:

"Userlarni ko‘rish + e’lon o‘chirish"

paneli bo‘lmasligi kerak.

Admin panel platformaning Control Center bo‘lishi kerak.

Admin quyidagilarni bitta joydan boshqara olishi kerak:

Users
Owners
Tenants
Listings
Properties
Verifications
Reports
Fraud
AI alerts
Reviews
Messages metadata
Payments
Premium
Referrals
Rewards
Analytics
Notifications
System settings
Audit logs
2. DATABASE PRINCIPLES

Database:

PostgreSQL
Prisma ORM
UUID primary keys
Foreign keys
Proper indexes
Transactions
Soft delete where appropriate
Audit logs
Data validation

ishlatishi kerak.

Database dizayni kelajakda millionlab foydalanuvchilarni qo‘llab-quvvatlashga tayyor bo‘lishi kerak.

3. USER DATABASE
users

Fields:

id
phone
email
passwordHash
status
role
trustScore
riskScore
isVerified
createdAt
updatedAt
lastLoginAt
deletedAt
status
ACTIVE
SUSPENDED
BANNED
PENDING
DELETED
role
TENANT
OWNER
MODERATOR
ADMIN
SUPER_ADMIN
4. USER PROFILE
profiles
id
userId
firstName
lastName
avatar
bio
birthYear
gender
city
district
createdAt
updatedAt

Sensitive ma'lumotlar imkon qadar minimal saqlansin.

5. USER VERIFICATION
verifications
id
userId
type
status
provider
referenceId
verifiedAt
expiresAt
createdAt
updatedAt
type
PHONE
EMAIL
IDENTITY
SELFIE
LIVENESS
PROPERTY
status
PENDING
APPROVED
REJECTED
EXPIRED
6. VERIFICATION DOCUMENTS
verification_documents
id
verificationId
documentType
storageKey
status
createdAt
deletedAt

Muhim:

Hujjatlarning public URL'i saqlanmasin.

Private storage ishlatilsin.

Admin access audit qilinsin.

7. OWNER PROFILE
owner_profiles
id
userId
ownerType
verifiedPropertiesCount
successfulRentals
averageRating
trustLevel
createdAt
updatedAt
ownerType
INDIVIDUAL
BUSINESS

Maklerlik ehtimoli alohida:

brokerRiskScore

orqali saqlanishi mumkin.

8. PROPERTY
properties
id
ownerId
title
description
propertyType
rooms
area
floor
totalFloors
price
currency
deposit
utilitiesIncluded
furnished
petsAllowed
parking
internet
latitude
longitude
regionId
districtId
status
createdAt
updatedAt
deletedAt
9. PROPERTY TYPES
APARTMENT
HOUSE
ROOM
STUDIO
DORMITORY

Kelajakda:

OFFICE
COMMERCIAL

qo‘shilishi mumkin.

10. LISTINGS
listings

E'lon va property bir xil narsa emas.

Bitta property kelajakda qayta e'lon qilinishi mumkin.

id
propertyId
ownerId
status
price
title
description
publishedAt
expiresAt
viewsCount
favoritesCount
contactCount
trustScore
riskScore
createdAt
updatedAt
deletedAt
status
DRAFT
PENDING_REVIEW
PUBLISHED
PAUSED
REJECTED
EXPIRED
SOLD
RENTED
REMOVED
11. LISTING IMAGES
listing_images
id
listingId
storageKey
thumbnailKey
hash
width
height
sortOrder
aiRiskScore
createdAt
12. LISTING VIDEOS
listing_videos
id
listingId
storageKey
thumbnailKey
duration
status
createdAt
13. LOCATION DATABASE
regions
id
nameUz
nameRu
nameEn
districts
id
regionId
nameUz
nameRu
nameEn
14. UNIVERSITIES
universities
id
name
city
latitude
longitude
website
status
createdAt

Bu tizim:

"Universitetimga yaqin kvartira"

qidiruvini yaratish uchun ishlatiladi.

15. METRO STATIONS
metro_stations
id
name
line
latitude
longitude

Listing bilan relation:

listing_metro_distances
16. TRUST SCORE
trust_scores
id
userId
score
identityScore
propertyScore
reviewScore
behaviorScore
complaintScore
verificationScore
calculatedAt
updatedAt

Har bir o‘zgarish history sifatida saqlanishi mumkin.

17. TRUST HISTORY
trust_score_history
id
userId
oldScore
newScore
reason
source
createdAt

Misol:

+20 Identity Verification
+10 Positive Review
-15 Valid Complaint
18. RISK SCORE
risk_scores
id
entityType
entityId
score
level
reasons
createdAt
updatedAt
entityType
USER
LISTING
PHONE
IMAGE
PROPERTY
19. AI ANALYSIS
ai_analyses
id
entityType
entityId
model
analysisType
riskScore
confidence
result
reasons
createdAt
analysisType
TEXT
IMAGE
FRAUD
BROKER
DUPLICATE
REVIEW
BEHAVIOR
20. DUPLICATE IMAGES
image_matches
id
imageId
matchedImageId
similarity
algorithm
createdAt
21. REPORT SYSTEM
reports
id
reporterId
targetType
targetId
reason
description
status
priority
assignedTo
createdAt
resolvedAt
reason
SCAM
BROKER
FAKE_LISTING
FAKE_IMAGE
WRONG_PRICE
WRONG_LOCATION
SPAM
HARASSMENT
OTHER
status
OPEN
UNDER_REVIEW
RESOLVED
REJECTED
22. REPORT EVIDENCE
report_evidence
id
reportId
type
storageKey
description
createdAt
23. MODERATION ACTIONS
moderation_actions
id
moderatorId
targetType
targetId
action
reason
metadata
createdAt
action
WARNING
APPROVE
REJECT
SUSPEND
BAN
RESTORE
REQUEST_VERIFICATION
24. APPEALS
appeals
id
userId
targetType
targetId
reason
status
reviewerId
decision
createdAt
resolvedAt
25. REVIEWS
reviews
id
authorId
targetUserId
listingId
rating
comment
status
riskScore
createdAt
updatedAt
26. REVIEW MODERATION

Review status:

PENDING
PUBLISHED
HIDDEN
FLAGGED
REMOVED

AI review risk:

reviewRiskScore
27. FAVORITES
favorites
id
userId
listingId
createdAt

Unique constraint:

userId + listingId
28. SEARCH HISTORY
search_history
id
userId
query
filters
createdAt

Bu data:

Recommendation
Analytics
Retargeting

uchun ishlatilishi mumkin.

29. RECENTLY VIEWED
recently_viewed
id
userId
listingId
viewedAt
30. CHAT SYSTEM
conversations
id
listingId
createdAt
updatedAt
conversation_members
id
conversationId
userId
joinedAt
messages
id
conversationId
senderId
type
content
storageKey
status
createdAt
31. CHAT SAFETY

Message metadata:

riskScore
flagged
flagReason

AI message analysis kerak bo‘lsa, alohida:

message_ai_analysis

jadvali ishlatilishi mumkin.

32. NOTIFICATIONS
notifications
id
userId
type
title
body
data
readAt
createdAt
33. REFERRAL SYSTEM
referrals
id
referrerId
referredUserId
code
status
createdAt
completedAt
34. REWARDS
rewards
id
userId
type
amount
source
status
createdAt
35. XP SYSTEM
user_xp
id
userId
xp
level
updatedAt
36. XP HISTORY
xp_transactions
id
userId
amount
type
description
createdAt
37. BADGES
badges
id
name
description
icon
criteria
createdAt
user_badges
id
userId
badgeId
earnedAt
38. SUBSCRIPTIONS
subscriptions
id
userId
plan
status
provider
providerSubscriptionId
startedAt
expiresAt
createdAt
plan
FREE
PREMIUM
OWNER_PRO
BUSINESS
39. PAYMENTS
payments
id
userId
amount
currency
provider
providerPaymentId
status
type
createdAt
status
PENDING
SUCCESS
FAILED
REFUNDED
40. ADMIN PANEL

Admin panel:

/admin

asosiy dashboard bo‘ladi.

41. ADMIN DASHBOARD

Dashboard'da:

Users

Total Users

Active Users

New Users

Verified Users

Listings

Total Listings

Published

Pending

Rejected

High Risk

Safety

Reports

Fraud Alerts

Broker Signals

Verification Queue

Revenue

Premium Users

Revenue

Subscriptions

Growth

New Users

Referral Users

Retention

42. ADMIN SIDEBAR
Dashboard

Users

Owners

Tenants

Listings

Properties

Verifications

Reports

Fraud Center

Reviews

Messages

Referrals

Rewards

Subscriptions

Payments

Analytics

Notifications

System Settings

Audit Logs
43. USERS PAGE

Admin:

Search
Filter
Sort
View profile
View Trust Score
View Risk Score
View verification
Suspend
Ban
Restore

qila olishi kerak.

44. USER DETAIL PAGE

Ko‘rsatiladi:

Profile

Trust Score

Risk Score

Verification

Listings

Reviews

Reports

Referrals

Activity

Moderation history

45. OWNER PAGE

Owner profilida:

Property count
Listing count
Verification
Trust Score
Broker Risk
Reviews
Successful rentals
Reports

ko‘rsatiladi.

46. LISTINGS PAGE

Filter:

Status
Region
Price
Trust
Risk
Verification
Created date
47. LISTING DETAIL ADMIN

Admin ko‘radi:

Photos

Description

Owner

Property

AI Analysis

Trust

Risk

Reports

History

48. VERIFICATION CENTER

Queue:

Pending
High Priority
Rejected
Approved
Expired

Admin:

Approve

Reject

Request More Information

qila oladi.

49. FRAUD CENTER

Fraud Center platformaning eng muhim admin modullaridan biri.

Ko‘rsatiladi:

High Risk Users

High Risk Listings

Duplicate Images

Suspicious Phones

Multi Account Networks

Broker Signals

Fraud Reports

50. FRAUD DETAIL

Har bir signal uchun:

Risk Score

Reasons

Evidence

Related Users

Related Listings

Related Images

Related Phones

Reports

AI Analysis

ko‘rsatiladi.

51. GRAPH VIEW

Kelajakda:

User

↓

Phone

↓

Listing

↓

Image

↓

Another User

kabi aloqalarni graph ko‘rinishida ko‘rsatish.

Bu katta fraud networklarni aniqlash uchun ishlatiladi.

52. REPORT CENTER

Admin:

Open
High Priority
Assigned
Resolved

reportlarni ko‘radi.

Har bir report moderatorga biriktirilishi mumkin.

53. MODERATOR WORKFLOW

Report:

NEW

↓

AI Analysis

↓

Priority

↓

Moderator

↓

Evidence

↓

Decision

↓

Action

↓

Audit Log

54. ADMIN ACTION CONFIRMATION

Quyidagi actionlar uchun confirmation talab qilinsin:

Ban
Delete
Restore
Reject verification
Refund
Suspend
55. TWO-PERSON APPROVAL

Juda xavfli actionlar uchun kelajakda:

Two-person approval

qo‘llash mumkin.

Masalan:

Permanent deletion

yoki

Super Admin action.

56. AUDIT LOG
audit_logs
id
actorId
action
targetType
targetId
metadata
ipAddress
userAgent
createdAt

Admin harakati o‘chirilmasligi kerak.

57. ANALYTICS

Admin analytics:

Users

DAU

WAU

MAU

Retention

Listings

Created

Published

Rejected

Rented

Expired

Safety

Reports

Fraud rate

False positive rate

Verification rate

Revenue

Revenue

ARPU

Premium conversion

58. GROWTH ANALYTICS

Referral:

Invites

Conversions

Conversion rate

Top referrers

59. GEOGRAPHIC ANALYTICS

Hududlar bo‘yicha:

Listing count
Average price
Demand
Supply
Searches
Successful rentals
60. PRICE ANALYTICS

Admin:

Hudud bo‘yicha o‘rtacha ijara narxini ko‘ra oladi.

Masalan:

Yunusobod

Average:

X so‘m

61. DEMAND ANALYTICS

Qaysi hududga talab ko‘p?

Qaysi narx diapazonida qidiruv ko‘p?

Qaysi kvartiralar tez ijaraga chiqadi?

62. SYSTEM SETTINGS

Admin:

Commission
Premium price
Referral rewards
XP rewards
Trust rules
Report categories
Notification templates

kabi konfiguratsiyalarni boshqara olishi mumkin.

Lekin kritik configurationlar permission bilan himoyalansin.

63. NOTIFICATION MANAGEMENT

Admin:

Push

Email

Telegram

System notifications

uchun template yaratishi mumkin.

64. FEATURE FLAGS
feature_flags
id
key
enabled
environment
createdAt
updatedAt

Kelajakda:

New search
AI feature
Premium feature
Beta feature

ni ayrim foydalanuvchilarda test qilish mumkin.

65. ADMIN ROLES
MODERATOR

Reports

Listings

Reviews

ADMIN

Users

Payments

Analytics

Settings

SUPER ADMIN

Full access.

66. ADMIN PERMISSIONS

Permissionlar granular bo‘lsin.

Misol:

users.read
users.update
users.suspend

listings.read
listings.update
listings.remove

reports.read
reports.resolve

payments.read
payments.refund
67. DATABASE INDEXING

Muhim indexlar:

users.phone
users.email
users.status

listings.ownerId
listings.status
listings.price
listings.createdAt
listings.riskScore
listings.trustScore

reports.status
reports.priority

reviews.listingId
reviews.targetUserId

messages.conversationId
messages.createdAt
68. DATABASE CONSTRAINTS

Majburiy:

Unique phone
Unique email where applicable
Unique referral code
Unique favorite
Foreign keys
Required fields
Valid enum values
69. TRANSACTIONS

Muhim operatsiyalar database transaction orqali bajarilsin.

Masalan:

Payment

↓

Subscription

↓

Premium activation

uchalasi bir transaction yoki reliable workflow bilan bajarilishi kerak.

70. SOFT DELETE

Quyidagilarda soft delete afzal:

Users
Listings
Properties
Reviews

Legal/privacy talab qilsa permanent deletion alohida workflow orqali bajariladi.

71. DATA PRIVACY

Admin panel:

Passwordlarni ko‘rsatmaydi.
Verification documentlarni public qilmaydi.
Keraksiz PII ko‘rsatmaydi.
Sensitive actionlarni audit qiladi.
72. DATABASE BACKUP

Production database:

Automated backup
Point-in-time recovery where available
Restore testing

bilan himoyalansin.

73. ADMIN MOBILE RESPONSIVE

Admin panel asosan desktop uchun optimallashtiriladi.

Lekin:

Tablet

va

Mobile

uchun ham asosiy funksiyalar ishlashi kerak.

74. ADMIN UI PRINCIPLE

Admin panel:

chiroyli bo‘lishidan ko‘ra:

Tez
Aniq
Tushunarli
Xavfsiz
Informativ

bo‘lishi kerak.

75. FINAL ADMIN FLOW
USER / LISTING EVENT
        ↓
AI ANALYSIS
        ↓
RISK ENGINE
        ↓
MODERATION QUEUE
        ↓
ADMIN / MODERATOR
        ↓
DECISION
        ↓
ACTION
        ↓
AUDIT LOG
        ↓
ANALYTICS
76. FINAL DATABASE PRINCIPLE

Database shunchaki ma'lumot saqlash joyi emas.

U platformaning:

Trust
Safety
Marketing
Monetization
Analytics
Moderation

tizimlarining asosiy manbasi bo‘ladi.

77. ANTIGRAVITY IMPLEMENTATION REQUIREMENTS

Antigravity ushbu README asosida:

PostgreSQL schema yaratishi.
Prisma schema yaratishi.
Barcha relations yaratishi.
Indexlarni yaratishi.
Seed data yaratishi.
Admin authentication yaratishi.
Role-based permissions yaratishi.
Admin dashboard yaratishi.
User management yaratishi.
Listing moderation yaratishi.
Verification center yaratishi.
Fraud center yaratishi.
Reports center yaratishi.
Reviews moderation yaratishi.
Referral management yaratishi.
Subscription management yaratishi.
Payment management yaratishi.
Analytics dashboard yaratishi.
Audit logging yaratishi.
Privacy va security talablarini qo‘llashi kerak.
78. IMPORTANT

Admin panelga faqat kerakli ma'lumotlar chiqarilsin.

Juda ko‘p ma'lumotni bitta sahifaga joylashtirib, interfeysni chalkashtirmaslik kerak.

Har bir modul:

Search

Filter

Sort

Pagination

Bulk actions

Detail view

Audit history

imkoniyatlariga ega bo‘lishi kerak.

79. FINAL VISION

Maklersiz.uz admin paneli oddiy CMS emas.

U:

PROPERTY OPERATING SYSTEM

bo‘lishi kerak.

Admin platformaning barcha muhim jarayonlarini bitta markazdan:

SEE → ANALYZE → DECIDE → ACT → MEASURE

modeli orqali boshqara olishi kerak.

Platforma kattalashgan sari yangi funksiyalar qo‘shilishi mumkin, lekin database va admin architecture qayta yozilishga majbur qiladigan darajada qattiq bog‘lanmagan bo‘lishi kerak.