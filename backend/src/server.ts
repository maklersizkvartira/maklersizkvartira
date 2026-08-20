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
  '',
  'VAZIFALAR VA QAT\'IY QOIDALAR:',
  '1. O\'ZBEKONA ODOB VA HURMAT: Har doim samimiy va hurmat bilan salom bering ("Assalomu alaykum, [Ism]!" yoki "Assalomu alaykum!"). "Siz" deb murojaat qiling.',
  '2. BEVOSITA VA QISQA JAVOB: Mijoz bergan savoliga avval 1-2 ta aniq, londa va tushunarli jumlada bevosita javob bering. Hech qachon uzundan-uzun matn yozmang va savolni javobsiz qoldirmang!',
  '3. TAVSIYA VA UYLARNI OXIRIDA BERISH: Mijozning savoliga javob berib bo\'lgach, javobingiz ENG OXIRIDA muloyimlik bilan variantlarni taklif qiling (Masalan: "Xohlasangiz, quyidagi mos variantlarni ko\'rib chiqishingiz mumkin:"). Javob boshidayoq e\'lon sotishga o\'tib ketmang!',
  '4. MUKAMMAL IMLO: FAQAT to\'g\'ri o\'zbek grammatikasi va imlosida yozing (masalan: "hoziq" emas, "hozir" deb yozing).',
  '5. ISMNI SO\'RASH: Agar mijoz ismi noma\'lum bo\'lsa, odob bilan ismini so\'rang.',
  '6. XAVFSIZLIK: Uyni ko\'rmasdan turib kartaga oldindan pul o\'tkazmaslikni uqtiring.',
  '',
  'Javobingiz FAQAT quyidagi JSON formatida bo\'lishi shart:',
  '{',
  '  "region": "Toshkent" yoki null,',
  '  "district": "Chilonzor" yoki null,',
  '  "rooms": 2 yoki null,',
  '  "maxPrice": 4000000 yoki null,',
  '  "audience": "STUDENT" yoki "FAMILY" yoki "ALL",',
  '  "rentalType": "FULL" yoki "ROOMMATE" yoki "ALL",',
  '  "userName": "Zayniddin" yoki null,',
  '  "chatSummary": "Chilonzordan 2 va 3 xonali kvartiralar farqi haqida so\'radi",',
  '  "replyText": "Assalomu alaykum, Zayniddin! Agar 1-2 kishi bo\'lsangiz 2 xonali tejamkorroq, agar oilangiz bo\'lsa yoki kengroq joy kerak bo\'lsa 3 xonali ma\'qulroq. Xohlasangiz, siz uchun mos variantlarni quyida ko\'rib chiqishingiz mumkin:"',
  '}',
  '',
  'Qoidalar:',
  '- 3 mln = 3000000. 1 USD = 12700 UZS.',
  '- Faqat toza JSON formatida javob bering.',
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
        const past = await (prisma as any).aIMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
        history = past.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
      } catch (e) { /* ignore */ }
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

    let aiText = parsed.replyText || '';
    if (!aiText) {
      const nameSalute = (parsed.userName || authUser?.name || userName) ? `Assalomu alaykum, ${parsed.userName || authUser?.name || userName}! ` : 'Assalomu alaykum! ';
      if (listings.length > 0) {
        aiText = `${nameSalute}Siz so'ragan bo'lim bo'yicha mos variantlarni topdim. Xohlasangiz, quyidagi kartalar ustiga bosib to'liqroq ma'lumot olishingiz mumkin:`;
      } else {
        aiText = `${nameSalute}Siz so'ragan parametrlar bo'yicha uylar qidirildi. Qidiruv bo'limidan boshqa tumanlarni ham ko'rib chiqishingiz mumkin.`;
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

    res.json({ status: 'success', reply: aiText, need: parsed, listings, sessionKey: key, remaining, limit: DAILY_AI_LIMIT });
  } catch (error) {
    console.error('Shield AI error:', error);
    res.json({ status: 'success', reply: 'Shield AI: Uzr, xatolik yuz berdi. Qidiruv bo\'limidan foydalaning.', debugError: String(error) });
  }
});

// POST /api/v1/smart/assistant/close -- Triggered when user closes/ends AI chat session
app.post('/api/v1/smart/assistant/close', async (req: Request, res: Response) => {
  const { sessionKey, userName, userPhone } = req.body as {
    sessionKey?: string;
    userName?: string | null;
    userPhone?: string | null;
  };
  if (!sessionKey) return res.json({ status: 'success' });

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

  try {
    const session = await (prisma as any).aISession.findUnique({ where: { sessionKey } }).catch(() => null);
    if (!session) return res.json({ status: 'success' });

    const messages = await (prisma as any).aIMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }).catch(() => []);

    const userMsgs = messages.filter((m: any) => m.role === 'user');
    if (userMsgs.length === 0) return res.json({ status: 'success' });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openaiUrl = 'https://api.openai.com/v1/chat/completions';

    const fullTranscript = messages.map((m: any) => `${m.role === 'user' ? 'Mijoz' : 'Shield AI'}: ${m.content}`).join('\n');

    const summaryPrompt = `Quyida mijozning Shield AI yordamchisi bilan bo'lgan to'liq suhbat transkripti berilgan.
Suhbatni tahlil qilib, mijoz nima qidirgani, talablari, byudjeti va erishilgan natija haqida 2-3 jumlalik to'liq XULOSA tayyorlang.

Transkript:
${fullTranscript}

Javobni FAQAT quyidagi JSON formatida bering:
{
  "userName": "Mijoz ismi (agar suhbatda aytilgan bo'lsa)" yoki null,
  "district": "Tuman (masalan Chilonzor)" yoki null,
  "rooms": 2 yoki null,
  "maxPrice": 4000000 yoki null,
  "finalSummary": "Mijoz Chilonzor tumanidan 4 mln so'mgacha 2 xonali kvartira izlamoqda."
}`;

    let parsed: any = {};
    try {
      const aiRes = await fetch(openaiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: summaryPrompt }]
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const rawText = aiData.choices?.[0]?.message?.content || '';
        if (rawText) {
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleanText);
        }
      }
    } catch (e) { console.warn('Close summary generation error:', e); }

    const finalUserName = parsed.userName || authUser?.name || userName || 'Noma\'lum mijoz';
    const finalUserPhone = authUser?.phone || userPhone || (authUser ? 'Ro\'yxatdan o\'tgan' : 'Kiritilmadi');
    const nowTashkent = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const searchDetails: string[] = [];
    if (parsed.district && parsed.district !== 'Barchasi') searchDetails.push(`📍 <b>Tuman:</b> ${parsed.district}`);
    if (parsed.rooms) searchDetails.push(`🏠 <b>Xonalar:</b> ${parsed.rooms} xona`);
    if (parsed.maxPrice) searchDetails.push(`💰 <b>Maks narx:</b> ${Math.round(parsed.maxPrice).toLocaleString('uz-UZ')} so'm`);

    const searchBlock = searchDetails.length > 0 ? searchDetails.join('\n') + '\n\n' : '';

    const tgHtml = `📋 <b>Shield AI — Toliq Suhbat Xulosasi</b> 🛡️

👤 <b>Mijoz:</b> ${finalUserName}
📱 <b>Telefon:</b> ${finalUserPhone}

${searchBlock}📝 <b>Toliq AI Xulosasi:</b>
<i>${parsed.finalSummary || 'Foydalanuvchi Shield AI bilan suhbat o\'tkazdi.'}</i>

📊 <b>Jami xabarlar:</b> ${messages.length} ta
⏰ <i>Yakunlangan vaqt: ${nowTashkent}</i>`;

    await sendTelegramGroupNotification(tgHtml);
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Close assistant error:', err);
    res.json({ status: 'success' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Maklersiz PostgreSQL Backend running on port ${PORT}`);
});
