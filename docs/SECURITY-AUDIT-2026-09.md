# Xavfsizlik auditi — 2026-09-21

Uyiz to'lov tizimi, backend, sayt va admin paneli bo'yicha to'liq audit.
11 ta hujum yo'nalishi bo'yicha parallel tekshiruv, har bir topilma mustaqil
skeptiklar tomonidan qayta tekshirildi (13 ta yuqori daraja 3 ta tekshiruvdan
o'tdi, 74 ta o'rta/past).

Audit faqat **kodni o'qish** orqali qilindi: prod serverga, Click yoki Payme
tizimlariga birorta ham so'rov yuborilmadi, real ma'lumotlarga tegilmadi.
Testlar faqat lokal Docker bazasida ishladi.

---

## Tuzatilgan kamchiliklar

### Pul oqimi

| # | Kamchilik | Fayl | Nima bo'lardi |
|---|-----------|------|----------------|
| 1 | Click to'lovni qaytarsa (reversal), balans qaytarib olinmasdi | `payments.py` | Kartaga pul qaytadi, balansda ham qoladi — ikki marta to'langan |
| 2 | Payme qaytarishida daftardagi summa haqiqiy yechilgan summaga teng emasdi | `payments.py` | `SUM(wallet_transactions)` va `users.balance` doimiy ravishda farq qilardi |
| 3 | Bir vaqtda ikkita galochka xaridi ikkalasi ham o'tardi | `payments.py` | Bitta galochka uchun 40 000 so'm yechilardi |
| 4 | VIP muddati `featured_until` dan hisoblanardi | `payments.py` | 3 haftalik TOP qolgan e'longa 1 haftalik narxda 4 haftalik VIP berilardi |
| 5 | Yangi to'lov Click allaqachon Prepare qilgan to'lovni bekor qilardi | `payments.py` | Karta yechilgandan keyin "tranzaksiya bekor qilingan" javobi |

Har biriga regression test yozildi (`tests/test_payments.py`).

### Hujumga chidamlilik

- Click webhook'iga imzosiz so'rov har safar cheksiz hajmli audit yozuvini
  saqlardi (6 MB × 240/daqiqa) → endi faqat protokol maydonlari, har biri
  512 belgigacha; `sign_string` va karta raqami umuman saqlanmaydi.
- IPv6 limitlari har bir manzil uchun alohida hisoblanardi — bitta /64 blok
  18 kvintillion "yangi" IP beradi, ya'ni `admin_login_ip` (8/15 daq) va
  `bootstrap_admin` (3/soat) amalda cheksiz edi → endi /64 (IPv6) va /24 (IPv4).
- `X-Real-IP` har qanday mijozdan qabul qilinardi → endi faqat ishonchli
  proksi orqali.
- Cheksiz edi, endi limitli: chat xabarlari (120/soat), qo'llab-quvvatlash
  xabarlari (20/soat — har biri OpenAI puli), tasdiqlash so'rovlari (5/soat),
  push obunalari (20/soat), AI sessiyasi va traffic yozuvlari.
- Chat xabari uzunligi cheklanmagandi (6 MB × 200 = suhbat ochilmay qoladi)
  → 4000 belgi.
- Bitta AI javobi 11 ta OpenAI so'rovi davomida baza ulanishini ushlab turardi
  → 90 soniyalik cheklov va bir vaqtda 6 ta javob (pool 30 ta ulanishdan).
- Fon vazifalari (`asyncio.create_task`) havolasiz edi — Python ularni o'rtada
  yig'ishi mumkin → endi cheklangan to'plamda saqlanadi.

### Maxfiy kalitlar

- **Telegram bot tokeni** `config.py` da default qiymat sifatida turgan edi
  (ops kanali id'si bilan birga) → olib tashlandi.
- **Ikkinchi Telegram tokeni** admin panelning 2FA route'ida turgan edi → olib
  tashlandi.
- **2FA cookie'ni muhrlaydigan kalit** kodda literal edi → olib tashlandi.
- **Web-push (VAPID) maxfiy kaliti** `chat.py` da literal edi → `.env` ga
  ko'chirildi.
- CORS `*.vercel.app` ning hammasiga ishonardi (cookie bilan) → faqat o'z
  domenlar; localhost faqat developmentda.
- `/health` muhit nomi va versiyani ochiq qaytarardi → faqat holat.
- Production endi `PAYME_TEST_MODE` / `CLICK_TEST_MODE` yoqilgan bo'lsa
  ishga tushmaydi.

### Ruxsatlar va ma'lumot

- Moderator har qanday karta raqamini **to'liq** ko'rardi → maskalandi.
- Push xabarning havolasi ixtiyoriy sayt bo'lishi mumkin edi → faqat o'z sayt.
- Tasdiqlash (verification) qayta-qayta "APPROVED" qilinsa, har safar
  +15 ishonch ball qo'shardi → bir marta.
- Coin yechish so'rovi REJECTED→APPROVED→REJECTED qilinsa, har safar coin
  qaytarardi (coin "yasash") → bir marta, qulflangan qator bilan.
- ADMIN darajasi SUPERADMIN ning face-login'ini o'chira olardi → endi daraja
  solishtiriladi.
- Chatni bir tomon o'chirsa, ikkinchi tomonning butun yozishmasi ham
  o'chardi → endi faqat o'zidan yashiriladi (migratsiya: `f9a0b1c2d3e4`).
- O'chirilgan yoki tasdiqlanmagan e'longa chat ochish mumkin edi → yopildi.
- Telegram xabarlarida foydalanuvchi ismi HTML sifatida talqin qilinardi →
  escape qilindi.

### Sayt

- **Click'dan orqaga qaytilganda modal "loading" holatida qotib qolardi** —
  bfcache tiklagan holat; modal yopilmas, fon bosilmas, Escape ishlamas edi.
  Endi qaytishda holat tiklanadi, to'lov holati so'raladi (`GET
  /payments/topup/{id}/status`), to'langan bo'lsa balans yangilanadi, aks holda
  "To'lov yakunlanmadi" ogohlantirishi chiqadi.
- "Reklama" sotib olinganda "Ismingiz yangilandi" deb chiqardi; balans
  yetmaganda "xatolik yuz berdi" deyilardi → to'g'ri matnlar.
- Hamyon yangilanganda profil sarlavhasidagi balans eski qolardi.
- `Sheet` ni pastga surib yopganda `onClose` ikki marta chaqirilardi.

---

## Hali qilinishi kerak (siz qilasiz)

1. **Telegram botlarining ikkala tokenini @BotFather orqali bekor qiling** —
   ikkalasi ham ochiq repoda turgan edi. Yangisini Railway'ga
   `TELEGRAM_BOT_TOKEN` + `TELEGRAM_GROUP_ID`, Vercel'ga (admin loyihasi)
   `TELEGRAM_2FA_BOT_TOKEN` qilib qo'ying. **Qo'yilmasa ops xabarlari kelmaydi.**
2. **Vercel admin loyihasida `SECRET_KEY`** o'rnating (2FA cookie kaliti).
3. **VAPID juftligini yangilang** va Railway'ga `VAPID_PUBLIC_KEY` /
   `VAPID_PRIVATE_KEY` qo'ying; ochiq kalitni `src/services/notificationService.ts`
   dagi bilan bir xil qiling. Qo'yilmaguncha push xabarlar yuborilmaydi.
4. **Click/Payme kalitlarini almashtiring** (ilgari ochiq repoda edi).
5. `GOOGLE_CLIENT_IDS` — Google (Firebase emas) orqali kirish kerak bo'lsa.

## Tuzatilmagan, ammo ma'lum (keyingi ish)

- Pasport skanerlari bazada base64 sifatida saqlanadi (R2 ga o'tkazish kerak).
- Rate limiter har bir jarayonda alohida — konteyner 2 ta worker bilan
  ishlaydi, demak limitlar amalda ikki barobar. Redis kerak.
- Admin paneldagi 2FA backend darajasida majburiy emas: parolni bilgan kishi
  to'g'ridan-to'g'ri API orqali token ola oladi. To'liq yechim — 2FA'ni
  backend'ga ko'chirish (alohida ish, kirishdan mahrum bo'lish xavfi bor).
- `click_payment_logs` / `payme_payment_logs` hech qachon tozalanmaydi.
- `/spinner/*` router `main.py` da ulanmagan — frontend chaqiradigan barcha
  endpointlar 404. O'chirish yoki ulash kerak.
