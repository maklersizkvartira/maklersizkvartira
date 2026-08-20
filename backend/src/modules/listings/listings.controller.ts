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

let LISTINGS_DB: any[] = [];

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

    const aiResult = await aiService.scanListing(title || '', description || '', price, rooms, images);

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
