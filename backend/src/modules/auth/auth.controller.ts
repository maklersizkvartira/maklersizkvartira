import { Request, Response } from 'express';

export const AuthController = {
  register: async (req: Request, res: Response) => {
    const { name, phone, role, avatar } = req.body || {};
    if (!name || !phone || !role) {
      return res.status(400).json({ error: 'Ism, telefon va rol kerak' });
    }
    if (role !== 'OWNER' && role !== 'STUDENT') {
      return res.status(400).json({ error: 'Rol egasi yoki talaba bo\'lishi kerak' });
    }
    
    const defaultAvatar = role === 'OWNER' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300';

    return res.json({
      status: 'success',
      user: {
        id: `user-${Date.now()}`,
        name,
        phone,
        role,
        avatar: avatar || defaultAvatar,
      },
    });
  },
};
