import { ReportItem, VerificationRequest, FraudSignal } from '../types';

export const MOCK_REPORTS: ReportItem[] = [
  {
    id: 'report-101',
    listingId: 'listing-5',
    listingTitle: 'Buyuk Ipak Yo\'li yaqinida shubhali arzon kvartira',
    ownerName: 'Sardor RealEstate (Shubhali)',
    reporterName: 'Alisher Valiyev',
    reason: 'SCAM',
    description: "Ushbu e'lon egasi telefon qilganimda 500.000 so'm zaklad o'tkazishimni va keyin kalit berishini aytdi. Soxta e'longa o'xshaydi.",
    status: 'OPEN',
    priority: 'CRITICAL',
    aiRiskScore: 88,
    createdAt: '2026-08-12T10:15:00Z',
  },
  {
    id: 'report-102',
    listingId: 'listing-3',
    listingTitle: 'Chilonzor 5-kvartal Metro Mirzo Ulug\'bek yaqinida shinam Studio',
    ownerName: 'Bekzod Rahimov',
    reporterName: 'Madina Umarova',
    reason: 'BROKER',
    description: "E'lon qilgan odam o'zini makler emasman dedi, lekin uyni ko'rsatgani kelganda 50% komissiya so'radi.",
    status: 'UNDER_REVIEW',
    priority: 'HIGH',
    aiRiskScore: 65,
    createdAt: '2026-08-11T16:40:00Z',
  },
  {
    id: 'report-103',
    listingId: 'listing-2',
    listingTitle: 'Yunusobod 19-kvartal TATU va INHA yaqinida 3 xonali oilaviy uy',
    ownerName: 'Nodira Alimova',
    reporterName: 'Farhod Toshev',
    reason: 'WRONG_PRICE',
    description: "Saytda narx 6.2 mln so'm yozilgan, lekin telefonda 6.8 mln deb aytdi.",
    status: 'RESOLVED',
    priority: 'MEDIUM',
    aiRiskScore: 22,
    createdAt: '2026-08-10T12:00:00Z',
  }
];

export const MOCK_VERIFICATIONS: VerificationRequest[] = [
  {
    id: 'verif-201',
    userId: 'user-301',
    userName: 'Dilshod Rahmatov',
    userPhone: '+998 90 999 11 22',
    targetLevel: 2,
    documentType: 'PASSPORT',
    documentImage: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
    status: 'PENDING',
    submittedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'verif-202',
    userId: 'user-302',
    userName: 'Shahnoza Xalilova',
    userPhone: '+998 94 444 33 22',
    targetLevel: 4,
    documentType: 'CADASTRE',
    documentImage: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=600',
    status: 'PENDING',
    submittedAt: '2026-08-12T07:30:00Z',
  },
  {
    id: 'verif-203',
    userId: 'owner_jasur',
    userName: 'Jasur Karimov',
    userPhone: '+998 90 123 45 67',
    targetLevel: 5,
    documentType: 'SELFIE_LIVENESS',
    documentImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    status: 'APPROVED',
    submittedAt: '2026-08-05T14:20:00Z',
  }
];

export const MOCK_FRAUD_SIGNALS: FraudSignal[] = [
  {
    id: 'fraud-501',
    type: 'DUPLICATE_IMAGE',
    title: 'Internetdan olingan rasm aniqlandi',
    entityId: 'listing-5',
    entityName: 'Buyuk Ipak Yo\'li yaqinida shubhali arzon kvartira',
    riskScore: 88,
    evidenceReasons: [
      'Visual Hash (pHash) 99.4% o\'xshashlik: Olx.uz saytidagi 2024-yilgi e\'lon bilan mos tushdi',
      'Telefon raqam 3 xil profilga bog\'langan',
      'IP manzili ko\'p sonli registratsiya qilgan'
    ],
    matchedImages: [
      {
        currentUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=400',
        originalUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=400',
        similarity: 99.4
      }
    ],
    detectedAt: '2026-08-12T08:05:00Z',
    status: 'PENDING_MODERATION'
  },
  {
    id: 'fraud-502',
    type: 'HIGH_BROKER_PROBABILITY',
    title: 'Yuqori Maklerlik Ehtimoli (88%)',
    entityId: 'owner_suspicious',
    entityName: 'Sardor RealEstate (Shubhali)',
    riskScore: 85,
    evidenceReasons: [
      '7 kun ichida 14 ta har xil tumanda e\'lon yaratdi (Chilonzor, Yunusobod, Sergeli, Mirobod)',
      'Profil verification qilinmagan',
      'Bir xil tavsif matni 6 ta har xil kvartirada takrorlangan'
    ],
    detectedAt: '2026-08-11T19:30:00Z',
    status: 'INVESTIGATING'
  }
];

export const MOCK_AUDIT_LOGS = [
  { id: 'log-1', admin: 'Moderator_Aziz', action: 'APPROVE_VERIFICATION', target: 'Jasur Karimov (Level 5)', timestamp: '2026-08-12 10:45' },
  { id: 'log-2', admin: 'AI_Shield_Engine', action: 'AUTO_FLAG_LISTING', target: 'Buyuk Ipak Yo\'li kvartira (Risk 88)', timestamp: '2026-08-12 08:05' },
  { id: 'log-3', admin: 'Admin_Super', action: 'UPDATE_SYSTEM_SETTINGS', target: 'Referral reward XP boosted +50', timestamp: '2026-08-11 18:20' },
  { id: 'log-4', admin: 'Moderator_Madina', action: 'RESOLVE_REPORT', target: 'Report #103 closed (Resolved)', timestamp: '2026-08-10 14:10' },
];
