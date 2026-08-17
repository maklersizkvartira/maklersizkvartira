import { Request, Response } from 'express';

export const AuthController = {
  register: async (req: Request, res: Response) => {
    const { name, phone, role } = req.body || {};
    if (!name || !phone || !role) {
      return res.status(400).json({ error: 'Ism, telefon va rol kerak' });
    }
    if (role !== 'OWNER' && role !== 'STUDENT') {
      return res.status(400).json({ error: 'Rol egasi yoki talaba bo\'lishi kerak' });
    }
    return res.json({
      status: 'success',
      user: {
        id: `user-${Date.now()}`,
        name,
        phone,
        role,
      },
    });
  },
};
