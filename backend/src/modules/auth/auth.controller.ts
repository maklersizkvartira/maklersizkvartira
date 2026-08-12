import { Request, Response } from 'express';

export const AuthController = {
  // Step 1: Send SMS OTP
  sendOtp: async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    return res.json({
      status: 'success',
      message: `SMS OTP code 1234 sent to ${phone}`,
      otpSessionId: `session_${Date.now()}`
    });
  },

  // Step 2: Verify SMS OTP
  verifyOtp: async (req: Request, res: Response) => {
    const { phone, code } = req.body;
    if (code !== '1234') {
      return res.status(400).json({ error: 'Invalid SMS OTP code' });
    }

    return res.json({
      status: 'success',
      token: 'jwt_token_sample_abc123',
      user: {
        id: 'user_101',
        phone,
        role: 'TENANT',
        trustScore: 30,
        isVerified: false
      }
    });
  },

  // Step 3: Complete Profile
  updateProfile: async (req: Request, res: Response) => {
    const { firstName, lastName, role } = req.body;
    return res.json({
      status: 'success',
      message: 'Profile successfully updated',
      user: {
        id: 'user_101',
        firstName,
        lastName,
        role,
        trustScore: 40,
        xpEarned: 20
      }
    });
  }
};
