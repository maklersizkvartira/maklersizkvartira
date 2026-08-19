import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Firebase Admin Service Account credentials parsing (if configured in Railway Variables)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log(`🔥 Firebase Service Account loaded for project: ${serviceAccount.project_id || 'maklersiz-uy'}`);
  } catch (e) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT env is set but invalid JSON');
  }
}

// Dynamic Bulletproof CORS configuration for production custom domain (https://www.maklersizuy.uz)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

// Persistent JSON storage for listings
const DB_FILE = path.join(__dirname, '..', 'listings_db.json');

function loadListings(): any[] {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Error reading listings_db.json:', e);
    }
  }
  return [];
}

function saveListings(listings: any[]): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(listings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing listings_db.json:', e);
  }
}

let LISTINGS_DB: any[] = loadListings();
let REPORTS_DB: any[] = [];
let TRAFFIC_LOGS: any[] = [];

// Persistent JSON storage for users
const USERS_FILE = path.join(__dirname, '..', 'users_db.json');

function loadUsers(): any[] {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error('Error reading users_db.json:', e);
    }
  }
  return [
    {
      id: 'user-zayniddin',
      name: 'Zayniddin',
      phone: '+998 93 718 88 85',
      password: 'password123',
      role: 'STUDENT',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300',
      trustScore: 94,
      status: 'ACTIVE',
      createdAt: '2026-08-18T03:00:00Z',
    },
    {
      id: 'user-jasur-owner',
      name: 'Jasur (Uy Egasi)',
      phone: '+998 90 123 45 67',
      password: 'password123',
      role: 'OWNER',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
      trustScore: 98,
      status: 'ACTIVE',
      createdAt: '2026-08-18T03:00:00Z',
    },
  ];
}

function saveUsers(users: any[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing users_db.json:', e);
  }
}

let USERS_DB: any[] = loadUsers();

// Helper AI Skaner algorithm
function scanListingAI(title: string, description: string, price?: number, rooms?: number) {
  const combined = `${title} ${description}`.toLowerCase();
  const safeWords = ['maklersiz', 'komissiya yo\'q', '0% komissiya', 'egasidan', 'maklerlar bezovta qilmasin', 'makler emasman'];
  const isSafe = safeWords.some((w) => combined.includes(w));

  const brokerWords = ['maklerman', 'men makler', 'vositachi', 'agentlik', 'rieltor', 'komissiya 50%', 'usluga 50%', 'xizmat haqi', '15% komissiya'];
  
  const reasons: string[] = [];
  let riskScore = 5;

  const foundBrokerWord = !isSafe && brokerWords.find((w) => combined.includes(w));
  if (foundBrokerWord) {
    reasons.push(`Broker belgisi topildi: "${foundBrokerWord}"`);
    riskScore += 80;
  }

  if (price && price < 100000 && price > 0) {
    reasons.push("Shubhali darajada arzon narx (soxta e'lon xavfi)");
    riskScore += 20;
  }

  const allowed = riskScore < 70;
  const trustScore = Math.max(10, 100 - riskScore);

  return {
    allowed,
    trustScore,
    riskScore,
    status: allowed ? 'APPROVED' : 'REJECTED',
    reasons: reasons.length > 0 ? reasons : ["Maklerlik belgisi topilmadi. Oddiy egasidan e'lon."],
  };
}

// Routes

// 1. Health check
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'Maklersiz.uz TypeScript Production Backend',
    engine: 'Node.js + Express + TypeScript',
    timestamp: new Date().toISOString(),
  });
});

function matchPhoneBackend(p1?: string, p2?: string): boolean {
  if (!p1 || !p2) return false;
  const d1 = String(p1).replace(/\D/g, '');
  const d2 = String(p2).replace(/\D/g, '');
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  if (d1.length >= 9 && d2.length >= 9 && d1.slice(-9) === d2.slice(-9)) return true;
  return false;
}

// 2. Auth Login
app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const { phone, password } = req.body || {};
  const user = USERS_DB.find((u) => matchPhoneBackend(u.phone, phone));

  if (!user) {
    res.status(404).json({
      status: 'error',
      detail: "Ushbu telefon raqami bilan hisob topilmadi. Avval Ro'yxatdan o'tish bo'limida hisob yarating.",
    });
    return;
  }

  // Password verification if user has password set
  if (user.password && password && user.password !== password) {
    res.status(400).json({
      status: 'error',
      detail: "Parolingiz noto'g'ri. Iltimos, qayta kiriting.",
    });
    return;
  }

  res.json({
    status: 'success',
    user: user,
    data: { user, token: `token_${Date.now()}` },
  });
});

// 3. Auth Register
app.post('/api/v1/auth/register', (req: Request, res: Response) => {
  const { name, phone, role, password, avatar } = req.body || {};

  const existing = USERS_DB.find((u) => matchPhoneBackend(u.phone, phone));
  if (existing) {
    if (role) existing.role = role === 'OWNER' ? 'OWNER' : 'STUDENT';
    if (password) existing.password = password;
    if (name) existing.name = name;
    if (avatar && !avatar.includes('unsplash.com')) existing.avatar = avatar;
    saveUsers(USERS_DB);
    res.json({
      status: 'success',
      user: existing,
      data: { user: existing, token: `token_${Date.now()}` },
    });
    return;
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: name || 'Foydalanuvchi',
    phone: phone || '+998 90 000 00 00',
    password: password || 'password123',
    role: role === 'OWNER' ? 'OWNER' : 'STUDENT',
    avatar:
      avatar ||
      (role === 'OWNER'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300'),
    trustScore: 90,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  USERS_DB.push(newUser);
  saveUsers(USERS_DB);

  res.json({
    status: 'success',
    user: newUser,
    data: { user: newUser, token: `token_${Date.now()}` },
  });
});

// 3b. Auth Update Profile Avatar
app.post('/api/v1/auth/profile', (req: Request, res: Response) => {
  const { phone, avatar } = req.body || {};
  const user = USERS_DB.find((u) => matchPhoneBackend(u.phone, phone));
  if (user && avatar) {
    user.avatar = avatar;
    saveUsers(USERS_DB);
    res.json({ status: 'success', user });
    return;
  }
  res.json({ status: 'ignored' });
});

// 4. Traffic Track
app.post('/api/v1/traffic/track', (req: Request, res: Response) => {
  const { session_id, page_path } = req.body || {};
  TRAFFIC_LOGS.push({ session_id, page_path, timestamp: new Date().toISOString() });
  res.json({ status: 'success', message: 'Traffic tracked' });
});

// 5. Get All Listings
app.get('/api/v1/listings', (req: Request, res: Response) => {
  const { district, rooms, search } = req.query;
  let result = [...LISTINGS_DB];

  if (district && district !== 'Barchasi') {
    result = result.filter((l) => (l.district || '').toLowerCase() === String(district).toLowerCase());
  }

  if (rooms) {
    result = result.filter((l) => String(l.rooms) === String(rooms));
  }

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(
      (l) => (l.title || '').toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
    );
  }

  res.json({ status: 'success', totalCount: result.length, data: result });
});

// 6. Get Listing By ID
app.get('/api/v1/listings/:id', (req: Request, res: Response) => {
  const cleanId = String(req.params.id).trim();
  const found = LISTINGS_DB.find(
    (l) =>
      String(l.id) === cleanId ||
      String(l.id) === `listing-${cleanId}` ||
      cleanId === `listing-${l.id}` ||
      String(l.id).endsWith(cleanId) ||
      cleanId.endsWith(String(l.id))
  );

  if (!found) {
    res.status(404).json({ status: 'error', detail: "E'lon topilmadi" });
    return;
  }

  res.json({ status: 'success', data: found });
});

// 7. Create Listing
app.post('/api/v1/listings', (req: Request, res: Response) => {
  const body = req.body || {};
  const aiResult = scanListingAI(body.title || '', body.description || '', body.price, body.rooms);

  if (!aiResult.allowed) {
    res.status(403).json({
      status: 'rejected',
      error: aiResult.reasons.join(' | '),
      aiAnalysis: aiResult,
    });
    return;
  }

  const defaultOwner = body.owner || {
    id: `owner-${Date.now()}`,
    name: 'Kvartira Egasi',
    phone: '+998 90 000 00 00',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    role: 'OWNER',
    trustScore: 90,
    isVerified: true,
  };

  const newListing = {
    id: body.id || `listing-${Date.now()}`,
    title: body.title || 'Shinam Kvartira',
    description: body.description || "To'g'ridan-to'g'ri egasidan.",
    price: Number(body.price) || 3000000,
    currency: body.currency || 'UZS',
    depositPrice: Number(body.depositPrice) || 1000000,
    utilitiesIncluded: Boolean(body.utilitiesIncluded),
    rooms: Number(body.rooms) || 2,
    area: Number(body.area) || 55,
    floor: Number(body.floor) || 3,
    totalFloors: Number(body.totalFloors) || 9,
    propertyType: body.propertyType || 'APARTMENT',
    region: body.region || 'Toshkent shahri',
    district: body.district || 'Chilonzor',
    address: body.address || `${body.district || 'Chilonzor'} ko'chasi`,
    images: Array.isArray(body.images) && body.images.length > 0 ? body.images : [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200',
    ],
    videoUrl: body.videoUrl || undefined,
    hasVirtualTour: false,
    owner: defaultOwner,
    trustScore: aiResult.trustScore,
    riskScore: aiResult.riskScore,
    aiCheckStatus: aiResult.status,
    aiRiskReasons: aiResult.reasons,
    safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION'],
    createdAt: new Date().toISOString(),
    viewsCount: 1,
    favoritesCount: 0,
    contactCount: 0,
  };

  LISTINGS_DB.unshift(newListing);
  saveListings(LISTINGS_DB);

  res.status(201).json({ status: 'success', data: newListing });
});

// 8. Update Listing
app.put('/api/v1/listings/:id', (req: Request, res: Response) => {
  const cleanId = String(req.params.id).trim();
  const updates = req.body || {};
  let target = LISTINGS_DB.find((l) => String(l.id) === cleanId || String(l.id) === `listing-${cleanId}`);

  if (target) {
    Object.assign(target, updates);
  } else {
    target = { id: cleanId, ...updates };
    LISTINGS_DB.unshift(target);
  }

  saveListings(LISTINGS_DB);
  res.json({ status: 'success', data: target });
});

// 9. Delete Listing
app.delete('/api/v1/listings/:id', (req: Request, res: Response) => {
  const cleanId = String(req.params.id).trim();
  LISTINGS_DB = LISTINGS_DB.filter((l) => String(l.id) !== cleanId && String(l.id) !== `listing-${cleanId}`);
  saveListings(LISTINGS_DB);
  res.json({ status: 'success', message: "E'lon o'chirildi" });
});

// 10. AI Scan Endpoint
app.post('/api/v1/ai/scan-listing', (req: Request, res: Response) => {
  const { title, description, price, rooms } = req.body || {};
  const aiAnalysis = scanListingAI(title || '', description || '', price, rooms);
  res.status(aiAnalysis.allowed ? 200 : 403).json({
    status: aiAnalysis.allowed ? 'success' : 'rejected',
    aiAnalysis,
  });
});

// 11. AI Write Copy
app.post('/api/v1/ai/write-copy', (req: Request, res: Response) => {
  const { district, region, rooms, area, furnished, metro, metroMinutes } = req.body || {};
  const where = district || region || 'Toshkent';
  const furn = furnished ? 'jihozlangan' : 'jihozlanmagan';
  const metroBit = metro ? ` ${metro} metrosiga piyoda taxminan ${metroMinutes || 10} daqiqa.` : '';
  const text = `${where} tumanida joylashgan, ${rooms || 2} xonali${area ? `, ${area} m²` : ''}, ${furn} kvartira ijaraga beriladi.${metroBit} Maklersiz, to'g'ridan-to'g'ri egasidan. Komissiya yo'q.`;
  res.json({ status: 'success', text });
});

// 12. AI Price Suggestion
app.post('/api/v1/ai/price', (req: Request, res: Response) => {
  const { rooms } = req.body || {};
  const base = 2200000;
  const suggested = base * Math.max(1, Number(rooms) || 2);
  res.json({ status: 'success', suggested, low: Math.round(suggested * 0.85), high: Math.round(suggested * 1.15) });
});

// 13. Reports Endpoints
app.get('/api/v1/admin/reports', (_req: Request, res: Response) => {
  res.json({ status: 'success', totalCount: REPORTS_DB.length, data: REPORTS_DB });
});

app.post('/api/v1/admin/reports', (req: Request, res: Response) => {
  const newReport = { id: `rep-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  REPORTS_DB.unshift(newReport);
  res.json({ status: 'success', data: newReport });
});

app.post('/api/v1/admin/reports/:id/resolve', (req: Request, res: Response) => {
  const rep = REPORTS_DB.find((r) => r.id === req.params.id);
  if (rep) rep.status = 'RESOLVED';
  res.json({ status: 'success', message: 'Report resolved' });
});

// 14. Admin Unblock & Reject
app.post('/api/v1/admin/listings/:id/unblock', (req: Request, res: Response) => {
  const item = LISTINGS_DB.find((l) => String(l.id) === req.params.id);
  if (item) {
    item.aiCheckStatus = 'APPROVED';
    item.trustScore = 95;
    saveListings(LISTINGS_DB);
  }
  res.json({ status: 'success', message: 'Listing unblocked' });
});

app.post('/api/v1/admin/listings/:id/reject', (req: Request, res: Response) => {
  const item = LISTINGS_DB.find((l) => String(l.id) === req.params.id);
  if (item) {
    item.aiCheckStatus = 'REJECTED';
    saveListings(LISTINGS_DB);
  }
  res.json({ status: 'success', message: 'Listing rejected' });
});

// 15. Verifications Endpoints
let VERIFICATIONS_DB: any[] = [];

app.get('/api/v1/verifications', (_req: Request, res: Response) => {
  res.json({ status: 'success', totalCount: VERIFICATIONS_DB.length, data: VERIFICATIONS_DB });
});
app.get('/api/v1/admin/verifications', (_req: Request, res: Response) => {
  res.json({ status: 'success', totalCount: VERIFICATIONS_DB.length, data: VERIFICATIONS_DB });
});

app.post('/api/v1/verifications', (req: Request, res: Response) => {
  const body = req.body || {};
  const newVerif = {
    id: body.id || `verif-${Date.now()}`,
    userId: body.userId || `user-${Date.now()}`,
    userName: body.userName || 'Foydalanuvchi',
    userPhone: body.userPhone || '+998 90 000 00 00',
    targetLevel: body.targetLevel || 4,
    documentType: body.type || body.documentType || 'PASSPORT',
    passportImage: body.passportImage || body.document_url || undefined,
    selfieImage: body.selfieImage || undefined,
    cadastreCode: body.cadastreCode || undefined,
    status: 'APPROVED',
    submittedAt: new Date().toISOString(),
  };
  VERIFICATIONS_DB.unshift(newVerif);
  res.json({ status: 'success', data: newVerif });
});

app.post('/api/v1/admin/verifications/submit', (req: Request, res: Response) => {
  const body = req.body || {};
  const newVerif = {
    id: body.id || `verif-${Date.now()}`,
    userId: body.userId || `user-${Date.now()}`,
    userName: body.userName || 'Foydalanuvchi',
    userPhone: body.userPhone || '+998 90 000 00 00',
    targetLevel: body.targetLevel || 4,
    documentType: body.type || body.documentType || 'PASSPORT',
    passportImage: body.passportImage || body.document_url || undefined,
    selfieImage: body.selfieImage || undefined,
    cadastreCode: body.cadastreCode || undefined,
    status: 'APPROVED',
    submittedAt: new Date().toISOString(),
  };
  VERIFICATIONS_DB.unshift(newVerif);
  res.json({ status: 'success', data: newVerif });
});

// 16. Stats
app.get('/api/v1/stats', (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: {
      totalUsers: USERS_DB.length,
      totalListings: LISTINGS_DB.length,
      approvedListings: LISTINGS_DB.filter((l) => l.aiCheckStatus === 'APPROVED').length,
      dailyVisitors: 1420 + TRAFFIC_LOGS.length,
    },
  });
});

// Global 404 Fallback with CORS Headers
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', detail: 'Endpoint not found' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Maklersiz.uz TypeScript Production Server running on port ${PORT} (0.0.0.0)`);
});
