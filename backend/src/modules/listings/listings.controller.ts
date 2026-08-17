import { Request, Response } from 'express';
import { AIService } from '../ai/ai.service';

const aiService = new AIService();

export const ListingsController = {
  // Get all listings with search & filtering
  getAllListings: async (req: Request, res: Response) => {
    const { region, district, rooms, maxPrice, minTrustScore, search } = req.query;

    return res.json({
      status: 'success',
      totalCount: 4,
      data: [
        {
          id: 'listing-1',
          title: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
          description: 'Kvartira egasidan to\'g\'ridan-to\'g\'ri ijaraga beriladi. 0% komissiya!',
          price: 5500000,
          currency: 'UZS',
          rooms: 2,
          area: 68,
          region: 'Toshkent shahri',
          district: 'Mirobod',
          metroStation: 'Oybek',
          trustScore: 96,
          riskScore: 4,
          aiCheckStatus: 'APPROVED',
          owner: {
            name: 'Jasur Karimov',
            phone: '+998 90 123 45 67',
            trustScore: 96,
            isVerified: true
          }
        }
      ]
    });
  },

  // Get single listing by ID
  getListingById: async (req: Request, res: Response) => {
    const { id } = req.params;
    return res.json({
      status: 'success',
      data: {
        id,
        title: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
        price: 5500000,
        currency: 'UZS',
        trustScore: 96,
        riskScore: 4,
        aiCheckStatus: 'APPROVED',
        aiRiskReasons: ['Barcha rasmlar original', 'Kadastr tasdiqlangan']
      }
    });
  },

  // Create new listing with AI pre-scan
  createListing: async (req: Request, res: Response) => {
    const { title, description, price, region, district, rooms, area, images } = req.body;

    const aiResult = await aiService.scanListing(title || '', description || '', price, rooms);

    if (!aiResult.allowed) {
      return res.status(403).json({
        status: 'rejected',
        error: aiResult.message,
        aiAnalysis: aiResult,
      });
    }

    const newListing = {
      id: `listing-${Date.now()}`,
      title,
      description,
      price,
      currency: 'UZS',
      region,
      district,
      rooms,
      area,
      trustScore: aiResult.trustScore,
      riskScore: aiResult.riskScore,
      aiCheckStatus: aiResult.status,
      aiRiskReasons: aiResult.reasons,
      createdAt: new Date().toISOString()
    };

    return res.status(201).json({
      status: 'success',
      data: newListing
    });
  }
};
