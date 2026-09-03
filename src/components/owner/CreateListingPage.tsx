/**
 * The three-step "post a listing" wizard.
 *
 * How publishing works:
 *  - A listing that passes this form's own validation is published. There is
 *    no check to wait for and no verdict to argue with — a 201 from
 *    `ListingsApi.create()` means the listing is live.
 *  - Being seen sooner is a separate, optional request: the owner can ask for
 *    Top on the last step, which is free, is sent after the listing exists,
 *    and only takes effect once an admin approves it. It can never delay or
 *    block the publish itself.
 *  - Nothing server-owned (status, trust score, counters, owner) is sent:
 *    the API rejects unknown fields with 422.
 *  - Images travel as base64 data URLs inside the JSON body, so they are
 *    downscaled before they are encoded and the wizard shows the running
 *    payload size — a request over the limit fails at the gateway, long after
 *    the owner has done the work.
 *
 * Two rules this form learned the hard way:
 *
 *  - **Nothing is answered on the owner's behalf.** Every numeric field used
 *    to open with a plausible number in it and six of the seven amenities
 *    ticked, so an owner who typed a title and pressed through published a
 *    flat that claimed 65 m², a 4.5M price, parking and a five-minute walk to
 *    Yunusobod. A seeded value reads as an answer; a placeholder reads as an
 *    example.
 *  - **Nothing is lost.** Three steps is long enough that a mis-tapped back
 *    gesture used to empty all three, photos included. The answers are kept in
 *    a local draft and leaving is confirmed.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Home,
  Navigation,
  MapPin,
  MessageSquare,
  Phone,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { AMENITIES, NO_AMENITIES, type AmenityState } from '../../data/amenities';
import { ApiError } from '../../services/http';
import {
  DEFAULT_TOP_DAYS,
  ListingsApi,
  MAX_TOP_NOTE_LENGTH,
  TOP_DAYS_OPTIONS,
} from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import { useHaptics } from '../../hooks/useHaptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/cn';
import { Button, Field, FormError, SelectInput, TextInput } from '../ui/Field';
import { Card } from '../ui/Card';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import type { PropertyType, SellerType } from '../../types';
import { canPublishAsAgent, canPublishListings, isSwitchableRole } from '../../types/roles';
import {
  districtCentre,
  reverseGeocode,
  TASHKENT_CITY,
} from '../../services/geocoding';

/** Stored value for "no metro nearby"; the label is translated at render time. */
const METRO_NONE = 'NONE';

/**
 * The five kinds of place the API knows about.
 *
 * The wizard never asked, and sent `propertyType: 'APARTMENT'` for every
 * listing on the site — so a house, a room, a studio and a dormitory could not
 * be posted as such, and none of them were ever returned by the search that
 * filters on the type. The order is the one they are offered in, commonest
 * first.
 */
const PROPERTY_TYPES_OWNER: readonly { value: PropertyType; labelKey: string }[] = [
  { value: 'APARTMENT', labelKey: 'listings.propertyType.apartment' },
  { value: 'HOUSE', labelKey: 'listings.propertyType.house' },
  { value: 'LAND', labelKey: 'listings.propertyType.land' },
  { value: 'COMMERCIAL', labelKey: 'listings.propertyType.commercial' },
];

const PROPERTY_TYPES_ROOMMATE: readonly { value: PropertyType; labelKey: string }[] = [
  { value: 'ROOM', labelKey: 'listings.propertyType.room' },
  { value: 'APARTMENT', labelKey: 'listings.propertyType.apartment' },
  { value: 'DORMITORY', labelKey: 'listings.propertyType.dormitory' },
  { value: 'HOUSE', labelKey: 'listings.propertyType.house' },
  { value: 'STUDIO', labelKey: 'listings.propertyType.studio' },
];

const PROPERTY_TYPES: readonly { value: PropertyType; labelKey: string }[] = [
  ...PROPERTY_TYPES_OWNER,
  { value: 'ROOM', labelKey: 'listings.propertyType.room' },
  { value: 'STUDIO', labelKey: 'listings.propertyType.studio' },
  { value: 'DORMITORY', labelKey: 'listings.propertyType.dormitory' },
];

const MAX_IMAGES = 12;
/**
 * One photo, not three.
 *
 * A listing with no picture at all is not worth publishing — nobody rents a
 * flat they cannot see — but demanding three of them turned away owners who
 * had one good photo of the room and nothing else on the phone in their hand.
 * The copy asks for more; the gate insists on one.
 */
const MIN_IMAGES = 1;
/** The JSON body carries the photos, so the whole request must stay small. */
const MAX_PAYLOAD_MB = 6;
const TOTAL_STEPS = 3;

/**
 * Longest edge a stored photo is allowed to have.
 *
 * A photo straight off a current phone is 4000px wide and three of them are
 * enough to blow the 6MB request cap on their own — which is why the single
 * most common way to fail this form used to be uploading normal pictures. At
 * 1600px a listing photo still fills a desktop card at 2x and costs roughly a
 * fifteenth as many bytes.
 */
const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;
/** Below this an untouched original is cheaper than a re-encode of it. */
const REENCODE_ABOVE_BYTES = 400 * 1024;

/**
 * The draft key carries the account id.
 *
 * One global key meant one draft per *browser*, and a shared phone or a family
 * desktop is normal here: the owner who signed in second opened "post a
 * listing" and found the first one's street address, price, Telegram handle
 * and photos already in the form, ready to publish under their own name.
 * `logout` never cleared it either, so signing out did not help.
 */
const DRAFT_KEY_PREFIX = 'uyiz.owner.createDraft';
/** The pre-rebrand prefix. Its per-account drafts are adopted once and the old
 *  keys removed, so nobody loses work to the rename. */
const LEGACY_DRAFT_KEY_PREFIX = 'maklersiz.owner.createDraft';
/** The key from before the per-account split, deleted rather than adopted. */
const LEGACY_SHARED_DRAFT_KEY = LEGACY_DRAFT_KEY_PREFIX;
/**
 * Still 2, although the property type and the "who is publishing" question
 * were added to the shape after version 2 was written.
 *
 * Bumping it to 3 read as caution and would have been destruction: `readDraft`
 * throws away every draft whose version does not match, so the deploy that
 * carried the bump would have deleted a week of them — address, description,
 * price and up to twelve photos each — from the one form whose second rule is
 * that nothing is lost. The reasoning behind the bump does not survive contact
 * with the empty form either: a new wizard already opens on APARTMENT and on
 * the seller the account's own role implies, so a migrated version-2 draft
 * shows exactly the defaults an untouched one shows and claims nothing extra.
 * A version bump is for a shape whose old values can no longer be read; these
 * can, so the two missing answers are defaulted in `readDraft` instead.
 */
const DRAFT_VERSION = 2;
const DRAFT_DEBOUNCE_MS = 800;
/**
 * A draft older than this is not a draft, it is a memory. Coming back to a
 * five-month-old form and pressing through publishes last spring's price.
 */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The API's own rule, applied here so a typo is not worth a round trip. */
const TELEGRAM_PATTERN = /^@?[A-Za-z0-9_]{4,32}$/;

/**
 * The schema's own caps (`app/schemas/listing.py`), mirrored.
 *
 * Only the minimums were checked here, so a contact-time box filled with a
 * whole sentence uploaded four megabytes of photos and came back as one red
 * line reading "check the data you entered", with nothing saying which box.
 * The server trims before it measures, so `.trim().length` is what is compared.
 */
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_CONTACT_TIME_LENGTH = 64;
const MAX_AGENCY_NAME_LENGTH = 120;

/** Whichever step the draft claims, it has to be one this wizard renders. */
function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(Math.max(1, Math.round(step)), TOTAL_STEPS);
}

/**
 * Which field a 422 is about, and where it lives.
 *
 * The API answers with the camelCase alias it was sent (`preferredContactTime`),
 * which is neither this form's error key nor a step number — so the two are
 * written down rather than assumed to line up.
 */
const SERVER_FIELDS: Record<string, { step: number; field: string }> = {
  title: { step: 1, field: 'title' },
  description: { step: 1, field: 'description' },
  propertyType: { step: 1, field: 'propertyType' },
  price: { step: 1, field: 'price' },
  depositPrice: { step: 1, field: 'deposit' },
  rooms: { step: 1, field: 'rooms' },
  area: { step: 1, field: 'area' },
  floor: { step: 1, field: 'floor' },
  totalFloors: { step: 1, field: 'floor' },
  address: { step: 2, field: 'address' },
  metroDistanceMinutes: { step: 2, field: 'metroMinutes' },
  images: { step: 3, field: 'images' },
  agencyName: { step: 3, field: 'agency' },
  contactTelegram: { step: 3, field: 'telegram' },
  preferredContactTime: { step: 3, field: 'preferredTime' },
};

const GPS_ERROR_KEYS: Record<number, string> = {
  1: 'owner.create.location.gpsDenied',
  2: 'owner.create.location.gpsUnavailable',
  3: 'owner.create.location.gpsTimeout',
};

const textareaClass =
  'w-full rounded-2xl border border-line bg-surface-2 p-3.5 text-base font-medium text-content ' +
  'transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none';

/**
 * `number | ''` rather than `number`.
 *
 * `Number('')` is 0, so with a plain number state clearing the price box wrote
 * a literal zero into the listing and the field showed it.
 */
type NumberField = number | '';

type RoommateGender = 'BOYS' | 'GIRLS' | 'ANY';

type Notice = { key: string; params?: Record<string, string | number> };

interface Draft {
  version: number;
  savedAt: number;
  step: number;
  /** The furthest step reached, so a reload does not re-lock the steps that
   *  were already earned before it. */
  maxStep: number;
  region: string;
  district: string;
  address: string;
  metro: string;
  metroMinutes: NumberField;
  latitude: number | null;
  longitude: number | null;
  title: string;
  description: string;
  propertyType: PropertyType;
  price: NumberField;
  deposit: NumberField;
  rooms: NumberField;
  area: NumberField;
  landArea?: NumberField;
  floor: NumberField;
  totalFloors: NumberField;
  amenities: AmenityState;
  isRoommate: boolean;
  categoryChosen?: boolean;
  roommateGender: RoommateGender;
  roommateSpots: number;
  images: string[];
  sellerType: SellerType;
  agencyName: string;
  telegram: string;
  preferredTime: string;
  /** The Top choice made on the last step, kept so a reload does not lose it. */
  topRequested: boolean;
  topDays: number;
  topNote: string;
  /** True when this copy was stored without its photos — see `writeDraft`. */
  photosDropped?: boolean;
}

/** Approximate byte size of a base64 data URL, without decoding it. */
function dataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return Math.round(payload.length * 0.75);
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode_failed'));
    image.src = dataUrl;
  });
}

/**
 * What came back from `prepareImage`: a picture, or a file that is not one.
 *
 * Unreadable and undecodable end in the same message rather than a
 * format-specific one, because "this file could not be read" is equally true
 * of a HEIC on Android, a truncated JPEG and a file whose extension lies.
 */
type PreparedImage = { ok: true; dataUrl: string } | { ok: false };

/**
 * Read a picked file and shrink it to something a JSON body can carry.
 *
 * A file the browser cannot decode is rejected rather than passed through.
 * Returning the original used to look like leniency and was the opposite: no
 * desktop or Android browser decodes HEIC, so an iPhone photo synced to a
 * laptop went through untouched at its full size, showed a broken-image icon
 * in the grid, counted three or four megabytes against the payload cap, and —
 * if the total happened to fit — published a listing whose photos are blank in
 * every browser, the moderation queue included.
 *
 * The canvas being unavailable is a different thing and still falls back to the
 * original: there the picture is fine, only the shrinking failed, and a photo
 * that is too big at least reaches the size warning.
 */
async function prepareImage(file: File): Promise<PreparedImage> {
  const original = await readAsDataUrl(file);
  if (!original) return { ok: false };

  let image: HTMLImageElement;
  try {
    image = await decode(original);
  } catch {
    return { ok: false };
  }

  try {
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestEdge > 0 ? Math.min(1, MAX_IMAGE_EDGE / longestEdge) : 1;
    if (scale === 1 && dataUrlBytes(original) <= REENCODE_ABOVE_BYTES) {
      return { ok: true, dataUrl: original };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return { ok: true, dataUrl: original };
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const encoded = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
    const smaller = dataUrlBytes(encoded) < dataUrlBytes(original) ? encoded : original;
    return { ok: true, dataUrl: smaller };
  } catch {
    return { ok: true, dataUrl: original };
  }
}

function draftKeyFor(userId: string): string {
  return `${DRAFT_KEY_PREFIX}.${userId}`;
}

function legacyDraftKeyFor(userId: string): string {
  return `${LEGACY_DRAFT_KEY_PREFIX}.${userId}`;
}

function readDraft(
  key: string | null,
  legacyKey: string | null,
  sellerFallback: SellerType,
): Draft | null {
  if (!key) return null;
  try {
    // One-time migration off the old brand's key. The value is moved rather
    // than read in place, so the rename cannot orphan a draft; whether it is
    // then restorable is the version check's business, a few lines down.
    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null && localStorage.getItem(key) === null) {
        localStorage.setItem(key, legacy);
      }
      localStorage.removeItem(legacyKey);
    }
    // The draft from before the per-account split is not adopted into this
    // account — it may belong to whoever used the browser last — it is thrown
    // away, photos and all, so it stops leaking and stops taking up quota.
    localStorage.removeItem(LEGACY_SHARED_DRAFT_KEY);

    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    // A draft from an older shape is cleared, not just refused: left in place
    // it would sit in the quota forever, being re-read and re-rejected.
    if (!parsed || parsed.version !== DRAFT_VERSION) {
      clearDraft(key);
      return null;
    }
    // A missing `savedAt` is a draft from before this check, so it is treated
    // as old rather than as an age of NaN.
    if (
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS
    ) {
      clearDraft(key);
      return null;
    }
    // The keys a draft written before those two questions existed cannot have,
    // filled in with the values an untouched form opens on — the same
    // treatment the amenities have had since they were split out. Nothing is
    // answered on the owner's behalf by doing so: a new wizard shows APARTMENT
    // and the role's own seller before anybody has touched it, so a restored
    // draft that shows them is saying no more than an empty one does.
    return {
      ...parsed,
      amenities: { ...NO_AMENITIES, ...parsed.amenities },
      propertyType: parsed.propertyType ?? 'APARTMENT',
      landArea: parsed.landArea ?? '',
      categoryChosen:
        parsed.categoryChosen ??
        (parsed.step > 1 || Boolean(parsed.title) || parsed.price !== ''),
      sellerType: parsed.sellerType ?? sellerFallback,
      agencyName: parsed.agencyName ?? '',
      // The `maxStep` state's own initialiser already copes with this being
      // missing; defaulting it here is so the object matches the type it is
      // being read as rather than only happening to work.
      maxStep: parsed.maxStep ?? parsed.step,
    };
  } catch {
    // Corrupt or unreadable storage must not stop the form from opening.
    return null;
  }
}

type DraftWrite = 'saved' | 'photosDropped' | 'failed';

/**
 * Persist the draft, dropping the photos if that is what it takes.
 *
 * Twelve downscaled photos are past the ~5MB localStorage quota — the form's
 * own 6MB budget is measured in decoded bytes and storage counts base64
 * characters, so the wall arrives around a "3.6 / 6 MB" reading — and a quota
 * error thrown here would otherwise lose the text too, which is the part that
 * took the owner ten minutes to write.
 *
 * The drop is reported rather than swallowed. It is destructive: the write
 * that fails replaces a draft that *did* hold four photos with one that holds
 * none, so adding a fifth photo is what deletes the first four. The caller
 * records it on the draft so the restore banner can say the photos are gone
 * before the owner discovers it by their absence.
 */
function writeDraft(key: string | null, draft: Draft): DraftWrite {
  if (!key) return 'failed';
  try {
    localStorage.setItem(key, JSON.stringify({ ...draft, photosDropped: false }));
    return 'saved';
  } catch {
    const dropped = draft.images.length > 0;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...draft, images: [], photosDropped: dropped }),
      );
      return dropped ? 'photosDropped' : 'saved';
    } catch {
      /* storage is unavailable entirely (private mode, blocked) */
      return 'failed';
    }
  }
}

function clearDraft(key: string | null): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const CreateListingPage: React.FC = () => {
  const { t, tRaw, formatPrice, formatDate } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const switchRole = useAppStore((state) => state.switchRole);
  const fetchMyListings = useAppStore((state) => state.fetchMyListings);
  const pushToast = useAppStore((state) => state.pushToast);
  const fxRate = useAppStore((state) => state.fxRate);

  const prefersReducedMotion = useReducedMotion();
  const haptics = useHaptics();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<number | null>(null);

  // Derived above the sign-in gate below, because the draft initialiser a few
  // lines down runs before that gate does. `null` when nobody is signed in, and
  // every draft helper does nothing with a null key.
  const draftKey = currentUser ? draftKeyFor(currentUser.id) : null;
  const legacyDraftKey = currentUser ? legacyDraftKeyFor(currentUser.id) : null;

  /**
   * Whether this account may file a listing as coming from an agent.
   *
   * The API decides this too — `_normalise_seller` puts a non-agent's listing
   * back to OWNER whatever it was sent — so what is decided here is only what
   * the form offers. An option that is silently ignored is worse than one that
   * is visibly locked with the way to unlock it beside it.
   *
   * Derived up here beside the draft key, above the gates below, because the
   * seller state and the draft it is restored from both have to consult it and
   * both are initialised before any gate runs.
   */
  const canActAsAgent = canPublishAsAgent(currentUser?.role);
  /** What the seller question opens on when nothing has answered it yet. */
  const defaultSellerType: SellerType = canActAsAgent ? 'AGENT' : 'OWNER';

  // Read once, so every field below can open on the value the owner left.
  const [initialDraft] = useState<Draft | null>(() =>
    readDraft(draftKey, legacyDraftKey, defaultSellerType),
  );

  const [step, setStep] = useState(() => clampStep(initialDraft?.step ?? 1));
  /**
   * The furthest step this form has been walked to.
   *
   * The step header used to unlock nothing above the step you were standing
   * on, so going back to correct the district re-locked the two steps behind
   * it: the photos were still uploaded and the price still typed, but the
   * only way back to them was to press "next" through every gate again.
   */
  const [maxStep, setMaxStep] = useState(() =>
    clampStep(Math.max(initialDraft?.maxStep ?? 1, initialDraft?.step ?? 1)),
  );

  // -- Step 1: location ------------------------------------------------------
  const [region, setRegion] = useState(initialDraft?.region ?? TASHKENT_CITY);
  const [district, setDistrict] = useState(
    () =>
      initialDraft?.district ??
      (UZBEKISTAN_REGIONS.find((item) => item.name === TASHKENT_CITY) ?? UZBEKISTAN_REGIONS[0])
        .districts[0],
  );
  const [address, setAddress] = useState(initialDraft?.address ?? '');
  // METRO_NONE, not a station: an untouched form used to claim a five-minute
  // walk to Yunusobod from anywhere in the country.
  const [metro, setMetro] = useState(initialDraft?.metro ?? METRO_NONE);
  const [metroMinutes, setMetroMinutes] = useState<NumberField>(
    initialDraft?.metroMinutes ?? '',
  );
  const [metroOpen, setMetroOpen] = useState(false);
  const [metroQuery, setMetroQuery] = useState('');
  // Only consulted below `lg`, where the tips panel collapses. Above that the
  // panel is always shown and its toggle is not reachable.
  const [tipsOpen, setTipsOpen] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(initialDraft?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialDraft?.longitude ?? null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<Notice | null>(null);
  const [gpsError, setGpsError] = useState<Notice | null>(null);
  const [gpsPermission, setGpsPermission] = useState<PermissionState | null>(null);

  // -- Step 2: the property --------------------------------------------------
  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [propertyType, setPropertyType] = useState<PropertyType>(
    initialDraft?.propertyType ?? 'APARTMENT',
  );
  const [price, setPrice] = useState<NumberField>(initialDraft?.price ?? '');
  const [deposit, setDeposit] = useState<NumberField>(initialDraft?.deposit ?? '');
  const [rooms, setRooms] = useState<NumberField>(initialDraft?.rooms ?? '');
  const [area, setArea] = useState<NumberField>(initialDraft?.area ?? '');
  const [landArea, setLandArea] = useState<NumberField>(initialDraft?.landArea ?? '');
  const [floor, setFloor] = useState<NumberField>(initialDraft?.floor ?? '');
  const [totalFloors, setTotalFloors] = useState<NumberField>(initialDraft?.totalFloors ?? '');
  const [amenities, setAmenities] = useState<AmenityState>(
    initialDraft?.amenities ?? NO_AMENITIES,
  );
  const [isRoommate, setIsRoommate] = useState(initialDraft?.isRoommate ?? false);
  const [categoryChosen, setCategoryChosen] = useState<boolean>(() => {
    if (initialDraft?.categoryChosen !== undefined) {
      return initialDraft.categoryChosen;
    }
    if (initialDraft && (initialDraft.step > 1 || Boolean(initialDraft.title) || initialDraft.price !== '')) {
      return true;
    }
    return false;
  });
  const [roommateGender, setRoommateGender] = useState<RoommateGender>(
    initialDraft?.roommateGender ?? 'ANY',
  );
  const [roommateSpots, setRoommateSpots] = useState(initialDraft?.roommateSpots ?? 1);

  // -- Step 3: photos, contact, top, submit ----------------------------------
  const [images, setImages] = useState<string[]>(initialDraft?.images ?? []);
  const [processingImages, setProcessingImages] = useState(false);
  const [dragOverDropzone, setDragOverDropzone] = useState(false);
  // Seeded from the role the account itself declared, not fixed at OWNER: an
  // agency that has already told us what it is would otherwise publish
  // listings badged "from the owner" every time it forgot to change this —
  // precisely the claim the badge exists to stop being made. Nothing is
  // hidden by it; both segments are on the screen, one of them lit.
  //
  // The draft only gets a say while the account can still act on it, because
  // a draft outlives a role change and AGENT → OWNER is a switch the profile
  // page offers. Restoring the stored AGENT afterwards lit a segment that was
  // also disabled: the agency box asked for a name that would never be sent,
  // the "you cannot do this" panel sat underneath a control saying it was
  // already done, `validateStep(3)` length-checked that name, and the publish
  // sent OWNER without a word — the screen saying one thing and the listing
  // another. A disabled segment that is also the selected one takes the whole
  // radiogroup out of the tab order as well, since `Segmented` keeps only the
  // active segment at `tabIndex={0}` and the arrow keys are on a wrapper that
  // is not focusable.
  const [sellerType, setSellerType] = useState<SellerType>(() =>
    canActAsAgent ? (initialDraft?.sellerType ?? defaultSellerType) : 'OWNER',
  );
  // Prefilled from the account, because an agency publishes under the same
  // name every time and retyping it on each listing is how the third one ends
  // up spelled differently from the first two.
  const [agencyName, setAgencyName] = useState(
    initialDraft?.agencyName ?? currentUser?.agencyName ?? '',
  );
  const [telegram, setTelegram] = useState(initialDraft?.telegram ?? '');
  const [preferredTime, setPreferredTime] = useState(initialDraft?.preferredTime ?? '');
  const [topRequested, setTopRequested] = useState(initialDraft?.topRequested ?? false);
  const [topDays, setTopDays] = useState<number>(initialDraft?.topDays ?? DEFAULT_TOP_DAYS);
  const [topNote, setTopNote] = useState(initialDraft?.topNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * What to say once the listing is live: nothing, "the Top request is with
   * the admins", or "published, but the Top request did not go through".
   * Never null while the sheet is open, and the sheet is the only thing that
   * moves the owner on to their listings.
   */
  const [topOutcome, setTopOutcome] = useState<'sent' | 'failed' | null>(null);

  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(
    initialDraft?.savedAt ?? null,
  );
  /** The stored draft is holding no photos, whatever the grid is showing. */
  const [photosDropped, setPhotosDropped] = useState(initialDraft?.photosDropped ?? false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  /** Field name -> translation key, so errors survive a language switch. */
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  /**
   * Counts refused presses, so the effect that shows the summary can tell one
   * refusal from the next.
   *
   * `setStep(invalidStep)` when the failure is on the step already showing —
   * the ordinary case, a missing photo or a mistyped Telegram handle — is a
   * React bail-out: no re-render, so an effect keyed on the step never runs
   * again. Publishing an invalid form therefore fired the haptic and did
   * nothing visible, because the summary sits at the top of the form, several
   * screens above the button a thumb had just pressed on a 360px phone.
   */
  const [errorNudge, setErrorNudge] = useState(0);

  const activeRegion =
    UZBEKISTAN_REGIONS.find((item) => item.name === region) ?? UZBEKISTAN_REGIONS[0];

  // Tashkent is the only city in the country with a metro, so everywhere else
  // the question is noise — and a station left selected from a previous region
  // would be a false claim on the listing. The province is included because
  // the line now reaches Sergeli and Yangihayot, which border it.
  const hasMetro = region.startsWith('Toshkent');

  const visibleMetroLines = useMemo(() => {
    const query = metroQuery.trim().toLowerCase();
    if (!query) return TASHKENT_METRO_LINES;
    return TASHKENT_METRO_LINES.map((line) => ({
      ...line,
      stations: line.stations.filter((station) =>
        station.toLowerCase().includes(query),
      ),
    })).filter((line) => line.stations.length > 0);
  }, [metroQuery]);

  useEffect(() => {
    if (!hasMetro && metro !== METRO_NONE) {
      setMetro(METRO_NONE);
      setMetroMinutes('');
      setMetroOpen(false);
    }
  }, [hasMetro, metro]);

  // The seed above runs once, and `currentUser.role` is store state that can
  // change while this form stays mounted — the gate below switches it, and so
  // does anything else that refreshes the account — so the same clamp is
  // repeated whenever the capability goes away. Without it the segment goes on
  // showing AGENT, disabled and selected at the same time, while the publish
  // quietly sends OWNER.
  useEffect(() => {
    if (!canActAsAgent && !isSwitchableRole(currentUser?.role) && sellerType === 'AGENT') {
      setSellerType('OWNER');
    }
  }, [canActAsAgent, currentUser?.role, sellerType]);

  const payloadBytes = useMemo(
    () => images.reduce((sum, image) => sum + dataUrlBytes(image), 0),
    [images],
  );
  const payloadMb = payloadBytes / (1024 * 1024);
  const payloadTooLarge = payloadMb > MAX_PAYLOAD_MB;

  /**
   * A step change is not a route change, so the app's own scroll reset — which
   * lives in the store and fires on navigation — never saw any of the nine
   * places that call `setStep`. Without this, pressing "next" at the bottom of
   * a long step leaves you looking at the bottom of the next one.
   */
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [step, prefersReducedMotion]);

  /**
   * Put the refusal in front of whoever was refused.
   *
   * Focus as well as scroll: the summary is the answer to the press, and
   * moving focus into it is what tells a screen reader the same thing the
   * scroll tells everyone else. Declared after the step effect above so that
   * when a failure does move the wizard to another step this one runs second
   * and the summary, not the top of the page, is where the owner is left.
   */
  useEffect(() => {
    if (errorNudge === 0) return;
    const summary = errorSummaryRef.current;
    if (!summary) return;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [errorNudge, prefersReducedMotion]);

  /**
   * What the button will do, before it is pressed.
   *
   * Asking the Permissions API is not a request: it reports what the browser
   * already decided, so the label can say "this will ask you" rather than the
   * page finding out by firing a prompt at someone who has not asked for one.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const sync = () => {
      if (!cancelled && status) setGpsPermission(status.state);
    };

    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setGpsPermission(result.state);
        result.addEventListener('change', sync);
      })
      .catch(() => {
        /* Safari only learned this recently; the button still works */
      });

    return () => {
      cancelled = true;
      status?.removeEventListener('change', sync);
    };
  }, []);

  const hasContent =
    address.trim() !== '' ||
    title.trim() !== '' ||
    description.trim() !== '' ||
    price !== '' ||
    rooms !== '' ||
    area !== '' ||
    images.length > 0 ||
    telegram.trim() !== '';

  const draft = useMemo<Draft>(
    () => ({
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      step,
      maxStep,
      region,
      district,
      address,
      metro,
      metroMinutes,
      latitude,
      longitude,
      title,
      description,
      propertyType,
      price,
      deposit,
      rooms,
      area,
      landArea,
      floor,
      totalFloors,
      amenities,
      isRoommate,
      categoryChosen,
      roommateGender,
      roommateSpots,
      images,
      sellerType,
      agencyName,
      telegram,
      preferredTime,
      topRequested,
      topDays,
      topNote,
    }),
    [
      step, maxStep, region, district, address, metro, metroMinutes, latitude,
      longitude, title, description, propertyType, price, deposit, rooms, area,
      landArea, floor, totalFloors, amenities, isRoommate, categoryChosen, roommateGender, roommateSpots,
      images, sellerType, agencyName, telegram, preferredTime, topRequested,
      topDays, topNote,
    ],
  );

  // Debounced, because the alternative is serialising several megabytes of
  // photos on every keystroke in the description box.
  useEffect(() => {
    if (!hasContent) return;
    const timer = setTimeout(() => {
      setPhotosDropped(writeDraft(draftKey, draft) === 'photosDropped');
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, draftKey, hasContent]);

  // -- Gates -----------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.signInTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.signInBody')}</p>
        <Button type="button" fullWidth onClick={() => setShowAuth(true, 'LOGIN')}>
          {t('common.action.signIn')}
        </Button>
      </div>
    );
  }

  if (!canPublishListings(currentUser.role)) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Building2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.studentTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.studentBody')}</p>
        <Button
          type="button"
          fullWidth
          onClick={() => {
            void switchRole('OWNER').catch(() => pushToast('owner.gate.switchFailed', 'error'));
          }}
        >
          {t('owner.gate.switchToOwner')}
        </Button>
        <Button type="button" variant="secondary" fullWidth onClick={() => setCurrentView('LISTINGS')}>
          {t('owner.gate.browseCta')}
        </Button>
      </div>
    );
  }

  // -- Errors ----------------------------------------------------------------
  /** Clears one field's error the moment it is corrected, not on the next
   *  "Next" press — the old behaviour left a red field under a fixed value. */
  const clearError = (field: string) =>
    setFormErrors((current) => (current[field] ? { ...current, [field]: '' } : current));

  const numberHandler =
    (set: (value: NumberField) => void, field: string) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      set(raw === '' ? '' : Number(raw));
      clearError(field);
    };

  // -- Media handlers --------------------------------------------------------
  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      pushToast('owner.create.photos.limitReached', 'warning', { max: MAX_IMAGES });
      return;
    }
    if (files.length > room) {
      pushToast('owner.create.photos.limitNotice', 'warning', { max: MAX_IMAGES });
    }

    const pictures = files.filter((file) => file.type.startsWith('image/')).slice(0, room);
    if (pictures.length === 0) {
      // Some phones and file managers report an empty MIME type. Everything
      // picked was dropped here, and saying so beats a "choose photos" button
      // that appears to do nothing at all.
      pushToast('owner.create.photos.readFailed', 'error');
      return;
    }

    setProcessingImages(true);
    try {
      const results = await Promise.all(pictures.map(prepareImage));
      // Deduplicated against the batch as well as against what is already
      // there: the same photo picked twice is never intentional, and two
      // identical entries cannot be told apart once they are in a list the
      // owner can reorder. Comparing only against `images` missed a duplicate
      // dragged in alongside its own copy, because both were new.
      const seen = new Set(images);
      const accepted: string[] = [];
      for (const result of results) {
        if (!result.ok || seen.has(result.dataUrl)) continue;
        seen.add(result.dataUrl);
        accepted.push(result.dataUrl);
      }
      if (results.some((result) => !result.ok)) {
        pushToast('owner.create.photos.readFailed', 'error');
      }
      if (accepted.length > 0) {
        setImages((current) => [...current, ...accepted]);
        clearError('images');
        clearError('payload');
        haptics.success();
      }
    } finally {
      setProcessingImages(false);
    }
  };

  const handleImageInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(files);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    haptics.select();
  };

  // GPS has answered and the coordinates are on the form.
  const located = latitude !== null && longitude !== null;

  const detectLocation = () => {
    setGpsError(null);
    setGpsNotice(null);

    if (!('geolocation' in navigator)) {
      setGpsError({ key: 'owner.create.location.gpsUnsupported' });
      return;
    }

    haptics.tap();
    setGpsBusy(true);
    setGpsNotice({ key: 'owner.create.location.gpsSearching' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLng = position.coords.longitude;
        setLatitude(nextLat);
        setLongitude(nextLng);
        setGpsNotice({ key: 'owner.create.location.gpsSuccess' });

        void reverseGeocode(nextLat, nextLng)
          .then((match) => {
            // `reverseGeocode` guarantees the district belongs to the region,
            // so these two can be applied together without the dropdown
            // falling back to its em-dash placeholder.
            setRegion(match.region);
            setDistrict(match.district);
            if (match.street) {
              setAddress(match.street);
              clearError('address');
              setGpsNotice({
                key: 'owner.create.location.gpsFound',
                params: {
                  region: match.region,
                  district: match.district,
                  address: match.street,
                },
              });
            } else {
              // No street name came back: keep the field for the owner to fill
              // rather than writing a placeholder sentence into their address.
              setGpsNotice({
                key: 'owner.create.location.gpsCoordinates',
                params: { latitude: nextLat.toFixed(4), longitude: nextLng.toFixed(4) },
              });
            }
            haptics.success();
          })
          .finally(() => setGpsBusy(false));
      },
      // The old callback took no parameter at all, so a timeout and a refusal
      // both told the owner they had denied permission and sent them into the
      // browser settings to fix something that was not broken.
      (error: GeolocationPositionError) => {
        setGpsBusy(false);
        setGpsNotice(null);
        setGpsError({
          key: GPS_ERROR_KEYS[error.code] ?? 'owner.create.location.gpsUnavailable',
        });
        haptics.warn();
      },
      // `enableHighAccuracy` asks for the GPS chip instead of a coarse WiFi or
      // IP fix, `maximumAge` accepts a fix from the last minute rather than
      // forcing a cold one, and 15s is what a cold fix actually costs outdoors.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  // -- Validation ------------------------------------------------------------
  const validateStep = (target: number): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (target === 1) {
      if (title.trim().length < 8) errors.title = 'owner.create.validation.title';
      else if (title.trim().length > MAX_TITLE_LENGTH) errors.title = 'common.error.validation';
      if (description.trim().length < 20) errors.description = 'owner.create.validation.description';
      else if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
        errors.description = 'common.error.validation';
      }
      if (price === '' || price <= 0) errors.price = 'owner.create.validation.price';
      if (deposit !== '' && deposit < 0) errors.deposit = 'owner.create.validation.deposit';
      if (propertyType !== 'LAND') {
        if (rooms === '' || rooms < 1) errors.rooms = 'common.state.required';
      }
      if (area !== '' && area <= 0) errors.area = 'owner.create.validation.area';
      if (landArea !== '' && landArea <= 0) errors.landArea = 'common.error.validation';
      if (propertyType !== 'LAND') {
        if (
          (floor !== '' && floor < 1) ||
          (totalFloors !== '' && totalFloors < 1) ||
          (floor !== '' && totalFloors !== '' && floor > totalFloors)
        ) {
          errors.floor = 'owner.create.validation.floor';
        }
      }
    }

    if (target === 2) {
      if (!address.trim()) errors.address = 'owner.create.validation.address';
      if (
        metro !== METRO_NONE &&
        (metroMinutes === '' || metroMinutes < 1 || metroMinutes > 60)
      ) {
        errors.metroMinutes = 'owner.create.validation.metroMinutes';
      }
    }

    // Photos and contact share the last step, so they share its rules. The
    // photo gate is the only blocking one: at least one picture, and a body
    // the gateway will still accept.
    if (target === 3) {
      if (images.length < MIN_IMAGES) errors.images = 'owner.create.validation.images';
      if (payloadTooLarge) errors.payload = 'owner.create.validation.imagesTooLarge';
      if ((currentUser.phone ?? '').replace(/\D/g, '').length < 9) {
        errors.phone = 'owner.create.validation.phone';
      }
      // The Telegram pattern already caps its own length at 33 characters,
      // well inside the schema's 64, so only the free-text box needs the rule.
      if (telegram.trim() && !TELEGRAM_PATTERN.test(telegram.trim())) {
        errors.telegram = 'owner.create.validation.telegram';
      }
      if (preferredTime.trim().length > MAX_CONTACT_TIME_LENGTH) {
        errors.preferredTime = 'common.error.validation';
      }
      // Only when it is going to be sent. The box is prefilled from the
      // profile, where the name was stored under the same 120-character cap,
      // so this catches a paste rather than the prefill.
      if (
        sellerType === 'AGENT' &&
        agencyName.trim().length > MAX_AGENCY_NAME_LENGTH
      ) {
        errors.agency = 'common.error.validation';
      }
    }

    return errors;
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    // Walking backwards never has to be earned.
    if (target < step) {
      setStep(target);
      return;
    }
    // Every step between here and there is checked, not only the one being
    // left. Now that a step already reached stays tappable, walking back to
    // step 1 and tapping straight through to 3 would otherwise carry an
    // emptied step 2 past its own gate. The first one that fails is where the
    // owner lands, so the message is on the screen that can fix it.
    for (let candidate = step; candidate < target; candidate += 1) {
      const errors = validateStep(candidate);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setErrorNudge((count) => count + 1);
        haptics.warn();
        setStep(candidate);
        return;
      }
    }
    setFormErrors({});
    haptics.select();
    setStep(target);
    setMaxStep((furthest) => Math.max(furthest, target));
  };

  const firstInvalidStep = (): number | null => {
    for (const candidate of [1, 2, 3]) {
      const errors = validateStep(candidate);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return candidate;
      }
    }
    setFormErrors({});
    return null;
  };

  // -- Submit ----------------------------------------------------------------
  /**
   * No GPS and no known centre means no coordinates.
   *
   * The fallback used to be the centre of Tashkent for every district in the
   * country that is not in the table, so a flat in G'ijduvon was published at
   * 41.311/69.279 and drawn on the map 450km from the building. The API takes
   * both as null together, and a listing with no point is one the map declares
   * unplaced instead of placing wrongly.
   */
  const coordinates = (): { latitude: number | null; longitude: number | null } => {
    if (latitude !== null && longitude !== null) return { latitude, longitude };
    const fallback = districtCentre(district);
    return fallback
      ? { latitude: fallback[0], longitude: fallback[1] }
      : { latitude: null, longitude: null };
  };

  const handleSubmit = async () => {
    const invalidStep = firstInvalidStep();
    if (invalidStep !== null) {
      haptics.warn();
      // Counted rather than left to the step change, which is usually no
      // change at all: the field that failed is nearly always on step 3, the
      // step the Publish button is on.
      setErrorNudge((count) => count + 1);
      setStep(invalidStep);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const point = coordinates();
    // `sellerType` is already clamped to what this account may claim — when
    // the draft is read and again whenever the role changes under the form —
    // so this reads the same answer the segment is showing rather than
    // correcting it behind the owner's back. It stays written through the
    // capability because a publish that disagrees with the screen is the one
    // failure this must not have. The API normalises the same way.
    // If posting as an agent but account hasn't switched role yet, switch automatically
    if (sellerType === 'AGENT' && currentUser?.role !== 'AGENT' && isSwitchableRole(currentUser?.role)) {
      try {
        await switchRole('AGENT');
      } catch {
        // continue
      }
    }

    const publishAsAgent = (canActAsAgent || currentUser?.role === 'AGENT') && sellerType === 'AGENT';
    // Only owner-editable fields: anything the server owns (status, scores,
    // counters, ownerId) makes the request fail validation with 422. Optional
    // numbers travel as null rather than 0 — `area` is validated `gt=0`, so a
    // zero is rejected outright.
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      price: price === '' ? null : price,
      currency: 'UZS',
      depositPrice: deposit === '' ? null : deposit,
      utilitiesIncluded: amenities.utilitiesIncluded,
      rooms: propertyType === 'LAND' ? (rooms === '' ? 1 : rooms) : (rooms === '' ? null : rooms),
      area: area === '' ? null : area,
      landArea: landArea === '' ? null : landArea,
      floor: propertyType === 'LAND' ? null : (floor === '' ? null : floor),
      totalFloors: propertyType === 'LAND' ? null : (totalFloors === '' ? null : totalFloors),
      propertyType,
      region,
      district,
      address: address.trim(),
      latitude: point.latitude,
      longitude: point.longitude,
      metroStation: metro === METRO_NONE ? null : metro,
      metroDistanceMinutes: metro === METRO_NONE || metroMinutes === '' ? null : metroMinutes,
      furnished: amenities.furnished,
      petsAllowed: amenities.petsAllowed,
      parking: amenities.parking,
      internet: amenities.internet,
      airConditioning: amenities.airConditioning,
      washingMachine: amenities.washingMachine,
      images,
      hasVirtualTour: false,
      sellerType: publishAsAgent ? 'AGENT' : 'OWNER',
      agencyName: publishAsAgent ? agencyName.trim() || null : null,
      contactTelegram: telegram.trim() || null,
      preferredContactTime: preferredTime.trim() || null,
      isRoommate,
      roommateGender: isRoommate ? roommateGender : null,
      roommateSpotsAvailable: isRoommate ? roommateSpots : null,
    };

    try {
      const response = await ListingsApi.create(payload);
      // A 201 is the whole answer: the listing is published. Everything below
      // is about the optional promotion, and none of it can undo that.
      clearDraft(draftKey);
      haptics.success();
      pushToast('layout.toast.listingCreated', 'success');

      if (topRequested) {
        // The listing id exists only now, so this is the one moment the Top
        // request can be sent without making the owner go and find the
        // listing again. A failure here is a failed promotion, never a failed
        // publish, and the sheet says so in those words.
        try {
          await ListingsApi.requestTop(response.data.id, {
            days: topDays,
            note: topNote.trim() || null,
          });
          setTopOutcome('sent');
        } catch {
          setTopOutcome('failed');
        }
        void fetchMyListings();
        // The sheet is what moves the owner on, so the view does not change
        // out from under the message that has just been put in front of them.
        return;
      }

      void fetchMyListings();
      setCurrentView('MY_LISTINGS');
    } catch (error) {
      // Five creates an hour is a real cap and the bare catch used to render it
      // as "no internet", which sends the owner to reload and try again.
      if (error instanceof ApiError && error.code === 'listing_limit_reached') {
        setSubmitError(
          t('owner.create.validation.limitReached', {
            max: Number(error.params?.limit ?? 5),
          }),
        );
        pushToast('common.error.limitReached', 'warning');
      } else if (error instanceof ApiError && error.isRateLimited) {
        // The other 429. The router runs the in-process limiter (`enforce`)
        // before it counts the hour's listings, so hitting the cap normally
        // answers with the plain `rate_limited` code and no limit in it —
        // which the branch below used to render as "check your internet
        // connection", sending the owner off to reload a form that was
        // working and to try again into a wall that has not moved.
        setSubmitError(t('common.error.rateLimited'));
        pushToast('common.error.rateLimited', 'warning');
      } else if (error instanceof ApiError && error.status === 422) {
        // The server names the field it rejected. Marking that field and
        // opening its step is the difference between "check the data you
        // entered" and a red box around the box that is wrong.
        const target = error.field ? SERVER_FIELDS[error.field] : undefined;
        if (target) {
          setFormErrors({ [target.field]: 'common.error.validation' });
          // A server refusal about a step-3 field lands on the step already
          // showing, so it needs the same nudge the local rules do or the red
          // box appears somewhere nobody is looking.
          setErrorNudge((count) => count + 1);
          setStep(target.step);
        } else {
          setSubmitError(error.message || t('common.error.validation'));
        }
        pushToast('common.error.validation', 'error');
      } else {
        setSubmitError(t('owner.create.submitFailed'));
        pushToast('common.error.network', 'error');
      }
      haptics.warn();
    } finally {
      setSubmitting(false);
    }
  };

  /** Enter anywhere in the form now does what the visible button does. */
  const onFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 1 && !categoryChosen) return;
    if (step < TOTAL_STEPS) {
      goToStep(step + 1);
      return;
    }
    void handleSubmit();
  };

  // -- Draft -----------------------------------------------------------------
  const discardDraft = () => {
    clearDraft(draftKey);
    setDraftRestoredAt(null);
    setPhotosDropped(false);
    setStep(1);
    // The steps go back with it: nothing has been earned on a form that is
    // empty, so leaving 2 and 3 unlocked would offer a shortcut into a step
    // whose answers have just been thrown away.
    setMaxStep(1);
    setRegion(TASHKENT_CITY);
    setDistrict(
      (UZBEKISTAN_REGIONS.find((item) => item.name === TASHKENT_CITY) ?? UZBEKISTAN_REGIONS[0])
        .districts[0],
    );
    setAddress('');
    setMetro(METRO_NONE);
    setMetroMinutes('');
    setLatitude(null);
    setLongitude(null);
    setTitle('');
    setDescription('');
    setPropertyType('APARTMENT');
    setPrice('');
    setDeposit('');
    setRooms('');
    setArea('');
    setLandArea('');
    setFloor('');
    setTotalFloors('');
    setAmenities(NO_AMENITIES);
    setIsRoommate(false);
    setCategoryChosen(false);
    setRoommateGender('ANY');
    setRoommateSpots(1);
    setImages([]);
    setSellerType(defaultSellerType);
    // Back to the profile's name rather than to nothing: that is what an
    // untouched form shows an agency account, and discarding a draft asks for
    // an empty form, not a stripped account.
    setAgencyName(currentUser.agencyName ?? '');
    setTelegram('');
    setPreferredTime('');
    setFormErrors({});
    // A discarded draft takes the Top choice with it: the listing the owner
    // rebuilds from scratch is not the one they asked to promote.
    setTopRequested(false);
    setTopDays(DEFAULT_TOP_DAYS);
    setTopNote('');
    pushToast('owner.create.draft.discarded', 'info');
  };

  const requestLeave = () => {
    if (!hasContent) {
      setCurrentView('HOME');
      return;
    }
    setConfirmLeave(true);
  };

  /** The only way out of the Top confirmation, whichever way it went. */
  const finishAfterTop = () => {
    setTopOutcome(null);
    setCurrentView('MY_LISTINGS');
  };

  // -- Render helpers --------------------------------------------------------
  const stepMeta = [
    {
      num: 1,
      title: !categoryChosen
        ? 'Toifani tanlash'
        : isRoommate
          ? 'Sheriklik ma’lumotlari'
          : sellerType === 'AGENT'
            ? 'Rieltor ma’lumotlari'
            : t('owner.create.steps.detailsTitle'),
      hint: !categoryChosen
        ? 'Mulk egasi, Rieltor yoki Sheriklikka'
        : t('owner.create.steps.detailsHint'),
    },
    { num: 2, title: t('owner.create.steps.locationTitle'), hint: t('owner.create.steps.locationHint') },
    { num: 3, title: t('owner.create.steps.photosTitle'), hint: t('owner.create.steps.photosHint') },
  ];

  // Deduplicated: two fields can now fail on the same shared message, and the
  // summary below keys its list by the message itself.
  const errorKeys = [...new Set(Object.values(formErrors).filter(Boolean))];
  const usdPrice = price !== '' && fxRate > 0 ? Math.round(price / fxRate) : null;

  const stepBadge = (
    <span className="shrink-0 rounded-lg border border-line bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-text">
      {t('owner.create.stepBadge', { step })}
    </span>
  );

  const headingClass =
    'flex items-center gap-2 text-lg font-extrabold text-content outline-none';

  /** The line under the GPS button says what pressing it will do. */
  const gpsHintKey =
    gpsPermission === 'denied'
      ? 'owner.create.location.gpsDenied'
      : gpsPermission === 'prompt'
        ? 'owner.create.location.gpsPrompt'
        : 'owner.create.location.gpsHint';

  // `overflow-x-clip` on the page container rather than `overflow-x-hidden`:
  // hidden makes the element a scroll container, and nothing inside a scroll
  // container can stick to the viewport — which is what the action bar below
  // and the tips rail beside it both need to do.
  const pageClass =
    'mx-auto w-full min-h-[85vh] max-w-6xl space-y-6 overflow-x-clip px-4 py-6 pb-40 ' +
    'sm:space-y-8 sm:px-6 sm:py-10 lg:pb-16';

  return (
    <div className={pageClass}>
      <div className="space-y-3 border-b border-line pb-4 sm:space-y-4 sm:pb-5">
        <nav aria-label={t('owner.create.breadcrumb')} className="hidden sm:block">
          <ol className="flex items-center gap-2 text-xs font-semibold text-subtle">
            <li>
              <button
                type="button"
                onClick={requestLeave}
                className="transition-colors hover:text-brand-text"
              >
                {t('layout.nav.home')}
              </button>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-bold text-content" aria-current="page">
              {t('owner.create.breadcrumb')}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-content sm:text-3xl">
              {t('owner.create.title')}
            </h1>
            <p className="mt-1 text-xs font-medium text-muted sm:text-sm">
              {t('owner.create.subtitle')}
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="press self-start sm:self-center"
            onClick={requestLeave}
          >
            {t('common.action.cancel')}
          </Button>
        </div>
      </div>

      {draftRestoredAt !== null && (
        <div className="flex flex-col gap-2 rounded-2xl border border-brand/25 bg-brand-soft p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="flex items-start gap-2 text-xs font-bold text-brand-text">
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
              {/* The date, not just the clock. "Restored the draft saved at
                  14:32" reads as "a few hours ago" whether it was saved this
                  morning or in March, and the March one publishes March's
                  price. */}
              <span>
                {t('owner.create.draft.restoredAt', {
                  time: formatDate(draftRestoredAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </span>
            </p>
            {/* The photos did not fit in storage, so the restored draft has
                none — said here rather than left to be discovered by an empty
                grid on step 3. */}
            {photosDropped && (
              <p className="flex items-start gap-2 text-xs font-semibold text-warning">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('owner.create.draft.photosDropped')}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discardDraft}
              className="press min-h-11 rounded-xl border border-line bg-surface px-3 text-xs font-extrabold text-danger"
            >
              {t('owner.create.draft.discard')}
            </button>
            <button
              type="button"
              onClick={() => setDraftRestoredAt(null)}
              className="press min-h-11 rounded-xl px-3 text-xs font-extrabold text-brand-text"
            >
              {t('common.action.dismiss')}
            </button>
          </div>
        </div>
      )}

      {/*
        Step navigation, in two forms.

        On a phone the cards below stacked into a block that pushed the first
        field most of a screen down — on every step, so the form was
        the thing you had to scroll to reach. The compact bar shows the same
        state in one row: which step, how many are left, and how far along the
        page is. The cards return from `sm:` up, where the width is free.
      */}
      <div className="space-y-2.5 sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-black text-content">
            {stepMeta[step - 1]?.title}
          </p>
          <p className="shrink-0 text-[11px] font-bold text-muted">
            {t('owner.create.stepCounter', { current: step, total: TOTAL_STEPS })}
          </p>
        </div>

        <ol className="flex items-center gap-1.5">
          {stepMeta.map((item) => {
            const isDone = item.num < maxStep;
            const isActive = step === item.num;
            return (
              <li key={item.num} className="flex-1">
                {/* Every step already reached stays tappable, ahead as well as
                    behind: going back to fix the district used to lock the
                    photos you had already uploaded behind two "next" presses.
                    A step nobody has reached is still not a link to anywhere. */}
                <button
                  type="button"
                  onClick={() => goToStep(item.num)}
                  disabled={item.num > maxStep}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${item.num}. ${item.title}`}
                  className={cn(
                    'h-1.5 w-full touch-manipulation rounded-full transition-colors disabled:cursor-not-allowed',
                    isActive || isDone ? 'bg-brand' : 'bg-line',
                  )}
                />
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step navigation. Every step already reached stays reachable, in both
          directions; the ones beyond it do not. The check mark is kept for a
          step whose gate has actually been cleared, so the furthest step —
          reached but not finished — is tappable without claiming to be done. */}
      <ol className="hidden gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3">
        {stepMeta.map((item) => {
          const isActive = step === item.num;
          const isDone = item.num < maxStep;
          return (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => goToStep(item.num)}
                disabled={item.num > maxStep}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'press-sm relative w-full overflow-hidden rounded-2xl border p-3.5 text-left',
                  'transition-all disabled:cursor-not-allowed sm:p-4',
                  isActive
                    ? 'border-brand bg-brand text-on-brand shadow-brand'
                    : isDone
                      ? 'border-line bg-brand-soft text-brand-text hover:bg-brand-soft-2'
                      : 'border-line bg-surface text-subtle',
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-black',
                      isActive
                        ? 'bg-surface text-brand-text'
                        : isDone
                          ? 'bg-brand text-on-brand'
                          : 'bg-surface-2 text-subtle',
                    )}
                  >
                    {/* The step you are standing on keeps its number even
                        once it has been cleared, or the header would show a
                        tick where the "you are here" marker belongs. */}
                    {isDone && !isActive ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      item.num
                    )}
                  </span>
                  <span className="text-[10px] font-bold">
                    {t('owner.create.stepCounter', { current: item.num, total: TOTAL_STEPS })}
                  </span>
                </span>
                <span className="mt-2.5 block text-xs font-black sm:text-sm">{item.title}</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium opacity-80">
                  {item.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {/* One <form>, so Enter submits the step instead of doing nothing. */}
        <form
          noValidate
          onSubmit={onFormSubmit}
          className="space-y-6 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-8 lg:col-span-2"
        >
          {errorKeys.length > 0 && (
            <div
              ref={errorSummaryRef}
              // Focusable by script only. The effect above moves focus here
              // after a refused press, and a `-1` tabindex is what lets it
              // without adding a stop to the tab order the owner has to walk
              // past on every pass through the form.
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger outline-none"
            >
              <p className="flex items-center gap-2 font-black">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('owner.create.errorsTitle')}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-semibold">
                {errorKeys.map((key) => (
                  <li key={key}>
                    {tRaw(key, { max: MAX_PAYLOAD_MB, size: payloadMb.toFixed(1) })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---------------------------------------------------- STEP 2: LOCATION --- */}
          {step === 2 && (
            <section className="space-y-5" aria-labelledby="owner-step-location">
              <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <h2 id="owner-step-location" ref={headingRef} tabIndex={-1} className={headingClass}>
                    <MapPin className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    {t('owner.create.location.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t('owner.create.location.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

              {/* First, because it fills the three fields below it — everything
                  underneath is a correction rather than data entry. Prominence
                  here is position and width, not colour: a filled brand panel
                  made the shortcut louder than the form's actual subject.

                  The prompt stays attached to this press. Chrome blocks a
                  geolocation request that is not tied to a gesture, and an
                  unexplained permission dialog on first paint is the fastest
                  way to lose someone who has not yet decided to trust the
                  site — so the line underneath says what the press will do. */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant={located ? 'secondary' : 'primary'}
                  fullWidth
                  className="press"
                  onClick={detectLocation}
                  loading={gpsBusy}
                >
                  {located ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                  )}
                  {gpsBusy
                    ? t('owner.create.location.gpsDetecting')
                    : located
                      ? t('owner.create.location.gpsDetected')
                      : t('owner.create.location.gpsDetect')}
                </Button>

                <p className="text-center text-[11px] font-medium text-subtle">
                  {tRaw(gpsHintKey)}
                </p>

                {gpsNotice && (
                  <p className="flex items-start gap-2 rounded-xl border border-brand/25 bg-brand-soft px-3 py-2.5 text-xs font-semibold text-brand-text">
                    <MapPin className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{tRaw(gpsNotice.key, gpsNotice.params)}</span>
                  </p>
                )}
                {gpsError && <FormError message={tRaw(gpsError.key, gpsError.params)} />}
              </div>

              {/* Everything GPS fills stays editable: it is a shortcut, not a
                  verdict, and it is wrong often enough outside the capital. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('owner.create.location.regionLabel')}>
                  {({ id }) => (
                    <SelectInput
                      id={id}
                      value={region}
                      onChange={(event) => {
                        const nextRegion = event.target.value;
                        setRegion(nextRegion);
                        const match = UZBEKISTAN_REGIONS.find(
                          (item) => item.name === nextRegion,
                        );
                        if (match) setDistrict(match.districts[0]);
                      }}
                    >
                      {UZBEKISTAN_REGIONS.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>

                <Field label={t('owner.create.location.districtLabel')}>
                  {({ id }) => (
                    <SelectInput
                      id={id}
                      value={district}
                      onChange={(event) => setDistrict(event.target.value)}
                    >
                      {activeRegion.districts.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              </div>

              <Field
                label={t('owner.create.location.addressLabel')}
                required
                error={formErrors.address ? tRaw(formErrors.address) : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      if (event.target.value.trim()) clearError('address');
                    }}
                    placeholder={t('owner.create.location.addressPlaceholder')}
                  />
                )}
              </Field>

              {/* Only Tashkent has a metro, so outside it this asked a question
                  with no answer. Inside it, every station was listed open by
                  default: a 240px nested scroll area sitting between the
                  address and the button that leaves the step. It is now a row
                  that states the choice and opens on demand. */}
              {hasMetro && (
                <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">
                        {t('owner.create.location.metroLabel')}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black text-content">
                        {metro === METRO_NONE ? t('owner.create.location.metroNone') : metro}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMetroOpen((open) => !open)}
                      aria-expanded={metroOpen}
                      className="press min-h-11 shrink-0 rounded-xl border border-line bg-surface px-3 text-xs font-extrabold text-brand-text transition-colors hover:bg-surface-3"
                    >
                      {metroOpen
                        ? t('common.action.close')
                        : metro === METRO_NONE
                          ? t('owner.create.location.metroChoose')
                          : t('common.action.edit')}
                    </button>
                  </div>

                  {metroOpen && (
                    <div className="space-y-2">
                      <TextInput
                        value={metroQuery}
                        onChange={(event) => setMetroQuery(event.target.value)}
                        placeholder={t('owner.create.location.metroSearch')}
                        aria-label={t('owner.create.location.metroSearch')}
                      />

                      <div className="max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMetro(METRO_NONE);
                            setMetroMinutes('');
                            setMetroOpen(false);
                            setMetroQuery('');
                          }}
                          className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-muted transition-colors hover:bg-surface-2"
                        >
                          {t('owner.create.location.metroNone')}
                        </button>

                        {visibleMetroLines.map((line) => (
                          <div key={line.id} className="mt-2 first:mt-0">
                            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                              {line.name}
                            </p>
                            {line.stations.map((station) => {
                              const isSelected = metro === station;
                              return (
                                <button
                                  key={station}
                                  type="button"
                                  onClick={() => {
                                    setMetro(isSelected ? METRO_NONE : station);
                                    setMetroOpen(false);
                                    setMetroQuery('');
                                  }}
                                  className={cn(
                                    'min-h-11 w-full rounded-lg px-3 text-left text-sm transition-colors',
                                    isSelected
                                      ? 'bg-brand font-bold text-on-brand'
                                      : 'text-content hover:bg-surface-2',
                                  )}
                                >
                                  {station}
                                </button>
                              );
                            })}
                          </div>
                        ))}

                        {visibleMetroLines.length === 0 && (
                          <p className="px-3 py-4 text-center text-xs text-subtle">
                            {t('owner.create.location.metroNoMatch')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Minutes only mean something once a station is named. */}
                  {metro !== METRO_NONE && (
                    <Field
                      label={t('owner.create.location.metroMinutesLabel')}
                      error={formErrors.metroMinutes ? tRaw(formErrors.metroMinutes) : undefined}
                    >
                      {({ id, describedBy, invalid }) => (
                        <TextInput
                          id={id}
                          aria-describedby={describedBy}
                          invalid={invalid}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={60}
                          value={metroMinutes === '' ? '' : metroMinutes}
                          onChange={numberHandler(setMetroMinutes, 'metroMinutes')}
                          placeholder="5"
                        />
                      )}
                    </Field>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ---------------------------------------------------- STEP 1: DETAILS --- */}
          {step === 1 && !categoryChosen && (
            <section className="space-y-6" aria-labelledby="owner-step-category">
              <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <h2 id="owner-step-category" ref={headingRef} tabIndex={-1} className={headingClass}>
                    <Building2 className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    E’lon toifasini tanlang
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    Qanday e’lon bermoqchisiz? Davom etish uchun kerakli toifani bosing:
                  </p>
                </div>
                {stepBadge}
              </header>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* 1. Mulk egasi */}
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setIsRoommate(false);
                    setSellerType('OWNER');
                    if (propertyType === 'ROOM' || propertyType === 'STUDIO' || propertyType === 'DORMITORY') {
                      setPropertyType('APARTMENT');
                    }
                    setCategoryChosen(true);
                  }}
                  className="press group relative flex flex-col items-start p-6 rounded-3xl border border-line bg-surface hover:border-brand/40 hover:bg-surface-2 transition-all text-left shadow-sm hover:shadow-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 transition-transform group-hover:scale-110">
                    <Home className="h-7 w-7 stroke-[2]" aria-hidden="true" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mb-2">
                    Vositachisiz ijara
                  </span>
                  <h3 className="font-extrabold text-base text-content mb-1">
                    Mulk egasi
                  </h3>
                  <p className="text-xs text-muted leading-relaxed mb-6 flex-1">
                    O‘z uyingiz, xonadoningiz yoki hovlingizni vositachisiz to‘g‘ridan-to‘g‘ri ijaraga bering.
                  </p>
                  <div className="w-full flex items-center justify-between text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">
                    <span>Mulk egasi sifatida to‘ldirish</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>

                {/* 2. Rieltor */}
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setIsRoommate(false);
                    setSellerType('AGENT');
                    if (currentUser?.role !== 'AGENT' && isSwitchableRole(currentUser?.role)) {
                      void switchRole('AGENT');
                    }
                    if (propertyType === 'ROOM' || propertyType === 'STUDIO' || propertyType === 'DORMITORY') {
                      setPropertyType('APARTMENT');
                    }
                    setCategoryChosen(true);
                  }}
                  className="press group relative flex flex-col items-start p-6 rounded-3xl border border-line bg-surface hover:border-brand/40 hover:bg-surface-2 transition-all text-left shadow-sm hover:shadow-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 transition-transform group-hover:scale-110">
                    <Briefcase className="h-7 w-7 stroke-[2]" aria-hidden="true" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 mb-2">
                    Agentlik / Makler
                  </span>
                  <h3 className="font-extrabold text-base text-content mb-1">
                    Rieltor (Agent)
                  </h3>
                  <p className="text-xs text-muted leading-relaxed mb-6 flex-1">
                    Mulk egasi nomidan ko‘chmas mulk agenti yoki agentlik sifatida e’lon joylashtiring.
                  </p>
                  <div className="w-full flex items-center justify-between text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">
                    <span>Rieltor sifatida to‘ldirish</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>

                {/* 3. Sheriklikka */}
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setIsRoommate(true);
                    setSellerType('OWNER');
                    if (propertyType === 'LAND' || propertyType === 'COMMERCIAL') {
                      setPropertyType('ROOM');
                    }
                    setCategoryChosen(true);
                  }}
                  className="press group relative flex flex-col items-start p-6 rounded-3xl border border-line bg-surface hover:border-brand/40 hover:bg-surface-2 transition-all text-left shadow-sm hover:shadow-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-4 transition-transform group-hover:scale-110">
                    <Users className="h-7 w-7 stroke-[2]" aria-hidden="true" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 mb-2">
                    Xonadosh / Talaba
                  </span>
                  <h3 className="font-extrabold text-base text-content mb-1">
                    Sheriklikka
                  </h3>
                  <p className="text-xs text-muted leading-relaxed mb-6 flex-1">
                    Kvartira yoki hovliga birga yashash uchun sherik (xonadosh) yoki talabalarni qidirish.
                  </p>
                  <div className="w-full flex items-center justify-between text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">
                    <span>Sheriklik e’lonini to‘ldirish</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              </div>
            </section>
          )}

          {step === 1 && categoryChosen && (
            <section className="space-y-5" aria-labelledby="owner-step-details">
              <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <h2 id="owner-step-details" ref={headingRef} tabIndex={-1} className={headingClass}>
                    <Building2 className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    {isRoommate
                      ? 'Sheriklik ma’lumotlari'
                      : sellerType === 'AGENT'
                        ? 'Rieltor va mulk ma’lumotlari'
                        : t('owner.create.details.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {isRoommate
                      ? 'Sheriklik shartlari, xona va to‘lov ma’lumotlarini kiriting'
                      : sellerType === 'AGENT'
                        ? 'Agentlik va ijara obyekti haqida ma’lumotlarni to‘ldiring'
                        : t('owner.create.details.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

              {/* Tanlangan toifa va o'zgartirish tugmasi */}
              <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-line bg-surface-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    {isRoommate ? (
                      <Users className="h-5 w-5" />
                    ) : sellerType === 'AGENT' ? (
                      <Briefcase className="h-5 w-5" />
                    ) : (
                      <Home className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-muted block">Tanlangan toifa</span>
                    <p className="text-sm font-black text-content">
                      {isRoommate
                        ? 'Sheriklikka (Xonadosh qidirish)'
                        : sellerType === 'AGENT'
                          ? 'Ko‘chmas mulk agenti (Rieltor)'
                          : 'Mulk egasi (Vositachisiz)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setCategoryChosen(false);
                  }}
                  className="press flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-line bg-surface hover:bg-surface-3 text-content shadow-sm transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted" />
                  <span>Toifani o‘zgartirish</span>
                </button>
              </div>

              {!isRoommate && sellerType === 'AGENT' && (
                <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300">
                    <Briefcase className="h-4 w-4" aria-hidden="true" />
                    <span>Rieltor / Agentlik ma’lumotlari</span>
                  </div>
                  <Field
                    label={t('owner.create.seller.agencyLabel')}
                    hint={t('owner.create.seller.agencyHint')}
                    error={formErrors.agency ? tRaw(formErrors.agency) : undefined}
                  >
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        value={agencyName}
                        maxLength={MAX_AGENCY_NAME_LENGTH}
                        autoComplete="organization"
                        placeholder={t('owner.create.seller.agencyPlaceholder')}
                        onChange={(event) => setAgencyName(event.target.value)}
                      />
                    )}
                  </Field>
                </div>
              )}

              {isRoommate && (
                <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-warning">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.details.roommateHeading')}</span>
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('owner.create.details.roommateGenderLabel')}>
                      {({ id }) => (
                        <SelectInput
                          id={id}
                          value={roommateGender}
                          onChange={(event) =>
                            setRoommateGender(event.target.value as RoommateGender)
                          }
                        >
                          <option value="ANY">
                            {t('owner.create.details.roommateGenderAny')}
                          </option>
                          <option value="BOYS">
                            {t('owner.create.details.roommateGenderBoys')}
                          </option>
                          <option value="GIRLS">
                            {t('owner.create.details.roommateGenderGirls')}
                          </option>
                        </SelectInput>
                      )}
                    </Field>

                    <Field label={t('owner.create.details.roommateSpotsLabel')}>
                      {({ id }) => (
                        <SelectInput
                          id={id}
                          value={roommateSpots}
                          onChange={(event) => setRoommateSpots(Number(event.target.value))}
                        >
                          {[1, 2, 3].map((count) => (
                            <option key={count} value={count}>
                              {t('owner.create.details.roommateSpotsOption', { count })}
                            </option>
                          ))}
                          <option value={4}>
                            {t('owner.create.details.roommateSpotsPlus', { count: 4 })}
                          </option>
                        </SelectInput>
                      )}
                    </Field>
                  </div>
                </div>
              )}

              <Field
                label={t('common.filters.propertyType')}
                error={formErrors.propertyType ? tRaw(formErrors.propertyType) : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <SelectInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={propertyType}
                    onChange={(event) => {
                      const nextType = event.target.value as PropertyType;
                      setPropertyType(nextType);
                      clearError('propertyType');
                      if (nextType === 'LAND' && rooms === '') {
                        setRooms(1);
                      }
                    }}
                  >
                    {(isRoommate ? PROPERTY_TYPES_ROOMMATE : PROPERTY_TYPES_OWNER).map((option) => (
                      <option key={option.value} value={option.value}>
                        {tRaw(option.labelKey)}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>

              <Field
                label={t('owner.create.details.titleLabel')}
                required
                error={formErrors.title ? tRaw(formErrors.title) : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={title}
                    maxLength={MAX_TITLE_LENGTH}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      clearError('title');
                    }}
                    placeholder={t('owner.create.details.titlePlaceholder')}
                  />
                )}
              </Field>

              <Field
                label={t('owner.create.details.descriptionLabel')}
                required
                error={formErrors.description ? tRaw(formErrors.description) : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <textarea
                    id={id}
                    rows={4}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    value={description}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      clearError('description');
                    }}
                    placeholder={t('owner.create.details.descriptionPlaceholder')}
                    className={textareaClass}
                  />
                )}
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t('owner.create.details.priceLabel')}
                  required
                  hint={
                    usdPrice === null
                      ? undefined
                      : t('owner.create.details.priceApprox', {
                          amount: formatPrice(usdPrice, 'USD'),
                        })
                  }
                  error={formErrors.price ? tRaw(formErrors.price) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100000}
                      value={price === '' ? '' : price}
                      onChange={numberHandler(setPrice, 'price')}
                      placeholder={t('owner.create.details.pricePlaceholder')}
                    />
                  )}
                </Field>

                <Field
                  label={t('owner.create.details.depositLabel')}
                  error={formErrors.deposit ? tRaw(formErrors.deposit) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100000}
                      value={deposit === '' ? '' : deposit}
                      onChange={numberHandler(setDeposit, 'deposit')}
                      placeholder={t('owner.create.details.depositPlaceholder')}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {propertyType !== 'LAND' && (
                  <Field
                    label={t('common.filters.rooms')}
                    required
                    error={formErrors.rooms ? tRaw(formErrors.rooms) : undefined}
                  >
                    {({ id, describedBy, invalid }) => (
                      <SelectInput
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        value={rooms === '' ? '' : rooms}
                        onChange={(event) => {
                          setRooms(event.target.value === '' ? '' : Number(event.target.value));
                          clearError('rooms');
                        }}
                      >
                        <option value="" disabled>
                          {t('owner.create.details.roomsPlaceholder')}
                        </option>
                        {[1, 2, 3].map((count) => (
                          <option key={count} value={count}>
                            {t('common.filters.roomsValue', { count })}
                          </option>
                        ))}
                        <option value={4}>{t('common.filters.roomsPlus', { count: 4 })}</option>
                      </SelectInput>
                    )}
                  </Field>
                )}

                <Field
                  label={propertyType === 'LAND' ? 'Umumiy maydon (m²)' : t('owner.create.details.areaLabel')}
                  error={formErrors.area ? tRaw(formErrors.area) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={area === '' ? '' : area}
                      onChange={numberHandler(setArea, 'area')}
                      placeholder={t('owner.create.details.areaPlaceholder')}
                    />
                  )}
                </Field>

                {/* Yer maydoni (sotix) — Mulk egasi / Rieltor va Hovli, Kottej, Yer maydoni uchun */}
                {(!isRoommate && (propertyType === 'HOUSE' || propertyType === 'LAND' || propertyType === 'COMMERCIAL')) && (
                  <Field
                    label="Yer maydoni (sotix)"
                    hint="Masalan: 4 yoki 6 sotix"
                    error={formErrors.landArea ? tRaw(formErrors.landArea) : undefined}
                  >
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        step={0.5}
                        value={landArea === '' ? '' : landArea}
                        onChange={numberHandler(setLandArea, 'landArea')}
                        placeholder="Masalan: 6"
                      />
                    )}
                  </Field>
                )}

                {propertyType !== 'LAND' && (
                  <>
                    <Field
                      label={t('owner.create.details.floorLabel')}
                      error={formErrors.floor ? tRaw(formErrors.floor) : undefined}
                    >
                      {({ id, describedBy, invalid }) => (
                        <TextInput
                          id={id}
                          aria-describedby={describedBy}
                          invalid={invalid}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={floor === '' ? '' : floor}
                          onChange={numberHandler(setFloor, 'floor')}
                          placeholder={t('owner.create.details.floorPlaceholder')}
                        />
                      )}
                    </Field>

                    <Field
                      label={t('owner.create.details.totalFloorsLabel')}
                      error={formErrors.totalFloors ? tRaw(formErrors.totalFloors) : undefined}
                    >
                      {({ id, describedBy, invalid }) => (
                        <TextInput
                          id={id}
                          aria-describedby={describedBy}
                          invalid={invalid}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={totalFloors === '' ? '' : totalFloors}
                          onChange={numberHandler(setTotalFloors, 'totalFloors')}
                          placeholder={t('owner.create.details.totalFloorsPlaceholder')}
                        />
                      )}
                    </Field>
                  </>
                )}
              </div>

              {/* Each amenity is a promise to a tenant, so each one is opted
                  into: the icon and the filled row make a ticked promise
                  visible at a glance rather than as a 16px checkbox. */}
              <fieldset className="space-y-2 pt-1">
                <legend className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('owner.create.details.amenitiesLabel')}
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {AMENITIES.map(({ key, labelKey, Icon }) => (
                    <label
                      key={key}
                      className={cn(
                        'press flex min-h-12 cursor-pointer touch-manipulation items-center gap-2.5',
                        'rounded-2xl border border-line bg-surface-2 p-3 text-xs font-bold text-content',
                        'transition-colors hover:bg-surface-3',
                        'has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-text',
                      )}
                    >
                      {/* The native input stays: it is what makes the row
                          focusable, toggleable with the space bar and
                          announced as a checkbox. */}
                      <input
                        type="checkbox"
                        checked={amenities[key]}
                        onChange={(event) =>
                          setAmenities((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 shrink-0 rounded border-line-2 text-brand accent-[var(--color-brand)] focus:ring-brand"
                      />
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{tRaw(labelKey)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          )}

          {/* ---------------------------------------------------- STEP 3 --- */}
          {step === 3 && (
            <section className="space-y-5" aria-labelledby="owner-step-photos">
              <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <h2 id="owner-step-photos" ref={headingRef} tabIndex={-1} className={headingClass}>
                    <Upload className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    {t('owner.create.photos.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t('owner.create.photos.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleImageInput}
              />

              {/* The dashed border and the word "drop" were a promise the card
                  did not keep: there were no drag handlers on it at all. */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={images.length >= MAX_IMAGES || processingImages}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverDropzone(true);
                }}
                onDragLeave={() => setDragOverDropzone(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverDropzone(false);
                  void addFiles(Array.from(event.dataTransfer.files ?? []));
                }}
                className={cn(
                  'press-sm w-full space-y-3 rounded-3xl border-2 border-dashed p-6 text-center',
                  'transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:p-8',
                  dragOverDropzone
                    ? 'border-brand bg-brand-soft-2'
                    : 'border-brand/50 bg-brand-soft hover:border-brand',
                )}
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft-2 text-brand-text">
                  {processingImages ? (
                    <span
                      className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                  ) : (
                    <Upload className="h-7 w-7" aria-hidden="true" />
                  )}
                </span>
                <span className="block text-sm font-extrabold text-content sm:text-base">
                  {t('owner.create.photos.dropTitle')}
                </span>
                <span className="mx-auto block max-w-sm text-xs font-medium text-muted">
                  {t('owner.create.photos.dropBody')}
                </span>
                <span className="inline-block rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-extrabold text-brand-text">
                  {t('owner.create.photos.dropCta', { count: images.length })}
                </span>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                <span className="text-subtle">
                  {t('owner.create.photos.countAndSizeHint', {
                    min: MIN_IMAGES,
                    max: MAX_IMAGES,
                    size: MAX_PAYLOAD_MB,
                  })}
                </span>
                <span className={payloadTooLarge ? 'text-danger' : 'text-subtle'}>
                  {t('owner.create.photos.sizeNotice', {
                    size: payloadMb.toFixed(1),
                    max: MAX_PAYLOAD_MB,
                  })}
                </span>
              </div>

              {payloadTooLarge && (
                <FormError
                  message={t('owner.create.validation.imagesTooLarge', {
                    size: payloadMb.toFixed(1),
                    max: MAX_PAYLOAD_MB,
                  })}
                />
              )}

              {images.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-extrabold text-muted">
                      {t('owner.create.photos.uploadedTitle')}
                    </p>
                    <p className="text-[11px] font-semibold text-subtle">
                      {t('owner.create.photos.remainingHint', {
                        count: MAX_IMAGES - images.length,
                      })}
                    </p>
                  </div>

                  {/* Order is the listing's cover photo, so it has to be
                      changeable. Drag works on a desktop pointer; on touch it
                      is two explicit buttons, because drag-to-reorder on a
                      touchscreen without a library is a pile of edge cases and
                      a target you cannot see under your own thumb. */}
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((image, index) => (
                      <li
                        key={image}
                        draggable
                        onDragStart={() => {
                          dragFromRef.current = index;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragFromRef.current !== null) {
                            moveImage(dragFromRef.current, index);
                          }
                          dragFromRef.current = null;
                        }}
                        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line"
                      >
                        <img
                          src={image}
                          alt={t('owner.create.photos.imageAlt', { index: index + 1 })}
                          className="h-full w-full object-cover"
                        />
                        {index === 0 && (
                          <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-0.5 text-[10px] font-extrabold text-on-brand shadow-card">
                            {t('owner.create.photos.coverBadge')}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t('owner.create.photos.removeImage', { index: index + 1 })}
                          onClick={() => {
                            setImages((current) => current.filter((_, item) => item !== index));
                            haptics.tap();
                          }}
                          className="press absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white shadow-card"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                          <button
                            type="button"
                            aria-label={t('common.a11y.scrollLeft')}
                            disabled={index === 0}
                            onClick={() => moveImage(index, index - 1)}
                            className="press flex h-11 w-11 items-center justify-center rounded-xl bg-black/45 text-white disabled:opacity-30"
                          >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t('common.a11y.scrollRight')}
                            disabled={index === images.length - 1}
                            onClick={() => moveImage(index, index + 1)}
                            className="press flex h-11 w-11 items-center justify-center rounded-xl bg-black/45 text-white disabled:opacity-30"
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-2xl border border-warning/40 bg-warning-soft p-4 text-xs font-medium text-warning">
                  {t('owner.create.photos.emptyHint')}
                </p>
              )}

              {/*
                Above the contact block rather than inside it, because it
                decides what the number underneath means: the person who owns
                the flat, or the agency letting it for them.

                Until this existed the form had no way to say either. Agencies
                signed up as owners and explained themselves in the
                description — "I run an agency and work as a realtor, but I am
                not allowed to post on the owner's behalf" — and a caller had
                no way to know who would answer the phone.
              */}
              <div className="min-w-0 border-t border-line pt-5">
                <h3 className={headingClass}>
                  <BadgeCheck className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  {t('owner.create.seller.heading')}
                </h3>
                <p className="mt-0.5 text-xs text-subtle">
                  {t('owner.create.seller.subheading')}
                </p>
              </div>

              <div className="space-y-2">
                <Segmented<SellerType>
                  value={sellerType}
                  onChange={(val) => {
                    setSellerType(val);
                    if (val === 'AGENT' && currentUser?.role !== 'AGENT' && isSwitchableRole(currentUser?.role)) {
                      void switchRole('AGENT');
                    }
                  }}
                  label={t('owner.create.seller.heading')}
                  size="sm"
                  options={[
                    {
                      value: 'OWNER',
                      label: t('owner.create.seller.owner'),
                      icon: Home,
                    },
                    {
                      value: 'AGENT',
                      label: t('owner.create.seller.agent'),
                      icon: Briefcase,
                    },
                  ]}
                />
                <p className="text-[11px] font-medium text-subtle">
                  {sellerType === 'AGENT'
                    ? t('owner.create.seller.agentHint')
                    : t('owner.create.seller.ownerHint')}
                </p>
              </div>

              {/* Optional even for an agency: an independent realtor has no
                  company name to give, and demanding one would be a second
                  reason not to tick the box that says what they are. */}
              {sellerType === 'AGENT' && (
                <Field
                  label={t('owner.create.seller.agencyLabel')}
                  hint={t('owner.create.seller.agencyHint')}
                  error={formErrors.agency ? tRaw(formErrors.agency) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={agencyName}
                      maxLength={MAX_AGENCY_NAME_LENGTH}
                      onChange={(event) => {
                        setAgencyName(event.target.value);
                        clearError('agency');
                      }}
                      placeholder={t('owner.create.seller.agencyPlaceholder')}
                      icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                    />
                  )}
                </Field>
              )}

              {/* Contact used to be a step of its own. With the video card and
                  the pre-publish check gone it was two optional boxes behind a
                  "next" press, so it moved here: the last step now asks for
                  the photos, who is letting the place, and who to ring. */}
              <div className="min-w-0 border-t border-line pt-5">
                <h3 className={headingClass}>
                  <Phone className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  {t('owner.create.contact.heading')}
                </h3>
                <p className="mt-0.5 text-xs text-subtle">
                  {t('owner.create.contact.subheading')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* The API takes the phone number from the account, so this is a
                    mirror of the profile rather than an editable field. */}
                <Field
                  label={t('owner.create.contact.phoneLabel')}
                  hint={t('owner.create.contact.phoneHint')}
                  error={formErrors.phone ? tRaw(formErrors.phone) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      readOnly
                      value={currentUser.phone || t('owner.create.contact.phoneMissing')}
                      icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                    />
                  )}
                </Field>

                <Field
                  label={t('owner.create.contact.telegramLabel')}
                  hint={t('owner.create.contact.telegramHint')}
                  error={formErrors.telegram ? tRaw(formErrors.telegram) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={telegram}
                      onChange={(event) => {
                        setTelegram(event.target.value);
                        clearError('telegram');
                      }}
                      placeholder={t('owner.create.contact.telegramPlaceholder')}
                      icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
                    />
                  )}
                </Field>
              </div>

              <Field
                label={t('owner.create.contact.timeLabel')}
                error={formErrors.preferredTime ? tRaw(formErrors.preferredTime) : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={preferredTime}
                    maxLength={MAX_CONTACT_TIME_LENGTH}
                    onChange={(event) => {
                      setPreferredTime(event.target.value);
                      clearError('preferredTime');
                    }}
                    placeholder={t('owner.create.contact.timePlaceholder')}
                    icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                  />
                )}
              </Field>

              {/*
                The Top offer, in the place the pre-publish check used to sit.

                It is a choice, not a gate: ticking it queues a request that is
                sent once the listing exists, and leaving it alone publishes
                exactly as before. Every button in here carries `type="button"`
                — the panel is inside the <form>, so an unmarked one would
                publish the listing instead of doing its own job.
              */}
              <Card tone="nested" padding="none" className="space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-black text-content">
                    <Rocket className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    {t('owner.create.top.title')}
                  </p>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-black text-brand-text">
                    {t('owner.create.top.free')}
                  </span>
                </div>

                <p className="text-xs font-medium leading-relaxed text-muted">
                  {t('owner.create.top.body')}
                </p>
                <p className="text-xs font-medium leading-relaxed text-subtle">
                  {t('owner.create.top.howItWorks')}
                </p>

                {topRequested ? (
                  <div className="space-y-3">
                    <p className="flex items-start gap-2 text-xs font-extrabold text-brand-text">
                      <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t('owner.create.top.selected')}</span>
                    </p>
                    <p className="text-[11px] font-medium leading-relaxed text-subtle">
                      {t('owner.create.top.selectedBody')}
                    </p>

                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-bold uppercase tracking-wider text-muted">
                        {t('owner.create.top.daysLabel')}
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        {TOP_DAYS_OPTIONS.map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setTopDays(days);
                              haptics.select();
                            }}
                            aria-pressed={topDays === days}
                            className={cn(
                              'press flex min-h-11 items-center justify-center rounded-2xl border',
                              'p-2.5 text-xs font-black transition-all',
                              topDays === days
                                ? 'border-brand bg-brand text-on-brand shadow-brand'
                                : 'border-line bg-surface-2 text-content hover:bg-surface-3',
                            )}
                          >
                            {t('owner.create.top.daysOption', { count: days })}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <Field label={t('owner.create.top.noteLabel')}>
                      {({ id }) => (
                        <TextInput
                          id={id}
                          value={topNote}
                          maxLength={MAX_TOP_NOTE_LENGTH}
                          onChange={(event) => setTopNote(event.target.value)}
                          placeholder={t('owner.create.top.notePlaceholder')}
                        />
                      )}
                    </Field>

                    <button
                      type="button"
                      onClick={() => {
                        setTopRequested(false);
                        haptics.tap();
                      }}
                      className="press min-h-11 text-xs font-extrabold text-danger underline"
                    >
                      {t('owner.create.top.cancel')}
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="press"
                    onClick={() => {
                      setTopRequested(true);
                      haptics.select();
                    }}
                  >
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.top.cta')}</span>
                  </Button>
                )}
              </Card>

              <FormError message={submitError} />
            </section>
          )}

          {/*
            One action row for all three steps.

            It follows the form down the page and parks itself just above the
            bottom navigation on a phone, which is where a thumb already is —
            the per-step button pairs it replaces sat at the end of a long
            scroll and were the reason "next" felt like something you had to go
            and find.
          */}
          <div
            className={cn(
              'sticky bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] z-20 -mx-4 flex gap-3',
              'border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur',
              'sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none',
            )}
          >
            {step > 1 && (
              <Button
                type="button"
                variant="secondary"
                className="press w-1/3"
                onClick={() => goToStep(step - 1)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>{t('common.action.back')}</span>
              </Button>
            )}

            {step < TOTAL_STEPS ? (
              step === 1 && !categoryChosen ? (
                <div className="w-full py-3.5 px-4 rounded-2xl bg-surface-2 border border-line text-center text-xs font-bold text-muted">
                  Davom etish uchun yuqoridagi 3 ta toifadan birini tanlang ☝️
                </div>
              ) : (
                <Button type="submit" className={cn('press', step > 1 ? 'w-2/3' : 'w-full')}>
                  <span>
                    {step === 1
                      ? t('owner.create.next.toLocation')
                      : t('owner.create.next.toPhotos')}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )
            ) : (
              // Only the payload cap can hold this button. Nothing about the
              // Top request may ever stop a listing being published.
              <Button
                type="submit"
                className="press w-2/3"
                loading={submitting}
                disabled={payloadTooLarge}
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <span>
                  {submitting ? t('owner.create.submitting') : t('owner.create.submit')}
                </span>
              </Button>
            )}
          </div>
        </form>

        {/*
          Side rail: what makes a listing rent quickly.

          There is no rail on a phone — the column stacks, so this advice sat
          between the last field and the bottom of the page on every one of the
          steps. Below `lg` it collapses to its header and opens on a tap;
          from `lg` up the column exists, so the toggle is hidden and the body
          is always shown regardless of the toggle's state.
        */}
        <aside className="space-y-4">
          <div className="sticky top-24 space-y-5 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-6">
            <button
              type="button"
              onClick={() => setTipsOpen((open) => !open)}
              aria-expanded={tipsOpen}
              className="flex w-full items-center gap-3 text-left lg:pointer-events-none lg:border-b lg:border-line lg:pb-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold text-content">
                  {t('owner.create.rules.title')}
                </span>
                <span className="block truncate text-xs text-subtle">
                  {t('owner.create.rules.subtitle')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-subtle transition-transform lg:hidden',
                  tipsOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>

            <div className={tipsOpen ? 'block space-y-5' : 'hidden space-y-5 lg:block'}>
              <ul className="space-y-4 text-xs font-medium text-muted">
                {(['photos', 'price', 'address', 'terms'] as const).map((rule) => (
                  <li key={rule} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text"
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-relaxed">
                      {tRaw(`owner.create.rules.${rule}`)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-1 rounded-2xl border border-brand/30 bg-brand-soft p-4 text-xs">
                <p className="flex items-center gap-1.5 font-extrabold text-brand-text">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('owner.create.rules.freeTitle')}</span>
                </p>
                <p className="text-[11px] font-medium leading-relaxed text-muted">
                  {t('owner.create.rules.freeBody')}
                </p>
              </div>

              <div className="border-t border-line pt-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="text-xs">
                    <p className="font-bold text-content">
                      {t('owner.create.rules.badgeTitle')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentView('VERIFICATION')}
                      className="mt-0.5 inline-block text-[11px] font-extrabold text-brand-text underline transition-colors hover:text-brand"
                    >
                      {t('owner.create.rules.badgeCta')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Cancel used to walk straight home with a full form behind it. */}
      <Sheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t('owner.create.draft.confirmLeaveTitle')}
        description={t('owner.create.draft.confirmLeaveBody')}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="press flex-1"
              onClick={() => setConfirmLeave(false)}
            >
              {t('owner.create.draft.stay')}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="press flex-1"
              onClick={() => {
                setConfirmLeave(false);
                setCurrentView('HOME');
              }}
            >
              {t('owner.create.draft.leave')}
            </Button>
          </div>
        }
      >
        <p className="flex items-start gap-2 text-sm font-semibold text-muted">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span>{t('owner.create.draft.saved')}</span>
        </p>
      </Sheet>

      {/*
        The Top confirmation, and the reason `window.alert` is not used for it:
        an alert freezes the app behind it and cannot say two different things.

        By the time this opens the listing is already published, so neither
        branch may read as a failed publish — the failed one says the listing
        is live in its first line and offers the request again from the
        dashboard. Every way out of the sheet lands on My Listings.
      */}
      <Sheet
        open={topOutcome !== null}
        onClose={finishAfterTop}
        title={
          topOutcome === 'failed'
            ? t('owner.create.top.failedTitle')
            : t('owner.create.top.sentTitle')
        }
        description={
          topOutcome === 'failed'
            ? t('owner.create.top.failedBody')
            : t('owner.create.top.sentBody')
        }
        size="sm"
        footer={
          <Button type="button" fullWidth className="press" onClick={finishAfterTop}>
            {t('owner.create.top.sentCta')}
          </Button>
        }
      >
        <p className="flex items-start gap-2 text-sm font-semibold text-muted">
          {topOutcome === 'failed' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          ) : (
            <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          )}
          <span>
            {topOutcome === 'failed'
              ? t('owner.my.top.failed')
              : t('owner.create.top.howItWorks')}
          </span>
        </p>
      </Sheet>
    </div>
  );
};

export default CreateListingPage;
