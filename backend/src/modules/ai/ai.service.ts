export interface AIScanResult {
  allowed: boolean;
  trustScore: number;
  riskScore: number;
  brokerProbability: number;
  status: 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED';
  reasons: string[];
  message: string;
}

const BROKER_RE = /\b(maklerman|men makler|vositachi|agentlik|rieltor|komissiya ol|foiz ol|vositachilik|bir nechta kvartira|kvartiralarim bor)\b/i;
const SCAM_RE = /\b(kartaga o['’`]tkaz|plastik karta|oldindan to['’`]lov|oldindan pul|zaklad|sms kod|karta parol|telegramga pul)\b/i;
const SAFE_RE = /\b(maklersiz|komissiya yo['’`]q|0%\s*komissiya|egasidan)\b/i;

export class AIService {
  async scanListing(title: string, description: string, price?: number, rooms?: number): Promise<AIScanResult> {
    const text = `${title || ''} ${description || ''}`;
    const reasons: string[] = [];
    let brokerProbability = 4;
    let riskScore = 6;
    const looksSafe = SAFE_RE.test(text);
    if (BROKER_RE.test(text) && !looksSafe) {
      reasons.push("Matnda makler yoki vositachi ekanligi seziladi.");
      brokerProbability = 88;
      riskScore = 80;
    }
    if (SCAM_RE.test(text)) {
      reasons.push("Oldindan kartaga pul o'tkazish yoki firibgarlik belgisi bor.");
      riskScore = Math.max(riskScore, 90);
      brokerProbability = Math.max(brokerProbability, 70);
    }
    if (typeof price === 'number' && typeof rooms === 'number' && rooms >= 2 && price > 0 && price < 1500000) {
      reasons.push("Narx xonalar soniga nisbatan g'ayritabiiy arzon.");
      riskScore = Math.max(riskScore, 75);
    }
    if (riskScore >= 70 || brokerProbability >= 70) {
      return {
        allowed: false,
        trustScore: 20,
        riskScore,
        brokerProbability,
        status: 'REJECTED',
        reasons,
        message: "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Joylashtirish taqiqlanadi.",
      };
    }
    return {
      allowed: true,
      trustScore: 94,
      riskScore,
      brokerProbability,
      status: 'APPROVED',
      reasons: ['Maklerlik belgisi topilmadi'],
      message: "E'lon tekshiruvdan o'tdi.",
    };
  }
}
