/**
 * The four-step "post a listing" wizard.
 *
 * What changed with the API migration:
 *  - Moderation is no longer decided in the browser. The old build shipped a
 *    Gemini key to every visitor and let the client mark its own listing as
 *    approved; now `ListingsApi.scan()` previews the verdict and the server
 *    has the final say inside `ListingsApi.create()`.
 *  - Nothing server-owned (status, trust/risk scores, counters, owner) is sent:
 *    the API rejects unknown fields with 422.
 *  - Images travel as base64 data URLs inside the JSON body, so the wizard
 *    caps them and shows the running payload size — a request over the limit
 *    fails at the gateway, long after the owner has done the work.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Home,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { ListingsApi, type ModerationResult } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Field, FormError, TextInput } from '../ui/Field';

/** Stored value for "no metro nearby"; the label is translated at render time. */
const METRO_NONE = 'NONE';

const MAX_IMAGES = 12;
/** The JSON body carries the photos, so the whole request must stay small. */
const MAX_PAYLOAD_MB = 6;
const TOTAL_STEPS = 4;

const selectClass =
  'w-full appearance-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 pr-9 ' +
  'text-sm font-bold text-content transition-colors focus:border-brand focus:bg-surface focus:outline-none';

const checkboxClass =
  'h-4 w-4 rounded border-line-2 text-brand accent-[var(--color-brand)] focus:ring-brand';

const checkboxRowClass =
  'flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 p-3 ' +
  'text-xs font-bold text-content transition-colors hover:bg-surface-3';

const textareaClass =
  'w-full rounded-xl border border-line bg-surface-2 p-3.5 text-sm font-medium text-content ' +
  'transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none';

/** Rough district centres, used when the browser gives coordinates but the
 *  reverse geocoder cannot name the district. Proper nouns, never translated. */
const DISTRICT_COORDINATES: Record<string, [number, number]> = {
  Chilonzor: [41.278, 69.208],
  Yunusobod: [41.365, 69.292],
  Mirobod: [41.3005, 69.274],
  Yakkasaroy: [41.289, 69.255],
  Sergeli: [41.225, 69.22],
  Uchtepa: [41.295, 69.175],
  Olmazor: [41.349, 69.208],
  Yashnobod: [41.29, 69.34],
  Shayxontohur: [41.32, 69.24],
  'Mirzo Ulugʻbek': [41.335, 69.33],
  Bektemir: [41.21, 69.33],
  Yangihayot: [41.2, 69.21],
  'Samarqand sh.': [39.6542, 66.9597],
  "Farg'ona sh.": [40.3842, 71.7843],
  'Andijon sh.': [40.7821, 72.3442],
  'Namangan sh.': [41.0011, 71.6683],
  'Buxoro sh.': [39.7747, 64.4286],
  'Qarshi sh.': [38.8606, 65.7891],
  'Termiz sh.': [37.2242, 67.2783],
  'Urganch sh.': [41.5504, 60.6317],
  'Navoiy sh.': [40.0844, 65.3792],
  'Jizzax sh.': [40.1158, 67.8422],
  'Nukus sh.': [42.4619, 59.6166],
};

const TASHKENT_CITY = 'Toshkent shahri';

interface GeoMatch {
  region: string;
  district: string;
  street: string;
}

/** Best-effort reverse geocode. Never throws: GPS is a convenience here. */
async function reverseGeocode(latitude: number, longitude: number): Promise<GeoMatch> {
  let region = TASHKENT_CITY;
  let district = '';
  let street = '';

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    );
    if (response.ok) {
      const data: { address?: Record<string, string> } = await response.json();
      const address = data.address ?? {};

      const stateOrCity = address.state || address.city || address.region || '';
      for (const candidate of UZBEKISTAN_REGIONS) {
        const core = candidate.name.toLowerCase().replace(' viloyati', '').replace(' shahri', '');
        if (stateOrCity.toLowerCase().includes(core)) {
          region = candidate.name;
          break;
        }
      }

      const regionData =
        UZBEKISTAN_REGIONS.find((item) => item.name === region) ?? UZBEKISTAN_REGIONS[0];
      const rawDistrict =
        address.city_district || address.suburb || address.district || address.county ||
        address.town || '';
      if (rawDistrict) {
        const normalise = (value: string) => value.toLowerCase().replace(/['ʻ’]/g, '');
        for (const candidate of regionData.districts) {
          if (normalise(rawDistrict).includes(normalise(candidate))) {
            district = candidate;
            break;
          }
        }
      }

      const road = address.road || address.street || address.neighbourhood || address.suburb || '';
      if (road) street = address.house_number ? `${road}, ${address.house_number}` : road;
    }
  } catch {
    /* offline or rate-limited — fall through to the coordinate match */
  }

  if (!district) {
    let closest = Infinity;
    for (const [name, [dLat, dLng]] of Object.entries(DISTRICT_COORDINATES)) {
      const distance = Math.hypot(latitude - dLat, longitude - dLng);
      if (distance < closest) {
        closest = distance;
        district = name;
      }
    }
  }

  return { region, district, street };
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

type Notice = { key: string; params?: Record<string, string | number> };

export const CreateListingPage: React.FC = () => {
  const { t, tRaw, formatPrice, formatNumber } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const switchRole = useAppStore((state) => state.switchRole);
  const fetchMyListings = useAppStore((state) => state.fetchMyListings);
  const pushToast = useAppStore((state) => state.pushToast);
  const fxRate = useAppStore((state) => state.fxRate);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);

  // -- Step 1: location ------------------------------------------------------
  const [region, setRegion] = useState(TASHKENT_CITY);
  const [district, setDistrict] = useState(
    () =>
      (UZBEKISTAN_REGIONS.find((item) => item.name === TASHKENT_CITY) ?? UZBEKISTAN_REGIONS[0])
        .districts[0],
  );
  const [address, setAddress] = useState('');
  const [metro, setMetro] = useState('Yunusobod');
  const [metroMinutes, setMetroMinutes] = useState(5);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<Notice | null>(null);
  const [gpsError, setGpsError] = useState<Notice | null>(null);

  // -- Step 2: the property --------------------------------------------------
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(4_500_000);
  const [deposit, setDeposit] = useState(1_000_000);
  const [rooms, setRooms] = useState(2);
  const [area, setArea] = useState(65);
  const [floor, setFloor] = useState(3);
  const [totalFloors, setTotalFloors] = useState(9);
  const [furnished, setFurnished] = useState(true);
  const [utilities, setUtilities] = useState(true);
  const [pets, setPets] = useState(false);
  const [parking, setParking] = useState(true);
  const [airConditioning, setAirConditioning] = useState(true);
  const [washingMachine, setWashingMachine] = useState(true);
  const [internet, setInternet] = useState(true);
  const [isRoommate, setIsRoommate] = useState(false);
  const [roommateGender, setRoommateGender] = useState<'BOYS' | 'GIRLS' | 'ANY'>('ANY');
  const [roommateSpots, setRoommateSpots] = useState(1);

  // -- Step 3: media ---------------------------------------------------------
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  // -- Step 4: contact, moderation, submit -----------------------------------
  const [telegram, setTelegram] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [scan, setScan] = useState<ModerationResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<ModerationResult | null>(null);

  /** Field name -> translation key, so errors survive a language switch. */
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const activeRegion =
    UZBEKISTAN_REGIONS.find((item) => item.name === region) ?? UZBEKISTAN_REGIONS[0];

  const payloadBytes = useMemo(
    () =>
      images.reduce((sum, image) => sum + dataUrlBytes(image), 0) +
      (videoUrl ? dataUrlBytes(videoUrl) : 0),
    [images, videoUrl],
  );
  const payloadMb = payloadBytes / (1024 * 1024);
  const payloadTooLarge = payloadMb > MAX_PAYLOAD_MB;

  // -- Gates -----------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.signInTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.signInBody')}</p>
        <Button fullWidth onClick={() => setShowAuth(true, 'LOGIN')}>
          {t('common.action.signIn')}
        </Button>
      </div>
    );
  }

  if (currentUser.role !== 'OWNER') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Building2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.studentTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.studentBody')}</p>
        <Button
          fullWidth
          onClick={() => {
            void switchRole('OWNER').catch(() => pushToast('owner.gate.switchFailed', 'error'));
          }}
        >
          {t('owner.gate.switchToOwner')}
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setCurrentView('LISTINGS')}>
          {t('owner.gate.browseCta')}
        </Button>
      </div>
    );
  }

  // -- Media handlers --------------------------------------------------------
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      pushToast('owner.create.photos.limitReached', 'warning', { max: MAX_IMAGES });
      return;
    }
    if (files.length > room) {
      pushToast('owner.create.photos.limitNotice', 'warning', { max: MAX_IMAGES });
    }

    const results = await Promise.all(files.slice(0, room).map(readAsDataUrl));
    const accepted = results.filter((item): item is string => item !== null);
    if (accepted.length < results.length) {
      pushToast('owner.create.photos.readFailed', 'error');
    }
    if (accepted.length > 0) {
      setImages((current) => [...current, ...accepted]);
      setFormErrors((current) => ({ ...current, images: '' }));
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    // The API only accepts an https video URL, so an inline data: URL would be
    // rejected at submit time and take the whole listing with it. Say so here
    // rather than letting the owner fill in a form that cannot be saved.
    pushToast('owner.create.photos.videoUploadUnsupported', 'warning');
  };

  const detectLocation = () => {
    setGpsError(null);
    setGpsNotice(null);

    if (!('geolocation' in navigator)) {
      setGpsError({ key: 'owner.create.location.gpsUnsupported' });
      return;
    }

    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLng = position.coords.longitude;
        setLatitude(nextLat);
        setLongitude(nextLng);

        void reverseGeocode(nextLat, nextLng)
          .then((match) => {
            setRegion(match.region);
            if (match.district) setDistrict(match.district);
            if (match.street) {
              setAddress(match.street);
              setFormErrors((current) => ({ ...current, address: '' }));
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
          })
          .finally(() => setGpsBusy(false));
      },
      () => {
        setGpsBusy(false);
        setGpsError({ key: 'owner.create.location.gpsDenied' });
      },
      { timeout: 8000 },
    );
  };

  // -- Validation ------------------------------------------------------------
  const validateStep = (target: number): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (target === 1) {
      if (!address.trim()) errors.address = 'owner.create.validation.address';
      if (
        metro !== METRO_NONE &&
        (!Number.isFinite(metroMinutes) || metroMinutes < 1 || metroMinutes > 60)
      ) {
        errors.metroMinutes = 'owner.create.validation.metroMinutes';
      }
    }

    if (target === 2) {
      if (title.trim().length < 8) errors.title = 'owner.create.validation.title';
      if (description.trim().length < 20) errors.description = 'owner.create.validation.description';
      if (!Number.isFinite(price) || price <= 0) errors.price = 'owner.create.validation.price';
      if (!Number.isFinite(deposit) || deposit < 0) errors.deposit = 'owner.create.validation.deposit';
      if (!Number.isFinite(area) || area <= 0) errors.area = 'owner.create.validation.area';
      if (
        !Number.isFinite(floor) ||
        !Number.isFinite(totalFloors) ||
        floor < 1 ||
        totalFloors < 1 ||
        floor > totalFloors
      ) {
        errors.floor = 'owner.create.validation.floor';
      }
    }

    if (target === 3) {
      if (images.length < 3) errors.images = 'owner.create.validation.images';
      if (payloadTooLarge) errors.payload = 'owner.create.validation.imagesTooLarge';
    }

    if (target === 4) {
      if ((currentUser.phone ?? '').replace(/\D/g, '').length < 9) {
        errors.phone = 'owner.create.validation.phone';
      }
    }

    return errors;
  };

  const goToStep = (target: number) => {
    const errors = validateStep(step);
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) setStep(target);
  };

  const firstInvalidStep = (): number | null => {
    for (const candidate of [1, 2, 3, 4]) {
      const errors = validateStep(candidate);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return candidate;
      }
    }
    setFormErrors({});
    return null;
  };

  // -- Moderation preview ----------------------------------------------------
  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    setScan(null);
    try {
      const result = await ListingsApi.scan({
        title: title.trim(),
        description: description.trim(),
        price,
        rooms,
      });
      setScan(result);
    } catch {
      setScanError(t('owner.create.moderation.failed'));
    } finally {
      setScanning(false);
    }
  };

  // -- Submit ----------------------------------------------------------------
  const coordinates = (): { latitude: number; longitude: number } => {
    if (latitude !== null && longitude !== null) return { latitude, longitude };
    const fallback = DISTRICT_COORDINATES[district] ?? [41.311, 69.279];
    return { latitude: fallback[0], longitude: fallback[1] };
  };

  const handleSubmit = async () => {
    const invalidStep = firstInvalidStep();
    if (invalidStep !== null) {
      setStep(invalidStep);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setRejection(null);

    const point = coordinates();
    // Only owner-editable fields: anything the server owns (status, scores,
    // counters, ownerId) makes the request fail validation with 422.
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      price,
      currency: 'UZS',
      depositPrice: deposit,
      utilitiesIncluded: utilities,
      rooms,
      area,
      floor,
      totalFloors,
      propertyType: 'APARTMENT',
      region,
      district,
      address: address.trim(),
      latitude: point.latitude,
      longitude: point.longitude,
      metroStation: metro === METRO_NONE ? null : metro,
      metroDistanceMinutes: metro === METRO_NONE ? null : metroMinutes,
      furnished,
      petsAllowed: pets,
      parking,
      internet,
      airConditioning,
      washingMachine,
      images,
      videoUrl: videoUrl || null,
      hasVirtualTour: false,
      contactTelegram: telegram.trim() || null,
      preferredContactTime: preferredTime.trim() || null,
      isRoommate,
      roommateGender: isRoommate ? roommateGender : null,
      roommateSpotsAvailable: isRoommate ? roommateSpots : null,
    };

    try {
      const response = await ListingsApi.create(payload);
      void fetchMyListings();

      if (!response.moderation.allowed) {
        // The work is kept: the owner edits the text and updates the listing
        // instead of losing everything they just typed.
        setRejection(response.moderation);
        pushToast('layout.toast.listingRejected', 'error');
        return;
      }

      pushToast('layout.toast.listingCreated', 'success');
      setCurrentView('MY_LISTINGS');
    } catch {
      setSubmitError(t('owner.create.submitFailed'));
      pushToast('common.error.network', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // -- Render helpers --------------------------------------------------------
  const stepMeta = [
    { num: 1, title: t('owner.create.steps.locationTitle'), hint: t('owner.create.steps.locationHint') },
    { num: 2, title: t('owner.create.steps.detailsTitle'), hint: t('owner.create.steps.detailsHint') },
    { num: 3, title: t('owner.create.steps.photosTitle'), hint: t('owner.create.steps.photosHint') },
    { num: 4, title: t('owner.create.steps.contactTitle'), hint: t('owner.create.steps.contactHint') },
  ];

  const errorKeys = Object.values(formErrors).filter(Boolean);
  const usdPrice = fxRate > 0 ? Math.round(price / fxRate) : 0;

  const stepBadge = (
    <span className="rounded-lg border border-line bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-text">
      {t('owner.create.stepBadge', { step })}
    </span>
  );

  return (
    <div className="mx-auto w-full min-h-[85vh] max-w-6xl space-y-6 overflow-x-hidden px-4 py-6 pb-24 sm:space-y-8 sm:px-6 sm:py-10 sm:pb-16">
      <div className="space-y-4 border-b border-line pb-5">
        <nav aria-label={t('owner.create.breadcrumb')}>
          <ol className="flex items-center gap-2 text-xs font-semibold text-subtle">
            <li>
              <button
                type="button"
                onClick={() => setCurrentView('HOME')}
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
          <div>
            <h1 className="text-2xl font-black tracking-tight text-content sm:text-3xl">
              {t('owner.create.title')}
            </h1>
            <p className="mt-1 text-xs font-medium text-muted sm:text-sm">
              {t('owner.create.subtitle')}
            </p>
          </div>

          <Button
            variant="secondary"
            className="self-start sm:self-center"
            onClick={() => setCurrentView('HOME')}
          >
            {t('common.action.cancel')}
          </Button>
        </div>
      </div>

      {/* Step navigation. Completed steps stay reachable; future ones do not. */}
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {stepMeta.map((item) => {
          const isActive = step === item.num;
          const isDone = step > item.num;
          return (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => {
                  if (item.num <= step) setStep(item.num);
                }}
                disabled={item.num > step}
                aria-current={isActive ? 'step' : undefined}
                className={`relative w-full overflow-hidden rounded-2xl border p-3.5 text-left transition-all disabled:cursor-not-allowed sm:p-4 ${
                  isActive
                    ? 'border-brand bg-brand text-on-brand shadow-brand'
                    : isDone
                      ? 'border-line bg-brand-soft text-brand-text hover:bg-brand-soft-2'
                      : 'border-line bg-surface text-subtle'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                      isActive
                        ? 'bg-surface text-brand-text'
                        : isDone
                          ? 'bg-brand text-on-brand'
                          : 'bg-surface-2 text-subtle'
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.num}
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
        <div className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8 lg:col-span-2">
          {errorKeys.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
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

          {/* ---------------------------------------------------- STEP 1 --- */}
          {step === 1 && (
            <section className="space-y-5" aria-labelledby="owner-step-location">
              <header className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2
                    id="owner-step-location"
                    className="flex items-center gap-2 text-lg font-extrabold text-content"
                  >
                    <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                    {t('owner.create.location.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t('owner.create.location.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('owner.create.location.regionLabel')}>
                  {({ id }) => (
                    <div className="relative">
                      <select
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
                        className={selectClass}
                      >
                        {UZBEKISTAN_REGIONS.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Field>

                <Field label={t('owner.create.location.districtLabel')}>
                  {({ id }) => (
                    <div className="relative">
                      <select
                        id={id}
                        value={district}
                        onChange={(event) => setDistrict(event.target.value)}
                        className={selectClass}
                      >
                        {activeRegion.districts.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={detectLocation}
                    loading={gpsBusy}
                    className="px-3 py-1.5 text-[11px]"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {gpsBusy
                      ? t('owner.create.location.gpsDetecting')
                      : latitude !== null && longitude !== null
                        ? t('owner.create.location.gpsDetected')
                        : t('owner.create.location.gpsDetect')}
                  </Button>
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
                        if (event.target.value.trim()) {
                          setFormErrors((current) => ({ ...current, address: '' }));
                        }
                      }}
                      placeholder={t('owner.create.location.addressPlaceholder')}
                    />
                  )}
                </Field>

                {gpsNotice && (
                  <p className="flex items-start gap-1.5 rounded-xl border border-line bg-brand-soft p-2.5 text-xs font-bold text-brand-text">
                    <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{tRaw(gpsNotice.key, gpsNotice.params)}</span>
                  </p>
                )}
                {gpsError && (
                  <FormError message={tRaw(gpsError.key, gpsError.params)} />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('owner.create.location.metroLabel')}>
                  {({ id }) => (
                    <div className="relative">
                      <select
                        id={id}
                        value={metro}
                        onChange={(event) => setMetro(event.target.value)}
                        className={selectClass}
                      >
                        <option value={METRO_NONE}>
                          {t('owner.create.location.metroNone')}
                        </option>
                        {TASHKENT_METRO_LINES.map((line) => (
                          <optgroup key={line.id} label={line.name}>
                            {line.stations.map((station) => (
                              <option key={station} value={station}>
                                {t('owner.create.location.metroOption', { station })}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Field>

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
                      min={1}
                      max={60}
                      disabled={metro === METRO_NONE}
                      value={metroMinutes}
                      onChange={(event) => setMetroMinutes(Number(event.target.value))}
                    />
                  )}
                </Field>
              </div>

              <Button fullWidth onClick={() => goToStep(2)}>
                <span>{t('owner.create.next.toDetails')}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </section>
          )}

          {/* ---------------------------------------------------- STEP 2 --- */}
          {step === 2 && (
            <section className="space-y-5" aria-labelledby="owner-step-details">
              <header className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2
                    id="owner-step-details"
                    className="flex items-center gap-2 text-lg font-extrabold text-content"
                  >
                    <Building2 className="h-5 w-5 text-brand" aria-hidden="true" />
                    {t('owner.create.details.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t('owner.create.details.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

              <fieldset className="space-y-1.5">
                <legend className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('owner.create.details.rentalTypeLabel')}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRoommate(false)}
                    aria-pressed={!isRoommate}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-black transition-all ${
                      !isRoommate
                        ? 'border-brand bg-brand text-on-brand shadow-brand'
                        : 'border-line bg-surface-2 text-content hover:bg-surface-3'
                    }`}
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.details.whole')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoommate(true)}
                    aria-pressed={isRoommate}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-black transition-all ${
                      isRoommate
                        ? 'border-warning bg-warning text-white shadow-card'
                        : 'border-line bg-surface-2 text-content hover:bg-surface-3'
                    }`}
                  >
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.details.roommate')}</span>
                  </button>
                </div>
              </fieldset>

              {isRoommate && (
                <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-warning">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.details.roommateHeading')}</span>
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('owner.create.details.roommateGenderLabel')}>
                      {({ id }) => (
                        <div className="relative">
                          <select
                            id={id}
                            value={roommateGender}
                            onChange={(event) =>
                              setRoommateGender(event.target.value as 'BOYS' | 'GIRLS' | 'ANY')
                            }
                            className={selectClass}
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
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </Field>

                    <Field label={t('owner.create.details.roommateSpotsLabel')}>
                      {({ id }) => (
                        <div className="relative">
                          <select
                            id={id}
                            value={roommateSpots}
                            onChange={(event) => setRoommateSpots(Number(event.target.value))}
                            className={selectClass}
                          >
                            {[1, 2, 3].map((count) => (
                              <option key={count} value={count}>
                                {t('owner.create.details.roommateSpotsOption', { count })}
                              </option>
                            ))}
                            <option value={4}>
                              {t('owner.create.details.roommateSpotsPlus', { count: 4 })}
                            </option>
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                </div>
              )}

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
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t('owner.create.details.descriptionPlaceholder')}
                    className={textareaClass}
                  />
                )}
              </Field>

              {/* The in-browser copywriter and price estimator ran on a Gemini
                  key shipped to every visitor. They are disabled until the
                  server exposes the same helpers. */}
              <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button variant="secondary" type="button" disabled>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.ai.writeCopy')}</span>
                  </Button>
                  <Button variant="secondary" type="button" disabled>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>{t('owner.create.ai.suggestPrice')}</span>
                  </Button>
                </div>
                <p className="text-xs font-medium text-subtle">
                  {t('owner.create.ai.unavailable')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t('owner.create.details.priceLabel')}
                  required
                  hint={t('owner.create.details.priceApprox', {
                    amount: formatPrice(usdPrice, 'USD'),
                  })}
                  error={formErrors.price ? tRaw(formErrors.price) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      min={0}
                      step={100000}
                      value={price}
                      onChange={(event) => setPrice(Number(event.target.value))}
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
                      min={0}
                      step={100000}
                      value={deposit}
                      onChange={(event) => setDeposit(Number(event.target.value))}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label={t('common.filters.rooms')}>
                  {({ id }) => (
                    <div className="relative">
                      <select
                        id={id}
                        value={rooms}
                        onChange={(event) => setRooms(Number(event.target.value))}
                        className={selectClass}
                      >
                        {[1, 2, 3].map((count) => (
                          <option key={count} value={count}>
                            {t('common.filters.roomsValue', { count })}
                          </option>
                        ))}
                        <option value={4}>{t('common.filters.roomsPlus', { count: 4 })}</option>
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Field>

                <Field
                  label={t('owner.create.details.areaLabel')}
                  error={formErrors.area ? tRaw(formErrors.area) : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      min={1}
                      value={area}
                      onChange={(event) => setArea(Number(event.target.value))}
                    />
                  )}
                </Field>

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
                      min={1}
                      value={floor}
                      onChange={(event) => setFloor(Number(event.target.value))}
                    />
                  )}
                </Field>

                <Field label={t('owner.create.details.totalFloorsLabel')}>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      type="number"
                      min={1}
                      value={totalFloors}
                      onChange={(event) => setTotalFloors(Number(event.target.value))}
                    />
                  )}
                </Field>
              </div>

              <fieldset className="space-y-2 pt-1">
                <legend className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('owner.create.details.amenitiesLabel')}
                </legend>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      ['furnished', furnished, setFurnished, 'listings.amenities.furnished'],
                      ['utilities', utilities, setUtilities, 'listings.amenities.utilitiesIncluded'],
                      [
                        'airConditioning',
                        airConditioning,
                        setAirConditioning,
                        'listings.amenities.airConditioning',
                      ],
                      [
                        'washingMachine',
                        washingMachine,
                        setWashingMachine,
                        'listings.amenities.washingMachine',
                      ],
                      ['internet', internet, setInternet, 'listings.amenities.internet'],
                      ['parking', parking, setParking, 'listings.amenities.parking'],
                      ['pets', pets, setPets, 'listings.amenities.petsAllowed'],
                    ] as const
                  ).map(([name, checked, setChecked, labelKey]) => (
                    <label key={name} className={checkboxRowClass}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                        className={checkboxClass}
                      />
                      <span>{tRaw(labelKey)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="w-1/3" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{t('common.action.back')}</span>
                </Button>
                <Button className="w-2/3" onClick={() => goToStep(3)}>
                  <span>{t('owner.create.next.toPhotos')}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- STEP 3 --- */}
          {step === 3 && (
            <section className="space-y-5" aria-labelledby="owner-step-photos">
              <header className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2
                    id="owner-step-photos"
                    className="flex items-center gap-2 text-lg font-extrabold text-content"
                  >
                    <Upload className="h-5 w-5 text-brand" aria-hidden="true" />
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
                onChange={(event) => {
                  void handleImageUpload(event);
                }}
              />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                className="w-full space-y-3 rounded-3xl border-2 border-dashed border-brand/50 bg-brand-soft p-6 text-center transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60 sm:p-8"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft-2 text-brand-text">
                  <Upload className="h-7 w-7" aria-hidden="true" />
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
                  {t('owner.create.photos.limitNotice', { max: MAX_IMAGES })}
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
                  <p className="text-xs font-extrabold text-muted">
                    {t('owner.create.photos.uploadedTitle')}
                  </p>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((image, index) => (
                      <li
                        key={image.slice(-48) + String(index)}
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
                          onClick={() =>
                            setImages((current) => current.filter((_, item) => item !== index))
                          }
                          className="absolute right-2 top-2 rounded-full bg-danger p-1.5 text-white shadow-card transition-transform active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-2xl border border-warning/40 bg-warning-soft p-4 text-xs font-medium text-warning">
                  {t('owner.create.photos.emptyHint')}
                </p>
              )}

              <div className="space-y-3 rounded-3xl border border-line bg-surface-2 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-extrabold text-content">
                    <Video className="h-4 w-4 text-danger" aria-hidden="true" />
                    <span>{t('owner.create.photos.videoLabel')}</span>
                  </span>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-subtle">
                    {t('common.state.optional')}
                  </span>
                </div>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={(event) => {
                    void handleVideoUpload(event);
                  }}
                />

                {videoUrl ? (
                  <div className="space-y-2">
                    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#0b1220]">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- owner-recorded tour, no caption track exists */}
                      <video controls src={videoUrl} className="max-h-56 w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setVideoUrl('')}
                        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-xl bg-danger px-3 py-1.5 text-xs font-extrabold text-white shadow-raised transition-transform active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('owner.create.photos.videoRemove')}</span>
                      </button>
                    </div>
                    <p className="flex items-center gap-1 text-[11px] font-bold text-brand-text">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('owner.create.photos.videoUploaded')}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full space-y-2 rounded-2xl border-2 border-dashed border-line-2 p-4 text-center transition-colors hover:border-danger"
                  >
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
                      <Video className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="block text-xs font-bold text-content">
                      {t('owner.create.photos.videoDropTitle')}
                    </span>
                    <span className="block text-[11px] text-subtle">
                      {t('owner.create.photos.videoDropBody')}
                    </span>
                  </button>
                )}
              </div>

              {/* Photo-based condition and price analysis ran in the browser on
                  a shared API key. The card stays so the feature is not lost
                  silently; it turns back on when the server exposes it. */}
              <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-4 sm:p-5">
                <p className="flex items-center gap-2 text-sm font-black text-content">
                  <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
                  {t('owner.create.ai.photoTitle')}
                </p>
                <p className="text-xs font-medium leading-relaxed text-muted">
                  {t('owner.create.ai.photoBody')}
                </p>
                <p className="text-xs font-semibold text-subtle">
                  {t('owner.create.ai.unavailable')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="w-1/3" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{t('common.action.back')}</span>
                </Button>
                <Button className="w-2/3" onClick={() => goToStep(4)}>
                  <span>{t('owner.create.next.toContact')}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- STEP 4 --- */}
          {step === 4 && (
            <section className="space-y-6" aria-labelledby="owner-step-contact">
              <header className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2
                    id="owner-step-contact"
                    className="flex items-center gap-2 text-lg font-extrabold text-content"
                  >
                    <Phone className="h-5 w-5 text-brand" aria-hidden="true" />
                    {t('owner.create.contact.heading')}
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t('owner.create.contact.subheading')}
                  </p>
                </div>
                {stepBadge}
              </header>

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

                <Field label={t('owner.create.contact.telegramLabel')}>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      value={telegram}
                      onChange={(event) => setTelegram(event.target.value)}
                      placeholder={t('owner.create.contact.telegramPlaceholder')}
                      icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
                    />
                  )}
                </Field>
              </div>

              <Field label={t('owner.create.contact.timeLabel')}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={preferredTime}
                    onChange={(event) => setPreferredTime(event.target.value)}
                    placeholder={t('owner.create.contact.timePlaceholder')}
                    icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                  />
                )}
              </Field>

              {/* Moderation preview: advisory only, the server decides on create. */}
              <div aria-live="polite">
                {scanning ? (
                  <div className="space-y-3 rounded-3xl border border-line bg-brand-soft p-6 text-center">
                    <span
                      className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-extrabold text-brand-text">
                      {t('owner.create.moderation.scanning')}
                    </h3>
                    <p className="text-xs font-medium text-muted">
                      {t('owner.create.moderation.scanningBody')}
                    </p>
                  </div>
                ) : scan === null ? (
                  <div className="space-y-4 rounded-3xl border border-line bg-surface-2 p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-info-soft text-info">
                      <Sparkles className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-content">
                        {t('owner.create.moderation.title')}
                      </h3>
                      <p className="mt-1 text-xs text-subtle">
                        {t('owner.create.moderation.body')}
                      </p>
                    </div>
                    <FormError message={scanError} />
                    <Button
                      onClick={() => {
                        void runScan();
                      }}
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {t('owner.create.moderation.runCta')}
                    </Button>
                  </div>
                ) : scan.allowed ? (
                  <div className="space-y-2 rounded-3xl border border-brand/40 bg-brand-soft p-5">
                    <h3 className="flex items-center gap-2 text-base font-extrabold text-brand-text">
                      <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {t('owner.create.moderation.passedTitle')}
                    </h3>
                    <p className="text-xs font-medium text-muted">
                      {t('owner.create.moderation.passedBody')}
                    </p>
                    <p className="text-[11px] font-semibold text-subtle">
                      {t('common.badge.trustScore', { score: formatNumber(scan.trustScore) })}
                      {' · '}
                      {t('owner.create.moderation.provider', { provider: scan.provider })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-3xl border border-danger/30 bg-danger-soft p-5">
                    <h3 className="flex items-center gap-2 text-base font-black text-danger">
                      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {t('owner.create.moderation.blockedTitle')}
                    </h3>
                    <p className="text-xs font-medium text-muted">
                      {t('owner.create.moderation.blockedBody')}
                    </p>
                    {scan.reasons.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-content">
                          {t('owner.create.moderation.reasonsTitle')}
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-xs text-muted">
                          {scan.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[11px] font-semibold text-subtle">
                      {t('owner.create.moderation.riskScore', {
                        score: formatNumber(scan.riskScore),
                      })}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button className="flex-1" onClick={() => setStep(2)}>
                        {t('owner.create.moderation.editCta')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          void runScan();
                        }}
                      >
                        {t('owner.create.moderation.rerunCta')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {rejection && (
                <div
                  role="alert"
                  className="space-y-3 rounded-3xl border border-danger/30 bg-danger-soft p-5"
                >
                  <h3 className="flex items-center gap-2 text-base font-black text-danger">
                    <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {t('owner.create.moderation.rejectedTitle')}
                  </h3>
                  <p className="text-xs font-medium text-muted">
                    {t('owner.create.moderation.rejectedBody')}
                  </p>
                  {rejection.reasons.length > 0 && (
                    <ul className="list-inside list-disc space-y-1 text-xs text-muted">
                      {rejection.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1" onClick={() => setStep(2)}>
                      {t('owner.create.moderation.editCta')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setCurrentView('MY_LISTINGS')}
                    >
                      {t('owner.create.moderation.goToMyListings')}
                    </Button>
                  </div>
                </div>
              )}

              <FormError message={submitError} />

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="w-1/3" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{t('common.action.back')}</span>
                </Button>
                <Button
                  className="w-2/3"
                  loading={submitting}
                  disabled={payloadTooLarge}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  <span>
                    {submitting ? t('owner.create.submitting') : t('owner.create.submit')}
                  </span>
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Side rail: what makes a listing rent quickly. */}
        <aside className="space-y-4">
          <div className="sticky top-24 space-y-5 rounded-3xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-content">
                  {t('owner.create.rules.title')}
                </h2>
                <p className="text-xs text-subtle">{t('owner.create.rules.subtitle')}</p>
              </div>
            </div>

            <ul className="space-y-4 text-xs font-medium text-muted">
              {(['photos', 'price', 'address', 'terms'] as const).map((rule) => (
                <li key={rule} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text"
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-relaxed">{tRaw(`owner.create.rules.${rule}`)}</span>
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
                  <p className="font-bold text-content">{t('owner.create.rules.badgeTitle')}</p>
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
        </aside>
      </div>
    </div>
  );
};

export default CreateListingPage;
