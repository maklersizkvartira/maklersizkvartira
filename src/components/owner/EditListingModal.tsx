/**
 * Edit an existing listing.
 *
 * The dialog owns its own open/close state through props — the store no
 * longer carries `editingListing`, so whoever opens the modal decides when it
 * closes. Saving goes through `ListingsApi.update`, which returns the listing
 * as the server stored it; the caller gets that copy back rather than the
 * optimistic local object the previous version invented.
 *
 * Two things this form used to get wrong about numbers, both of which made a
 * perfectly ordinary edit impossible:
 *
 *  - The browser refused the submit. Price and deposit carried
 *    `step={100000}` on a `<form>` with no `noValidate`, so 3 450 000 so‘m —
 *    not a multiple of a hundred thousand — was rejected by a native bubble
 *    with no way to act on it, and the area box defaulted to a step of 1, so
 *    54.5 m² could not be saved either.
 *  - Every number field snapped to 0 the moment it was cleared, because
 *    `Number('')` is 0. Backspacing a price to retype it wrote a literal zero
 *    into the box and, if the owner then pressed Save, into the listing.
 *
 * Validation is done here rather than left to the API for the same reason the
 * create wizard does it: a rejected update comes back as one 422 for the whole
 * form, which the dialog could only render as "saving failed" over a form
 * where nothing said which box was wrong.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Briefcase, Edit3, Home, Save, ShieldCheck, Users, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { AMENITIES, amenityStateFrom, type AmenityState } from '../../data/amenities';
import { ApiError } from '../../services/http';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/cn';
import type { DealType, Listing, PropertyType, SellerType } from '../../types';
import { dealTypeOf } from '../../types/deal';
import { Button, Field, FormError, SelectInput, TextInput } from '../ui/Field';

/** Stored value for "no metro nearby"; the label is translated at render time. */
const METRO_NONE = 'NONE';

/**
 * The schema's own caps (`app/schemas/listing.py`), mirrored — as the create
 * wizard mirrors them.
 *
 * They are re-declared rather than imported from `CreateListingPage`: that
 * module is the lazily loaded "post a listing" route and this dialog ships
 * with My Listings, so importing two numbers out of it would pull the whole
 * wizard into the listings chunk.
 */
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_ADDRESS_LENGTH = 255;

const PROPERTY_TYPES: readonly { value: PropertyType; labelKey: string }[] = [
  { value: 'APARTMENT', labelKey: 'listings.propertyType.apartment' },
  { value: 'HOUSE', labelKey: 'listings.propertyType.house' },
  { value: 'LAND', labelKey: 'listings.propertyType.land' },
  { value: 'COMMERCIAL', labelKey: 'listings.propertyType.commercial' },
  { value: 'ROOM', labelKey: 'listings.propertyType.room' },
  { value: 'STUDIO', labelKey: 'listings.propertyType.studio' },
  { value: 'DORMITORY', labelKey: 'listings.propertyType.dormitory' },
];

/**
 * Which box a 422 is about.
 *
 * The API answers with the camelCase alias it was sent
 * (`preferredContactTime`), which is not this form's error key, so the two are
 * written down rather than assumed to line up.
 */
const SERVER_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  price: 'price',
  depositPrice: 'deposit',
  rooms: 'rooms',
  area: 'area',
  floor: 'floor',
  totalFloors: 'floor',
  propertyType: 'propertyType',
  address: 'address',
  metroDistanceMinutes: 'metroMinutes',
};

/**
 * `number | ''` rather than `number`.
 *
 * `Number('')` is 0, so with a plain number state clearing a box wrote a
 * literal zero into it and there was no way to type a new value over the top.
 */
type NumberField = number | '';

const checkboxClass =
  'h-4 w-4 shrink-0 rounded border-line-2 text-brand accent-[var(--color-brand)] focus:ring-brand';

const checkboxRowClass =
  'press flex min-h-12 cursor-pointer touch-manipulation items-center gap-2.5 rounded-2xl ' +
  'border border-line bg-surface-2 p-3 text-xs font-bold text-content transition-colors ' +
  'hover:bg-surface-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft ' +
  'has-[:checked]:text-brand-text';

interface EditListingModalProps {
  listing: Listing;
  onClose: () => void;
  /** Receives the server's copy of the listing after a successful save. */
  onSaved?: (listing: Listing) => void;
}

export const EditListingModal: React.FC<EditListingModalProps> = ({
  listing,
  onClose,
  onSaved,
}) => {
  const { t, tRaw } = useTranslation();
  const pushToast = useAppStore((state) => state.pushToast);
  const prefersReducedMotion = useReducedMotion();

  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [propertyType, setPropertyType] = useState<PropertyType>(
    listing.propertyType ?? 'APARTMENT',
  );
  /**
   * Letting or selling. Editable, because an owner who could not let a flat and
   * has decided to sell it is the ordinary case, and the alternative is
   * deleting the listing and typing all of it again.
   */
  const [dealType, setDealType] = useState<DealType>(dealTypeOf(listing));
  const forSale = dealType === 'SALE';
  const [price, setPrice] = useState<NumberField>(listing.price ?? '');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>(listing.currency ?? 'UZS');
  // `?? ''`, not `?? 0`: a listing with no deposit asks for no deposit, and
  // showing a zero in the box turned that into "the deposit is nothing" on
  // the next save.
  const [deposit, setDeposit] = useState<NumberField>(listing.depositPrice ?? '');
  const [rooms, setRooms] = useState(listing.rooms);
  const [area, setArea] = useState<NumberField>(listing.area ?? '');
  const [floor, setFloor] = useState<NumberField>(listing.floor ?? '');
  const [totalFloors, setTotalFloors] = useState<NumberField>(listing.totalFloors ?? '');
  const [region, setRegion] = useState(listing.region);
  const [district, setDistrict] = useState(listing.district);
  const [address, setAddress] = useState(listing.address ?? '');
  const [metro, setMetro] = useState(listing.metroStation ?? METRO_NONE);
  // Empty rather than a plausible 5: the previous default invented a
  // walking distance for every listing that had never been asked for one, and
  // saving the form published it.
  const [metroMinutes, setMetroMinutes] = useState<NumberField>(
    listing.metroDistanceMinutes ?? '',
  );
  // All seven, from the shared list. This form used to expose four, so the
  // three it left out — air conditioning, a washing machine, internet — could
  // be switched on while posting and never switched off again.
  const [amenities, setAmenities] = useState<AmenityState>(() => amenityStateFrom(listing));
  const [isRoommate, setIsRoommate] = useState(Boolean(listing.isRoommate));
  const [roommateGender, setRoommateGender] = useState<'BOYS' | 'GIRLS' | 'ANY'>(listing.roommateGender ?? 'ANY');
  const [roommateSpots, setRoommateSpots] = useState<number>(listing.roommateSpotsAvailable ?? 1);
  const [sellerType, setSellerType] = useState<SellerType>(listing.sellerType === 'AGENT' ? 'AGENT' : 'OWNER');
  const [agencyName, setAgencyName] = useState(listing.agencyName ?? '');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Field name -> translation key, so errors survive a language switch. */
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  /**
   * Counts refused saves, so the effect below runs again on the second one.
   *
   * The panel is `max-h-[90vh] overflow-y-auto` and the banner is its first
   * child, so pressing Save at the bottom of the form on a phone set a message
   * several screens above the thumb that pressed it and moved nothing: the
   * dialog looked like it had ignored the press. A counter rather than the
   * message itself, because pressing Save twice on the same unfixed form sets
   * the identical string and would not re-run an effect keyed on it.
   */
  const [errorNudge, setErrorNudge] = useState(0);

  const activeRegion =
    UZBEKISTAN_REGIONS.find((item) => item.name === region) ?? UZBEKISTAN_REGIONS[0];

  // Escape closes the dialog, and focus starts inside it so keyboard users are
  // not left behind on the page underneath.
  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Bring the banner back into the panel's own scroll after a refused save,
  // and take focus with it — the message is the answer to the press, and
  // moving focus is what tells a screen reader what the scroll tells everyone
  // else.
  useEffect(() => {
    if (errorNudge === 0) return;
    const banner = errorBannerRef.current;
    if (!banner) return;
    banner.focus({ preventScroll: true });
    banner.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [errorNudge, prefersReducedMotion]);

  /** Clears one field's error the moment it is corrected, rather than leaving
   *  a red box around a value that has already been fixed. */
  const clearError = (field: string) =>
    setFormErrors((current) => (current[field] ? { ...current, [field]: '' } : current));

  const numberHandler =
    (set: (value: NumberField) => void, field: string) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      set(raw === '' ? '' : Number(raw));
      clearError(field);
    };

  /** The create wizard's rules, applied to the same fields. Both ends of every
   *  length: the server trims before it measures, so `.trim().length` is what
   *  is compared here too. */
  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (title.trim().length < 8) errors.title = 'owner.create.validation.title';
    else if (title.trim().length > MAX_TITLE_LENGTH) errors.title = 'common.error.validation';

    if (description.trim().length < 20) {
      errors.description = 'owner.create.validation.description';
    } else if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      errors.description = 'common.error.validation';
    }

    if (price === '' || price <= 0) errors.price = 'owner.create.validation.price';
    // Skipped on a sale for the same reason the box is not drawn: an error
    // against a field nobody can see blocks the save with nothing to fix.
    if (!forSale && deposit !== '' && deposit < 0) {
      errors.deposit = 'owner.create.validation.deposit';
    }
    if (area !== '' && area <= 0) errors.area = 'owner.create.validation.area';
    if (
      (floor !== '' && floor < 1) ||
      (totalFloors !== '' && totalFloors < 1) ||
      (floor !== '' && totalFloors !== '' && floor > totalFloors)
    ) {
      errors.floor = 'owner.create.validation.floor';
    }
    if (address.trim().length > MAX_ADDRESS_LENGTH) errors.address = 'common.error.validation';
    // Only a value that is there is checked. The create wizard insists on the
    // minutes once a station is named, but this dialog also opens on listings
    // published before the question existed, and an empty box must not be the
    // reason an unrelated correction cannot be saved.
    if (
      metro !== METRO_NONE &&
      metroMinutes !== '' &&
      (metroMinutes < 1 || metroMinutes > 60)
    ) {
      errors.metroMinutes = 'owner.create.validation.metroMinutes';
    }

    return errors;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      // A line at the top as well as the red boxes: the dialog scrolls, and
      // the field that failed is often above the fold of the Save button that
      // was just pressed. Setting it is not enough on its own — the nudge is
      // what brings the panel back to it.
      setSaveError(t('common.error.validation'));
      setErrorNudge((count) => count + 1);
      return;
    }

    setSaving(true);
    setSaveError(null);

    // Only fields the owner may change; server-owned values (status, scores,
    // counters) are never echoed back or the API rejects the payload with 422.
    // An optional number that has been cleared travels as null, which is the
    // API's way of saying "this listing has no answer to that" — a zero would
    // be an answer.
    const changes: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      propertyType,
      dealType,
      price: price === '' ? null : price,
      currency,
      // Cleared outright on a sale rather than left as it was. A listing that
      // used to be let carries the deposit it was let for, and switching it to
      // a sale without dropping that would publish a purchase price with a
      // month's deposit under it. The server applies the same rule; sending it
      // is what keeps this dialog's idea of the listing in step with the one
      // that comes back.
      depositPrice: forSale || deposit === '' ? null : deposit,
      rooms,
      area: area === '' ? null : area,
      floor: floor === '' ? null : floor,
      totalFloors: totalFloors === '' ? null : totalFloors,
      region,
      district,
      address: address.trim(),
      metroStation: metro === METRO_NONE ? null : metro,
      metroDistanceMinutes:
        metro === METRO_NONE || metroMinutes === '' ? null : metroMinutes,
      // `videoUrl` is deliberately absent rather than sent as null: video is
      // gone from the product, but a listing posted before that still has one
      // stored, and an update that names the field would wipe it on every save.
      ...amenities,
      isRoommate,
      roommateGender: isRoommate ? roommateGender : null,
      roommateSpotsAvailable: isRoommate ? roommateSpots : null,
      sellerType,
      agencyName: !isRoommate && sellerType === 'AGENT' ? agencyName.trim() : null,
    };

    try {
      const updated = await ListingsApi.update(listing.id, changes);
      pushToast('layout.toast.listingUpdated', 'success');
      onSaved?.(updated);
      onClose();
    } catch (error) {
      // Every branch below ends in a message in that same banner, so the panel
      // is brought back to it once, here, rather than three times over.
      setErrorNudge((count) => count + 1);
      if (error instanceof ApiError && error.isRateLimited) {
        // A real cap on writes, not a broken connection: saying "try again"
        // sends the owner into a wall that has not moved yet.
        setSaveError(t('common.error.rateLimited'));
        pushToast('common.error.rateLimited', 'warning');
      } else if (error instanceof ApiError && error.status === 422) {
        // The server names the field it rejected. Marking that field is the
        // difference between "saving failed" and a red box around the box
        // that is wrong.
        const target = error.field ? SERVER_FIELDS[error.field] : undefined;
        if (target) {
          setFormErrors({ [target]: 'common.error.validation' });
          setSaveError(t('common.error.validation'));
        } else {
          setSaveError(error.message || t('common.error.validation'));
        }
        pushToast('common.error.validation', 'error');
      } else {
        setSaveError(t('owner.edit.saveFailed'));
        pushToast('common.error.generic', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 backdrop-blur-md sm:p-6"
      style={{ backgroundColor: 'var(--overlay)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-raised sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-brand-soft text-brand-text">
              <Edit3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-black text-content">
                {t('owner.edit.title')}
              </h2>
              <p className="text-xs text-subtle">{t('owner.edit.subtitle')}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t('common.a11y.closeDialog')}
            className="rounded-full p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* `noValidate`, so the rules above are the ones that decide. The
            browser's own were both stricter than the API's and unactionable:
            a price of 3 450 000 failed the `step` attribute and all the owner
            got was a bubble saying the nearest valid values were 3 400 000
            and 3 500 000. */}
        <form noValidate onSubmit={handleSave} className="space-y-4">
          {/* Wrapped, and the wrapper is conditional rather than always there:
              `FormError` renders nothing when there is no message, so a
              permanent wrapper would put an empty first child into the
              `space-y-4` stack and open a gap above the title box on a form
              that is perfectly fine. `tabIndex={-1}` is what lets the effect
              above move focus here without adding a tab stop. */}
          {saveError && (
            <div ref={errorBannerRef} tabIndex={-1} className="outline-none">
              <FormError message={saveError} />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted">
              E’lon toifasi
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setIsRoommate(false);
                  setSellerType('OWNER');
                }}
                className={cn(
                  'press flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                  !isRoommate && sellerType === 'OWNER'
                    ? 'border-content bg-surface shadow-sm ring-1 ring-content/15'
                    : 'border-line bg-surface-2 text-content hover:bg-surface-3',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Home className={cn('h-4 w-4 stroke-[2]', !isRoommate && sellerType === 'OWNER' ? 'text-brand' : 'text-content')} />
                  <span className="font-bold text-xs text-content">Mulk egasi</span>
                </div>
                <span className="text-[11px] text-muted">To‘liq ijara</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRoommate(false);
                  setSellerType('AGENT');
                }}
                className={cn(
                  'press flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                  !isRoommate && sellerType === 'AGENT'
                    ? 'border-content bg-surface shadow-sm ring-1 ring-content/15'
                    : 'border-line bg-surface-2 text-content hover:bg-surface-3',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className={cn('h-4 w-4 stroke-[2]', !isRoommate && sellerType === 'AGENT' ? 'text-brand' : 'text-content')} />
                  <span className="font-bold text-xs text-content">Rieltor</span>
                </div>
                <span className="text-[11px] text-muted">Agentlik nomidan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRoommate(true);
                  setSellerType('OWNER');
                }}
                className={cn(
                  'press flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                  isRoommate
                    ? 'border-content bg-surface shadow-sm ring-1 ring-content/15'
                    : 'border-line bg-surface-2 text-content hover:bg-surface-3',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className={cn('h-4 w-4 stroke-[2]', isRoommate ? 'text-brand' : 'text-content')} />
                  <span className="font-bold text-xs text-content">Sheriklikka</span>
                </div>
                <span className="text-[11px] text-muted">Sherik qidirish</span>
              </button>
            </div>
          </fieldset>

          {!isRoommate && sellerType === 'AGENT' && (
            <Field label={t('owner.create.seller.agencyLabel')} hint={t('owner.create.seller.agencyHint')}>
              {({ id, describedBy }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={agencyName}
                  maxLength={120}
                  placeholder={t('owner.create.seller.agencyPlaceholder')}
                  onChange={(e) => setAgencyName(e.target.value)}
                />
              )}
            </Field>
          )}

          {isRoommate && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-info/40 bg-info-soft p-3">
              <Field label={t('owner.create.details.roommateGenderLabel')}>
                {({ id }) => (
                  <SelectInput
                    id={id}
                    value={roommateGender}
                    onChange={(e) => setRoommateGender(e.target.value as any)}
                  >
                    <option value="ANY">{t('owner.create.details.roommateGenderAny')}</option>
                    <option value="BOYS">{t('owner.create.details.roommateGenderBoys')}</option>
                    <option value="GIRLS">{t('owner.create.details.roommateGenderGirls')}</option>
                  </SelectInput>
                )}
              </Field>
              <Field label={t('owner.create.details.roommateSpotsLabel')}>
                {({ id }) => (
                  <SelectInput
                    id={id}
                    value={roommateSpots}
                    onChange={(e) => setRoommateSpots(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((cnt) => (
                      <option key={cnt} value={cnt}>
                        {t('owner.create.details.roommateSpotsOption', { count: cnt })}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
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
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearError('title');
                }}
                required
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('listings.filters.dealType')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={dealType}
                  onChange={(event) => setDealType(event.target.value as DealType)}
                >
                  <option value="RENT">{t('common.dealType.rentAction')}</option>
                  <option value="SALE">{t('common.dealType.saleAction')}</option>
                </SelectInput>
              )}
            </Field>

            <Field
              label={t(
                forSale
                  ? 'owner.create.details.priceLabelSale'
                  : 'owner.create.details.priceLabel',
              )}
              required
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
                  // `any`, not 100 000. Rents are not round: the old step made
                  // every price between the hundred-thousands unsubmittable.
                  step="any"
                  value={price === '' ? '' : price}
                  onChange={numberHandler(setPrice, 'price')}
                  required
                />
              )}
            </Field>

            <Field label={t('owner.create.details.currencyLabel')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as 'UZS' | 'USD')}
                >
                  <option value="UZS">{t('owner.create.details.currencyUzs')}</option>
                  <option value="USD">{t('owner.create.details.currencyUsd')}</option>
                </SelectInput>
              )}
            </Field>

            {/* Money held back against the end of a tenancy. A sale has no
                end, so the question has no answer — and the row keeps its four
                columns either way, because the deal picker took a slot as this
                one gave one up. */}
            {!forSale && (
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
                    step="any"
                    value={deposit === '' ? '' : deposit}
                    onChange={numberHandler(setDeposit, 'deposit')}
                  />
                )}
              </Field>
            )}

            {/* The `error` prop is what makes `SERVER_FIELDS.rooms` mean
                anything. The 422 handler writes that key and this dialog has
                no summary list to catch it, so without a render site here the
                server's one explanation of the refusal was put into state and
                dropped — leaving "saving failed" over a form with nothing
                marked on it. Reached whenever `listing.rooms` is outside the
                range this select offers. */}
            <Field
              label={t('common.filters.rooms')}
              error={formErrors.rooms ? tRaw(formErrors.rooms) : undefined}
            >
              {({ id, describedBy, invalid }) => (
                <SelectInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={rooms}
                  onChange={(event) => {
                    setRooms(Number(event.target.value));
                    clearError('rooms');
                  }}
                >
                  {[1, 2, 3].map((count) => (
                    <option key={count} value={count}>
                      {t('common.filters.roomsValue', { count })}
                    </option>
                  ))}
                  <option value={4}>{t('common.filters.roomsPlus', { count: 4 })}</option>
                </SelectInput>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  // Both halves of the fraction: without `step` the field
                  // accepts whole metres only, and `inputMode="numeric"` gives
                  // iOS a keypad with no decimal separator on it — so 54.5 m²
                  // could neither be typed nor saved.
                  inputMode="decimal"
                  step="any"
                  min={1}
                  value={area === '' ? '' : area}
                  onChange={numberHandler(setArea, 'area')}
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
                  inputMode="numeric"
                  min={1}
                  value={floor === '' ? '' : floor}
                  onChange={numberHandler(setFloor, 'floor')}
                />
              )}
            </Field>
            <Field label={t('owner.create.details.totalFloorsLabel')}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={totalFloors === '' ? '' : totalFloors}
                  onChange={numberHandler(setTotalFloors, 'floor')}
                />
              )}
            </Field>
          </div>

          {/* The wizard published every listing as an APARTMENT for as long as
              it never asked, so this is also where the back catalogue of
              houses, rooms and dormitories gets corrected. */}
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
                  setPropertyType(event.target.value as PropertyType);
                  clearError('propertyType');
                }}
              >
                {PROPERTY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {tRaw(option.labelKey)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('owner.create.location.regionLabel')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={region}
                  onChange={(event) => {
                    const nextRegion = event.target.value;
                    setRegion(nextRegion);
                    const match = UZBEKISTAN_REGIONS.find((item) => item.name === nextRegion);
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
            error={formErrors.address ? tRaw(formErrors.address) : undefined}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={address}
                maxLength={MAX_ADDRESS_LENGTH}
                onChange={(event) => {
                  setAddress(event.target.value);
                  clearError('address');
                }}
                placeholder={t('owner.create.location.addressPlaceholder')}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('owner.create.location.metroLabel')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={metro}
                  onChange={(event) => setMetro(event.target.value)}
                >
                  <option value={METRO_NONE}>{t('owner.create.location.metroNone')}</option>
                  {TASHKENT_METRO_LINES.map((line) => (
                    <optgroup key={line.id} label={line.name}>
                      {line.stations.map((station) => (
                        <option key={station} value={station}>
                          {t('owner.create.location.metroOption', { station })}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </SelectInput>
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
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={metroMinutes === '' ? '' : metroMinutes}
                  disabled={metro === METRO_NONE}
                  onChange={numberHandler(setMetroMinutes, 'metroMinutes')}
                />
              )}
            </Field>
          </div>

          <Field
            label={t('owner.create.details.descriptionLabel')}
            required
            error={formErrors.description ? tRaw(formErrors.description) : undefined}
          >
            {({ id, describedBy, invalid }) => (
              <textarea
                id={id}
                rows={3}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={description}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearError('description');
                }}
                className="w-full rounded-xl border border-line bg-surface-2 p-3.5 text-sm font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
              />
            )}
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted">
              {t('owner.create.details.amenitiesLabel')}
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {AMENITIES.map(({ key, labelKey, Icon }) => (
                <label key={key} className={checkboxRowClass}>
                  <input
                    type="checkbox"
                    checked={amenities[key]}
                    onChange={(event) =>
                      setAmenities((current) => ({ ...current, [key]: event.target.checked }))
                    }
                    className={checkboxClass}
                  />
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{tRaw(labelKey)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.action.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? t('common.action.saving') : t('common.action.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditListingModal;
