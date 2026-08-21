import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

export const adminRouter = Router();
const prisma = new PrismaClient();

adminRouter.get('/stats', async (req, res) => {
  try {
    const tenantsCount = await prisma.user.count({ where: { role: { not: 'OWNER' } } });
    const ownersCount = await prisma.user.count({ where: { role: 'OWNER' } });
    const guestsCount = await (prisma as any).aISession.count({ where: { userId: null } });
    const aiQueriesCount = await (prisma as any).aIMessage.count({ where: { role: 'user' } });

    res.json({
      status: 'success',
      data: {
        tenants: tenantsCount,
        owners: ownersCount,
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
    
    const formattedUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      listingsCount: u._count.listings,
      createdAt: u.createdAt,
    }));

    res.json({ status: 'success', data: formattedUsers });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});
