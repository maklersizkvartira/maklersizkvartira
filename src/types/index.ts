export type UserRole =
  | 'TENANT'
  | 'STUDENT'
  | 'OWNER'
  /**
   * A realtor, or somebody running an agency, publishing on behalf of the
   * people who own the property. Before this role existed they had to sign up
   * as an owner and explain themselves in the listing text — a lie the
   * platform made them tell, and one a caller had no way to see through.
   */
  | 'AGENT'
  | 'MODERATOR'
  | 'ADMIN'
  /** Full access to every user-side capability. Granted, never signed up for. */
  | 'DEVELOPER';

export type SignupRole = 'STUDENT' | 'OWNER' | 'AGENT';

/**
 * Who a *listing* says it comes from, which is not the same question as what
 * the account is: an agent may let out a flat of their own, and an owner who
 * hands one property to an agency is still an owner. Asked per listing.
 */
export type SellerType = 'OWNER' | 'AGENT';

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

/**
 * Where a listing stands with the moderators.
 *
 * Nothing here is decided by a model any more: a new listing is published
 * immediately as APPROVED, and only an admin moves it out of that state.
 */
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'WARNING'
  | 'REJECTED'
  | 'UNDER_REVIEW'
  | 'ARCHIVED';

/** @deprecated The AI-branded alias of `ListingStatus`; read `status` instead. */
export type AICheckStatus = 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED' | 'WARNING' | 'PENDING';

/**
 * Where the owner's free "put my listing on top" request stands.
 *
 * The request is sent by the owner and granted by an admin — until it is
 * APPROVED the listing sits exactly where it did before.
 */
export type TopRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  /** Set only on an AGENT account, and optional even there. */
  agencyName?: string | null;
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
  hasVirtualTour: boolean;
  owner: OwnerProfile;
  /**
   * Whether this listing comes from the owner or from an agent acting for
   * them. Optional because a response served by a container predating the
   * field carries nothing; read it through a helper that defaults to 'OWNER',
   * which is what every such row meant.
   */
  sellerType?: SellerType;
  /** The agency, snapshotted at publish time. Only set on an agent listing. */
  agencyName?: string | null;
  contactTelegram?: string;
  preferredContactTime?: string;
  trustScore: number;
  riskScore: number;
  /** The moderation state the API stores. Optional only because the field is
   *  absent from a response served by a container that predates it. */
  status?: ListingStatus;
  /** @deprecated Legacy alias of `status`, still sent for one release. */
  aiCheckStatus?: AICheckStatus;
  /** @deprecated Left over from the removed scanner; always empty now. */
  aiRiskReasons?: string[];
  /**
   * Only two badges are awarded now. AI_CHECKED, NO_COMMISSION and
   * STUDENT_FRIENDLY are retired: the first claimed a check that no longer
   * runs, the second carried the old broker-free positioning, and the data
   * migration strips all three from existing rows. Nothing in the app compares
   * against them any more, so the union is narrowed to what the server sends.
   */
  safetyBadges: ('VERIFIED_OWNER' | 'PROPERTY_VERIFIED')[];
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
  /** When the granted Top promotion runs out. Null while the listing is not promoted. */
  featuredUntil?: string | null;
  /**
   * The owner's own view of their Top request. The API fills it in only for
   * the listing's owner and for staff, so it is absent on every other row.
   */
  topRequestStatus?: TopRequestStatus | null;
  /**
   * Why an administrator actioned this listing, in their own words. The API
   * sends it only to the listing's owner and to staff, so it is absent on
   * every catalogue row. It is the owner's only explanation of a warning or a
   * takedown now that the publish-time scanner is gone.
   */
  moderationNote?: string | null;
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
