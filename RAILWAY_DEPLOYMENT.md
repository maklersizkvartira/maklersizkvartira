# Maklersiz.uz Python Backend - Railway Deployment Guide

Ushbu yo'riqnoma Maklersiz.uz loyihasining Python FastAPI backendini **Railway.app** bulutli serveriga joylashtirish (deploy) uchun to'liq qo'llanmadir.

---

## 🛠️ Tayyorlangan Fayllar
Backend katalogida (`backend_python/`) Railway uchun barcha fayllar yaratildi:
- `requirements.txt`: Barcha kerakli Python kutubxonalari (`fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `pydantic`, `passlib`, `python-jose`)
- `Procfile`: Serverni ishga tushirish buyrug'i (`web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- `railway.json`: Railway NIXPACKS build va deploy sozlamalari
- `runtime.txt`: Python muhiti (`python-3.11`)
- `app/core/config.py`: Dynamic PORT va Railway PostgreSQL URL moslashuvchanligi (`postgres://` -> `postgresql+asyncpg://`)

---

## 🚀 Railway.app ga Joylashtirish Bosqichlari

### 1-Usul: GitHub orqali Joylashtirish (Tavsiya etiladi)

1. [Railway.app](https://railway.app) saytiga kiring va loyihangiz xisobiga kiring.
2. **"New Project"** -> **"Deploy from GitHub repo"** tugmasini bosing.
3. Repozitoriyangizni tanlang (`maklersiz-uy` / `maklersizkvartira`).
4. Railway sozlamalarida (`Settings` -> `Root Directory`):
   - **Root Directory**: `backend_python` deb ko'rsating.
5. Railway loyihangizga PostgreSQL bazasini qo'shish uchun:
   - **"New"** -> **"Database"** -> **"Add PostgreSQL"** tugmasini bosing.
   - Railway avtomatik ravishda `DATABASE_URL` o'zgaruvchisini yaratadi.
6. **Variables** bo'limida quyidagi o'zgaruvchilarni kiriting:
   - `SECRET_KEY`: `maklersiz_uz_super_secret_jwt_key_2026_safe_hash_token` (yoki o'zingizning maxfiy kalitingiz)
7. **Deploy** tugmasini bosing. Railway avtomatik backendni yig'ib, sizga HTTPS havola beradi (`https://xxx.up.railway.app`).

---

### 2-Usul: Railway CLI orqali Joylashtirish

1. Termianlda `backend_python` papkasiga kiring:
   ```bash
   cd backend_python
   ```
2. Railway CLI orqali tizimga kiring:
   ```bash
   railway login
   ```
3. Yangi loyiha bering va serverga yuklang:
   ```bash
   railway init
   railway up
   ```

---

## 🔍 Tekshirish (Verification)
Deploy yakunlangach:
- Backend Swagger Hujjatlari: `https://<sizning-railway-app-url>.up.railway.app/docs`
- Health Check Status: `https://<sizning-railway-app-url>.up.railway.app/api/v1/health`
