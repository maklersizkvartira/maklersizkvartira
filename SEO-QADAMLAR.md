# SEO — siz qiladigan ishlar

Bu hujjat **faqat siz qo'lda qiladigan** ishlar uchun. Kodda nima qilingani va
nima uchun qilingani — `SEO.md` da (inglizcha, texnik).

Tartib muhim: 0-bosqichsiz qolganlarining hech biri to'liq ishlamaydi.

---

## Hozirgi holat

**2026-09-02 da tekshirilgan, jonli saytdan.** Domen ko'chishining kod va
hosting qismi tugadi. Qolgani — Search Console, va u faqat sizning qo'lingizda.

| Nima | Holat |
|---|---|
| `uyiz.uz` DNS Vercel'ga qaragan | ✅ |
| Vercel: `uyiz.uz` — Primary Domain, `www` → apex 308 | ✅ |
| Sahifalar `canonical` sifatida `uyiz.uz` ni ko'rsatadi | ✅ |
| `hreflang` uz/ru/en/x-default — hammasi `uyiz.uz` da | ✅ |
| `sitemap.xml`, `robots.txt` — `uyiz.uz` | ✅ |
| `sitemap-listings.xml` (Railway proksi) — `uyiz.uz` | ✅ |
| Vercel `VITE_SITE_URL` | kerak emas — kod standarti `uyiz.uz` |
| Railway `SITE_URL` | kerak emas — kod standarti `uyiz.uz` |
| Railway `CORS_ORIGINS` | ✅ `main.py` regexi `*.uyiz.uz` ni qamraydi |
| `admin.uyiz.uz` — admin loyihasiga ulangan | ❌ ochilmaydi |
| Firebase Authorized Domains'da `uyiz.uz` | ❌ tekshirilmagan |
| Yandex kaliti referrerlarida `uyiz.uz` | ❌ tekshirilmagan |
| Google Search Console — `uyiz.uz` tasdiqlangan | ✅ 2026-09-03, DNS TXT |
| Search Console — `sitemap.xml` yuborilgan | ✅ 2026-09-03 |
| Search Console — `maklersizuy.uz` DNS bilan tasdiqlangan | ❌ |
| `maklersizuy.uz` → `uyiz.uz` 301 | ❌ **ataylab, hali erta** |
| Change of Address | ❌ |
| Bing / Yandex Webmaster | ❌ |
| Google Analytics 4 — stream URL | ❌ |

### Raqamlar, hozirgi holicha

| | Soni |
|---|---|
| Prerender qilingan sahifa | **595** |
| Indekslanadigan sahifa | **186** |
| Sitemapga tushgani | **31** |
| Sitemapdan kesilgani (ortida e'lon yo'q) | **155** |
| **Saytdagi haqiqiy e'lon** | **2 ta** |

Oxirgi qator qolganini tushuntiradi. 155 sahifa o'chib ketgani yo'q — ochiladi,
ichki linklardan topiladi va **e'lon qo'shilgan zahoti o'zi sitemapga tushadi**.
Bo'sh sahifani Google'ga tiqishtirish "Crawled – currently not indexed" beradi,
foyda emas.

Va ikkala mavjud e'lon ham test ma'lumot: `ggggggssssssss` va `yengi toshmi`.
Ular hozir Google'ga topshirilgan sitemapda turibdi.

---

## 0-BOSQICH — ✅ BAJARILGAN (2026-09-02)

Bu bosqich tugagan. Nima qilinganini bilib turish uchun qoldirilgan.

Vercel'da `uyiz.uz` Primary Domain qilindi va `www.uyiz.uz` unga 308 bilan
yo'naltirildi. Kodning besh joyidagi manzil `uyiz.uz` ga o'tkazildi
(`src/seo/config.ts`, `scripts/generate-sitemap.mjs`, `index.html`,
`backend_python/app/core/config.py`; `public/CNAME` o'chirildi — u Vercel'da
ishlamaydigan GitHub Pages mexanizmi edi).

Muhim: `VITE_SITE_URL` va `SITE_URL` **qo'yilmadi va kerak emas**. Kodning
o'zi endi `https://uyiz.uz` ni standart qilib beradi, ikkala platforma ham
push'dan keyin avtomat qayta deploy bo'lib o'sha qiymatni oldi. Qo'ysangiz
ham bo'ladi — bir kun domen yana o'zgarsa, kodni qayta yozmasdan boshqarish
imkonini beradi. `CORS_ORIGINS` ham kerak emas: `main.py` dagi regex
`https://(.*\.)?uyiz\.uz` ni allaqachon qamraydi.

Tekshiruv (hozir shu natijani beradi):

```bash
curl -sI https://uyiz.uz/ | head -1
# 200

curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://www.uyiz.uz/
# 308 -> https://uyiz.uz/

curl -s https://uyiz.uz/toshkent/chilonzor | grep -o 'canonical" href="[^"]*"'
# canonical" href="https://uyiz.uz/toshkent/chilonzor"

curl -s https://uyiz.uz/robots.txt | tail -1
# Sitemap: https://uyiz.uz/sitemap.xml
```

### Hali qilinmagani

- **`admin.uyiz.uz`** ochilmaydi. Uni admin Vercel loyihasiga ulang
  (Root Directory `admin`). Tekshiruv:
  `curl -sI https://admin.uyiz.uz/ | grep -i x-robots-tag` → `noindex, nofollow`.
- **Firebase → Authentication → Settings → Authorized domains**: `uyiz.uz`,
  `www.uyiz.uz`, `admin.uyiz.uz` qo'shing. Eski yozuvlarni o'chirmang.
  Bo'lmasa Google orqali kirish `auth/unauthorized-domain` bilan yiqiladi.
- **Yandex** (developer.tech.yandex.ru) — kalitning ruxsat etilgan
  referrerlariga `uyiz.uz`, `www.uyiz.uz`, `*.uyiz.uz`. Bo'lmasa xarita
  Yandex plitkalari o'rniga OSM'ga tushadi.

---

## 1-BOSQICH — eski domendan 301 (⚠️ HALI ERTA)

**Buni 3-bosqichdagi ikkala Search Console property DNS bilan tasdiqlanmaguncha
qilmang.** 301 — qaytarib bo'lmaydigan qadam: uni ko'rgan har bir brauzer
keshlaydi, va eski domen 200 qaytarmay qolgach Change of Address imkoni
butunlay yo'qoladi.

Vaqti kelganda `vercel.json` ichiga, `"redirects"` ro'yxatining **eng
boshiga** (Vercel yuqoridan pastga qarab moslaydi):

```json
{ "source": "/:path*", "has": [{ "type": "host", "value": "maklersizuy.uz" }],
  "destination": "https://uyiz.uz/:path*", "permanent": true },
{ "source": "/:path*", "has": [{ "type": "host", "value": "www.maklersizuy.uz" }],
  "destination": "https://uyiz.uz/:path*", "permanent": true }
```

Diqqat: `maklersizuy.uz` hozir `www.maklersizuy.uz` ga 308 qilyapti. Vercel →
Domains'da o'sha yo'naltirishni avval tozalang, aks holda eski apex ikki
qadamda yuradi.

Tekshiruv — **yo'l saqlanishi shart**, bosh sahifaga tushmasin:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://maklersizuy.uz/toshkent/chilonzor
# 301 -> https://uyiz.uz/toshkent/chilonzor
```

Eski domen **kamida 12 oy** shu holatda tursin. Uni o'chirish — saytning
yiqqan barcha o'rinlarini va tashqi linklarini bir zarbada yo'qotish.

---

## 2-BOSQICH — Deploy to'g'ri ketganini tekshirish

Terminalda quyidagi 4 ta buyruqni bajaring. Har birining kutilgan natijasi
yozilgan.

```bash
# 1) Sahifa matni HTML ichida bormi?
curl -s https://uyiz.uz/toshkent/chilonzor/kvartira-ijaraga | grep -o "<h1[^>]*>[^<]*"
```
**Kutilgan:** `<h1 ...>Chilonzorda kvartira ijarasi` ko'rinishidagi sarlavha.
Aniq matn `src/seo/content/` dan keladi — muhimi, sarlavha HTML ichida bo'lsin.
**Chiqmasa:** prerender ishlamagan — Vercel build logini ko'ring.

```bash
# 2) Noma'lum manzil 404 qaytaradimi?
curl -s -o /dev/null -w "%{http_code}\n" https://uyiz.uz/bunday-sahifa-yoq
```
**Kutilgan:** `404`
**200 chiqsa:** `vercel.json` deploy bo'lmagan.

```bash
# 3) E'lonlar sitemapi ishlayaptimi?
curl -s https://uyiz.uz/sitemap-listings.xml | head -3
```
**Kutilgan:** `<?xml version="1.0" ...` bilan boshlanadi va ichidagi manzillar
`https://uyiz.uz/...` bo'lsin.
**HTML chiqsa:** `vercel.json` dagi Railway manzili noto'g'ri.
**Ichida `maklersizuy.uz` chiqsa:** Railway'da `SITE_URL` qo'yilmagan.

```bash
# 4) Sitemap indeksi joyidami?
curl -s https://uyiz.uz/sitemap.xml
```
**Kutilgan:** ichida `sitemap-pages.xml` va `sitemap-listings.xml`.

---

## 3-BOSQICH — Google Search Console (30 daqiqa, bir marta)

Manzil: **https://search.google.com/search-console**

### 3.1. Yangi saytni qo'shish va tasdiqlash

1. **Add property** → chapdagi **Domain** ni tanlang (URL prefix emas)
2. `uyiz.uz` deb yozing → **Continue**
3. Google sizga `google-site-verification=...` degan **TXT yozuv** beradi
4. **Eskiz.uz** paneliga kiring → `uyiz.uz` → **DNS** → yangi **TXT** yozuv:
   - Name/Host: `@`
   - Value: Google bergan qator, **to'liq** — `google-site-verification=`
     qismi bilan birga. Qo'shtirnoqni qo'lda qo'ymang, panel o'zi qo'shadi.
5. 10–30 daqiqa kuting → Search Console'da **Verify**

> **DNS Eskiz'da, Cloudflare'da emas.** Ikkala domen ham `ns1.eskiz.uz` /
> `ns2.eskiz.uz` da — SMS provayder bilan bir joyda. Boshqa panelda qidirib
> vaqt ketkazmang.

> **Tarqalganini shu bilan tekshiring**, `Verify` ni ko'r-ko'rona bosmasdan:
> `nslookup -type=TXT uyiz.uz 8.8.4.4`. Erta bosilgan `Verify` xato beradi va
> Google keyingi urinishgacha kutishga majbur qiladi. Bitta public resolver
> hali ko'rmasligi normal — avtoritativ server (`ns1.eskiz.uz`) ko'rsa yetadi.

> **DNS'ga kira olmasangiz:** "Domain" o'rniga **URL prefix** ni tanlab
> `https://uyiz.uz/` deb kiriting, **HTML tag** usulini tanlang, va
> Google bergan `<meta name="google-site-verification" ...>` qatorini
> `index.html` fayliga — **`<!--seo-head-start-->` qatoridan YUQORIGA** —
> joylashtiring. Pastga qo'ysangiz build uni o'chirib yuboradi.

> **Eski domenni ham tasdiqlangan holda qoldiring.** `maklersizuy.uz` property
> o'chirilmasin — 3.5 dagi Change of Address ikkalasi ham tasdiqlangan
> bo'lmasa ishlamaydi.

### 3.2. Sitemap yuborish

Chap menyu → **Sitemaps** → maydonchaga **to'liq manzilni** yozing:

```
https://uyiz.uz/sitemap.xml
```

> **Nega to'liq?** `Domain` property `http` va `https` ni, apex va barcha
> subdomenlarni bir vaqtda qamraydi, ya'ni Google qisqa yo'lni qaysi manzilga
> qo'shishni bilmaydi — `sitemap.xml` deb yozilsa `Invalid sitemap address`
> beradi. Qisqa yozuv faqat `URL prefix` property'da ishlaydi, u yerda
> maydoncha oldindan `https://uyiz.uz/` bilan to'ldirilgan bo'ladi.

**Submit** bosing. Faqat shu bittasini yuboring — ichidagi ikkitasini
alohida yubormang, Google o'zi topadi.

24–48 soatdan keyin qaytib kiring. Status **Success** va "Discovered URLs"
bir necha yuz bo'lishi kerak.

### 3.3. Asosiy sahifalarni indekslashga berish

Yuqoridagi qidiruv maydoniga (URL Inspection) quyidagilarni **bittalab**
kiriting va har birida **Request indexing** bosing:

```
https://uyiz.uz/
https://uyiz.uz/elonlar
https://uyiz.uz/kvartira-ijaraga
https://uyiz.uz/toshkent
https://uyiz.uz/toshkent/kvartira-ijaraga
https://uyiz.uz/toshkent/uchtepa/kvartira-ijaraga
https://uyiz.uz/toshkent/olmazor/kvartira-ijaraga
https://uyiz.uz/talabalar-uchun-ijara
https://uyiz.uz/blog
https://uyiz.uz/ru/toshkent/kvartira-ijaraga
```

> Kuniga ~10 tadan cheklov bor. Qolgan sahifalarni qo'lda kiritish
> **shart emas** — Google sitemap va ichki linklar orqali o'zi topadi.

> **Ro'yxatni ko'chirishdan oldin sitemapga solishtiring.** Bu ro'yxatda
> avval `/uy-ijaraga` turardi — sahifa ochiladi va `index, follow` beradi,
> lekin ortida bironta e'lon yo'qligi uchun sitemapga kirmaydi, ya'ni uni
> indekslashga berish quyidagi qoidaning o'zini buzardi. O'rniga Olmazor
> qo'yildi: unda e'lon bor. Sitemapdagi haqiqiy ro'yxat —
> `curl -s https://uyiz.uz/sitemap-pages.xml | grep -o '<loc>[^<]*'`.

> **Nega ba'zi tumanlar ro'yxatda yo'q?** Ularda hali e'lon yo'q, shuning uchun
> sitemapga ham kirmagan. Bo'sh sahifani indekslashga berish — Google
> ko'zida saytning sifatini tushiradi. Birinchi e'lon qo'shilishi bilan
> o'sha tuman sitemapga o'zi tushadi.

### 3.4. Google haqiqatan matnni ko'ryaptimi? (eng muhim qadam)

Bitta sahifa uchun tekshiring:

1. URL Inspection'ga `https://uyiz.uz/toshkent/uchtepa/kvartira-ijaraga`
2. **Test live URL** bosing (10–20 soniya)
3. **View tested page** → **Screenshot** yorlig'i

Manzil ataylab e'loni **bor** tumandan olingan. Bo'sh tuman sahifasi ham
prerenderni tekshiradi, lekin skrinshotda e'lon kartochkasi ko'rinsa, bir
vaqtda ma'lumot oqimi ham tasdiqlanadi — ikkitasi o'rniga bitta tekshiruv.

**Kutilgan:** sahifa matni bilan ko'rinadi.
**Aylanayotgan yuklash belgisi ko'rinsa:** prerender ishlamagan — menga ayting.

### 3.5. Change of Address (domen ko'chirish)

Bu qadam **eng oxirida** bajariladi va uchta shart bir vaqtda bajarilgan
bo'lishi kerak:

1. `maklersizuy.uz` property tasdiqlangan
2. `uyiz.uz` property tasdiqlangan
3. Eski domendan yangisiga **301** jonli ishlayapti (0.5 dagi tekshiruv)

Keyin: **eski** property → **Settings → Change of address** → yangi saytni
tanlang → **Validate & Update**.

Google ko'chishni bir necha hafta davomida qayta ishlaydi. Shu davrda eski
domenni o'chirmang.

### 3.6. Keyin nima kuzatiladi

| Qachon | Qayerga qarash | Nima ko'rish kerak |
|---|---|---|
| 3–7 kun | **Pages** (Indexing) | "Indexed" soni o'sib boryapti |
| 2–3 hafta | **Performance** | Impressions paydo bo'ldi |
| 4–6 hafta | **Performance → Queries** | Qaysi so'rovlar ishlayapti |
| 28 kundan keyin | **Core Web Vitals** | Yashil zona |

**Muammo belgisi:** Pages bo'limida **"Duplicate without user-selected
canonical"** ko'p chiqsa — canonical noto'g'ri yoki apex/www teskari ulangan.
**Muammo emas:** "Crawled – currently not indexed" — e'loni yo'q tuman
sahifalari uchun bu normal.

---

## 4-BOSQICH — Bing va Yandex (10 daqiqa)

O'zbekistonda Yandex ham muhim.

**Bing:** https://www.bing.com/webmasters → **Import from Google Search
Console** → ruxsat bering. Keyin **Site Move** bo'limida ham domen
ko'chganini ko'rsating.

**Yandex:** https://webmaster.yandex.com → `uyiz.uz` ni qo'shing → DNS TXT
bilan tasdiqlang → **Индексирование → Файлы Sitemap** →
`https://uyiz.uz/sitemap.xml`. Eski sayt ham qo'shilgan bo'lsa,
**Настройки → Переезд сайта** orqali ko'chishni tasdiqlang.

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

> **GA4 allaqachon ishlayotgan bo'lsa:** yangi property **YARATMANG**. Mavjud
> data stream'ning URL manzilini `uyiz.uz` ga o'zgartiring. Yangi property —
> butun tarixni noldan boshlash demak.

ID qo'ymasangiz — hech narsa yuklanmaydi, cookie yozilmaydi.

**GA4 da eng muhim hodisa: `contact_reveal`** — foydalanuvchi e'lon egasining
raqamini ko'rgan payt. Admin → Events → uni **Mark as key event** qiling. Bu
qaysi SEO sahifa faqat kirish beryapti, qaysi biri haqiqiy mijoz beryaptini
ko'rsatadigan yagona raqam.

---

## Qaysi so'rovlar uchun kurashamiz

Eski strategiya **"maklersiz kvartira"** so'rovi ustiga qurilgan edi. Endi u
ishlamaydi va ishlatilmasligi ham kerak: platforma endi makler va agentliklar
bilan ham ishlaydi, ya'ni "maklersiz" — biz bermaydigan va'da. Bunday so'rov
bilan kelgan odam sahifaga kirib, va'da bajarilmaganini ko'rib chiqib ketadi;
Google buni sezadi.

O'rniga — hamisha ostida turgan, ancha kattaroq so'rovlar. Odamlar makler
yo'qligini emas, **yashash uchun joy** qidiradi:

| Daraja | O'zbekcha | Ruscha |
|---|---|---|
| Brend | `uyiz`, `uyiz.uz` | `uyiz` |
| Asosiy | `kvartira ijara`, `uy ijaraga` | `аренда квартир`, `снять квартиру` |
| Hududiy | `ijara Toshkent`, `Toshkentda kvartira ijaraga` | `аренда квартир Ташкент` |
| Uzun (tuman) | `Chilonzorda kvartira ijaraga` | `снять квартиру Чиланзар` |
| Auditoriya | `talabalar uchun ijara`, `arzon ijara` | `аренда для студентов` |

Sahifalar tuzilishi o'zgarmaydi — `SEO.md` §2 dagi sahifalar aynan shu
daraxt uchun qurilgan. O'zgaradigani — sahifadagi matn va biz kutayotgan
brend so'rovi.

**Brend so'rovi haqida ochig'i:** `uyiz` — yangi so'z, Google uchun tarixi
yo'q. Birinchi haftalarda u bo'yicha hech narsa bo'lmaydi. Uni Google'dan
kutish emas, **Telegram va Instagram orqali odamlarga tanitish** kerak.

---

## Keyin nima bo'ladi (realistik)

| Vaqt | Kutilgan natija |
|---|---|
| 1–2 hafta | Sahifalar indeksga tusha boshlaydi |
| 3–6 hafta | Uzun so'rovlar: "Chilonzorda kvartira ijaraga" |
| 2–4 oy | O'rta so'rovlar: "Toshkentda kvartira ijaraga" |
| 4–6 oy+ | Asosiy so'rovlar: "kvartira ijara" |

Bu jadval **e'lonlar soni o'sib borsa** amal qiladi. Kod Google'ga saytni
ko'rsatadi; nimani ko'rsatishni e'lonlar hal qiladi.

**Ochig'ini aytganda: saytda e'lon juda kam.** Bu SEO'ning emas, biznesning
muammosi, va hozir eng katta to'siq aynan shu — kodda emas. 595 sahifa Google
uchun tayyor idish; idish bo'sh bo'lsa Google uni ko'rsatmaydi.

Amaliy chegara:

| E'lon soni | Nima kutish mumkin |
|---|---|
| 1–10 | Faqat brend so'rovi: "uyiz" |
| 20–50 | Uzun so'rovlar: "Chilonzorda kvartira ijaraga" |
| 100–300 | O'rta so'rovlar: "Toshkentda kvartira ijaraga" |
| 500+ | Asosiy so'rovlar bo'yicha kurashish mumkin |

Shuning uchun keyingi oyda eng foydali ish — SEO kodi emas, **e'lon
yig'ish**: Telegram kanallaridan uy egalarini va agentlarni taklif qilish,
birinchi 50 ta e'lonni qo'lda bo'lsa ham kiritish. E'lon joylash bepul va
darhol chop etiladi — kutish ham, tekshiruvdan o'tish ham yo'q, shuning uchun
taklif qilish oson. Har bir yangi tumandagi e'lon o'sha tuman sahifasini
avtomat sitemapga qo'shadi va uni jonlantiradi.

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

Qolganlari — `SEO.md` §9 da.
