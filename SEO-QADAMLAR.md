# SEO — siz qiladigan ishlar

Bu hujjat **faqat siz qo'lda qiladigan** ishlar uchun. Kodda nima qilingani va
nima uchun qilingani — `SEO.md` da (inglizcha, texnik).

Tartib muhim: 1-bosqichsiz qolganlarining hech biri ishlamaydi.

---

## Hozirgi holat

Kod tayyor: **334 ta sahifa**, 309 ta sitemap URL, SEO audit **0 xato**.

Lekin **jonli saytda hali eski versiya turibdi.** `seo-ssr` brenchida 3 ta
commit push qilinmagan. Ya'ni Google bu ishning hali bitta baytini ham
ko'rmagan, va reyting bugun o'zgarmaydi.

---

## 1-BOSQICH — Deploy (bugun, ~20 daqiqa)

### 1.1. Qolgan o'zgarishlarni commit qiling

```bash
cd C:/Users/karim/OneDrive/Desktop/maklersiz-uy/maklersizkvartira
git status --short          # 6 ta fayl ko'rinadi
git add -A
git commit -m "feat(seo): analytics, chunk splitting va SEO qo'llanma"
```

### 1.2. Deploydan oldin oxirgi tekshiruv

```bash
npm run build && npm run seo:audit
```

Oxirida **`No errors.`** yozilishi shart. Yozilmasa — deploy qilmang.

### 1.3. Push

```bash
git push origin seo-ssr
```

Keyin GitHub'da `seo-ssr` → `main` ga Pull Request oching va merge qiling.
(Yoki to'g'ridan-to'g'ri: `git checkout main && git merge seo-ssr && git push`.)

### 1.4. Vercel'da 2 ta sozlama

Vercel → loyihangiz → **Settings**:

**a) Environment Variables** bo'limida qo'shing:

| Nomi | Qiymati |
|---|---|
| `VITE_API_URL` | `https://maklersizkvartira-production.up.railway.app/api/v1` |

> Bu **majburiy**. Busiz sitemap bo'sh sahifalarni ham qo'shib yuboradi va API
> ga preconnect ishlamaydi. Qo'shgandan keyin **Redeploy** qiling.

**b) Domains** bo'limida:

- `maklersizuy.uz` ni **Primary** qilib belgilang
- `www.maklersizuy.uz` **Redirect to maklersizuy.uz** bo'lsin

> Ikkalasi ham ochilaversa, Google ularni ikki xil sayt deb biladi va kuchni
> ikkiga bo'ladi.

### 1.5. Railway (backend) — 1 ta o'zgaruvchi

Railway → servis → **Variables**:

| Nomi | Qiymati |
|---|---|
| `SITE_URL` | `https://maklersizuy.uz` |

> Bu e'lonlar sitemapidagi manzillar uchun. Qo'ymasangiz ham default shu, lekin
> domen o'zgarsa shu yerdan o'zgartirasiz.

---

## 2-BOSQICH — Deploy to'g'ri ketganini tekshirish (5 daqiqa)

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
https://maklersizuy.uz/uy-ijaraga
https://maklersizuy.uz/toshkent
https://maklersizuy.uz/toshkent/kvartira-ijaraga
https://maklersizuy.uz/toshkent/chilonzor/kvartira-ijaraga
https://maklersizuy.uz/sheriklikka-ijara
https://maklersizuy.uz/talabalar-uchun-ijara
https://maklersizuy.uz/ru/toshkent/kvartira-ijaraga
```

> Kuniga ~10 tadan cheklov bor. Qolgan 300 ta sahifani qo'lda kiritish
> **shart emas** — Google sitemap va ichki linklar orqali o'zi topadi.

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
ko'rsatadi; nimani ko'rsatishni e'lonlar hal qiladi. 50 ta e'lon bilan
"maklersiz kvartira" so'rovida birinchi o'ringa chiqib bo'lmaydi.

---

## Har oyda qiladigan 3 ta ish

1. **Search Console → Performance** ni oching, qaysi so'rovlar ishlayotganini
   ko'ring. Yaxshi ishlayotgan sahifaga kontent qo'shing.
2. **Oyiga 2 ta maqola** yozing — odamlar haqiqatan so'raydigan savolga:
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
