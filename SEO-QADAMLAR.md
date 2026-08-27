# SEO — siz qiladigan ishlar

Bu hujjat **faqat siz qo'lda qiladigan** ishlar uchun. Kodda nima qilingani va
nima uchun qilingani — `SEO.md` da (inglizcha, texnik).

Tartib muhim: 0-bosqichsiz qolganlarining hech biri to'liq ishlamaydi.

---

## Hozirgi holat

Kod tayyor va **jonli saytda turibdi**: 346 ta prerender qilingan sahifa,
SEO audit 0 xato. `seo-ssr` `main` ga merge qilinib push qilingan.

Sitemapda hozir **87 ta URL** bor (29 sahifa × 3 til), 321 emas — chunki
`VITE_API_URL` qo'yilgani uchun generator **e'loni yo'q tuman sahifalarini
sitemapdan chiqarib tashlayapti**. Bu to'g'ri xatti-harakat: bo'sh sahifani
Google'ga tiqishtirish "Crawled – currently not indexed" beradi, foyda emas.
Hozir e'lonlar faqat Uchtepada bor, shuning uchun sitemapda faqat Uchtepa
turibdi. **E'lon qo'shilgan tuman avtomat sitemapga qo'shiladi** — qo'lda
hech narsa qilish shart emas. Qolgan 300+ sahifa o'chib ketgani yo'q,
hammasi ochiladi va ichki linklar orqali topiladi.

Tekshirilgan (2026-08-27):

| Nima | Holat |
|---|---|
| Sahifa matni HTML ichida (prerender) | ✅ ishlayapti |
| Noma'lum manzil → 404 | ✅ |
| `sitemap.xml`, `sitemap-pages.xml` | ✅ |
| `sitemap-listings.xml` (Railway) | ✅ ishlayapti |
| `robots.txt` | ✅ |
| canonical / hreflang / ru-uz ajralishi | ✅ |
| Vercel `VITE_API_URL` | ✅ qo'yilgan |
| Railway `SITE_URL` | ✅ qo'yilgan |
| **Domen: apex vs www** | ❌ **teskari — pastda** |
| Google Search Console | ❓ tasdiqlanmagan (pastda) |
| Bing / Yandex | ❌ qilinmagan |
| Google Analytics 4 | ❌ ID qo'yilmagan |

---

## 0-BOSQICH — ⚠️ ENG SHOSHILINCH: domen teskari ulangan

Hozir sayt shunday ishlayapti:

```
https://maklersizuy.uz/…      →  308 redirect  →  https://www.maklersizuy.uz/…
```

Ya'ni **www asosiy**, apex esa unga yo'naltiryapti. Lekin kodda hamma narsa
teskarisini aytyapti — canonical, hreflang, sitemap, robots.txt, og:image,
hammasi `https://maklersizuy.uz` (www'siz) deb yozilgan.

Natijada Google'ga shunday ko'rinadi: "www sahifasi menga o'zimni emas,
apex'ni asosiy deb bil deyapti — apex'ga borsam, u meni yana www'ga
qaytaryapti." Bu **"Duplicate without user-selected canonical"** degan
xatoni beradi va indekslashni sekinlashtiradi.

**Tuzatish (2 daqiqa, Vercel'da):**

Vercel → loyiha → **Settings → Domains**:

1. `maklersizuy.uz` yonidagi **⋯** → **Set as Primary Domain**
2. `www.maklersizuy.uz` **Redirect to → maklersizuy.uz** bo'lib qolsin

Keyin tekshiring — endi teskarisi bo'lishi kerak:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://www.maklersizuy.uz/
# Kutilgan: 308 -> https://maklersizuy.uz/
curl -s -o /dev/null -w "%{http_code}\n" https://maklersizuy.uz/robots.txt
# Kutilgan: 200
```

> **Muhim:** Search Console'ga saytni qo'shishdan **oldin** shuni tuzating.
> Aks holda Google noto'g'ri manzilni o'rganib oladi.

---

## 1-BOSQICH — Deploy ✅ BAJARILGAN

Quyidagilar allaqachon qilingan, qayta qilish shart emas:

- Vercel `VITE_API_URL` — qo'yilgan (sitemap-listings jonli ishlayapti)
- Railway `SITE_URL` — qo'yilgan
- `seo-ssr` → `main` merge va push — qilingan, Vercel deploy qilgan

Qolgani faqat yuqoridagi **0-BOSQICH** (domen).

---

## 2-BOSQICH — Deploy to'g'ri ketganini tekshirish ✅ BAJARILGAN

Quyidagi 4 ta tekshiruv 2026-08-27 da o'tkazildi va hammasi o'tdi. Keyingi
deploydan so'ng qayta ishlatish uchun saqlanyapti.

Terminalda quyidagi 4 ta buyruqni bajaring. Har birining kutilgan natijasi
yozilgan.

```bash
# 1) Sahifa matni HTML ichida bormi?
curl -s https://maklersizuy.uz/toshkent/chilonzor/kvartira-ijaraga | grep -o "<h1[^>]*>[^<]*"
```
**Kutilgan:** `<h1 ...>Chilonzorda maklersiz kvartira ijarasi`
**Chiqmasa:** prerender ishlamagan — Vercel build logini ko'ring.

```bash
# 2) Noma'lum manzil 404 qaytaradimi?
curl -s -o /dev/null -w "%{http_code}\n" https://maklersizuy.uz/bunday-sahifa-yoq
```
**Kutilgan:** `404`
**200 chiqsa:** `vercel.json` deploy bo'lmagan.

```bash
# 3) E'lonlar sitemapi ishlayaptimi?
curl -s https://maklersizuy.uz/sitemap-listings.xml | head -3
```
**Kutilgan:** `<?xml version="1.0" ...` bilan boshlanadi.
**HTML chiqsa:** `vercel.json` dagi Railway manzili noto'g'ri.

```bash
# 4) Sitemap indeksi joyidami?
curl -s https://maklersizuy.uz/sitemap.xml
```
**Kutilgan:** ichida `sitemap-pages.xml` va `sitemap-listings.xml`.

---

## 3-BOSQICH — Google Search Console (30 daqiqa, bir marta)

Manzil: **https://search.google.com/search-console**

### 3.1. Saytni qo'shish va tasdiqlash

1. **Add property** → chapdagi **Domain** ni tanlang (URL prefix emas)
2. `maklersizuy.uz` deb yozing → **Continue**
3. Google sizga `google-site-verification=...` degan **TXT yozuv** beradi
4. Domen sotib olgan joyingizga (yoki Cloudflare'ga) kiring → **DNS** →
   yangi **TXT** yozuv qo'shing:
   - Name/Host: `@`
   - Value: Google bergan qator
5. 10–30 daqiqa kuting → Search Console'da **Verify**

> **DNS'ga kira olmasangiz:** "Domain" o'rniga **URL prefix** ni tanlab
> `https://maklersizuy.uz/` deb kiriting, **HTML tag** usulini tanlang, va
> Google bergan `<meta name="google-site-verification" ...>` qatorini
> `index.html` fayliga — **`<!--seo-head-start-->` qatoridan YUQORIGA** —
> joylashtiring. Pastga qo'ysangiz build uni o'chirib yuboradi.

### 3.2. Sitemap yuborish

Chap menyu → **Sitemaps** → maydonchaga faqat shuni yozing:

```
sitemap.xml
```

**Submit** bosing. Faqat shu bittasini yuboring — ichidagi ikkitasini
alohida yubormang, Google o'zi topadi.

24–48 soatdan keyin qaytib kiring. Status **Success** va "Discovered URLs"
bir necha yuz bo'lishi kerak.

### 3.3. Asosiy sahifalarni indekslashga berish

Yuqoridagi qidiruv maydoniga (URL Inspection) quyidagilarni **bittalab**
kiriting va har birida **Request indexing** bosing:

```
https://maklersizuy.uz/
https://maklersizuy.uz/elonlar
https://maklersizuy.uz/kvartira-ijaraga
https://maklersizuy.uz/toshkent
https://maklersizuy.uz/toshkent/kvartira-ijaraga
https://maklersizuy.uz/toshkent/uchtepa/kvartira-ijaraga
https://maklersizuy.uz/talabalar-uchun-ijara
https://maklersizuy.uz/blog
https://maklersizuy.uz/blog/toshkent-ijara-narxlari
https://maklersizuy.uz/ru/toshkent/kvartira-ijaraga
```

> Kuniga ~10 tadan cheklov bor. Qolgan sahifalarni qo'lda kiritish
> **shart emas** — Google sitemap va ichki linklar orqali o'zi topadi.

> **Nega Chilonzor ro'yxatda yo'q?** Unda hali e'lon yo'q, shuning uchun
> sitemapga ham kirmagan. Bo'sh sahifani indekslashga berish — Google
> ko'zida saytning sifatini tushiradi. Chilonzorga birinchi e'lon
> qo'shilishi bilan u sitemapga o'zi tushadi.

### 3.4. Google haqiqatan matnni ko'ryaptimi? (eng muhim qadam)

Bitta sahifa uchun tekshiring:

1. URL Inspection'ga `https://maklersizuy.uz/toshkent/chilonzor/kvartira-ijaraga`
2. **Test live URL** bosing (10–20 soniya)
3. **View tested page** → **Screenshot** yorlig'i

**Kutilgan:** sahifa matni bilan ko'rinadi.
**Aylanayotgan yuklash belgisi ko'rinsa:** prerender ishlamagan — menga ayting.

### 3.5. Keyin nima kuzatiladi

| Qachon | Qayerga qarash | Nima ko'rish kerak |
|---|---|---|
| 3–7 kun | **Pages** (Indexing) | "Indexed" soni o'sib boryapti |
| 2–3 hafta | **Performance** | Impressions paydo bo'ldi |
| 4–6 hafta | **Performance → Queries** | Qaysi so'rovlar ishlayapti |
| 28 kundan keyin | **Core Web Vitals** | Yashil zona |

**Muammo belgisi:** Pages bo'limida **"Duplicate without user-selected
canonical"** ko'p chiqsa — canonical noto'g'ri, menga ayting.
**Muammo emas:** "Crawled – currently not indexed" — e'loni yo'q tuman
sahifalari uchun bu normal.

---

## 4-BOSQICH — Bing va Yandex (10 daqiqa)

O'zbekistonda Yandex ham muhim.

**Bing:** https://www.bing.com/webmasters → **Import from Google Search
Console** → ruxsat bering. Tamom, boshqa hech narsa kerak emas.

**Yandex:** https://webmaster.yandex.com → sayt qo'shing → DNS TXT bilan
tasdiqlang → **Индексирование → Файлы Sitemap** → `https://maklersizuy.uz/sitemap.xml`

---

## 5-BOSQICH — Analitika (ixtiyoriy, 10 daqiqa)

Google Analytics 4 kodda tayyor, lekin **o'chirilgan**. Yoqish uchun:

1. https://analytics.google.com → Admin → Create property
2. Web data stream qo'shing → `G-XXXXXXXXXX` ko'rinishidagi ID oling
3. Vercel → Settings → Environment Variables:

| Nomi | Qiymati |
|---|---|
| `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` |

4. Redeploy

ID qo'ymasangiz — hech narsa yuklanmaydi, cookie yozilmaydi.

**GA4 da eng muhim hodisa: `contact_reveal`** — foydalanuvchi uy egasining
raqamini ko'rgan payt. Admin → Events → uni **Mark as key event** qiling. Bu
qaysi SEO sahifa faqat kirish beryapti, qaysi biri haqiqiy mijoz beryaptini
ko'rsatadigan yagona raqam.

---

## Keyin nima bo'ladi (realistik)

| Vaqt | Kutilgan natija |
|---|---|
| 1–2 hafta | Sahifalar indeksga tusha boshlaydi |
| 3–6 hafta | Uzun so'rovlar: "Chilonzorda maklersiz kvartira" |
| 2–4 oy | O'rta so'rovlar: "Toshkentda kvartira ijaraga" |
| 4–6 oy+ | Asosiy so'rovlar: "maklersiz kvartira" |

Bu jadval **e'lonlar soni o'sib borsa** amal qiladi. Kod Google'ga saytni
ko'rsatadi; nimani ko'rsatishni e'lonlar hal qiladi.

**Ochig'ini aytganda: hozir saytda 1 ta e'lon bor.** Bu SEO'ning emas,
biznesning muammosi, va hozir eng katta to'siq aynan shu — kodda emas.
Yuqoridagi 346 sahifa Google uchun tayyor idish; idish bo'sh bo'lsa Google
uni ko'rsatmaydi. 1 ta e'lon bilan hech qanday SEO "maklersiz kvartira"
so'rovida birinchi o'ringa chiqara olmaydi.

Amaliy chegara:

| E'lon soni | Nima kutish mumkin |
|---|---|
| 1–10 | Faqat brend so'rovi: "maklersizuy" |
| 20–50 | Uzun so'rovlar: "Chilonzorda maklersiz kvartira" |
| 100–300 | O'rta so'rovlar: "Toshkentda kvartira ijaraga" |
| 500+ | Asosiy so'rovlar bo'yicha kurashish mumkin |

Shuning uchun keyingi oyda eng foydali ish — SEO kodi emas, **e'lon
yig'ish**: Telegram kanallaridan uy egalarini taklif qilish, birinchi 50 ta
e'lonni qo'lda bo'lsa ham kiritish. Har bir yangi tumandagi e'lon o'sha
tuman sahifasini avtomat sitemapga qo'shadi va uni jonlantiradi.

---

## Har oyda qiladigan 3 ta ish

1. **Search Console → Performance** ni oching, qaysi so'rovlar ishlayotganini
   ko'ring. Yaxshi ishlayotgan sahifaga kontent qo'shing.
2. **Oyiga 2 ta maqola** yozing (hozir 11 ta qo'llanma + 3 ta hujjat sahifasi bor) — odamlar haqiqatan so'raydigan savolga:
   zakladka qaytariladimi, kadastrni qanday tekshirish kerak, shartnomada
   nima bo'lishi shart. `src/seo/content/articles.uz.ts` ichida.
3. **Telegram** — har bir maqolani kanalga tashlang, orqasiga link bilan.
   O'zbekistonda uy qidiruvi Telegram orqali ketadi va yangi domen shu tarzda
   tanilgan domenga aylanadi.

---

## Keyingi eng katta ish (kod tarafi)

**E'lon rasmlari hozir base64 `data:` URI ko'rinishida bazada saqlanadi.**
Bu degani: Google Images'da chiqmaydi, ulashganda rasm ko'rinmaydi, CDN
keshlamaydi va har bir javobni og'irlashtiradi.

Bu qolgan ishlar ichida **eng qimmatlisi**. Cloudflare R2 yoki S3 kerak +
migratsiya. Tayyor bo'lganingizda ayting.

Qolganlari — `SEO.md` §8 da.
