export type ListingScanStatus = 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';

export interface FieldError {
  field: 'Sarlavha' | 'Tavsif' | 'Narx' | 'Telefon' | 'Rasmlar';
  issue: string;
  matchedWord?: string;
  fixSuggestion: string;
}

export interface ListingScanResult {
  allowed: boolean;
  status: 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED' | 'WARNING';
  trustScore: number;
  riskScore: number;
  brokerProbability: number;
  reasons: string[];
  message: string;
  fieldErrors?: { field: string; issue: string; fixSuggestion: string }[];
  apiDown?: boolean;
}

const BROKER_RE = /\b(maklerman|men makler|vositachi|agentlik|rieltor|komissiya 50%|usluga 50%|15% komissiya|vositachilik|bir nechta kvartira|kvartiralarim bor|10 ta kvartira)\b/i;
const SCAM_RE = /\b(kartaga o['’`]tkaz|plastik karta|oldindan to['’`]lov|oldindan pul|zaklad|sms kod|karta parol|telegramga pul|ko['’`]rmasdan to['’`]la)\b/i;
const SAFE_RE = /\b(maklersiz|komissiya yo['’`]q|0%\s*komissiya|egasidan|to['’`]g['’`]ridan[\s-]*to['’`]g['’`]ri|zaklad yo['’`]q|zaklad olinmaydi|oldindan pul shart emas|kartaga pul o['’`]tkazmang|maklerlar bezovta qilmasin|makler emasman)\b/i;

export function scanListingLocal(title: string, description: string, price?: number, rooms?: number): ListingScanResult {
  const text = `${title} ${description}`.trim();
  const reasons: string[] = [];
  const fieldErrors: FieldError[] = [];
  let brokerProbability = 4;
  let riskScore = 6;

  const looksSafe = SAFE_RE.test(text);
  const brokerMatch = text.match(BROKER_RE);
  const scamMatch = text.match(SCAM_RE);

  // Check if scam hit is actually a safe negative statement (e.g. "zaklad yo'q", "oldindan pul shart emas")
  const isNegativeScamContext = /\b(zaklad yo['’`]q|zaklad olinmaydi|oldindan pul (shart emas|yo['’`]q|kerak emas)|kartaga pul o['’`]tkazmang)\b/i.test(text);
  const scamHit = Boolean(scamMatch) && !isNegativeScamContext;

  if (brokerMatch && !looksSafe) {
    const word = brokerMatch[0];
    const isTitle = BROKER_RE.test(title);
    const targetField = isTitle ? 'Sarlavha' : 'Tavsif';
    reasons.push(`📍 ${targetField} maydonida maklerlik so'zi topildi: "${word}"`);
    fieldErrors.push({
      field: targetField,
      issue: `Matningizda maklerlik yoki vositachilik kalit so'zi ("${word}") aniqlandi.`,
      matchedWord: word,
      fixSuggestion: `"${word}" so'zini o'chiring yoki o'rniga "Egasidan to'g'ridan-to'g'ri 0% komissiya" deb yozing.`,
    });
    brokerProbability = 88;
    riskScore = 80;
  }

  if (scamHit && scamMatch) {
    const word = scamMatch[0];
    const isTitle = SCAM_RE.test(title);
    const targetField = isTitle ? 'Sarlavha' : 'Tavsif';
    reasons.push(`📍 ${targetField} maydonida shubhali ibora topildi: "${word}"`);
    fieldErrors.push({
      field: targetField,
      issue: `Oldindan pul o'tkazish yoki zaklad shubhasi ("${word}") bor.`,
      matchedWord: word,
      fixSuggestion: `"${word}" iborasini olib tashlang. Agarda zaklad olinmasa, "Zaklad yo'q, uyni ko'rib keyin to'lanadi" deb aniq yozing.`,
    });
    riskScore = Math.max(riskScore, 90);
    brokerProbability = Math.max(brokerProbability, 70);
  }

  if (typeof price === 'number' && typeof rooms === 'number' && rooms >= 2 && price > 0 && price < 500000) {
    reasons.push(`📍 Narx maydonida eslatma: ${price.toLocaleString('uz-UZ')} so'm (${rooms} xonali uy uchun birmuncha arzon)`);
    fieldErrors.push({
      field: 'Narx',
      issue: `${rooms} xonali kvartira uchun ${price.toLocaleString('uz-UZ')} so'm narx biroz past ko'rinmoqda.`,
      matchedWord: `${price} so'm`,
      fixSuggestion: `Narx to'g'ri kiritilganiga ishonch hosil qiling.`,
    });
    riskScore = Math.max(riskScore, 30);
  }

  if (riskScore >= 70 || brokerProbability >= 70) {
    return {
      allowed: false,
      status: 'REJECTED',
      trustScore: 20,
      riskScore,
      brokerProbability,
      reasons,
      fieldErrors,
      message: "⚠️ AI XAVFSIZLIK TIZIMI: E'loningizda aniq xatolik va taqiqlangan so'zlar aniqlandi. Quyida AI aniqlagan aniq joy va sabablarini ko'rib tuzatishingiz mumkin:",
    };
  }

  return {
    allowed: true,
    status: 'APPROVED',
    trustScore: 94,
    riskScore,
    brokerProbability,
    reasons: reasons.length ? reasons : ["Maklerlik belgisi topilmadi", "Oddiy egasidan e'lon"],
    fieldErrors: [],
    message: "E'lon tekshiruvdan o'tdi. Endi odamlar ko'ra oladi.",
  };
}
