import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

export const adminRouter = Router();
const prisma = new PrismaClient();

adminRouter.get('/stats', async (req, res) => {
  try {
    const tenantsCount = await prisma.user.count({ where: { role: { not: 'OWNER' } } });
    const usersWithListings = await prisma.user.count({ where: { listings: { some: {} } } });
    const guestsCount = await (prisma as any).aISession.count({ where: { userId: null } });
    const aiQueriesCount = await (prisma as any).aIMessage.count({ where: { role: 'user' } });

    res.json({
      status: 'success',
      data: {
        tenants: tenantsCount,
        owners: usersWithListings,
        guests: guestsCount,
        aiQueries: aiQueriesCount,
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

adminRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { _count: { select: { listings: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedUsers = users.map((u: any) => {
      const isGoogle = u.phone && (u.phone.startsWith('google:') || u.phone.includes('@'));
      const authType = isGoogle ? 'Google' : 'Telefon';
      const phoneDisplay = isGoogle ? u.phone.replace('google:', '') : u.phone;
      return {
        id: u.id,
        name: u.name,
        phone: phoneDisplay,
        authType,
        role: u.role,
        listingsCount: u._count.listings,
        createdAt: u.createdAt,
      };
    });

    res.json({ status: 'success', data: formattedUsers });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});
