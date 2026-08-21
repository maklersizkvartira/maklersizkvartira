import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

export const adminRouter = Router();
const prisma = new PrismaClient();

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
adminRouter.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      tenantsCount,
      usersWithListings,
      totalListings,
      approvedListings,
      rejectedListings,
      todayUsers,
      thisWeekUsers,
      guestsCount,
      aiQueriesCount,
      todayAiQueries,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { not: 'OWNER' } } }),
      prisma.user.count({ where: { listings: { some: {} } } }),
      prisma.listing.count(),
      prisma.listing.count({ where: { aiCheckStatus: 'APPROVED' } }),
      prisma.listing.count({ where: { aiCheckStatus: 'REJECTED' } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      (prisma as any).aISession.count({ where: { userId: null } }),
      (prisma as any).aIMessage.count({ where: { role: 'user' } }),
      (prisma as any).aIMessage.count({
        where: { role: 'user', createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } }
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        totalUsers,
        tenants: tenantsCount,
        owners: usersWithListings,
        totalListings,
        approvedListings,
        rejectedListings,
        pendingListings: totalListings - approvedListings - rejectedListings,
        todayNewUsers: todayUsers,
        weekNewUsers: thisWeekUsers,
        guests: guestsCount,
        aiQueries: aiQueriesCount,
        todayAiQueries,
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

// ─── LISTINGS ADMIN LIST ───────────────────────────────────────────────────────
adminRouter.get('/listings', async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      include: { owner: { select: { id: true, name: true, phone: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ status: 'success', data: listings });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

// ─── USERS ADMIN LIST ─────────────────────────────────────────────────────────
adminRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: { select: { listings: true } },
        listings: { select: { id: true, aiCheckStatus: true }, take: 10 },
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedUsers = users.map((u: any) => {
      const isGoogle = u.phone && (u.phone.startsWith('google:') || u.phone.includes('@'));
      const authType = isGoogle ? 'Google' : 'Telefon';
      const phoneDisplay = isGoogle ? u.phone.replace('google:', '') : u.phone;
      const approvedListings = u.listings.filter((l: any) => l.aiCheckStatus === 'APPROVED').length;
      return {
        id: u.id,
        name: u.name,
        phone: phoneDisplay,
        password: u.password || null,
        authType,
        role: u.role,
        listingsCount: u._count.listings,
        approvedListings,
        trustScore: u.trustScore,
        createdAt: u.createdAt,
      };
    });

    res.json({ status: 'success', data: formattedUsers });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

// ─── 7-DAY REGISTRATION CHART ─────────────────────────────────────────────────
adminRouter.get('/chart/registrations', async (req, res) => {
  try {
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lte: end } } });
      days.push({ date: start.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }), count });
    }
    res.json({ status: 'success', data: days });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

// ─── DELETE LISTING ───────────────────────────────────────────────────────────
adminRouter.delete('/listings/:id', async (req, res) => {
  try {
    await prisma.listing.delete({ where: { id: req.params.id } });
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

// ─── UPDATE LISTING STATUS ────────────────────────────────────────────────────
adminRouter.patch('/listings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: { aiCheckStatus: status },
    });
    res.json({ status: 'success', data: listing });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});
