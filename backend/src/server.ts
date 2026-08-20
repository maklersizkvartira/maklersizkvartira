import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

export let AI_SYSTEM_ACTIVE = true;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos biroz kuting." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { status: 'error', error: "Kechirasiz, 1 soatda faqat 5 ta e'lon qo'shishingiz mumkin." }
});

// Serve admin frontend statically
app.use(express.static(path.join(__dirname, '..', 'admin-frontend')));

// Helper functions
function parseUserIdFromToken(tokenHeader?: string): string | null {
  if (!tokenHeader) return null;
  const raw = tokenHeader.replace('Bearer ', '').trim();
  if (!raw) return null;
  const parts = raw.split('_');
  if (parts.length >= 2) {
    return parts[1];
  }
  return null;
}

function generateAuthTokens(userId: string) {
  const ts = Date.now();
  const accessToken = `token_${userId}_${ts}`;
  const refreshToken = `refresh_${userId}_${ts}`;
  return { access_token: accessToken, refresh_token: refreshToken, token: accessToken };
}

// Gemini AI API Scanner
async function scanListingAIGemini(title: string, description: string, price?: number, rooms?: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY.trim()}`;
  const prompt = `Siz O'zbekistonning ijaraga uy berish platformasidagi moderator AIsiz. Vazifangiz: quyidagi e'lon matni maklerga tegishlimi yoki yo'qmi shuni aniqlash.
Agar makler bo'lsa (yoki komissiya, xizmat haqi bo'lsa, yoxud rieltorlik tashkiloti bo'lsa), shuningdek OLX kabi boshqa saytlardan ko'chirilganligiga ishora qiluvchi so'zlar bo'lsa (masalan "olx" yoki "ko'chirma"), uni REJECTED (yoki WARNING) deb belgilang.
Oddiy uy egasi bo'lsa APPROVED deb belgilang.

E'lon sarlavhasi: ${title}
E'lon matni: ${description}
Narxi: ${price}
Xonalar: ${rooms}

Javobni JSON formatida qaytaring:
{
  "allowed": true/false,
  "status": "APPROVED"/"WARNING"/"REJECTED",
  "trustScore": 10-100,
  "riskScore": 0-100,
  "reasons": ["sabab 1"]
}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    
    if (!response.ok) throw new Error(`Gemini xatosi: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return {
        allowed: parsed.allowed ?? true,
        status: parsed.status || 'APPROVED',
        trustScore: parsed.trustScore || 90,
        riskScore: parsed.riskScore || 10,
        reasons: parsed.reasons || ["Maklerlik belgisi topilmadi."]
      };
    }
    throw new Error("Bo'sh javob");
  } catch (error) {
    console.error("Gemini AI xatosi:", error);
    throw error;
  }
}

// Fallback AI Scanner
function scanListingAIFallback(title: string, description: string, price?: number) {
  const combined = `${title} ${description}`.toLowerCase();
  const safeWords = ['maklersiz', 'komissiya yo\'q', '0% komissiya', 'egasidan'];
  const isSafe = safeWords.some((w) => combined.includes(w));
  const brokerWords = ['maklerman', 'vositachi', 'agentlik', 'komissiya 50%', 'usluga'];
  const reasons: string[] = [];
  let riskScore = 5;

  const foundBrokerWord = !isSafe && brokerWords.find((w) => combined.includes(w));
  if (foundBrokerWord) {
    reasons.push(`Broker belgisi topildi: "${foundBrokerWord}"`);
    riskScore += 80;
  }
  if (price && price < 100000 && price > 0) {
    reasons.push("Shubhali darajada arzon narx");
    riskScore += 20;
  }
  const allowed = riskScore < 70;
  return {
    allowed,
    trustScore: Math.max(10, 100 - riskScore),
    riskScore,
    status: allowed ? 'APPROVED' : 'REJECTED',
    reasons: reasons.length > 0 ? reasons : ["Maklerlik belgisi topilmadi."]
  };
}

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), aiSystemActive: AI_SYSTEM_ACTIVE });
});

// ─── AUTH & USER MANAGEMENT ──────────────────────────────────────────────────

const handleRegister = async (req: Request, res: Response) => {
  const { phone, password, name, role, avatar } = req.body;
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone) {
    return res.status(400).json({ status: 'error', message: 'Telefon raqam kiritilmadi' });
  }

  try {
    const digits = cleanPhone.replace(/\D/g, '');
    let existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          ...(digits.length >= 7 ? [{ phone: { endsWith: digits.slice(-9) } }] : [])
        ]
      }
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(name ? { name } : {}),
          ...(avatar ? { avatar } : {}),
          ...(role ? { role } : {}),
        }
      });
      const tokens = generateAuthTokens(updated.id);
      return res.json({ status: 'success', ...tokens, user: updated });
    }

    const newUser = await prisma.user.create({
      data: {
        phone: cleanPhone,
        name: name || 'Foydalanuvchi',
        role: role || 'STUDENT',
        avatar: avatar || null,
      }
    });
    const tokens = generateAuthTokens(newUser.id);
    return res.json({ status: 'success', ...tokens, user: newUser });
  } catch (e) {
    console.error("Register error:", e);
    return res.status(500).json({ status: 'error', error: String(e) });
  }
};

app.post('/api/v1/auth/signup', handleRegister);
app.post('/api/v1/auth/register', handleRegister);

app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  const { phone } = req.body;
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone) {
    return res.status(400).json({ status: 'error', message: 'Telefon raqam kiritilmadi' });
  }

  try {
    const digits = cleanPhone.replace(/\D/g, '');
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          ...(digits.length >= 7 ? [{ phone: { endsWith: digits.slice(-9) } }] : [])
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Telefon raqami noto\'g\'ri yoki ro\'yxatdan o\'tmagan' });
    }

    const tokens = generateAuthTokens(user.id);
    return res.json({ status: 'success', ...tokens, user });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.post('/api/v1/auth/google', async (req: Request, res: Response) => {
  const { email, name, avatar, uid } = req.body;
  const identifier = email || (uid ? `google:${uid}` : `google:${Date.now()}`);

  try {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: identifier },
          ...(uid ? [{ phone: { contains: uid } }] : [])
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: identifier,
          name: name || 'Google Foydalanuvchisi',
          avatar: avatar || null,
          role: 'STUDENT',
        }
      });
    } else if (avatar || name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(avatar ? { avatar } : {}),
          ...(name ? { name } : {}),
        }
      });
    }

    const tokens = generateAuthTokens(user.id);
    return res.json({ status: 'success', ...tokens, user });
  } catch (e) {
    console.error("Google auth error:", e);
    return res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.get('/api/v1/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const tokenRaw = authHeader.replace('Bearer ', '').trim();
  if (!tokenRaw) return res.status(401).json({ status: 'error', message: 'Token missing' });

  const userIdOrPhone = parseUserIdFromToken(authHeader);
  try {
    let user = null;
    if (userIdOrPhone) {
      user = await prisma.user.findUnique({ where: { id: userIdOrPhone } }).catch(() => null);
      if (!user) {
        const digits = userIdOrPhone.replace(/\D/g, '');
        if (digits.length >= 7) {
          user = await prisma.user.findFirst({
            where: { phone: { endsWith: digits.slice(-9) } }
          }).catch(() => null);
        }
      }
    }

    if (!user && tokenRaw.includes('_')) {
      const parts = tokenRaw.split('_');
      if (parts[1]) {
        const digits = parts[1].replace(/\D/g, '');
        if (digits.length >= 7) {
          user = await prisma.user.findFirst({
            where: { phone: { endsWith: digits.slice(-9) } }
          }).catch(() => null);
        }
      }
    }

    if (!user) return res.status(401).json({ status: 'error', message: 'User not found' });
    return res.json({ status: 'success', user });
  } catch (e) {
    console.error("Auth /me error:", e);
    return res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.post('/api/v1/auth/profile', async (req: Request, res: Response) => {
  const { phone, avatar, id, name, role } = req.body;
  try {
    let user = null;
    if (id) {
      user = await prisma.user.findUnique({ where: { id } }).catch(() => null);
    }
    if (!user && phone) {
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length >= 7) {
        user = await prisma.user.findFirst({ where: { phone: { endsWith: digits.slice(-9) } } }).catch(() => null);
      }
    }
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(avatar ? { avatar } : {}),
          ...(name ? { name } : {}),
          ...(role ? { role } : {}),
        }
      });
      return res.json({ status: 'success', user });
    }
    return res.status(404).json({ status: 'error', message: 'User not found' });
  } catch (e) {
    return res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.post('/api/v1/auth/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  const userId = parseUserIdFromToken(refresh_token);
  if (!userId) return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ status: 'error', message: 'User not found' });

    const tokens = generateAuthTokens(user.id);
    return res.json({ status: 'success', ...tokens, user });
  } catch (e) {
    return res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.post('/api/v1/auth/logout', (_req: Request, res: Response) => {
  res.json({ status: 'success' });
});

app.post('/api/v1/traffic/track', (_req: Request, res: Response) => {
  res.json({ status: 'success' });
});

// ????????? TELEGRAM BOT NOTIFICATIONS ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8819756746:AAEJaKGx9zT0wQRWkVLZN-BDRGdbs9MjfWY';
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || '-1003935734144';

async function sendTelegramGroupNotification(htmlMessage: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.trim()}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_GROUP_ID.trim(),
        text: htmlMessage,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.warn("Telegram bot error:", err);
  }
}

// -----------------------------------------------------------------
// SHIELD AI -- Multi-turn Conversation Assistant
// -----------------------------------------------------------------

const SHIELD_AI_SYSTEM_PROMPT = [
  'Siz "MaklersizUy.uz" platformasining rasmiy aqlli sun\'iy intellekt yordamchisi -- Shield AI siz.',
  '',
  'Platforma haqida:',
  '- 0% komissiyali, maklersiz kvartira ijara va sherikchilik platformasi.',
  '- Foydalanuvchilar uy egalari bilan bevosita bog\'lanadi. Maklerlar yo\'q.',
  '- Toshkent tumanlari, viloyatlar, Talabalar sherikchilik (Roommate) bo\'limi, Pasport verifikatsiyasi.',
  '',
  'Vazifalaringiz:',
  '1. Samimiy va xushfe\'l o\'zbek tilida javob bering.',
  '2. Agar foydalanuvchining ismi ma\'lum bo\'lmasa, suhbat davomida odob bilan ismini so\'rang (masalan: "Ismingizni bilsam bo\'ladimi?").',
  '3. Agar foydalanuvchining ismi ma\'lum bo\'lsa, unga ismi bilan samimiy murojaat qiling (masalan: "Jasur aka", "Anvarbek", va h.k.).',
  '4. Foydalanuvchi xabaridan qidiruv parametrlarini (viloyat, tuman, xonalar soni, maks narx, auditoriya, ijara turi) hamda ismini ajrating.',
  '5. Xavfsizlik: Hech qachon uyni ko\'rmasdan oldindan kartaga pul o\'tkazmaslikni uqtiring!',
  '6. Suhbat xulosasini (chatSummary) 1-2 jumlada tayyorlang.',
  '',
  'Javobingiz FAQAT quyidagi JSON formatida bo\'lishi shart:',
  '{',
  '  "region": "Toshkent" yoki null,',
  '  "district": "Chilonzor" yoki null,',
  '  "rooms": 2 yoki null,',
  '  "maxPrice": 4000000 yoki null,',
  '  "audience": "STUDENT" yoki "FAMILY" yoki "ALL",',
  '  "rentalType": "FULL" yoki "ROOMMATE" yoki "ALL",',
  '  "userName": "Jasur" yoki null,',
  '  "chatSummary": "Chilonzordan 4 mln so\'mgacha 2 xonali kvartira izlamoqda",',
  '  "replyText": "Jasur aka, Chilonzordan 2 ta ajoyib kvartira topdim!"',
  '}',
  '',
  'Qoidalar:',
  '- 3 mln = 3000000. 1 USD = 12700 UZS.',
  '- Toshkent tumanlari: Chilonzor, Yunusobod, Mirzo Ulug\'bek, Yakkasaroy, Mirobod, Shayxontohur, Olmazor, Sergeli, Uchtepa, Yashnobod, Bektemir.',
  '- Faqat toza JSON. Boshqa matn yoki kod bloki yo\'q.',
].join('\n');

app.post('/api/v1/smart/assistant', async (req: Request, res: Response) => {
  const { message, sessionKey, userName, userPhone } = req.body as {
    message: string;
    sessionKey?: string;
    userName?: string | null;
    userPhone?: string | null;
  };
  if (!message) return res.status(400).json({ error: 'Message is required' });

  // Resolve authenticated user from Bearer token if provided
  const authHeader = req.headers.authorization || '';
  let authUser: any = null;
  const userIdFromToken = parseUserIdFromToken(authHeader);
  if (userIdFromToken) {
    try {
      authUser = await prisma.user.findUnique({ where: { id: userIdFromToken } }).catch(() => null);
      if (!authUser && userIdFromToken.replace(/\D/g, '').length >= 7) {
        const digits = userIdFromToken.replace(/\D/g, '');
        authUser = await prisma.user.findFirst({ where: { phone: { endsWith: digits.slice(-9) } } }).catch(() => null);
      }
    } catch (e) { authUser = null; }
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const openaiUrl = 'https://api.openai.com/v1/chat/completions';
  const DAILY_AI_LIMIT = 10;

  try {
    const key = sessionKey || ('anon-' + Date.now());
    let session: any = null;
    try {
      session = await (prisma as any).aISession.findUnique({ where: { sessionKey: key } });
      if (!session) session = await (prisma as any).aISession.create({ data: { sessionKey: key } });
    } catch (e) { session = null; }

    if (session) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await (prisma as any).aIMessage.count({
          where: { sessionId: session.id, role: 'user', createdAt: { gte: todayStart } },
        });
        if (todayCount >= DAILY_AI_LIMIT) {
          return res.json({
            status: 'limit_reached',
            reply: `Bugungi ${DAILY_AI_LIMIT} ta bepul Shield AI so'rovingiz tugadi. Ertaga yangilanadi! Hozircha Qidiruv sahifasidan bepul foydalanishingiz mumkin.`,
            used: todayCount,
            limit: DAILY_AI_LIMIT,
            remaining: 0,
            sessionKey: key,
          });
        }
      } catch (e) { /* ignore */ }
    }

    let history: { role: string; content: string }[] = [];
    if (session) {
      try {
        const dbMsgs = await (prisma as any).aIMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'desc' },
          take: 12,
        });
        history = dbMsgs.reverse().map((m: any) => ({ role: m.role, content: m.content }));
      } catch (e) { history = []; }
    }

    if (session) {
      try { await (prisma as any).aIMessage.create({ data: { sessionId: session.id, role: 'user', content: message } }); } catch (e) {}
    }

    const effectiveName = authUser?.name || userName || null;
    const userContextStr = effectiveName ? `\n[Tizimdagi mijoz ismi: ${effectiveName}]` : '';

    const openaiMessages = [
      { role: 'system', content: SHIELD_AI_SYSTEM_PROMPT + userContextStr },
      ...history,
      { role: 'user', content: message },
    ];

    // Explicitly use OpenAI gpt-4o-mini model
    const aiRes = await fetch(openaiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY },
      body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: openaiMessages }),
    });
    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      throw new Error('OpenAI xatosi: ' + aiRes.status + ' ' + errText);
    }
    const aiData = await aiRes.json();
    const rawText: string = aiData.choices?.[0]?.message?.content || '';
    if (!rawText) throw new Error('Empty response from OpenAI');
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    const where: any = { aiCheckStatus: 'APPROVED' };
    if (parsed.district) where.district = { contains: parsed.district, mode: 'insensitive' };
    if (parsed.rooms) where.rooms = parseInt(String(parsed.rooms));
    if (parsed.maxPrice) where.price = { lte: parseInt(String(parsed.maxPrice)) };
    const listings = await prisma.listing.findMany({ where, take: 5, orderBy: { createdAt: 'desc' }, include: { owner: true } });

    let aiText = '';
    if (listings.length > 0) {
      const place = parsed.district ? (parsed.district + ' tumanidan') : 'Siz uchun';
      const listStr = listings.map((l: any, i: number) => {
        return (i + 1) + ') ' + l.title + ' -- ' + Math.round(l.price).toLocaleString('uz-UZ') + ' som (' + l.district + ')';
      }).join('\n');
      aiText = (parsed.replyText || (place + ' mos ' + listings.length + ' ta kvartira topdim:')) + '\n\n' + listStr + '\n\nBarcha mos kvartiralarni Qidiruv sahifasidan toliq koring!';
    } else {
      const av = await prisma.listing.findMany({ where: { aiCheckStatus: 'APPROVED' }, select: { district: true }, distinct: ['district'], take: 8 });
      const dists = av.map((l: any) => l.district).filter(Boolean);
      if (dists.length > 0 && parsed.district) {
        aiText = (parsed.replyText || (parsed.district + ' tumanida hozircha elon yoq.')) + '\n\nMavjud tumanlar: ' + dists.join(', ') + '. Qidiruv bolimida korib chiqing!';
      } else {
        aiText = parsed.replyText || 'Kechirasiz, mos kvartira topilmadi. Qidiruv bolimidan boshqacha izlab koring.';
      }
    }

    let remaining = DAILY_AI_LIMIT - 1;
    if (session) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const usedToday = await (prisma as any).aIMessage.count({
          where: { sessionId: session.id, role: 'user', createdAt: { gte: todayStart } },
        });
        remaining = Math.max(0, DAILY_AI_LIMIT - usedToday);
      } catch (e) { /* ignore */ }
    }

    if (session) {
      try { await (prisma as any).aIMessage.create({ data: { sessionId: session.id, role: 'assistant', content: aiText } }); } catch (e) {}
    }

    // ── Send Telegram Notification to Group ───────────────────────────────────
    try {
      const identifiedName = parsed.userName || authUser?.name || userName || 'Noma\'lum mijoz';
      const identifiedPhone = authUser?.phone || userPhone || (authUser ? 'Ro\'yxatdan o\'tgan' : 'Kiritilmadi');
      const nowTashkent = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

      const searchDetails: string[] = [];
      if (parsed.district && parsed.district !== 'Barchasi') searchDetails.push(`📍 <b>Tuman:</b> ${parsed.district}`);
      if (parsed.rooms) searchDetails.push(`🏠 <b>Xonalar:</b> ${parsed.rooms} xona`);
      if (parsed.maxPrice) searchDetails.push(`💰 <b>Maks narx:</b> ${Math.round(parsed.maxPrice).toLocaleString('uz-UZ')} so'm`);

      const searchBlock = searchDetails.length > 0 ? searchDetails.join('\n') + '\n\n' : '';

      const tgHtml = `🤖 <b>Shield AI — Suhbat Xulosasi</b> 🛡️

👤 <b>Mijoz:</b> ${identifiedName}
📱 <b>Telefon:</b> ${identifiedPhone}

${searchBlock}📝 <b>AI Xulosasi:</b>
<i>${parsed.chatSummary || parsed.replyText || 'Suhbat bo\'ldi'}</i>

💬 <b>Mijoz xabari:</b>
"${message}"

⏰ <i>Vaqt: ${nowTashkent}</i>`;

      sendTelegramGroupNotification(tgHtml).catch(() => {});
    } catch (tgErr) {
      console.warn("Failed to dispatch Telegram summary:", tgErr);
    }

    res.json({ status: 'success', reply: aiText, need: parsed, listings, sessionKey: key, remaining, limit: DAILY_AI_LIMIT });
  } catch (error) {
    console.error('Shield AI error:', error);
    res.json({ status: 'success', reply: 'Shield AI: Uzr, xatolik yuz berdi. Qidiruv bolimidan foydalaning.', debugError: String(error) });
  }
});

app.get('/api/v1/smart/assistant/history', async (req: Request, res: Response) => {
  const { sessionKey } = req.query as { sessionKey?: string };
  const DAILY_AI_LIMIT = 10;
  if (!sessionKey) return res.json({ status: 'success', messages: [], remaining: DAILY_AI_LIMIT, limit: DAILY_AI_LIMIT });
  try {
    const session = await (prisma as any).aISession.findUnique({ where: { sessionKey } }).catch(() => null);
    if (!session) return res.json({ status: 'success', messages: [], remaining: DAILY_AI_LIMIT, limit: DAILY_AI_LIMIT });

    const [messages, todayCount] = await Promise.all([
      (prisma as any).aIMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }).catch(() => []),
      (async () => {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        return (prisma as any).aIMessage.count({ where: { sessionId: session.id, role: 'user', createdAt: { gte: todayStart } } }).catch(() => 0);
      })(),
    ]);

    const remaining = Math.max(0, DAILY_AI_LIMIT - todayCount);
    res.json({ status: 'success', messages: messages || [], remaining, limit: DAILY_AI_LIMIT });
  } catch (e) { res.json({ status: 'success', messages: [], remaining: DAILY_AI_LIMIT, limit: DAILY_AI_LIMIT }); }
});

// ─── LISTINGS ────────────────────────────────────────────────────────────────
app.get('/api/v1/listings', async (req, res) => {
  const { district, rooms, search, limit, page } = req.query;
  const take = limit ? parseInt(String(limit)) : 20;
  const skip = page ? (parseInt(String(page)) - 1) * take : 0;
  
  try {
    const where: any = { aiCheckStatus: 'APPROVED' };
    if (district && district !== 'Barchasi') where.district = String(district);
    if (rooms) where.rooms = parseInt(String(rooms));
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    const totalCount = await prisma.listing.count({ where });
    const listings = await prisma.listing.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      include: { owner: true }
    });
    const totalPages = Math.ceil(totalCount / take);
    res.json({ status: 'success', totalCount, totalPages, currentPage: page ? parseInt(String(page)) : 1, data: listings, aiSystemActive: AI_SYSTEM_ACTIVE });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/v1/listings/my', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const phonePart = token.split('_')[1];
  if (!phonePart) return res.json({ status: 'success', data: [] });
  
  try {
    const user = await prisma.user.findFirst({
      where: { phone: { endsWith: phonePart.replace(/\D/g, '').slice(-9) } }
    });
    if (!user) return res.json({ status: 'success', data: [] });
    
    const listings = await prisma.listing.findMany({
      where: { ownerId: user.id },
      include: { owner: true }
    });
    res.json({ status: 'success', data: listings });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/v1/listings/:id', async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: { owner: true }
    });
    if (!listing) return res.status(404).json({ error: "Not found" });
    res.json({ status: 'success', data: listing });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/v1/listings', postLimiter, async (req, res) => {
  const body = req.body || {};
  try {
    const fallbackResult = scanListingAIFallback(body.title || '', body.description || '', body.price);
    if (fallbackResult.riskScore > 90) {
      return res.status(403).json({ status: 'rejected', error: fallbackResult.reasons.join(' | ') });
    }

    let user = null;
    if (body.owner && body.owner.phone) {
      user = await prisma.user.findFirst({ where: { phone: body.owner.phone } });
      if (!user) {
        user = await prisma.user.create({ data: { phone: body.owner.phone, name: body.owner.name || 'Owner' }});
      }
    } else {
      user = await prisma.user.findFirst();
      if (!user) user = await prisma.user.create({ data: { phone: '+998901112233', name: 'Default Owner' }});
    }

    const listing = await prisma.listing.create({
      data: {
        title: body.title,
        description: body.description,
        price: body.price || 0,
        rooms: body.rooms || 1,
        district: body.district || 'Yunusobod',
        images: body.images || [],
        aiCheckStatus: 'UNDER_REVIEW',
        aiRiskReasons: ["AI tekshirmoqda..."],
        ownerId: user.id
      },
      include: { owner: true }
    });

    res.json({ status: 'success', data: listing });

    setTimeout(async () => {
      try {
        let aiResponse;
        if (AI_SYSTEM_ACTIVE) {
           aiResponse = await scanListingAIGemini(listing.title, listing.description, listing.price, listing.rooms);
        } else {
           throw new Error("Force fallback");
        }
        AI_SYSTEM_ACTIVE = true;
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            aiCheckStatus: aiResponse.status,
            trustScore: aiResponse.trustScore,
            riskScore: aiResponse.riskScore,
            aiRiskReasons: aiResponse.reasons,
            safetyBadges: { push: 'AI_CHECKED' }
          }
        });
      } catch (err) {
        AI_SYSTEM_ACTIVE = false;
        const isSimulatedCopied = (listing.description || '').toLowerCase().includes('olx');
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            aiCheckStatus: isSimulatedCopied ? 'WARNING' : fallbackResult.status,
            aiRiskReasons: isSimulatedCopied ? ["Ko'chirma bo'lishi mumkin"] : fallbackResult.reasons,
            trustScore: isSimulatedCopied ? 40 : fallbackResult.trustScore,
            riskScore: isSimulatedCopied ? 60 : fallbackResult.riskScore
          }
        });
      }
    }, 10000);

  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/api/v1/listings/:id', async (req, res) => {
  const updates = req.body || {};
  delete updates.id;
  delete updates.owner;
  try {
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...updates,
        aiCheckStatus: 'UNDER_REVIEW',
        aiRiskReasons: ["Qayta tekshirmoqda..."]
      },
      include: { owner: true }
    });
    res.json({ status: 'success', data: listing });

    setTimeout(async () => {
      try {
        const aiResponse = await scanListingAIGemini(listing.title, listing.description, listing.price, listing.rooms);
        AI_SYSTEM_ACTIVE = true;
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            aiCheckStatus: aiResponse.status,
            trustScore: aiResponse.trustScore,
            riskScore: aiResponse.riskScore,
            aiRiskReasons: aiResponse.reasons
          }
        });
      } catch (err) {
        AI_SYSTEM_ACTIVE = false;
        const fallback = scanListingAIFallback(listing.title, listing.description, listing.price);
        await prisma.listing.update({
          where: { id: listing.id },
          data: { aiCheckStatus: fallback.status, aiRiskReasons: fallback.reasons }
        });
      }
    }, 10000);
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/api/v1/listings/:id', async (req, res) => {
  try {
    await prisma.listing.delete({ where: { id: req.params.id } });
    res.json({ status: 'success' });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/v1/listings/:id/view', async (req, res) => {
  try {
    await prisma.listing.update({
      where: { id: req.params.id },
      data: { viewsCount: { increment: 1 } }
    });
    res.json({ status: 'success' });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/v1/listings/:id/favorite', async (req, res) => {
  try {
    await prisma.listing.update({
      where: { id: req.params.id },
      data: { favoritesCount: { increment: 1 } }
    });
    res.json({ status: 'success' });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────
app.get('/api/v1/admin/stats', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalListings = await prisma.listing.count();
    const approved = await prisma.listing.count({ where: { aiCheckStatus: 'APPROVED' } });
    res.json({ status: 'success', data: { totalUsers, totalListings, approvedListings: approved } });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/v1/admin/listings/:id/approve', async (req, res) => {
  try {
    await prisma.listing.update({ where: { id: req.params.id }, data: { aiCheckStatus: 'APPROVED' } });
    res.json({ status: 'success' });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/v1/admin/listings/:id/reject', async (req, res) => {
  try {
    await prisma.listing.update({ where: { id: req.params.id }, data: { aiCheckStatus: 'REJECTED' } });
    res.json({ status: 'success' });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/v1/admin/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ status: 'success', totalCount: users.length, data: users });
  } catch(e) { res.status(500).json({ error: String(e) }); }
});

// Admin Static Panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin-frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Maklersiz PostgreSQL Backend running on port ${PORT}`);
});
