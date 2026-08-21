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
      const { district, rooms, search } = req.query;
      
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

      const { title, description, price, region, district, rooms, area, images } = req.body || {};

      const newListing = await prisma.listing.create({
        data: {
          title: title || 'Yangi kvartira',
          description: description || '',
          price: Number(price) || 4000000,
          rooms: Number(rooms) || 2,
          district: district || 'Chilonzor',
          images: Array.isArray(images) && images.length > 0 ? images : [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200'
          ],
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

