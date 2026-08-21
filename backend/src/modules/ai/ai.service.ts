export interface AIScanResult {
  allowed: boolean;
  trustScore: number;
  riskScore: number;
  brokerProbability: number;
  status: 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED';
  reasons: string[];
  message: string;
  apiDown?: boolean;
}

const BROKER_RE = /\b(maklerman|men makler|vositachi|agentlik|rieltor|komissiya ol|foiz ol|vositachilik|bir nechta kvartira|kvartiralarim bor)\b/i;
const SCAM_RE = /\b(kartaga o['’`]tkaz|plastik karta|oldindan to['’`]lov|oldindan pul|zaklad|sms kod|karta parol|telegramga pul)\b/i;
const SAFE_RE = /\b(maklersiz|komissiya yo['’`]q|0%\s*komissiya|egasidan)\b/i;

export class AIService {
  async scanListing(title: string, description: string, price?: number, rooms?: number, images?: string[]): Promise<AIScanResult> {
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

    let isApiDown = false;

    // Google Lens Image Search using SerpApi
    if (images && images.length > 0 && images[0].startsWith('http') && !images[0].includes('unsplash.com')) {
      try {
        const serpKey = process.env.SERPAPI_KEY || "58d6c5e2e669e083122ff7e97f69cb10deb8bc155549be892aa58cf6045205f9";
        const url = `https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(images[0])}&api_key=${serpKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.error("SerpAPI returned error:", data.error);
          isApiDown = true;
        } else if (data.visual_matches && Array.isArray(data.visual_matches)) {
          const badDomains = ['olx', 'uybor', 'krisha', 'avito', 'domik', 'pinterest', 'shutterstock', 'stock'];
          let foundDomains: string[] = [];
          for (const match of data.visual_matches) {
            const link = match.link ? match.link.toLowerCase() : '';
            for (const domain of badDomains) {
              if (link.includes(domain)) {
                foundDomains.push(domain);
              }
            }
          }
          if (foundDomains.length > 0) {
            const uniqueDomains = [...new Set(foundDomains)];
            reasons.push(`Bu rasm ${uniqueDomains.join(', ')} saytlaridan o'g'irlangan.`);
            riskScore = Math.max(riskScore, 95);
            brokerProbability = Math.max(brokerProbability, 80);
          }
        }
      } catch (err) {
        console.error("SerpAPI error:", err);
        isApiDown = true;
      }
    }

    if (riskScore >= 70 || brokerProbability >= 70) {
      const stolenReason = reasons.find(r => r.includes("o'g'irlangan"));
      const isStolen = !!stolenReason;
      
      return {
        allowed: false,
        trustScore: 20,
        riskScore,
        brokerProbability,
        status: 'REJECTED',
        reasons,
        message: isStolen
          ? `${stolenReason} E'loningiz ko'chirilgan, elonni tahrirlashni yoki ochirishni xohlaysizmi?`
          : "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Joylashtirish taqiqlanadi.",
        apiDown: isApiDown,
      };
    }
    
    return {
      allowed: true,
      trustScore: 94,
      riskScore,
      brokerProbability,
      status: 'APPROVED',
      reasons: reasons.length > 0 ? reasons : ['Maklerlik belgisi topilmadi'],
      message: "E'lon tekshiruvdan o'tdi.",
      apiDown: isApiDown,
    };
  }
}
