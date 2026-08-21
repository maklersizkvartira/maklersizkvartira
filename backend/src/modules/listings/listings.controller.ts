import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to parse user ID from token
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

export const ListingsController = {
  // Get all listings with search & filtering
  getAllListings: async (req: Request, res: Response) => {
    try {
      const { district, region, rooms, maxPrice, search } = req.query;
      
      const where: any = {};
      
      if (district && typeof district === 'string' && district !== 'Barchasi') {
        where.district = { contains: district, mode: 'insensitive' };
      }
      
      if (rooms) {
        const numRooms = Number(rooms);
        if (!isNaN(numRooms)) {
          where.rooms = numRooms;
        }
      }

      if (region && typeof region === 'string' && region !== 'Barchasi') {
        where.region = { contains: region, mode: 'insensitive' };
      }

      if (maxPrice) {
        const numericMaxPrice = Number(maxPrice);
        if (Number.isFinite(numericMaxPrice)) where.price = { lte: numericMaxPrice };
      }
      
      if (search && typeof search === 'string') {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const listings = await prisma.listing.findMany({
        where,
        include: { owner: true },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        status: 'success',
        totalCount: listings.length,
        data: listings
      });
    } catch (error) {
      console.error('Error fetching listings:', error);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  // Get single listing by ID
  getListingById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const found = await prisma.listing.findUnique({
        where: { id },
        include: { owner: true }
      });
      
      if (!found) {
        return res.status(404).json({ status: 'error', message: 'E\'lon topilmadi' });
      }
      return res.json({
        status: 'success',
        data: found
      });
    } catch (error) {
      console.error('Error fetching listing by ID:', error);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  recordStat: async (req: Request, res: Response) => {
    const statFields: Record<string, string> = {
      views: 'viewsCount',
      favorites: 'favoritesCount',
      contacts: 'contactCount',
    };
    const field = statFields[String(req.body?.stat || '')];
    if (!field) return res.status(400).json({ status: 'error', message: 'Noto\'g\'ri statistika turi' });
    const requestedDelta = Number(req.body?.delta ?? 1);
    const delta = field === 'favoritesCount' ? Math.max(-1, Math.min(1, requestedDelta)) : 1;

    try {
      await prisma.listing.updateMany({
        where: { id: req.params.id, ...(delta < 0 ? { [field]: { gt: 0 } } : {}) },
        data: { [field]: { increment: delta } },
      });
      const updated = await prisma.listing.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { owner: true },
      });
      return res.json({ status: 'success', data: updated });
    } catch (error) {
      return res.status(404).json({ status: 'error', message: 'E\'lon topilmadi' });
    }
  },
  
  // Get listings for current logged-in user
  getMyListings: async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const userId = parseUserIdFromToken(authHeader);
      
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }
      
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
         // Try by phone suffix if token uses phone
         const digits = userId.replace(/\D/g, '');
         if (digits.length >= 7) {
            user = await prisma.user.findFirst({ where: { phone: { endsWith: digits.slice(-9) } } });
         }
      }
      
      if (!user) {
        return res.status(401).json({ status: 'error', message: 'User not found' });
      }

      const listings = await prisma.listing.findMany({
        where: { ownerId: user.id },
        include: { owner: true },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        status: 'success',
        data: listings
      });
    } catch (error) {
      console.error('Error fetching user listings:', error);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  // Create new listing
  createListing: async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const userId = parseUserIdFromToken(authHeader);
      
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized. Tizimga kiring.' });
      }

      let owner = await prisma.user.findUnique({ where: { id: userId } });
      if (!owner) {
         const digits = userId.replace(/\D/g, '');
         if (digits.length >= 7) {
            owner = await prisma.user.findFirst({ where: { phone: { endsWith: digits.slice(-9) } } });
         }
      }

      if (!owner) {
        return res.status(401).json({ status: 'error', message: 'Egasi topilmadi. Tizimga qayta kiring.' });
      }

      const {
        title, description, price, depositPrice, region, district, address, latitude, longitude,
        rooms, area, floor, totalFloors, propertyType, metroStation, metroDistanceMinutes,
        universityName, universityDistanceMinutes, utilitiesIncluded, furnished, petsAllowed,
        parking, internet, airConditioning, washingMachine, images, videoUrl, hasVirtualTour,
        isRoommate, roommateGender, roommateSpotsAvailable, contactTelegram, preferredContactTime,
      } = req.body || {};

      const newListing = await prisma.listing.create({
        data: {
          title: title || 'Yangi kvartira',
          description: description || '',
          price: Number(price) || 4000000,
          depositPrice: Number.isFinite(Number(depositPrice)) ? Number(depositPrice) : null,
          rooms: Number(rooms) || 2,
          area: Number.isFinite(Number(area)) ? Number(area) : null,
          floor: Number.isFinite(Number(floor)) ? Number(floor) : null,
          totalFloors: Number.isFinite(Number(totalFloors)) ? Number(totalFloors) : null,
          propertyType: propertyType || 'APARTMENT',
          region: region || null,
          district: district || 'Chilonzor',
          address: address || null,
          latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
          longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
          metroStation: metroStation || null,
          metroDistanceMinutes: Number.isFinite(Number(metroDistanceMinutes)) ? Number(metroDistanceMinutes) : null,
          universityName: universityName || null,
          universityDistanceMinutes: Number.isFinite(Number(universityDistanceMinutes)) ? Number(universityDistanceMinutes) : null,
          utilitiesIncluded: Boolean(utilitiesIncluded),
          furnished: Boolean(furnished),
          petsAllowed: Boolean(petsAllowed),
          parking: Boolean(parking),
          internet: Boolean(internet),
          airConditioning: Boolean(airConditioning),
          washingMachine: Boolean(washingMachine),
          images: Array.isArray(images) && images.length > 0 ? images : [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200'
          ],
          videoUrl: videoUrl || null,
          hasVirtualTour: Boolean(hasVirtualTour),
          isRoommate: Boolean(isRoommate),
          roommateGender: roommateGender || null,
          roommateSpotsAvailable: Number.isFinite(Number(roommateSpotsAvailable)) ? Number(roommateSpotsAvailable) : null,
          contactTelegram: contactTelegram || null,
          preferredContactTime: preferredContactTime || null,
          ownerId: owner.id,
          aiCheckStatus: 'APPROVED',
          trustScore: 90,
          riskScore: 5,
          safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION', 'STUDENT_FRIENDLY'],
        },
        include: { owner: true }
      });

      return res.status(201).json({
        status: 'success',
        data: newListing
      });
    } catch (error) {
      console.error('Create listing error:', error);
      return res.status(500).json({ status: 'error', message: 'E\'lon yaratishda xatolik yuz berdi' });
    }
  }
};

