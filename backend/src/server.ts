import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('maklersiz.uz') || origin.includes('railway.app') || origin.includes('vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

export let AI_SYSTEM_ACTIVE = true;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos biroz kuting." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour for POST listings
  message: { status: 'error', error: "Kechirasiz, 1 soatda faqat 5 ta e'lon qo'shishingiz mumkin." }
});

// Serve admin frontend statically
app.use(express.static(path.join(__dirname, '..', 'admin-frontend')));

// Helper functions
function matchPhoneBackend(p1?: string | null, p2?: string | null) {
  if (!p1 || !p2) return false;
  const d1 = String(p1).replace(/\D/g, '');
  const d2 = String(p2).replace(/\D/g, '');
  if (!d1 || !d2) return false;
  return d1 === d2 || d1.endsWith(d2) || d2.endsWith(d1);
}

// Gemini AI API Scanner
async function scanListingAIGemini(title: string, description: string, price?: number, rooms?: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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

// Routes

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), aiSystemActive: AI_SYSTEM_ACTIVE });
});

// AUTH
app.post('/api/v1/auth/signup', async (req, res) => {
  const { phone, password, name, role } = req.body;
  try {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return res.status(400).json({ status: 'error', detail: 'Bu raqam band' });
    }
    const newUser = await prisma.user.create({
      data: { phone, name: name || 'Foydalanuvchi', role: role || 'OWNER' }
    });
    res.json({ status: 'success', token: `token_${phone}_${Date.now()}`, user: newUser });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  const { phone } = req.body;
  try {
    let user = await prisma.user.findFirst({
      where: { phone: { endsWith: phone.replace(/\D/g, '').slice(-9) } }
    });
    if (!user) {
      user = await prisma.user.create({
        data: { phone, name: 'Foydalanuvchi', role: 'OWNER' }
      });
    }
    res.json({ status: 'success', token: `token_${user.phone}_${Date.now()}`, user });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/v1/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ status: 'error' });
  const phonePart = token.split('_')[1];
  try {
    const user = await prisma.user.findFirst({
      where: { phone: { endsWith: phonePart.replace(/\D/g, '').slice(-9) } }
    });
    if (!user) return res.status(401).json({ status: 'error' });
    res.json({ status: 'success', user });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/v1/traffic/track', (req, res) => {
  res.json({ status: 'success' });
});

// LISTINGS
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
  delete updates.owner; // prevent relational mess here
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

// Admin endpoints
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
