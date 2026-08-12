# README-4

# AI TRUST & ANTI-SCAM ENGINE

## 1. MAQSAD

Ushbu tizim platformaning eng muhim texnologik ustunligi hisoblanadi.

Platforma faqat kvartira e'lonlarini joylashtiradigan marketplace bo'lmasligi kerak.

Platforma:

* Maklerlarni aniqlashi
* Firibgarlarni aniqlashi
* Soxta e'lonlarni aniqlashi
* Soxta rasmlarni aniqlashi
* Bir nechta akkauntlarni aniqlashi
* Shubhali xatti-harakatlarni aniqlashi
* Foydalanuvchilarni ogohlantirishi
* Moderatorlarga avtomatik signal berishi

kerak.

MUHIM:

AI hech qachon faqat bitta belgiga qarab foydalanuvchini "firibgar" yoki "makler" deb hukm qilmasligi kerak.

AI riskni baholaydi.

Yakuniy bloklash yoki jiddiy choralar uchun moderation workflow bo'lishi kerak.

---

# 2. AI TRUST ECOSYSTEM

Tizim quyidagi asosiy modullardan tashkil topadi:

1. Identity Verification
2. Owner Verification
3. Property Verification
4. AI Listing Analysis
5. AI Image Analysis
6. Duplicate Detection
7. Broker/Makler Risk Detection
8. Fraud Detection
9. Multi-Account Detection
10. Behavioral Risk Engine
11. Review Fraud Detection
12. Complaint Analysis
13. Trust Score Engine
14. Risk Score Engine
15. Moderation Queue
16. Appeal System
17. Continuous Monitoring

---

# 3. TRUST SCORE

Har bir foydalanuvchida:

TRUST SCORE

bo'ladi.

Range:

0–100

Bu score foydalanuvchining platformadagi ishonchlilik signalari asosida hisoblanadi.

---

# 4. TRUST SCORE COMPONENTS

Score quyidagi signallardan tashkil topadi:

## Identity

Telefon tasdiqlanganmi?

Email tasdiqlanganmi?

Identity verification o'tganmi?

---

## Profile

Profil to'liqmi?

Profil rasmi bormi?

Profil qancha vaqtdan beri mavjud?

---

## Property

Kvartira hujjatlari tasdiqlanganmi?

Kvartira ma'lumotlari izchilmi?

---

## Reputation

Ijobiy reviewlar.

Muvaffaqiyatli ijara tarixlari.

---

## Behavior

Platformadagi xatti-harakatlar.

---

## Complaints

Shikoyatlar soni va turi.

---

# 5. TRUST LEVELS

## 0–29

HIGH RISK

Qizil status.

---

## 30–49

LOW TRUST

Sariq status.

---

## 50–69

TRUSTED

Yashil status.

---

## 70–89

HIGHLY TRUSTED

Kuchli yashil status.

---

## 90–100

VERIFIED TRUST

Premium trust status.

---

# 6. RISK SCORE

Trust Score'dan alohida:

RISK SCORE

bo'lishi kerak.

Risk Score:

0–100

0 = minimal risk

100 = juda yuqori risk.

Bu score:

* E'lon
* Foydalanuvchi
* Telefon
* Qurilma
* Rasm
* Xatti-harakat

uchun alohida hisoblanishi mumkin.

---

# 7. AI LISTING ANALYSIS

Har bir yangi e'lon AI tomonidan tekshiriladi.

Tekshiruv:

* Title
* Description
* Price
* Location
* Phone
* Images
* Owner profile
* Listing history

---

# 8. TEXT ANALYSIS

AI e'lon matnini tahlil qiladi.

Shubhali patternlar:

* Juda umumiy matn
* Bir xil matnni ko'p e'lonlarda ishlatish
* Haddan tashqari shoshiltirish
* Oldindan pul talab qilish
* "Faqat hozir"
* "Zudlik bilan pul o'tkazing"

kabi risk signallari.

AI avtomatik ravishda risk signalari yaratadi.

---

# 9. MAKLER DETECTION

Bu platformaning asosiy funksiyalaridan biri.

Maklerlar ko'pincha o'zlarini "makler" deb yozmaydi.

Shuning uchun tizim behavior-based detection ishlatadi.

---

# 10. BROKER RISK SIGNALS

AI quyidagilarni tekshiradi:

### Listing Volume

Bir foydalanuvchi qancha e'lon joylayapti?

---

### Listing Frequency

Kuniga nechta e'lon?

---

### Geographic Spread

Bir foydalanuvchi:

Chilonzor

Yunusobod

Sergeli

Olmazor

Yashnobod

kabi juda ko'p hududlarda e'lon joylayaptimi?

---

### Phone Reuse

Bir telefon raqami nechta e'lon bilan bog'langan?

---

### Image Reuse

Bir xil rasmlar nechta e'londa ishlatilgan?

---

### Description Reuse

Bir xil tavsiflar takrorlanadimi?

---

### Behavior

Foydalanuvchi faqat e'lon joylaydimi?

Muloqot qiladimi?

Reviewlar bormi?

---

# 11. BROKER RISK SCORE

AI:

Broker Probability

hisoblaydi.

Masalan:

0–30%

Normal owner

---

31–60%

Suspicious

---

61–80%

High risk

---

81–100%

Strong broker signal

---

MUHIM:

Bu "foydalanuvchi makler" degan yakuniy hukm emas.

Bu moderation signalidir.

---

# 12. MULTI-LISTING DETECTION

Bir odam:

* 20 ta e'lon
* 10 ta telefon
* 5 ta akkaunt

ishlatayotgan bo'lishi mumkin.

AI:

Phone

Device

IP

Images

Text

Behavior

signallarini o'zaro bog'laydi.

---

# 13. MULTI-ACCOUNT DETECTION

Bir nechta akkauntlar orasidagi bog'liqlik aniqlanadi.

Signal:

* Bir xil telefon
* Bir xil device fingerprint
* Bir xil payment method
* Bir xil property
* Bir xil images
* Bir xil matn
* Bir xil behavior

---

# 14. IMAGE AI

Har bir rasm AI tomonidan tekshiriladi.

Aniqlash:

* Duplicate image
* Reused image
* Internetdan olingan rasm
* Stock image
* AI-generated image signalari
* Screenshot
* Juda past sifatli rasm

---

# 15. IMAGE HASHING

Har bir rasm uchun:

Perceptual Hash

yaratiladi.

Masalan:

pHash

dHash

yoki boshqa similarity algorithm.

Bu o'xshash rasmlarni topish uchun ishlatiladi.

---

# 16. DUPLICATE IMAGE ENGINE

Agar bir xil yoki juda o'xshash rasm:

10 ta e'londa ishlatilgan bo'lsa,

AI riskni oshiradi.

---

# 17. PROPERTY VERIFICATION

Owner kvartira joylashtirganda:

* Property document
* Kadastr information
* Ownership evidence

yuklash imkoniyati bo'ladi.

---

# 18. DOCUMENT VERIFICATION

AI document OCR ishlatadi.

Aniqlanadigan ma'lumotlar:

* Ism
* Manzil
* Document number
* Property information

Bu ma'lumotlar profil ma'lumotlari bilan solishtiriladi.

---

# 19. IDENTITY VERIFICATION

Foydalanuvchi:

1. Passport/ID
2. Selfie
3. Liveness verification

orqali verification'dan o'tishi mumkin.

---

# 20. PRIVACY

Juda muhim.

Shaxsiy hujjatlar:

* Public ko'rsatilmaydi.
* Listing sahifasida chiqarilmaydi.
* Faqat verification uchun ishlatiladi.
* Keraksiz ma'lumotlar saqlanmasligi kerak.
* Sensitive data access qat'iy cheklanishi kerak.

Admin ham barcha hujjatlarni oddiy ko'rinishda ko'ra olmasligi kerak.

Access logging bo'lishi kerak.

---

# 21. PHONE RISK ENGINE

Telefon raqamlar uchun risk tizimi.

Tekshiradi:

* Bir nechta akkaunt
* Ko'p e'lon
* Ko'p complaint
* Spam behavior
* Suspicious activity

---

# 22. COMMUNICATION SAFETY

Platforma ichidagi chat mavjud bo'ladi.

AI quyidagi xavfli patternlarni aniqlashi mumkin:

* Oldindan pul yuborishni talab qilish
* Tashqi payment link yuborish
* Shubhali link
* Shaxsiy ma'lumot so'rash
* Bosim o'tkazish

Foydalanuvchiga ogohlantirish chiqariladi.

---

# 23. TELEPHONE CALL SAFETY

Kelajakdagi modul sifatida qo'llab-quvvatlash:

Platforma orqali amalga oshiriladigan qo'ng'iroqlar uchun safety analysis.

MUHIM:

Foydalanuvchi roziligisiz shaxsiy telefon suhbatlarini yashirincha yozib olish yoki tahlil qilish mumkin emas.

Agar call analysis joriy qilinsa:

* Explicit consent
* Clear notification
* Data protection
* Retention policy

majburiy bo'ladi.

AI faqat qonuniy va foydalanuvchi roziligi mavjud bo'lgan holatda ishlaydi.

---

# 24. COMPLAINT ENGINE

Foydalanuvchi:

REPORT

tugmasini bosadi.

Sabab:

* Scam
* Broker
* Fake listing
* Fake photos
* Wrong price
* Wrong location
* Harassment
* Spam
* Other

---

# 25. AI COMPLAINT ANALYSIS

AI complaintlarni:

* Categorize
* Prioritize
* Detect duplicates
* Detect abuse

qiladi.

---

# 26. MODERATION PRIORITY

Risk:

90–100

CRITICAL

---

70–89

HIGH

---

50–69

MEDIUM

---

0–49

LOW

---

# 27. MODERATION QUEUE

Admin panelda:

CRITICAL

HIGH

MEDIUM

LOW

bo'yicha queue bo'ladi.

---

# 28. AUTOMATED ACTIONS

Low Risk:

E'lon normal chiqadi.

---

Medium Risk:

Qo'shimcha verification.

---

High Risk:

Manual review.

---

Critical Risk:

Temporary restriction.

---

# 29. NO BLIND AUTOMATIC BAN

AI foydalanuvchini faqat bitta signal asosida bloklamasligi kerak.

Masalan:

"Bir nechta e'lon joyladi"

degan sababning o'zi yetarli emas.

Chunki haqiqiy property owner ham bir nechta uyga ega bo'lishi mumkin.

Shuning uchun:

Multi-signal detection

ishlatilsin.

---

# 30. EXPLAINABLE AI

Admin AI qarorini tushuna olishi kerak.

Masalan:

Risk Score: 87

Reasons:

* 18 listings in 7 days
* Same phone used in 14 listings
* 6 duplicate images
* 4 complaints
* Repeated descriptions

---

# 31. HUMAN REVIEW

AI:

Detection

↓

Risk scoring

↓

Recommendation

qiladi.

Moderator:

Review

↓

Decision

qiladi.

---

# 32. APPEAL SYSTEM

Foydalanuvchi noto'g'ri bloklangan bo'lsa:

Appeal

qilishi mumkin.

---

# 33. APPEAL FLOW

User:

Appeal yuboradi.

↓

Moderator:

Evidence ko'radi.

↓

Decision:

Restore

yoki

Maintain Restriction

---

# 34. TRUST SCORE RECALCULATION

Trust Score real-time bo'lishi shart emas.

Muhim eventlardan keyin qayta hisoblanadi.

Masalan:

* Verification
* Review
* Complaint
* Successful rental
* Policy violation

---

# 35. SUCCESSFUL RENTAL SIGNAL

Ijara muvaffaqiyatli tugagandan keyin:

Owner reputation oshadi.

Tenant reputation ham oshishi mumkin.

---

# 36. REVIEW FRAUD DETECTION

AI fake reviewlarni aniqlashga harakat qiladi.

Signallar:

* Bir xil matn
* Bir xil device
* Bir xil IP
* Juda qisqa vaqt ichida ko'p review
* Suspicious accounts

---

# 37. AI RECOMMENDATION ENGINE

Foydalanuvchiga kvartiralarni faqat:

Narx

bo'yicha emas,

Trust + Location + Price + Preference

asosida tavsiya qilish.

---

# 38. TRUST-FIRST SEARCH

Search ranking:

1. Safety
2. Verification
3. Relevance
4. Price
5. Location
6. Freshness

bo'yicha optimallashtiriladi.

Firibgar yoki shubhali e'lon yuqoriga chiqarilmasligi kerak.

---

# 39. SAFETY BADGES

Listingda:

VERIFIED OWNER

PROPERTY VERIFIED

AI CHECKED

TRUSTED OWNER

kabi badge'lar bo'lishi mumkin.

Badge faqat haqiqiy verification natijasiga asoslangan bo'lishi kerak.

---

# 40. AI STATUS

Har bir e'lon uchun:

AI Checked

yoki

Verification Required

yoki

Under Review

statusi.

---

# 41. FRAUD NETWORK DETECTION

Kelajakda graph-based system yaratish.

Bog'lanishlar:

User

Phone

Device

Listing

Image

Payment

Complaint

Review

o'rtasidagi aloqalar graph sifatida ko'riladi.

Bu katta firibgarlik tarmoqlarini aniqlashga yordam beradi.

---

# 42. ADMIN AI DASHBOARD

Admin quyidagilarni ko'radi:

Fraud Attempts

High Risk Users

High Risk Listings

Broker Signals

Duplicate Images

Complaint Trends

Verification Queue

AI Decisions

---

# 43. REAL-TIME ALERTS

Critical risk paydo bo'lsa:

Admin notification.

---

# 44. SECURITY

AI tizim:

* Rate limiting
* Abuse prevention
* Audit logs
* Access control
* Encryption
* Secure storage

bilan himoyalanadi.

---

# 45. DATA RETENTION

Sensitive verification ma'lumotlari cheksiz saqlanmasligi kerak.

Har bir data turi uchun:

Retention Policy

bo'lishi kerak.

---

# 46. AI MODEL ABSTRACTION

AI provider kodga qattiq bog'lanmasligi kerak.

Architecture:

AIService

↓

OpenAI Adapter

Gemini Adapter

Future AI Adapter

Shunday qurilsinki, keyinchalik AI provider almashtirish oson bo'lsin.

---

# 47. FALLBACK SYSTEM

AI ishlamasa:

Platforma to'liq ishlashdan to'xtamasligi kerak.

Fallback:

Manual Review

bo'ladi.

---

# 48. AI AUDIT LOG

Har bir AI decision:

* Timestamp
* Model
* Input type
* Risk
* Decision
* Reason

bilan log qilinadi.

Sensitive data logga to'liq yozilmasligi kerak.

---

# 49. FALSE POSITIVE PROTECTION

AI xato qilishi mumkin.

Shuning uchun:

False Positive Rate

alohida monitoring qilinadi.

---

# 50. AI PERFORMANCE METRICS

Kuzatiladi:

* Precision
* Recall
* False Positive Rate
* False Negative Rate
* Detection Rate
* Review Resolution Time

---

# 51. CONTINUOUS LEARNING

Moderator qarorlari kelajakdagi modelni yaxshilash uchun anonimlashtirilgan signal sifatida ishlatilishi mumkin.

---

# 52. IMPORTANT LEGAL PRINCIPLE

AI hech qachon:

"Bu odam 100% firibgar"

degan mutlaq hukm bermasligi kerak.

Tizim:

"High Risk"

"Verification Required"

"Suspicious Activity"

kabi ehtiyotkor statuslardan foydalanadi.

---

# 53. FINAL AI FLOW

User creates listing

↓

Identity check

↓

Property check

↓

Text analysis

↓

Image analysis

↓

Phone analysis

↓

Duplicate detection

↓

Behavior analysis

↓

Complaint history

↓

Risk Engine

↓

Trust Engine

↓

Decision

↓

Approved

OR

Verification Required

OR

Manual Review

OR

Temporary Restriction

---

# 54. CORE PRINCIPLE

AI platformaning ko'rinmas xavfsizlik qatlami bo'lishi kerak.

Foydalanuvchi AI qanday ishlayotganini bilishi shart emas.

Lekin foydalanuvchi uning natijasini his qilishi kerak:

"Bu yerda menga kimdir tuzoq qo'ya olmaydi."

---

# 55. FINAL PRODUCT REQUIREMENT

Antigravity ushbu README asosida:

* AI architecture
* Risk engine
* Trust engine
* Verification system
* Moderation system
* Complaint system
* Appeal system
* Admin monitoring
* Database models
* API endpoints
* Frontend components

uchun production-ready architecture ishlab chiqishi kerak.

AI tizimi xavfsiz, explainable, scalable va provider-independent bo'lishi kerak.

Platformaning eng katta texnologik ustunligi:

TRUST + AI + HUMAN MODERATION

kombinatsiyasi bo'lishi kerak.
