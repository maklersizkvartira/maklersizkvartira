export type UserRole =
  | 'TENANT'
  | 'STUDENT'
  | 'OWNER'
  | 'MODERATOR'
  | 'ADMIN'
  /** Full access to every user-side capability. Granted, never signed up for. */
  | 'DEVELOPER';

export type SignupRole = 'STUDENT' | 'OWNER';

export interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  role: SignupRole;
  avatar?: string;
  password?: string;
}

export type TrustLevel = 'RED' | 'YELLOW' | 'GREEN' | 'PREMIUM_GREEN';

export type VerificationLevel = 1 | 2 | 3 | 4 | 5;

export type PropertyType = 'APARTMENT' | 'HOUSE' | 'ROOM' | 'STUDIO' | 'DORMITORY';

export type AICheckStatus = 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED' | 'WARNING' | 'PENDING';

export interface TrustScoreBreakdown {
  identityScore: number;       // +10 (Phone), +20 (Passport), +20 (Selfie)
  propertyScore: number;       // +30 (Cadastre doc)
  reviewScore: number;         // +20 (Positive tenant reviews)
  behaviorScore: number;       // Activity consistency
  complaintDeduction: number;  // Penalty for reports
  totalScore: number;          // 0 - 100
}

export interface OwnerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  role: UserRole;
  trustScore: number;
  trustLevel: TrustLevel;
  riskScore: number;
  brokerRiskScore: number; // 0-100% broker probability
  verificationLevel: VerificationLevel;
  isVerified: boolean;
  successfulRentals: number;
  joinedDate: string;
  badges: string[];
  xpPoints: number;
  xpLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  referralCode: string;
  referralsCount: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number; // UZS/month
  currency: 'UZS' | 'USD';
  depositPrice: number;
  utilitiesIncluded: boolean;
  rooms: number;
  area: number; // sq. meters
  floor: number;
  totalFloors: number;
  propertyType: PropertyType;
  region: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  metroStation?: string;
  metroDistanceMinutes?: number;
  universityName?: string;
  universityDistanceMinutes?: number;
  furnished: boolean;
  petsAllowed: boolean;
  parking: boolean;
  internet: boolean;
  airConditioning: boolean;
  washingMachine: boolean;
  images: string[];
  videoUrl?: string;
  hasVirtualTour: boolean;
  owner: OwnerProfile;
  contactTelegram?: string;
  preferredContactTime?: string;
  trustScore: number;
  riskScore: number;
  aiCheckStatus: AICheckStatus;
  aiRiskReasons: string[];
  safetyBadges: ('VERIFIED_OWNER' | 'PROPERTY_VERIFIED' | 'AI_CHECKED' | 'NO_COMMISSION' | 'STUDENT_FRIENDLY')[];
  createdAt: string;
  viewsCount: number;
  favoritesCount: number;
  /** People who revealed the owner's phone number — the intent to call. */
  contactCount: number;
  /**
   * People who opened a chat about this listing — the intent to message.
   * Server-side it is counted from the conversations that exist, not stored
   * on the row, and it is only filled in on the owner's own listings.
   */
  conversationCount?: number;
  isRoommate?: boolean; // True if listing is for Sherikchilikka (Roommate sharing)
  roommateGender?: 'BOYS' | 'GIRLS' | 'ANY'; // Sherik jinsi: Yigitlar / Qizlar / Farqi yo'q
  roommateSpotsAvailable?: number; // Qancha sherik kerak
  isFeatured?: boolean;
}

export interface University {
  id: string;
  name: string;
  shortName: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  icon: string;
}

export interface ReportItem {
  id: string;
  listingId: string;
  listingTitle: string;
  ownerName: string;
  reporterName: string;
  reason: 'SCAM' | 'BROKER' | 'FAKE_LISTING' | 'FAKE_PHOTOS' | 'WRONG_PRICE' | 'SPAM' | 'HARASSMENT';
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  aiRiskScore: number;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  targetLevel: VerificationLevel;
  documentType: 'PASSPORT' | 'ID_CARD' | 'CADASTRE' | 'SELFIE_LIVENESS';
  documentImage?: string;
  selfieImage?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  rejectionReason?: string;
}

export interface FraudSignal {
  id: string;
  type: 'DUPLICATE_IMAGE' | 'HIGH_BROKER_PROBABILITY' | 'SUSPICIOUS_PHONE' | 'MULTI_ACCOUNT' | 'TEXT_SCAM_PATTERN';
  title: string;
  entityId: string;
  entityName: string;
  riskScore: number; // 0-100
  evidenceReasons: string[];
  matchedImages?: { currentUrl: string; originalUrl: string; similarity: number }[];
  detectedAt: string;
  status: 'PENDING_MODERATION' | 'INVESTIGATING' | 'ACTION_TAKEN' | 'DISMISSED';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  imageUrl?: string;
  listingId?: string;
  listingData?: {
    id: string;
    title: string;
    price: number;
    image: string;
    district?: string;
    rooms?: number;
  };
  isSafetyWarning?: boolean;
  warningText?: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingImage: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  tenantId: string;
  tenantName: string;
  tenantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}
