# Maklersiz.uz saytini Mobile, Planshet va Desktop ilovaga aylantirish

Ushbu reja orqali mavjud React saytini Capacitor yordamida mobil ilovaga (Android va iOS) aylantiramiz va barcha ekran o'lchamlariga moslaymiz.

## Foydalanuvchi tekshirishi kerak bo'lgan bandlar
> [!IMPORTANT]
> iOS ilovasini yaratish va iPhone-da sinab ko'rish uchun sizga macOS va Xcode kerak bo'ladi. Android uchun esa hozirgi Android Studio yetarli.

## Kutilayotgan o'zgarishlar

### 1. Mobil ilova integratsiyasi (Capacitor)
Loyihaga Capacitor kutubxonalarini qo'shish orqali uni native ilovaga aylantiramiz.

#### [NEW] [capacitor.config.ts](file:///Users/macbookair/Desktop/Maklersiz.uz/capacitor.config.ts)
Capacitor sozlamalari fayli.

#### [MODIFY] [package.json](file:///Users/macbookair/Desktop/Maklersiz.uz/package.json)
Mobil ilovani qurish uchun scriptlar qo'shiladi.

### 2. Android va iOS platformalari
Android Studio-da ochish uchun `android` papkasini va iOS uchun `ios` papkasini yaratamiz.

#### [NEW] `android/` papkasi
Android Studio-da ochiladigan asosiy mobil loyiha.

#### [NEW] `ios/` papkasi
Xcode-da ochiladigan iOS loyihasi.

### 3. Responsiveness (Moslashuvchanlik)
Tailwind CSS yordamida planshet (tablet) va desktop ekranlaridagi ayrim kamchiliklarni to'g'irlaymiz.

#### [MODIFY] [Header.tsx](file:///Users/macbookair/Desktop/Maklersiz.uz/src/components/layout/Header.tsx)
Desktop menyusi va logotipni planshetlarda yaxshiroq ko'rinadigan qilamiz.

## Tekshirish rejasi

### Avtomatik tekshiruvlar
- `npm run build` orqali loyiha xatosiz yig'ilishini tekshirish.
- `npx cap sync` orqali mobil fayllar yangilanishini tekshirish.

### Qo'lda tekshirish
1. Android Studio-da loyihani ochish va Emulator yoki haqiqiy telefon orqali ishga tushirish.
2. Brauzerda Inspect element orqali Planshet (iPad) va Desktop o'lchamlarini tekshirish.
