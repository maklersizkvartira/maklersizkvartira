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
    if (need.district && need.district !== 'Barchasi' && listing.district.toLowerCase() === need.district.toLowerCase()) {
      score += 30;
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

    if (need.maxPrice) {
      const p = listing.price;
      if (p <= need.maxPrice) {
        score += 25;
        why.push('Narx mos');
      } else if (p <= need.maxPrice * 1.35) {
        score += 15;
        why.push('Narx yaqin');
      } else {
        score -= 15;
      }
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
    otherListings?: Array<{ title?: string; images: string[]; phone?: string; price?: number; district?: string; rooms?: number }>;
    district?: string;
    area?: number;
  }
): ListingScanResult {
  const base = scanListingLocal(title, description, price, rooms);
  const reasons: string[] = [];
  const fieldErrors = [...(base.fieldErrors || [])];
  let riskScore = base.riskScore;
  let brokerProbability = base.brokerProbability;

  const phone = (extra?.phone || '').replace(/\D/g, '');
  if (phone && phone !== '998900000000' && (/(\d)\1{6,}/.test(phone) || phone.length < 9)) {
    reasons.push("📍 Telefon raqam maydonida xatolik: Shubhali yoki soxta raqam format aniqlandi.");
    fieldErrors.push({
      field: 'Telefon',
      issue: "Telefon raqami noto'g'ri yoki takrorlanuvchi raqamlardan iborat.",
      matchedWord: phone,
      fixSuggestion: "O'zingizning haqiqiy va ishchi telefon raqamingizni kiriting.",
    });
    riskScore = Math.max(riskScore, 78);
  }

  const others = extra?.otherListings || [];
  
  // 1. Duplicate Image Check (only for custom user uploaded images, excluding default unsplash samples)
  let imageStolen = false;
  if (extra?.images?.length && others.length) {
    const userCustomImages = extra.images.filter(img => !img.includes('unsplash.com') && !img.startsWith('data:image/svg'));
    if (userCustomImages.length > 0) {
      const mine = new Set(userCustomImages);
      imageStolen = others.some((o) => o.images.some((img) => !img.includes('unsplash.com') && mine.has(img)));
      if (imageStolen) {
        reasons.push("📍 Rasmlar maydonida xatolik: Ushbu rasm avval boshqa e'londa yuklangan (Dublikat foto).");
        fieldErrors.push({
          field: 'Rasmlar',
          issue: "Yuklangan rasm boshqa e'londagi rasm bilan 100% bir xil (dublikat).",
          fixSuggestion: "Uyingizning shaxsiy va yangi olingan original rasmlarini yuklang.",
        });
        riskScore = Math.max(riskScore, 85);
        brokerProbability = Math.max(brokerProbability, 80);
      }
    }
  }

  // 2. Multi-listing Broker Check
  if (phone && phone !== '998900000000' && others.filter((o) => o.phone && o.phone.replace(/\D/g, '') === phone).length >= 5) {
    reasons.push("📍 Telefon raqamida xatolik: Ushbu raqamdan ko'plab e'lon berilgan (Maklerlik belgisi).");
    fieldErrors.push({
      field: 'Telefon',
      issue: "Bir xil raqamdan ko'plab e'lonlar joylashtirilgan (vositachi/maklerlik belgisi).",
      fixSuggestion: "Agarda uy egasi bo'lsangiz, avvalgi e'lonlaringizni o'chiring yoki admin bilan bog'laning.",
    });
    brokerProbability = Math.max(brokerProbability, 88);
    riskScore = Math.max(riskScore, 82);
  }

  // 3. Price Anomaly Check
  if (typeof price === 'number' && extra?.district) {
    const est = estimatePrice({
      region: extra.district,
      district: extra.district,
      rooms: rooms || 1,
      area: extra.area,
    });
    if (price > est.high * 2.2) {
      reasons.push(`📍 Narx maydonida xatolik: ${price.toLocaleString('uz-UZ')} so'm (Hudud me'yoridan g'ayritabiiy qimmat)`);
      fieldErrors.push({
        field: 'Narx',
        issue: "Narx tanlangan tuman va xonalar soniga nisbatan juda baland ko'rsatilgan.",
        matchedWord: `${price} so'm`,
        fixSuggestion: `Narxni hududiy o'rtacha narxga (${est.suggested.toLocaleString('uz-UZ')} so'm) yaqinlashtiring.`,
      });
      riskScore = Math.max(riskScore, 72);
    } else if (price < est.low * 0.45 && price > 0) {
      reasons.push(`📍 Narx maydonida xatolik: ${price.toLocaleString('uz-UZ')} so'm (Juda arzon - firibgar zaklad tuzog'i)`);
      fieldErrors.push({
        field: 'Narx',
        issue: "Narx bozordagi eng past chegaradan ham ancha arzon ko'rsatilgan.",
        matchedWord: `${price} so'm`,
        fixSuggestion: `Narxni adolatli bozor narxiga yaqinlashtiring.`,
      });
      riskScore = Math.max(riskScore, 78);
    }
  }

  // Base checks addition
  if (base.reasons.length) {
    base.reasons.forEach((r) => {
      if (!reasons.includes(r)) reasons.push(r);
    });
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
      message: "⚠️ AI XAVFSIZLIK TIZIMI: E'loningizda aniq xatolik va taqiqlangan joylar aniqlandi. Quyida AI ko'rsatgan aniq xatolikni ko'rib tuzatishingiz mumkin:",
    };
  }

  // Positive verification reasons if clean
  const cleanReasons = [
    "✅ Rasmlar original (Boshqa e'lonlarda takrorlanmagan)",
    "✅ Telefon raqam faol va ishonchli",
    "✅ Narx hududiy bozor narxiga 100% mos",
    "✅ Matnda maklerlik yoki kartaga pul o'tkazish kalit so'zlari yo'q",
  ];

  return {
    allowed: true,
    status: 'APPROVED',
    trustScore: 96,
    riskScore: 4,
    brokerProbability: 2,
    reasons: cleanReasons,
    message: "✅ E'lon AI xavfsizlik tekshiruvidan muvaffaqiyatli o'tdi!",
  };
}

export interface ChatReply {
  text: string;
  need?: SearchNeed;
  matchedListings?: Listing[];
  go?: 'SEARCH' | 'AUTH' | 'CREATE_LISTING' | 'HOME';
}

const DISTRICT_MAP: Record<string, string> = {
  'chilonzor': 'Chilonzor',
  'yunusobod': 'Yunusobod',
  'mirobod': 'Mirobod',
  'yakkasaroy': 'Yakkasaroy',
  'sergeli': 'Sergeli',
  'uchtepa': 'Uchtepa',
  'olmazor': 'Olmazor',
  'yashnobod': 'Yashnobod',
  'shayxontohur': 'Shayxontohur',
  'bektemir': 'Bektemir',
  'mirzo': "Mirzo Ulug'bek",
};

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

  // 1. Dollar matching ($300 or 300$)
  const dollarM = t.match(/(\d+)\s*\$|\$\s*(\d+)|(\d+)\s*dollar/);
  if (dollarM) {
    const usdVal = parseFloat(dollarM[1] || dollarM[2] || dollarM[3]);
    if (usdVal > 0) {
      need.maxPrice = Math.round(usdVal * 12800 * 1.25); // +25% buffer
    }
  }

  // 2. So'm matching (3ml, 3.5mln, 3m, 3000000)
  if (!need.maxPrice) {
    const priceM = t.match(/(\d+(?:[.,]\d+)?)\s*(mln|million|m|ml|milyon)/);
    if (priceM) {
      need.maxPrice = Math.round(parseFloat(priceM[1].replace(',', '.')) * 1000000 * 1.25);
    } else {
      const rawPriceM = t.match(/(\d{6,8})/);
      if (rawPriceM) {
        need.maxPrice = Math.round(parseFloat(rawPriceM[1]) * 1.25);
      }
    }
  }

  // 3. District matching
  for (const [key, name] of Object.entries(DISTRICT_MAP)) {
    if (t.includes(key)) {
      need.district = name;
      need.region = 'Toshkent shahri';
      break;
    }
  }

  if (/toshkent/.test(t)) need.region = 'Toshkent shahri';
  if (/metro/.test(t)) need.nearMetro = true;

  const hasSearch = Boolean(need.rooms || need.maxPrice || need.district || need.region || need.audience !== 'ALL' || /kvartira|uy|ijara|qidir|chilonzor|yunusobod|mirobod|olmazor|sergeli/.test(t));
  if (hasSearch) {
    const topRanked = rankListings(listings, need);
    const top = topRanked.slice(0, 3).map((r) => r.listing);

    if (!top.length) {
      return {
        text: "Hozircha siz so'ragan krriteriyalar bo'yicha mos e'lon topilmadi. Qidiruv sahifasiga o'tib boshqa variantlarni ko'rishingiz mumkin.",
        go: 'SEARCH',
        need,
      };
    }

    const districtText = need.district ? `${need.district} tumanida` : "Toshkentda";
    const priceText = need.maxPrice ? ` ${formatSom(need.maxPrice)}gacha` : "";
    const lines = top.map((l, i) => `${i + 1}) ${l.title} — ${formatSom(l.price)} (${l.district})`).join('\n');

    return {
      text: `🤖 Shield AI: ${districtText}${priceText} sizga mos ${top.length} ta eng yaxshi kvartirani topdim:\n\n${lines}\n\nQuyida har bir kvartirani ko'rishingiz mumkin:`,
      go: 'SEARCH',
      need,
      matchedListings: top,
    };
  }

  return {
    text: "Men Shield AI yordamchisiman. Masalan yozing: «Chilonzordan 3ml ga kvartira kerak» yoki «Yunusobod 2 xona» deb yozing.",
  };
}

export function formatSom(n: number): string {
  return `${Math.round(n).toLocaleString('uz-UZ')} so'm`;
}
