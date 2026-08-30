# Uyiz API — Railway'ga deploy qilish

Bu qisqa yo'riqnoma. **O'zgaruvchilarning to'liq ro'yxati va ularning har biri
nima uchun kerakligi — [`RAILWAY_ENV.md`](./RAILWAY_ENV.md) da**, o'sha yerda
Railway'ning Raw Editoriga to'g'ridan-to'g'ri ko'chirib qo'yiladigan blok bor.

> Avvalgi versiyada bu fayl `backend_python/` ni Root Directory qilib
> ko'rsatishni, NIXPACKS'ni, `runtime.txt` ni va `SECRET_KEY` degan
> o'zgaruvchini aytardi. **Ularning hech biri to'g'ri emas edi** — quyidagi
> tartib esa haqiqatan ishlaydigani.

---

## Nima qayerda turadi

| Fayl | Vazifasi |
|---|---|
| `Dockerfile` (**repo ildizida**) | production obrazi. Ichida `backend_python/` ni ko'chiradi, `python -m scripts.preflight`, keyin `alembic upgrade head`, keyin uvicorn ishga tushadi |
| `railway.json` (**repo ildizida**) | `"builder": "DOCKERFILE"`, `"dockerfilePath": "Dockerfile"`, healthcheck `/health` |
| `backend_python/requirements.txt` | Python kutubxonalari |
| `backend_python/alembic/` | migratsiyalar — deploy paytida o'zi bajariladi |

`backend_python/` ichida ham `Dockerfile` va `Procfile` bor, lekin
**ular ishlatilmaydi**: `railway.json` ildizdagi juftlikni ko'rsatadi.

---

## 1. Servislarni yaratish

1. [railway.app](https://railway.app) → **New Project** →
   **Deploy from GitHub repo** → shu repozitoriyani tanlang.
2. **Root Directory ni o'zgartirmang.** U repo ildizi bo'lib qolsin —
   `Dockerfile` o'zi `backend_python/` ni ichiga ko'chiradi.
3. Bazani qo'shing: **New → Database → Add PostgreSQL**.

Endi loyihada ikkita servis bor: **Postgres** va **API**. Ularni adashtirmang —
barcha o'zgaruvchilar **API** servisiga yoziladi, Postgres'ga emas
(sabablari `RAILWAY_ENV.md` ning birinchi bo'limida).

---

## 2. O'zgaruvchilar

API servisi → **Variables** → **Raw Editor** → `RAILWAY_ENV.md` dagi blokni
ko'chiring, `PASTE_...` joylarini to'ldiring, **Deploy**.

Bazani ulashning eng oson yo'li — API servisida
**Variables → Add all from Postgres**. Shunda `DATABASE_URL` ni qo'lda yozish
shart emas, ilova uni `PG*` o'zgaruvchilardan yig'adi.

Ilova production'da quyidagilarsiz **ishga tushmaydi** va logda nima yetishmayotganini
aytadi: `ENVIRONMENT`, `DATABASE_URL`, `JWT_SECRET`, `PASSWORD_REVEAL_KEY`.
Shuningdek `OTP_DEBUG_RETURN_CODE=true` bo'lsa yoki `CORS_ORIGINS` ichida `*`
bo'lsa ham ishga tushmaydi. Bu ataylab shunday: noto'g'ri sozlangan deploy
jimgina emas, ovoz chiqarib to'xtaydi.

**Eng ko'p unutiladigan ikkitasi:**

- `CORS_ORIGINS` — ichida `https://uyiz.uz` va `https://admin.uyiz.uz`
  bo'lsin, **domen ulanishidan oldin**. Moslik aniq, wildcard yo'q.
- `SITE_URL=https://uyiz.uz` — `sitemap-listings.xml` ichidagi barcha manzillar
  shundan yasaladi.

---

## 3. Deploy ketganini tekshirish

Deploy logida ketma-ketlik shunday bo'lishi kerak:

```
preflight: database=... (source: PG* variables)
preflight: sms=on balance=... price=200 remaining=...
alembic upgrade head
Application startup complete
```

Keyin:

```
https://<servis>.up.railway.app/health
https://<servis>.up.railway.app/api/v1/health
```

Kutilgan javob: `{"status":"ok","database":"up","environment":"production"}`.

Birinchi adminni yaratish (Railway servis shell'ida):

```bash
python -m scripts.create_admin --username admin --name "Bosh administrator"
```

Parolni **bir marta** chiqaradi — saqlang va admin panelga kirib o'zgartiring.
Admin panel alohida Vercel loyihasi (`admin.uyiz.uz`); bu servisda hech qanday
UI yo'q, faqat `/api/v1/*`.
