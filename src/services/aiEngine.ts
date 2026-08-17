import { Listing } from '../types';
import { ListingScanResult, scanListingLocal } from './aiGuard';

export type Audience = 'ALL' | 'STUDENT' | 'FAMILY';

export interface SearchNeed {
  region?: string;
  district?: string;
  maxPrice?: number;
  minPrice?: number;
  rooms?: number | null;
  audience?: Audience;
  metro?: string;
  nearMetro?: boolean;
  query?: string;
}

export interface RankedListing {
  listing: Listing;
  score: number;
  why: string[];
}

const DISTRICT_BASE: Record<string, number> = {
  Mirobod: 2800000,
  Yunusobod: 2400000,
  Chilonzor: 2100000,
  Yakkasaroy: 2600000,
  Shayxontohur: 2300000,
  Olmazor: 2000000,
  Uchtepa: 1900000,
  Yashnobod: 2000000,
  Bektemir: 1700000,
  Sergeli: 1800000,
};

export function estimatePrice(input: {
  region: string;
  district: string;
  rooms: number;
  area?: number;
  furnished?: boolean;
}): { suggested: number; low: number; high: number; explanation: string } {
  const perRoom = DISTRICT_BASE[input.district] || (input.region.includes('Toshkent') ? 2200000 : 1400000);
  let suggested = perRoom * Math.max(1, input.rooms);
  if (input.area && input.area > 0) {
    suggested = Math.round(suggested * (input.area / 55));
  }
  if (input.furnished) suggested = Math.round(suggested * 1.12);
  const low = Math.round(suggested * 0.85);
  const high = Math.round(suggested * 1.15);
  return {
    suggested,
    low,
    high,
    explanation: `${input.district || input.region} hududidagi ${input.rooms} xonali uylar asosida. Bu taxmin, majburiy emas.`,
  };
}

export function writeListingCopy(input: {
  district: string;
  region: string;
  rooms: number;
  area?: number;
  price?: number;
  furnished?: boolean;
  metro?: string;
  metroMinutes?: number;
  audience?: Audience;
}): string {
  const where = input.district || input.region;
  const size = input.area ? `, ${input.area} m²` : '';
  const furn = input.furnished ? 'jihozlangan' : 'jihozlanmagan';
  const metro = input.metro && input.metro !== "Yo'q"
    ? ` ${input.metro} metrosiga piyoda taxminan ${input.metroMinutes || 10} daqiqa.`
    : '';
  const who = input.audience === 'STUDENT'
    ? ' Talabalar uchun qulay.'
    : input.audience === 'FAMILY'
    ? ' Oila bilan yashash uchun mos.'
    : '';
  const price = input.price ? ` Oylik ijara: ${formatSom(input.price)}.` : '';
  return `${where} tumanida joylashgan, ${input.rooms} xonali${size}, ${furn} kvartira ijaraga beriladi.${metro}${who}${price} Maklersiz, to'g'ridan-to'g'ri egasidan. Komissiya yo'q.`;
}

export function analyzePhotos(listingLike: {
  rooms: number;
  furnished: boolean;
  images: string[];
  washingMachine?: boolean;
  airConditioning?: boolean;
}): {
  roomsFound: string[];
  condition: string;
  furnishedText: string;
  note: string;
} {
  const roomsFound = ['Mehmonxona'];
  if (listingLike.rooms >= 2) roomsFound.push('Yotoqxona');
  if (listingLike.rooms >= 1) roomsFound.push('Oshxona', 'Hojatxona');
  if (listingLike.images.length >= 4) roomsFound.push('Balkon');
  const condition = listingLike.airConditioning && listingLike.washingMachine
    ? "Yaxshi holat: asosiy jihozlar bor."
    : "Oddiy holat: rasmlardan qo'shimcha ta'mir darajasini keyin aniqlash mumkin.";
  return {
    roomsFound: Array.from(new Set(roomsFound)),
    condition,
    furnishedText: listingLike.furnished ? 'Jihozlangan' : 'Jihozlanmagan',
    note: "Hozircha xona turlari e'lon ma'lumotidan chiqariladi. Foto-AI (oshxona/yotoqxona aniq tanish) uchun OpenAI yoki Gemini kaliti kerak.",
  };
}

export function rankListings(listings: Listing[], need: SearchNeed): RankedListing[] {
  const ranked = listings.map((listing) => {
    let score = listing.trustScore * 0.35;
    const why: string[] = [];

    if (need.region && need.region !== 'Barchasi' && listing.region === need.region) {
      score += 18;
      why.push('Viloyat mos');
    }
    if (need.district && need.district !== 'Barchasi' && listing.district === need.district) {
      score += 24;
      why.push('Tuman mos');
    }
    if (need.rooms) {
      if (listing.rooms === need.rooms) {
        score += 20;
        why.push(`${need.rooms} xona`);
      } else if (Math.abs(listing.rooms - need.rooms) === 1) {
        score += 8;
      }
    }
    if (need.maxPrice && listing.price <= need.maxPrice) {
      score += 12;
      const closeness = 1 - listing.price / need.maxPrice;
      score += closeness * 8;
    }
    if (need.minPrice && listing.price < need.minPrice) score -= 20;
    if (need.metro && need.metro !== 'Barchasi' && listing.metroStation === need.metro) {
      score += 16;
      why.push('Metro mos');
    }
    if (need.nearMetro && listing.metroDistanceMinutes && listing.metroDistanceMinutes <= 10) {
      score += 10;
      why.push('Metroga yaqin');
    }
    if (need.audience === 'STUDENT') {
      if (listing.universityName || listing.safetyBadges.includes('STUDENT_FRIENDLY')) {
        score += 14;
        why.push('Talabaga qulay');
      }
      if (listing.rooms <= 2) score += 6;
    }
    if (need.audience === 'FAMILY') {
      if (listing.rooms >= 2) {
        score += 12;
        why.push('Oila uchun joy');
      }
      if (listing.petsAllowed) score += 4;
    }
    if (listing.aiCheckStatus === 'APPROVED') score += 8;
    if (listing.owner.isVerified) score += 6;
    score -= listing.riskScore * 0.2;

    if (need.query && need.query.trim()) {
      const q = need.query.toLowerCase();
      const blob = `${listing.title} ${listing.description} ${listing.district} ${listing.metroStation || ''}`.toLowerCase();
      if (blob.includes(q)) {
        score += 10;
        why.push('Qidiruvga mos');
      }
    }

    if (!why.length) why.push('Umumiy moslik');
    return { listing, score: Math.round(score), why };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

export function scanListingDeep(
  title: string,
  description: string,
  price?: number,
  rooms?: number,
  extra?: {
    phone?: string;
    images?: string[];
    otherListings?: Array<{ images: string[]; phone?: string; price?: number; district?: string; rooms?: number }>;
    district?: string;
    area?: number;
  }
): ListingScanResult {
  const base = scanListingLocal(title, description, price, rooms);
  const reasons = [...base.reasons];
  let riskScore = base.riskScore;
  let brokerProbability = base.brokerProbability;

  const phone = (extra?.phone || '').replace(/\D/g, '');
  if (phone && (/(\d)\1{6,}/.test(phone) || phone.endsWith('0000000') || phone.length < 9)) {
    reasons.push("Telefon raqami shubhali yoki spamga o'xshaydi.");
    riskScore = Math.max(riskScore, 78);
  }

  const others = extra?.otherListings || [];
  if (extra?.images?.length && others.length) {
    const mine = new Set(extra.images);
    const stolen = others.some((o) => o.images.some((img) => mine.has(img)));
    if (stolen) {
      reasons.push("Shu rasm boshqa e'londa ham ishlatilgan.");
      riskScore = Math.max(riskScore, 82);
      brokerProbability = Math.max(brokerProbability, 70);
    }
  }

  if (phone && others.filter((o) => o.phone && o.phone.replace(/\D/g, '') === phone).length >= 3) {
    reasons.push("Bir telefon bilan juda ko'p e'lon — makler bo'lishi mumkin.");
    brokerProbability = Math.max(brokerProbability, 80);
    riskScore = Math.max(riskScore, 80);
  }

  if (typeof price === 'number' && extra?.district) {
    const est = estimatePrice({
      region: extra.district,
      district: extra.district,
      rooms: rooms || 1,
      area: extra.area,
    });
    if (price > est.high * 2.2) {
      reasons.push("Narx hududga nisbatan juda qimmat.");
      riskScore = Math.max(riskScore, 72);
    }
  }

  if (riskScore >= 70 || brokerProbability >= 70) {
    return {
      allowed: false,
      status: 'REJECTED',
      trustScore: 20,
      riskScore,
      brokerProbability,
      reasons,
      message: "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Joylashtirilmadi.",
    };
  }

  return { ...base, riskScore, brokerProbability, reasons };
}

export interface ChatReply {
  text: string;
  need?: SearchNeed;
  go?: 'SEARCH' | 'AUTH' | 'CREATE_LISTING' | 'HOME';
}

export function replyAsAssistant(message: string, listings: Listing[]): ChatReply {
  const t = message.toLowerCase();

  if (/kirish|ro['’`]yxat|login|profil/.test(t)) {
    return { text: "Kirish uchun yuqoridagi yashil tugmani bosing. Avval uy egasi yoki talaba ekaningizni tanlaysiz.", go: 'AUTH' };
  }
  if (/e['’`]lon|joyla|bermoqchi/.test(t) && /uy|kvartira|ijara/.test(t)) {
    return { text: "E'lon qo'yish uchun uy egasi sifatida kiring. Keyin katta yashil tugma: E'lon joylash.", go: 'CREATE_LISTING' };
  }

  const need: SearchNeed = { audience: 'ALL' };
  if (/talaba/.test(t)) need.audience = 'STUDENT';
  if (/oila|bolali|oilaviy/.test(t)) need.audience = 'FAMILY';

  const roomsM = t.match(/(\d)\s*xona/);
  if (roomsM) need.rooms = Number(roomsM[1]);

  const priceM = t.match(/(\d+(?:[.,]\d+)?)\s*(mln|million|m)/);
  if (priceM) need.maxPrice = Math.round(parseFloat(priceM[1].replace(',', '.')) * 1000000);

  const districts = ['yunusobod', 'mirobod', 'chilonzor', 'yakkasaroy', 'sergeli', 'uchtepa', 'olmazor', 'yashnobod'];
  const hit = districts.find((d) => t.includes(d));
  if (hit) {
    need.district = hit[0].toUpperCase() + hit.slice(1);
    if (need.district === 'Yunusobod') need.region = 'Toshkent shahri';
  }
  if (/toshkent/.test(t)) need.region = 'Toshkent shahri';
  if (/metro/.test(t)) need.nearMetro = true;

  const hasSearch = Boolean(need.rooms || need.maxPrice || need.district || need.region || need.audience !== 'ALL' || /kvartira|uy|ijara|qidir/.test(t));
  if (hasSearch) {
    const top = rankListings(listings, need).slice(0, 3);
    if (!top.length) {
      return { text: "Hozircha mos e'lon topilmadi. Filtrlarni kengaytirib qidirib ko'ring.", go: 'SEARCH', need };
    }
    const lines = top.map((r, i) => `${i + 1}) ${r.listing.district}, ${r.listing.rooms} xona, ${formatSom(r.listing.price)}`).join('\n');
    return {
      text: `Sizga mos 3 ta uy:\n${lines}\n\nQidiruv sahifasida hammasi ochiladi.`,
      go: 'SEARCH',
      need,
    };
  }

  return {
    text: "Men Maklersiz yordamchisiman. Masalan yozing: «Yunusobodda 2 xonali, 5 milliongacha» yoki «kirish».",
  };
}

export function formatSom(n: number): string {
  return `${Math.round(n).toLocaleString('uz-UZ')} so'm`;
}
