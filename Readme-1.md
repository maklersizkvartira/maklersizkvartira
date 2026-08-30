# README-1

> **Tarixiy hujjat.** Bu spetsifikatsiya loyiha hali Maklersiz.uz deb atalgan paytda yozilgan; hozirgi mahsulot [`README.md`](./README.md) da tasvirlangan va nizo bo'lsa README.md ustun turadi.

# PRODUCT & BUSINESS SYSTEM

## Project Name

Uyiz.uz

---

# Vision

Uyiz.uz oddiy kvartira e'lonlari sayti emas.

Maqsad:

O'zbekistonda kvartira topish jarayonini xavfsiz, tez va ishonchli qilish.

Platformaning asosiy qadriyati:

"Ishonch"

Foydalanuvchi platformaga kirganda:

* Firibgarlardan qo'rqmasligi
* E'lon haqiqiy ekanligiga ishonishi
* E'lonni kim joylagan bo'lsa, o'sha bilan to'g'ridan-to'g'ri gaplasha olishi

kerak.

---

# Problem

Hozirgi bozordagi muammolar:

## Tarqoqlik

E'lonlar o'nlab Telegram kanallari va bir nechta saytga sochilib ketgan.

Natijada:

* Bir e'lon bir necha joyda takrorlanadi
* Allaqachon ijaraga berilgan uy oylab osilib turadi
* Qidiruv va taqqoslash imkonsiz

---

## Firibgarlar

Muammolar:

* Soxta rasmlar
* Soxta telefon raqamlar
* Soxta e'lonlar
* Oldindan pul so'rash

---

## Ishonchsizlik

Foydalanuvchi:

* E'lon haqiqiymi?
* E'lon hali dolzarbmi?
* Kim joylagan va u bilan qanday bog'lanaman?
* Rasmlar shu uyga tegishlimi?

degan savollar bilan qoladi.

---

# Solution

E'lon joylash bepul va e'lon darhol chop etiladi — oldida hech qanday
tekshiruv navbati yo'q. Ishonch chop etishdan oldin emas, chop etilgandan
keyin quriladi.

Har bir e'lon:

Ishonch foizi (100 dan boshlanadi)

oladi.

Foiz faqat shikoyat tushib, **admin uni tasdiqlaganda** tushadi.

Uy egasi ham, professional agent ham:

Owner Verification

dan o'tishi mumkin.

---

# Main Users

## Tenant

Kvartira qidiruvchi.

---

## Owner

Kvartira egasi.

---

## Admin

Platformani boshqaruvchi.

---

## Moderator

E'lonlarni tekshiruvchi.

---

# User Registration Flow

1. Telefon raqam kiritadi.

2. SMS OTP tasdiqlaydi.

3. Profil yaratadi.

4. Ism va familiya kiritadi.

5. Profil tayyor bo'ladi.

---

# Verification Flow

Verification ixtiyoriy emas.

Trust Score oshirish uchun tavsiya qilinadi.

Bosqichlar:

### Level 1

Telefon tasdiqlash.

---

### Level 2

Pasport tasdiqlash.

---

### Level 3

Selfie tasdiqlash.

---

### Level 4

Property Verification.

---

### Level 5

Premium Verified Owner.

---

# Owner Flow

Kvartira egasi:

1. Login qiladi.

2. E'lon yaratadi.

3. Rasmlar yuklaydi.

4. Narx kiritadi.

5. Manzil kiritadi.

6. Tavsif yozadi.

7. AI tekshiradi.

8. Moderator tasdiqlaydi.

9. E'lon chiqadi.

---

# Tenant Flow

1. Platformaga kiradi.

2. Filtrlaydi.

3. E'lonlarni ko'radi.

4. Trust Score tekshiradi.

5. Egasi bilan bog'lanadi.

6. Kvartirani ko'radi.

7. Sharh qoldiradi.

---

# Listing Flow

E'lon yaratish:

* Rasmlar
* Video
* Narx
* Xonalar soni
* Hudud
* Metro
* Universitet yaqinligi
* Tavsif

AI avtomatik tekshiradi.

---

# AI Verification Flow

E'lon yuboriladi.

↓

Rasmlar tekshiriladi.

↓

Matn tekshiriladi.

↓

Profil tekshiriladi.

↓

Risk Score hisoblanadi.

↓

Approve yoki Review Queue.

---

# Trust Score System

Har bir foydalanuvchi:

0-100 oralig'ida Trust Score oladi.

Hisoblash:

Telefon tasdiqlangan:
+10

Selfie:
+20

Pasport:
+20

Property Verification:
+30

Positive Reviews:
+20

---

# Trust Levels

0-25

Red

Shubhali

---

26-50

Yellow

Yangi foydalanuvchi

---

51-75

Green

Ishonchli

---

76-100

Premium Green

Yuqori ishonch

---

# Reputation System

Profil uchun:

Reviews

Stars

Comments

Trust History

saqlanadi.

---

# Complaint System

Har bir e'lon ostida:

Report Button

bo'ladi.

Sabablar:

* Firibgarlik
* Noto'g'ri ma'lumot
* Soxta rasm
* Spam

---

# Moderation Flow

Shikoyat tushadi.

↓

Admin ko'radi.

↓

Tasdiqlaydi (RESOLVED) yoki rad etadi (REJECTED).

↓

Tasdiqlansa — e'lonning ishonch foizi qayta hisoblanadi va tushadi.

↓

Kerak bo'lsa e'lon olib tashlanadi yoki foydalanuvchi bloklanadi.

Rad etilsa — hech narsa o'zgarmaydi. Tasdiq bekor qilinsa — foiz o'z joyiga
qaytadi, chunki u ayirilmaydi, har safar noldan hisoblanadi.

---

# Referral System

Har bir foydalanuvchida:

Referral Code

bo'ladi.

Do'st olib kelsa:

Referral Points

beriladi.

---

# Referral Rewards

10 ta do'st:

Premium Search

---

25 ta do'st:

Listing Boost

---

50 ta do'st:

VIP Badge

---

# Loyalty System

Platformada faol foydalanuvchilar:

XP yig'adi.

---

# Trust XP

Harakatlar:

Review yozish

Verification qilish

Do'st taklif qilish

Ijara yakunlash

XP beradi.

---

# Levels

Bronze

Silver

Gold

Platinum

Diamond

---

# Student Program

Alohida modul.

Universitetlar:

* TATU
* INHA
* WIUT
* Turin
* TDIU
* NUUz
* PDP Academy

Talabalarga yaqin uylarni ko'rsatadi.

---

# Premium System

Premium foydalanuvchilar:

* Priority Listing
* Featured Listing
* Boost Listing
* Premium Badge

oladi.

---

# Monetization

## Stage 1

Premium Listing

---

## Stage 2

Listing Boost

---

## Stage 3

Verified Owner Plus

---

## Stage 4

Advertising System

---

## Stage 5

Partner Services

* Ko'chirish
* Sug'urta
* Mebel

---

# Success Metrics

Platforma quyidagilarni kuzatadi:

* Daily Active Users
* Monthly Active Users
* Verified Owners
* Completed Rentals
* Fraud Reports
* Referral Growth

---

# Year 1 Goal

10 000 foydalanuvchi

1 000 verified owner

5 000 e'lon

---

# Year 3 Goal

100 000 foydalanuvchi

20 000 verified owner

50 000 e'lon

---

# Year 5 Goal

O'zbekistondagi eng ishonchli rental platforma.

1 million foydalanuvchi.

100 ming verified owner.

Ko'chmas mulk ekotizimiga aylanish.

---

# Final Product Principle

Bu platforma kvartira e'lonlari saytini qurish uchun emas.

Bu platforma odamlar kvartira qidirganda eng avvalo ishonadigan brendni yaratish uchun quriladi.

Har bir funksiya:

"Ishonch"

atrofida qurilishi kerak.
