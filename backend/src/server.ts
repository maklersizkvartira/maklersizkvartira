import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuthController } from './modules/auth/auth.controller';
import { ListingsController } from './modules/listings/listings.controller';
import { AIService } from './modules/ai/ai.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ai = new AIService();

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'Maklersiz.uz Backend',
    timestamp: new Date().toISOString(),
    aiEngineStatus: 'Active',
  });
});

app.post('/api/v1/auth/register', AuthController.register);
app.get('/api/v1/listings', ListingsController.getAllListings);
app.get('/api/v1/listings/:id', ListingsController.getListingById);
app.post('/api/v1/listings', ListingsController.createListing);

app.post('/api/v1/ai/scan-listing', async (req: Request, res: Response) => {
  const { title, description, price, rooms } = req.body || {};
  const aiAnalysis = await ai.scanListing(title || '', description || '', price, rooms);
  res.status(aiAnalysis.allowed ? 200 : 403).json({
    status: aiAnalysis.allowed ? 'success' : 'rejected',
    aiAnalysis,
  });
});


app.post('/api/v1/ai/write-copy', (req: Request, res: Response) => {
  const { district, region, rooms, area, price, furnished, metro, metroMinutes } = req.body || {};
  const where = district || region || 'Toshkent';
  const furn = furnished ? 'jihozlangan' : 'jihozlanmagan';
  const metroBit = metro ? ` ${metro} metrosiga piyoda taxminan ${metroMinutes || 10} daqiqa.` : '';
  const text = `${where} tumanida joylashgan, ${rooms || 2} xonali${area ? `, ${area} m²` : ''}, ${furn} kvartira ijaraga beriladi.${metroBit} Maklersiz, to'g'ridan-to'g'ri egasidan. Komissiya yo'q.`;
  res.json({ status: 'success', text });
});

app.post('/api/v1/ai/price', (req: Request, res: Response) => {
  const { rooms, district } = req.body || {};
  const per = 2200000;
  const suggested = per * Math.max(1, Number(rooms) || 2);
  res.json({ status: 'success', suggested, low: Math.round(suggested * 0.85), high: Math.round(suggested * 1.15) });
});

app.listen(PORT, () => {
  console.log(`Maklersiz.uz backend: http://localhost:${PORT}`);
});
