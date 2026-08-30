# SEO — siz qiladigan ishlar

Bu hujjat **faqat siz qo'lda qiladigan** ishlar uchun. Kodda nima qilingani va
nima uchun qilingani — `SEO.md` da (inglizcha, texnik).

Tartib muhim: 0-bosqichsiz qolganlarining hech biri to'liq ishlamaydi.

---

## Hozirgi holat

Kod tayyor: 346 ta prerender qilingan sahifa, SEO audit 0 xato. Lekin **sayt
yangi domenga ko'chyapti** — `maklersizuy.uz` dan `uyiz.uz` ga — shuning uchun
Search Console, Yandex va analitika tarafidagi ishlarning hammasi **qaytadan**
qilinadi. Eski domendagi tasdiqlash yangi domenga o'z-o'zidan o'tmaydi.

Sitemapda hozir e'loni bor tumanlarning sahifalari turadi, hammasi emas —
chunki `VITE_API_URL` qo'yilgani uchun generator **e'loni yo'q tuman
sahifalarini sitemapdan chiqarib tashlayapti**. Bu to'g'ri xatti-harakat:
bo'sh sahifani Google'ga tiqishtirish "Crawled – currently not indexed"
beradi, foyda emas. **E'lon qo'shilgan tuman avtomat sitemapga qo'shiladi** —
qo'lda hech narsa qilish shart emas. Qolgan 300+ sahifa o'chib ketgani yo'q,
hammasi ochiladi va ichki linklar orqali topiladi.

Yangi domen uchun holat:

| Nima | Holat |
|---|---|
| `uyiz.uz` sotib olingan va DNS Vercel'ga qaratilgan | ❌ |
| Vercel'da `uyiz.uz` — Primary Domain, `www` → apex | ❌ |
| `admin.uyiz.uz` — admin panel loyihasiga ulangan | ❌ |
| Railway `CORS_ORIGINS` ichida yangi domenlar | ❌ **domen ulanishidan OLDIN** |
| Railway `SITE_URL=https://uyiz.uz` | ❌ |
| Vercel `VITE_SITE_URL=https://uyiz.uz` | ❌ |
| Yandex kaliti referrer ro'yxatida `uyiz.uz` | ❌ |
| Firebase Authorized Domains'da `uyiz.uz`, `admin.uyiz.uz` | ❌ |
| `maklersizuy.uz` → `uyiz.uz` 301 (yo'lni saqlagan holda) | ❌ |
| Google Search Console — yangi domen tasdiqlangan | ❌ |
| Search Console — Change of Address | ❌ |
| Bing / Yandex Webmaster | ❌ |
| Google Analytics 4 — data stream URL yangilangan | ❌ |

---

## 0-BOSQICH — ⚠️ ENG SHOSHILINCH: domenni to'g'ri ulash

Domen bir marta noto'g'ri ulansa, Google noto'g'ri manzilni o'rganib oladi va
uni keyin tuzatish haftalar oladi. Shuning uchun **Search Console'ga
qo'shishdan oldin** quyidagi tartib bajarilsin.

### 0.1. Avval Railway, keyin domen

Domen ishlashidan **oldin** Railway → API servisi → Variables ichida shular
bo'lsin (to'liq blok `RAILWAY_ENV.md` da):

```env
CORS_ORIGINS=https://uyiz.uz,https://www.uyiz.uz,https://admin.uyiz.uz,https://maklersizuy.uz,https://www.maklersizuy.uz,https://admin.maklersizuy.uz
SITE_URL=https://uyiz.uz
```

Moslik **aniq** — yulduzcha ham, shablon ham ishlamaydi. Agar domen avval
ishlab, `CORS_ORIGINS` keyin yangilansa, sayt ham, admin panel ham ochiladi va
keyin **har bir so'rov** tushunarsiz "network error" bilan yiqiladi, API
logida esa hech qanday xato ko'rinmaydi.

### 0.2. Vercel — sayt loyihasi

**Settings → Domains**:

1. `uyiz.uz` ni qo'shing → **⋯** → **Set as Primary Domain**
2. `www.uyiz.uz` → **Redirect to `uyiz.uz`**
3. `maklersizuy.uz` va `www.maklersizuy.uz` ni **o'chirmang** — ular ham shu
   loyihada qolib, `uyiz.uz` ga **301** qilsin. Muhim: yo'lni saqlagan holda.
   `/toshkent/chilonzor` → `https://uyiz.uz/toshkent/chilonzor` bo'lsin,
   bosh sahifaga emas.

**Kamida 12 oy** eski domen shu holatda tursin. Uni o'chirish — saytning
hozirgacha yiqqan barcha o'rinlari va tashqi linklarini bir zarbada yo'qotish.

**Settings → Environment Variables**: `VITE_SITE_URL=https://uyiz.uz` →
Redeploy.

### 0.3. Vercel — admin loyihasi

`admin.uyiz.uz` ni admin loyihasiga ulang, `NEXT_PUBLIC_API_URL` o'z joyida
qolsin (Railway manzili o'zgarmagan).

### 0.4. Yandex va Firebase

- Yandex konsolida (developer.tech.yandex.ru) kalitning **ruxsat etilgan
  referrerlari** ro'yxatiga `uyiz.uz` ni qo'shing. Bo'lmasa yangi domenda
  xarita ham, "manzilni aniqlash" tugmasi ham ishlamay qoladi.
- Firebase → Authentication → Settings → **Authorized domains**: `uyiz.uz` va
  `admin.uyiz.uz` ni qo'shing. Bo'lmasa Google orqali kirish ishlamaydi.

### 0.5. Tekshirish

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://www.uyiz.uz/
# Kutilgan: 308 -> https://uyiz.uz/

curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://maklersizuy.uz/toshkent/chilonzor
# Kutilgan: 301 -> https://uyiz.uz/toshkent/chilonzor   (bosh sahifa EMAS)

curl -s -o /dev/null -w "%{http_code}\n" https://uyiz.uz/robots.txt
# Kutilgan: 200
```

---

## 1-BOSQICH — Deploy

- Vercel `VITE_API_URL` — qo'yilgan (o'zgarmaydi, Railway manzili eski)
- Vercel `VITE_SITE_URL=https://uyiz.uz` — **yangi, qo'yish shart**
- Railway `SITE_URL=https://uyiz.uz` — **yangi, qo'yish shart**
- Railway `CORS_ORIGINS` — 0.1 dagi qator

`SITE_URL` / `VITE_SITE_URL` unutilsa hech narsa qulamaydi — kod eski domenga
qaytadi va `sitemap.xml` butunlay o'lik manzillarni e'lon qiladi. Build yashil
bo'ladi, ogohlantirish chiqmaydi, Google esa hech narsani qabul qilmaydi.
Shuning uchun bu ro'yxatdagi eng jimgina xato.

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
4. Domen sotib olgan joyingizga (yoki Cloudflare'ga) kiring → **DNS** →
   yangi **TXT** yozuv qo'shing:
   - Name/Host: `@`
   - Value: Google bergan qator
5. 10–30 daqiqa kuting → Search Console'da **Verify**

> **DNS'ga kira olmasangiz:** "Domain" o'rniga **URL prefix** ni tanlab
> `https://uyiz.uz/` deb kiriting, **HTML tag** usulini tanlang, va
> Google bergan `<meta name="google-site-verification" ...>` qatorini
> `index.html` fayliga — **`<!--seo-head-start-->` qatoridan YUQORIGA** —
> joylashtiring. Pastga qo'ysangiz build uni o'chirib yuboradi.

> **Eski domenni ham tasdiqlangan holda qoldiring.** `maklersizuy.uz` property
> o'chirilmasin — 3.5 dagi Change of Address ikkalasi ham tasdiqlangan
> bo'lmasa ishlamaydi.

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
https://uyiz.uz/
https://uyiz.uz/elonlar
https://uyiz.uz/kvartira-ijaraga
https://uyiz.uz/uy-ijaraga
https://uyiz.uz/toshkent
https://uyiz.uz/toshkent/kvartira-ijaraga
https://uyiz.uz/toshkent/uchtepa/kvartira-ijaraga
https://uyiz.uz/talabalar-uchun-ijara
https://uyiz.uz/blog
https://uyiz.uz/ru/toshkent/kvartira-ijaraga
```

> Kuniga ~10 tadan cheklov bor. Qolgan sahifalarni qo'lda kiritish
> **shart emas** — Google sitemap va ichki linklar orqali o'zi topadi.

> **Nega ba'zi tumanlar ro'yxatda yo'q?** Ularda hali e'lon yo'q, shuning uchun
> sitemapga ham kirmagan. Bo'sh sahifani indekslashga berish — Google
> ko'zida saytning sifatini tushiradi. Birinchi e'lon qo'shilishi bilan
> o'sha tuman sitemapga o'zi tushadi.

### 3.4. Google haqiqatan matnni ko'ryaptimi? (eng muhim qadam)

Bitta sahifa uchun tekshiring:

1. URL Inspection'ga `https://uyiz.uz/toshkent/chilonzor/kvartira-ijaraga`
2. **Test live URL** bosing (10–20 soniya)
3. **View tested page** → **Screenshot** yorlig'i

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

Sahifalar tuzilishi o'zgarmaydi — `SEO.md` §2 dagi 346 sahifa aynan shu
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
muammosi, va hozir eng katta to'siq aynan shu — kodda emas. 346 sahifa Google
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
