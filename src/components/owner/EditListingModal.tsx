/**
 * Edit an existing listing.
 *
 * The dialog owns its own open/close state through props — the store no
 * longer carries `editingListing`, so whoever opens the modal decides when it
 * closes. Saving goes through `ListingsApi.update`, which returns the listing
 * as the server stored it; the caller gets that copy back rather than the
 * optimistic local object the previous version invented.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Edit3, Save, Trash2, Video, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button, Field, FormError, SelectInput, TextInput } from '../ui/Field';

/** Stored value for "no metro nearby"; the label is translated at render time. */
const METRO_NONE = 'NONE';

const checkboxClass =
  'h-4 w-4 rounded border-line-2 text-brand accent-[var(--color-brand)] focus:ring-brand';

const checkboxRowClass =
  'flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 p-2.5 ' +
  'text-xs font-bold text-content transition-colors hover:bg-surface-3';

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
  const { t } = useTranslation();
  const pushToast = useAppStore((state) => state.pushToast);

  const titleId = useId();
  const videoInputId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(listing.price);
  const [deposit, setDeposit] = useState(listing.depositPrice ?? 0);
  const [rooms, setRooms] = useState(listing.rooms);
  const [area, setArea] = useState(listing.area);
  const [floor, setFloor] = useState(listing.floor);
  const [totalFloors, setTotalFloors] = useState(listing.totalFloors);
  const [region, setRegion] = useState(listing.region);
  const [district, setDistrict] = useState(listing.district);
  const [address, setAddress] = useState(listing.address ?? '');
  const [metro, setMetro] = useState(listing.metroStation ?? METRO_NONE);
  const [metroMinutes, setMetroMinutes] = useState(listing.metroDistanceMinutes ?? 5);
  const [videoUrl, setVideoUrl] = useState(listing.videoUrl ?? '');
  const [furnished, setFurnished] = useState(listing.furnished);
  const [utilities, setUtilities] = useState(listing.utilitiesIncluded);
  const [pets, setPets] = useState(listing.petsAllowed);
  const [parking, setParking] = useState(listing.parking);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setVideoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    // Only fields the owner may change; server-owned values (status, scores,
    // counters) are never echoed back or the API rejects the payload with 422.
    const changes: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      price,
      depositPrice: deposit,
      rooms,
      area,
      floor,
      totalFloors,
      region,
      district,
      address: address.trim(),
      metroStation: metro === METRO_NONE ? null : metro,
      metroDistanceMinutes: metro === METRO_NONE ? null : metroMinutes,
      videoUrl: videoUrl.trim() || null,
      furnished,
      utilitiesIncluded: utilities,
      petsAllowed: pets,
      parking,
    };

    try {
      const updated = await ListingsApi.update(listing.id, changes);
      pushToast('layout.toast.listingUpdated', 'success');
      onSaved?.(updated);
      onClose();
    } catch {
      setSaveError(t('owner.edit.saveFailed'));
      pushToast('common.error.generic', 'error');
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

        <form onSubmit={handleSave} className="space-y-4">
          <FormError message={saveError} />

          <Field label={t('owner.create.details.titleLabel')} required>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('owner.create.details.priceLabel')} required>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step={100000}
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                  required
                />
              )}
            </Field>

            <Field label={t('owner.create.details.depositLabel')}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step={100000}
                  value={deposit}
                  onChange={(event) => setDeposit(Number(event.target.value))}
                />
              )}
            </Field>

            <Field label={t('common.filters.rooms')}>
              {({ id }) => (
                <div className="relative">
                  <SelectInput
                    id={id}
                    value={rooms}
                    onChange={(event) => setRooms(Number(event.target.value))}
                   
                  >
                    {[1, 2, 3].map((count) => (
                      <option key={count} value={count}>
                        {t('common.filters.roomsValue', { count })}
                      </option>
                    ))}
                    <option value={4}>{t('common.filters.roomsPlus', { count: 4 })}</option>
                  </SelectInput>
                </div>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('owner.create.details.areaLabel')}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  value={area}
                  onChange={(event) => setArea(Number(event.target.value))}
                />
              )}
            </Field>
            <Field label={t('owner.create.details.floorLabel')}>
              {({ id }) => (
                <TextInput
                  id={id}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('owner.create.location.regionLabel')}>
              {({ id }) => (
                <div className="relative">
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
                </div>
              )}
            </Field>

            <Field label={t('owner.create.location.districtLabel')}>
              {({ id }) => (
                <div className="relative">
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
                </div>
              )}
            </Field>
          </div>

          <Field label={t('owner.create.location.addressLabel')}>
            {({ id }) => (
              <TextInput
                id={id}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t('owner.create.location.addressPlaceholder')}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('owner.create.location.metroLabel')}>
              {({ id }) => (
                <div className="relative">
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
                </div>
              )}
            </Field>

            <Field label={t('owner.create.location.metroMinutesLabel')}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={60}
                  value={metroMinutes}
                  disabled={metro === METRO_NONE}
                  onChange={(event) => setMetroMinutes(Number(event.target.value))}
                />
              )}
            </Field>
          </div>

          <Field label={t('owner.create.details.descriptionLabel')}>
            {({ id }) => (
              <textarea
                id={id}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2 p-3.5 text-sm font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
              />
            )}
          </Field>

          <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <Video className="h-4 w-4 text-danger" aria-hidden="true" />
                {t('owner.create.photos.videoLabel')}
              </span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-subtle">
                {t('common.state.optional')}
              </span>
            </div>

            <input
              id={videoInputId}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={handleVideoUpload}
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
                <p className="text-[11px] font-bold text-brand-text">
                  {t('owner.create.photos.videoUploaded')}
                </p>
              </div>
            ) : (
              <label
                htmlFor={videoInputId}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-2 p-4 text-center transition-colors hover:border-brand"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <Video className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold text-content">
                  {t('owner.create.photos.videoDropTitle')}
                </span>
                <span className="text-[11px] text-subtle">
                  {t('owner.create.photos.videoDropBody')}
                </span>
              </label>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted">
              {t('owner.create.details.amenitiesLabel')}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className={checkboxRowClass}>
                <input
                  type="checkbox"
                  checked={furnished}
                  onChange={(event) => setFurnished(event.target.checked)}
                  className={checkboxClass}
                />
                <span>{t('listings.amenities.furnished')}</span>
              </label>
              <label className={checkboxRowClass}>
                <input
                  type="checkbox"
                  checked={utilities}
                  onChange={(event) => setUtilities(event.target.checked)}
                  className={checkboxClass}
                />
                <span>{t('listings.amenities.utilitiesIncluded')}</span>
              </label>
              <label className={checkboxRowClass}>
                <input
                  type="checkbox"
                  checked={pets}
                  onChange={(event) => setPets(event.target.checked)}
                  className={checkboxClass}
                />
                <span>{t('listings.amenities.petsAllowed')}</span>
              </label>
              <label className={checkboxRowClass}>
                <input
                  type="checkbox"
                  checked={parking}
                  onChange={(event) => setParking(event.target.checked)}
                  className={checkboxClass}
                />
                <span>{t('listings.amenities.parking')}</span>
              </label>
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
