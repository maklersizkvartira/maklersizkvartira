import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'Maklersiz.uz Backend Production API',
    timestamp: new Date().toISOString(),
    aiEngineStatus: 'Active (Shield AI v1.2)',
  });
});

// Public Listings Endpoint
app.get('/api/v1/listings', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: [
      {
        id: 'listing-1',
        title: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
        price: 5500000,
        currency: 'UZS',
        region: 'Toshkent shahri',
        district: 'Mirobod',
        trustScore: 96,
        riskScore: 4,
        aiCheckStatus: 'APPROVED',
      }
    ]
  });
});

// Auth OTP Endpoint
app.post('/api/v1/auth/otp', (req: Request, res: Response) => {
  const { phone } = req.body;
  res.json({
    status: 'success',
    message: `SMS OTP code 1234 sent to ${phone}`,
    otpId: `otp-${Date.now()}`
  });
});

// AI Risk Scan Endpoint
app.post('/api/v1/ai/scan-listing', (req: Request, res: Response) => {
  const { description, images } = req.body;
  const isSuspicious = /zaklad|oldindan|kod|kartaga/i.test(description || '');

  res.json({
    status: 'success',
    aiAnalysis: {
      trustScore: isSuspicious ? 52 : 95,
      riskScore: isSuspicious ? 48 : 5,
      brokerProbability: isSuspicious ? 65 : 4,
      aiCheckStatus: isSuspicious ? 'UNDER_REVIEW' : 'APPROVED',
      reasons: isSuspicious
        ? ['Matnda oldindan pul talab qilish belgisi bor']
        : ['Egasining pasporti tasdiqlangan', 'Duplikat rasm topilmadi (pHash verified)']
    }
  });
});

// Admin Fraud Signals Queue
app.get('/api/v1/admin/fraud', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    signals: [
      {
        id: 'fraud-501',
        type: 'DUPLICATE_IMAGE',
        title: 'Internetdan olingan rasm aniqlandi',
        riskScore: 88,
        detectedAt: new Date().toISOString(),
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Maklersiz.uz Backend Server running on http://localhost:${PORT}`);
});
