export type ListingScanStatus = 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';

export interface ListingScanResult {
  allowed: boolean;
  status: ListingScanStatus;
  trustScore: number;
  riskScore: number;
  brokerProbability: number;
  reasons: string[];
  message: string;
}

const BROKER_RE = /\b(maklerman|men makler|vositachi|agentlik|rieltor|komissiya ol|foiz ol|vositachilik|bir nechta kvartira|kvartiralarim bor|10 ta kvartira)\b/i;
const SCAM_RE = /\b(kartaga o['’`]tkaz|plastik karta|oldindan to['’`]lov|oldindan pul|zaklad|sms kod|karta parol|telegramga pul|ko['’`]rmasdan to['’`]la)\b/i;
const SAFE_RE = /\b(maklersiz|komissiya yo['’`]q|0%\s*komissiya|egasidan|to['’`]g['’`]ridan[\s-]*to['’`]g['’`]ri|zaklad yo['’`]q|zaklad olinmaydi|oldindan pul shart emas|kartaga pul o['’`]tkazmang)\b/i;

export function scanListingLocal(title: string, description: string, price?: number, rooms?: number): ListingScanResult {
  const text = `${title} ${description}`.trim();
  const reasons: string[] = [];
  let brokerProbability = 4;
  let riskScore = 6;

  const looksSafe = SAFE_RE.test(text);
  const brokerHit = BROKER_RE.test(text);

  // Check if scam hit is actually a safe negative statement (e.g. "zaklad yo'q", "oldindan pul shart emas")
  const isNegativeScamContext = /\b(zaklad yo['’`]q|zaklad olinmaydi|oldindan pul (shart emas|yo['’`]q|kerak emas)|kartaga pul o['’`]tkazmang)\b/i.test(text);
  const scamHit = SCAM_RE.test(text) && !isNegativeScamContext;

  if (brokerHit && !looksSafe) {
    reasons.push("Matnda makler yoki vositachi ekanligi seziladi.");
    brokerProbability = 88;
    riskScore = 80;
  }
  if (scamHit) {
    reasons.push("Oldindan kartaga pul o'tkazish yoki firibgarlik belgisi bor.");
    riskScore = Math.max(riskScore, 90);
    brokerProbability = Math.max(brokerProbability, 70);
  }
  if (typeof price === 'number' && typeof rooms === 'number' && rooms >= 2 && price > 0 && price < 1500000) {
    reasons.push("Narx xonalar soniga nisbatan g'ayritabiiy arzon — firibgarlik bo'lishi mumkin.");
    riskScore = Math.max(riskScore, 75);
  }

  if (riskScore >= 70 || brokerProbability >= 70) {
    return {
      allowed: false,
      status: 'REJECTED',
      trustScore: 20,
      riskScore,
      brokerProbability,
      reasons,
      message: "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Maklersiz.uz faqat uyning o'z egasidan e'lon qabul qiladi. E'lon joylashtirilmadi. Agarda xatolik yuz bergan bo'lsa, Telegram orqali admin bilan bog'laning: @MaklersizUy_Support",
    };
  }

  return {
    allowed: true,
    status: 'APPROVED',
    trustScore: 94,
    riskScore,
    brokerProbability,
    reasons: reasons.length ? reasons : ["Maklerlik belgisi topilmadi", "Oddiy egasidan e'lon"],
    message: "E'lon tekshiruvdan o'tdi. Endi odamlar ko'ra oladi.",
  };
}
