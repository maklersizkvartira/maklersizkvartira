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
import { Edit3, Save, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { AMENITIES, amenityStateFrom, type AmenityState } from '../../data/amenities';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button, Field, FormError, SelectInput, TextInput } from '../ui/Field';

/** Stored value for "no metro nearby"; the label is translated at render time. */
const METRO_NONE = 'NONE';

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

  const titleId = useId();
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
  // All seven, from the shared list. This form used to expose four, so the
  // three it left out — air conditioning, a washing machine, internet — could
  // be switched on while posting and never switched off again.
  const [amenities, setAmenities] = useState<AmenityState>(() => amenityStateFrom(listing));

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
      // `videoUrl` is deliberately absent rather than sent as null: video is
      // gone from the product, but a listing posted before that still has one
      // stored, and an update that names the field would wipe it on every save.
      ...amenities,
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
