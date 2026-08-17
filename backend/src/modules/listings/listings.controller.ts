import { Request, Response } from 'express';
import { AIService } from '../ai/ai.service';

const aiService = new AIService();

const MOCK_OWNERS: Record<string, any> = {
  owner_jasur: {
    id: 'owner_jasur',
    name: 'Jasur Karimov',
    phone: '+998 90 123 45 67',
    email: 'jasur.k@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    role: 'OWNER',
    trustScore: 96,
    trustLevel: 'PREMIUM_GREEN',
    riskScore: 4,
    brokerRiskScore: 3,
    verificationLevel: 5,
    isVerified: true,
    successfulRentals: 14,
    joinedDate: '2023-04-12',
    badges: ['Verified Owner', 'Property Verified', 'Super Host', 'Diamond Member'],
    xpPoints: 1450,
    xpLevel: 'Diamond',
    referralCode: 'JASUR96',
    referralsCount: 18,
  },
  owner_nodira: {
    id: 'owner_nodira',
    name: 'Nodira Alimova',
    phone: '+998 97 765 43 21',
    email: 'nodira.alimova@mail.ru',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
    role: 'OWNER',
    trustScore: 88,
    trustLevel: 'GREEN',
    riskScore: 8,
    brokerRiskScore: 12,
    verificationLevel: 4,
    isVerified: true,
    successfulRentals: 8,
    joinedDate: '2023-09-01',
    badges: ['Verified Owner', 'Property Verified', 'Gold Member'],
    xpPoints: 820,
    xpLevel: 'Gold',
    referralCode: 'NODIRA88',
    referralsCount: 9,
  },
  owner_bekzod: {
    id: 'owner_bekzod',
    name: 'Bekzod Rahimov',
    phone: '+998 93 555 11 22',
    email: 'bekzod.r@yandex.uz',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
    role: 'OWNER',
    trustScore: 74,
    trustLevel: 'GREEN',
    riskScore: 18,
    brokerRiskScore: 25,
    verificationLevel: 3,
    isVerified: true,
    successfulRentals: 4,
    joinedDate: '2024-01-15',
    badges: ['Verified Owner', 'Silver Member'],
    xpPoints: 460,
    xpLevel: 'Silver',
    referralCode: 'BEKZOD74',
    referralsCount: 4,
  },
};

let LISTINGS_DB: any[] = [
  {
    id: 'listing-1',
    title: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
    description: "Kvartira egasidan to'g'ridan-to'g'ri ijaraga beriladi. Hech qanday makler va komissiya yo'q! Evroremont, barcha mebel va maishiy texnikasi bor. Universitetlar va metroga 3 daqiqalik piyoda yo'l. Talabalar va shaffof ijarachilar uchun juda mos.",
    price: 5500000,
    currency: 'UZS',
    depositPrice: 2000000,
    utilitiesIncluded: true,
    rooms: 2,
    area: 68,
    floor: 4,
    totalFloors: 9,
    propertyType: 'APARTMENT',
    region: 'Toshkent shahri',
    district: 'Mirobod',
    address: 'Oybek ko\'chasi, 24-uy',
    latitude: 41.3005,
    longitude: 69.2740,
    metroStation: 'Oybek',
    metroDistanceMinutes: 3,
    universityName: 'Vestminster Xalqaro Universiteti (WIUT)',
    universityDistanceMinutes: 7,
    furnished: true,
    petsAllowed: false,
    parking: true,
    internet: true,
    airConditioning: true,
    washingMachine: true,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200',
    ],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    hasVirtualTour: true,
    owner: MOCK_OWNERS.owner_jasur,
    trustScore: 96,
    riskScore: 4,
    aiCheckStatus: 'APPROVED',
    aiRiskReasons: ['Barcha rasmlar original', 'Egasining kadastr hujjatlari tasdiqlangan', 'Matnda firibgarlik kalit so\'zlari yo\'q'],
    safetyBadges: ['VERIFIED_OWNER', 'PROPERTY_VERIFIED', 'AI_CHECKED', 'NO_COMMISSION'],
    createdAt: '2026-08-10T09:30:00Z',
    viewsCount: 482,
    favoritesCount: 38,
    contactCount: 19,
    isFeatured: true,
  },
  {
    id: 'listing-2',
    title: 'Yunusobod 19-kvartal TATU va INHA yaqinida 3 xonali oilaviy uy',
    description: "Yunusobod metrosiga va TATU / INHA universitetlariga yaqin hudud. Uydagilar hammasi yangi, Wi-Fi 100Mbps tezlikda. Uy sotilmaydi, faqat uzoq muddatga halol ijarachilarga beriladi. Rasmlar 100% shu kvartiraniki.",
    price: 6200000,
    currency: 'UZS',
    depositPrice: 2500000,
    utilitiesIncluded: false,
    rooms: 3,
    area: 84,
    floor: 2,
    totalFloors: 5,
    propertyType: 'APARTMENT',
    region: 'Toshkent shahri',
    district: 'Yunusobod',
    address: 'Yunusobod 19-kvartal, 12-uy',
    latitude: 41.3650,
    longitude: 69.2920,
    metroStation: 'Yunusobod',
    metroDistanceMinutes: 6,
    universityName: 'Toshkent Axborot Texnologiyalari Universiteti (TATU)',
    universityDistanceMinutes: 8,
    furnished: true,
    petsAllowed: true,
    parking: true,
    internet: true,
    airConditioning: true,
    washingMachine: true,
    images: [
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200',
    ],
    hasVirtualTour: false,
    owner: MOCK_OWNERS.owner_nodira,
    trustScore: 88,
    riskScore: 8,
    aiCheckStatus: 'APPROVED',
    aiRiskReasons: ['Pasport va rasmlar mos tushgan', 'Telefon raqam 2 yildan beri faol'],
    safetyBadges: ['VERIFIED_OWNER', 'PROPERTY_VERIFIED', 'AI_CHECKED', 'STUDENT_FRIENDLY'],
    createdAt: '2026-08-11T14:15:00Z',
    viewsCount: 310,
    favoritesCount: 24,
    contactCount: 11,
    isFeatured: true,
  },
  {
    id: 'listing-3',
    title: 'Chilonzor 5-kvartal Metro Mirzo Ulug\'bek yaqinida shinam Studio',
    description: "Chilonzor metrosiga va TDIU universitetiga juda yaqin jo'ylashgan. Yangi ta'mirdan chiqqan 1 xonali shinam studio. Arzon va qulay narxda to'g'ridan-to'g'ri egasidan. Talabalar uchun ajoyib imkoniyat.",
    price: 3800000,
    currency: 'UZS',
    depositPrice: 1000000,
    utilitiesIncluded: true,
    rooms: 1,
    area: 42,
    floor: 3,
    totalFloors: 4,
    propertyType: 'STUDIO',
    region: 'Toshkent shahri',
    district: 'Chilonzor',
    address: 'Chilonzor 5-kvartal, 8-uy',
    latitude: 41.2850,
    longitude: 69.2150,
    metroStation: 'Mirzo Ulug\'bek',
    metroDistanceMinutes: 4,
    universityName: 'Toshkent Davlat Iqtisodiyot Universiteti (TDIU)',
    universityDistanceMinutes: 5,
    furnished: true,
    petsAllowed: false,
    parking: false,
    internet: true,
    airConditioning: true,
    washingMachine: true,
    images: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80&w=1200',
    ],
    hasVirtualTour: true,
    owner: MOCK_OWNERS.owner_bekzod,
    trustScore: 74,
    riskScore: 18,
    aiCheckStatus: 'APPROVED',
    aiRiskReasons: ['Egasining telefoni tasdiqlangan', 'Shaxsiy selfie bor'],
    safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION', 'STUDENT_FRIENDLY'],
    createdAt: '2026-08-09T11:00:00Z',
    viewsCount: 654,
    favoritesCount: 52,
    contactCount: 28,
  },
  {
    id: 'listing-4',
    title: 'Olmazor tumani NUUz va Turin yaqinida 2 xonali arzon kvartira',
    description: "Universitet shaharchasi (Vuzgorodok) yaqinida joylashgan. Talabalar va yosh oilalar uchun mo'ljallangan. Barcha qulayliklar bor. Metro Beruniy piyoda 7 daqiqa.",
    price: 4200000,
    currency: 'UZS',
    depositPrice: 1500000,
    utilitiesIncluded: true,
    rooms: 2,
    area: 58,
    floor: 5,
    totalFloors: 9,
    propertyType: 'APARTMENT',
    region: 'Toshkent shahri',
    district: 'Olmazor',
    address: 'Universitet ko\'chasi, 15-uy',
    latitude: 41.3490,
    longitude: 69.2080,
    metroStation: 'Beruniy',
    metroDistanceMinutes: 7,
    universityName: 'Oʻzbekiston Milliy Universiteti (NUUz)',
    universityDistanceMinutes: 4,
    furnished: true,
    petsAllowed: false,
    parking: true,
    internet: true,
    airConditioning: false,
    washingMachine: true,
    images: [
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=1200',
    ],
    hasVirtualTour: false,
    owner: MOCK_OWNERS.owner_jasur,
    trustScore: 96,
    riskScore: 4,
    aiCheckStatus: 'APPROVED',
    aiRiskReasons: ['Premium Verified Owner', 'Barcha hujjatlar 100% haqiqiy'],
    safetyBadges: ['VERIFIED_OWNER', 'PROPERTY_VERIFIED', 'AI_CHECKED', 'STUDENT_FRIENDLY'],
    createdAt: '2026-08-08T16:20:00Z',
    viewsCount: 521,
    favoritesCount: 41,
    contactCount: 22,
  }
];

export const ListingsController = {
  // Get all listings with search & filtering
  getAllListings: async (req: Request, res: Response) => {
    const { district, rooms, search } = req.query;
    let result = [...LISTINGS_DB];

    if (district && typeof district === 'string' && district !== 'Barchasi') {
      result = result.filter(l => l.district.toLowerCase() === district.toLowerCase());
    }

    if (rooms) {
      const numRooms = Number(rooms);
      if (!isNaN(numRooms)) {
        result = result.filter(l => l.rooms === numRooms);
      }
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      result = result.filter(l => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
    }

    return res.json({
      status: 'success',
      totalCount: result.length,
      data: result
    });
  },

  // Get single listing by ID
  getListingById: async (req: Request, res: Response) => {
    const { id } = req.params;
    const found = LISTINGS_DB.find(l => l.id === id);
    if (!found) {
      return res.status(404).json({ status: 'error', message: 'E\'lon topilmadi' });
    }
    return res.json({
      status: 'success',
      data: found
    });
  },

  // Create new listing with AI pre-scan
  createListing: async (req: Request, res: Response) => {
    const { title, description, price, region, district, rooms, area, images, owner } = req.body || {};

    const aiResult = await aiService.scanListing(title || '', description || '', price, rooms);

    if (!aiResult.allowed) {
      return res.status(403).json({
        status: 'rejected',
        error: aiResult.message,
        aiAnalysis: aiResult,
      });
    }

    const defaultOwner = {
      id: owner?.id || `owner-${Date.now()}`,
      name: owner?.name || 'Kvartira Egasi',
      phone: owner?.phone || '+998 90 000 00 00',
      avatar: owner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
      role: 'OWNER',
      trustScore: 90,
      trustLevel: 'GREEN',
      riskScore: 5,
      brokerRiskScore: 2,
      verificationLevel: 4,
      isVerified: true,
      successfulRentals: 1,
      joinedDate: new Date().toISOString().split('T')[0],
      badges: ['Verified Owner', 'Property Verified'],
      xpPoints: 500,
      xpLevel: 'Gold',
      referralCode: 'OWNER100',
      referralsCount: 0,
    };

    const newListing = {
      id: `listing-${Date.now()}`,
      title: title || 'Yangi kvartira',
      description: description || '',
      price: Number(price) || 4000000,
      currency: 'UZS',
      depositPrice: 1000000,
      utilitiesIncluded: true,
      rooms: Number(rooms) || 2,
      area: Number(area) || 50,
      floor: 3,
      totalFloors: 9,
      propertyType: 'APARTMENT',
      region: region || 'Toshkent shahri',
      district: district || 'Chilonzor',
      address: `${district || 'Chilonzor'} tumani`,
      images: Array.isArray(images) && images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200'
      ],
      hasVirtualTour: false,
      owner: defaultOwner,
      trustScore: aiResult.trustScore,
      riskScore: aiResult.riskScore,
      aiCheckStatus: aiResult.status,
      aiRiskReasons: aiResult.reasons || ['Egasining telefoni tasdiqlangan'],
      safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION', 'STUDENT_FRIENDLY'],
      createdAt: new Date().toISOString(),
      viewsCount: 1,
      favoritesCount: 0,
      contactCount: 0,
    };

    LISTINGS_DB.unshift(newListing);

    return res.status(201).json({
      status: 'success',
      data: newListing
    });
  }
};
