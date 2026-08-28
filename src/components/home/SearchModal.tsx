/**
 * The home-page search sheet.
 *
 * It edits a local draft and commits it to the store in one go on submit:
 * `setFilters` refetches the listings, so binding the inputs straight to the
 * store would fire a request per keystroke and per dropdown change. That
 * single commit is the whole design of this file — every control below writes
 * to `draft`, and `handleSubmit` is the only place that touches the store.
 *
 * It used to offer seven of the store's fields and hide the rest, so the
 * price range, the sort order and the amenities — all of which the API has
 * always supported — could only be reached by opening the listings page and
 * finding the filter panel there. They are here now, behind a disclosure, so
 * the common search stays four taps long.
 *
 * The overlay is the shared <Sheet>: this file used to hand-roll it, which is
 * how it ended up with no scroll lock, no focus trap and a submit button
 * sitting underneath the iPhone home indicator.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { TASHKENT_METRO_LINES, UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import {
  activeQuickFilter,
  DEFAULT_FILTERS,
  quickFilterState,
  useAppStore,
  type Filters,
  type QuickFilterId,
} from '../../stores/useAppStore';
import { Button, SelectInput, TextInput } from '../ui/Field';
import { Chip, ChipRow } from '../ui/Chip';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';

/** Metro only exists in and around Tashkent; 'ALL' keeps the filter reachable. */
const METRO_REGIONS = new Set(['ALL', 'Toshkent shahri', 'Toshkent viloyati']);

const ROOM_OPTIONS = [1, 2, 3, 4] as const;

/** The three newest categories, offered here as one tap instead of five. */
const PRESETS: { id: QuickFilterId; labelKey: TranslationKey }[] = [
  { id: 'qizlarga', labelKey: 'listings.filters.quick.qizlarga' },
  { id: 'komfort', labelKey: 'listings.filters.quick.komfort' },
  { id: 'center', labelKey: 'listings.filters.quick.center' },
];

/**
 * Amenities, keyed exactly as the query string spells them.
 *
 * `toQuery` turns each entry into `?<name>=true`, and the backend reads
 * `furnished`, `airConditioning`, … — a near-miss like `air_conditioning`
 * would be forwarded, ignored, and leave a checked box that filters nothing.
 */
const AMENITIES: { id: string; labelKey: TranslationKey }[] = [
  { id: 'furnished', labelKey: 'listings.amenities.furnished' },
  { id: 'airConditioning', labelKey: 'listings.amenities.airConditioning' },
  { id: 'washingMachine', labelKey: 'listings.amenities.washingMachine' },
  { id: 'internet', labelKey: 'listings.amenities.internet' },
  { id: 'parking', labelKey: 'listings.amenities.parking' },
  { id: 'petsAllowed', labelKey: 'listings.amenities.petsAllowed' },
];

/** Only the orders the backend implements; there is no AREA sort. */
const SORT_OPTIONS: { value: NonNullable<Filters['sortBy']>; labelKey: TranslationKey }[] = [
  { value: 'RECOMMENDED', labelKey: 'listings.filters.sort.recommended' },
  { value: 'NEWEST', labelKey: 'listings.filters.sort.newest' },
  { value: 'PRICE_LOW', labelKey: 'listings.filters.sort.priceLow' },
  { value: 'PRICE_HIGH', labelKey: 'listings.filters.sort.priceHigh' },
  { value: 'TRUST', labelKey: 'listings.filters.sort.trust' },
  { value: 'POPULAR', labelKey: 'listings.filters.sort.popular' },
];

const labelClass = 'ml-1 block text-[10px] font-black uppercase tracking-wide text-subtle';

/*
 * The three text boxes below are <TextInput>, not a local class string.
 *
 * This sheet used to declare its own `text-sm px-3 font-bold` input style,
 * which is 14px — under the 16px at which iOS Safari zooms the viewport on
 * focus and does not zoom back out. The shared primitive carries that 16px for
 * exactly the reason its own comment gives, plus `min-h-11` and
 * `touch-manipulation`, and it lines its 16px side padding up with the
 * dropdowns sitting in the same form.
 */

/** Digits only: the field accepts a pasted "1 200 000" and stores 1200000. */
function parseAmount(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();

  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [draft, setDraft] = useState<Filters>(() => ({ ...filters }));
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.amenities.length > 0 ||
      filters.sortBy !== 'RECOMMENDED',
  );

  /**
   * The sheet no longer unmounts between openings — <Sheet> renders nothing
   * while closed, but this component stays mounted to own that `open` prop —
   * so the draft has to be re-seeded on the way in. Without it, filters
   * changed on the listings page would be invisible here, and the sheet would
   * silently commit last week's draft over them.
   */
  useEffect(() => {
    if (!open) return;
    setDraft({ ...filters });
    setShowAdvanced(
      filters.minPrice !== null ||
        filters.maxPrice !== null ||
        filters.amenities.length > 0 ||
        filters.sortBy !== 'RECOMMENDED',
    );
    // Deliberately keyed on `open` alone: re-seeding whenever `filters`
    // changes would throw away what the visitor is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (patch: Partial<Filters>) => setDraft((current) => ({ ...current, ...patch }));

  const districts = useMemo(() => {
    const match = UZBEKISTAN_REGIONS.find((item) => item.name === draft.region);
    return match?.districts ?? [];
  }, [draft.region]);

  const showMetro = METRO_REGIONS.has(draft.region);

  const handleRegionChange = (value: string) => {
    // A district from the previous region is not a district of this one, and
    // committing the pair would return nothing at all.
    update({
      region: value,
      district: 'ALL',
      ...(METRO_REGIONS.has(value) ? {} : { metroStation: 'ALL' }),
    });
  };

  /**
   * `audience: 'FAMILY'` means "two rooms or more, whole flat"; `rentalType:
   * 'ROOMMATE'` means "a room in a shared flat". Committing both asks the
   * server for a listing that is and is not a share, which returns zero rows
   * every time — an empty result the visitor has no way to read as a
   * contradiction. So each one steps aside for the other.
   */
  const handleRentalType = (value: Filters['rentalType']) =>
    update({
      rentalType: value,
      ...(value === 'ROOMMATE' && draft.audience === 'FAMILY' ? { audience: 'ALL' } : {}),
    });

  const handleAudience = (value: Filters['audience']) =>
    update({
      audience: value,
      ...(value === 'FAMILY' && draft.rentalType === 'ROOMMATE' ? { rentalType: 'FULL' } : {}),
    });

  const toggleAmenity = (id: string) =>
    update({
      amenities: draft.amenities.includes(id)
        ? draft.amenities.filter((item) => item !== id)
        : [...draft.amenities, id],
    });

  // A preset replaces the draft rather than adding to it — the same whole-set
  // rule the catalogue chips and the home tiles follow, so "for women" never
  // arrives silently narrowed by whatever was left in the sheet from the last
  // search. The typed query survives: it is the visitor's own words.
  const applyPreset = (id: QuickFilterId) => setDraft(quickFilterState(id, draft.search));

  /** Which preset the draft currently *is* — the store owns that comparison. */
  const activePreset = activeQuickFilter(draft);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({
      ...draft,
      // The metro select is not rendered outside Tashkent, so a station left
      // over from a previous region must not travel with the commit.
      metroStation: showMetro ? draft.metroStation : 'ALL',
    });
    setCurrentView('LISTINGS');
    onClose();
  };

  const formId = 'home-search-form';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('home.search.title')}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="px-4"
            onClick={() => setDraft({ ...DEFAULT_FILTERS })}
          >
            {t('home.search.reset')}
          </Button>
          <Button type="submit" form={formId} fullWidth>
            <Search className="h-4 w-4" aria-hidden="true" />
            {t('home.search.submit')}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5 pt-1">
        <ChipRow label={t('listings.filters.quickLabel')}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={t(preset.labelKey)}
              selected={activePreset === preset.id}
              onClick={() => applyPreset(preset.id)}
            />
          ))}
        </ChipRow>

        <div className="space-y-1.5">
          <label htmlFor="home-search-query" className={labelClass}>
            {t('home.search.queryLabel')}
          </label>
          {/* The icon goes through `icon`, which owns both its position and the
              matching `pl-11`; a hand-placed one on top of that would be
              offset twice. Only the pill shape and the taller box are ours. */}
          <TextInput
            id="home-search-query"
            type="search"
            value={draft.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder={t('home.search.queryPlaceholder')}
            icon={<Search className="h-5 w-5 text-brand" />}
            className="rounded-2xl py-4"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="home-search-region" className={labelClass}>
              {t('home.search.regionLabel')}
            </label>
            <SelectInput
              id="home-search-region"
              value={draft.region}
              onChange={(event) => handleRegionChange(event.target.value)}
            >
              <option value="ALL">{t('common.filters.all')}</option>
              {UZBEKISTAN_REGIONS.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="home-search-district" className={labelClass}>
              {t('home.search.districtLabel')}
            </label>
            <SelectInput
              id="home-search-district"
              value={draft.district}
              onChange={(event) => update({ district: event.target.value })}
              disabled={districts.length === 0}
            >
              <option value="ALL">{t('common.filters.all')}</option>
              {districts.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        {showMetro && (
          <div className="space-y-1.5">
            <label htmlFor="home-search-metro" className={cn(labelClass, 'text-info')}>
              {t('home.search.metroLabel')}
            </label>
            <SelectInput
              id="home-search-metro"
              value={draft.metroStation}
              onChange={(event) => update({ metroStation: event.target.value })}
            >
              <option value="ALL">{t('home.search.metroAll')}</option>
              {TASHKENT_METRO_LINES.map((line) => (
                <optgroup key={line.id} label={line.name}>
                  {line.stations.map((station) => (
                    <option key={station} value={station}>
                      {t('home.search.metroStation', { station })}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectInput>
          </div>
        )}

        <fieldset className="space-y-1.5">
          <legend className={labelClass}>{t('home.search.roomsLabel')}</legend>
          <div className="flex gap-2">
            {ROOM_OPTIONS.map((count) => {
              const active = draft.rooms === count;
              const label =
                count === 4
                  ? t('common.filters.roomsPlus', { count })
                  : t('common.filters.roomsValue', { count });
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => update({ rooms: active ? null : count })}
                  aria-pressed={active}
                  aria-label={label}
                  className={cn(
                    'press min-h-11 flex-1 rounded-xl text-sm font-extrabold',
                    active
                      ? 'bg-brand text-on-brand'
                      : 'border border-line bg-surface-2 text-muted hover:text-content',
                  )}
                >
                  <span aria-hidden="true">
                    {count}
                    {count === 4 ? '+' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <span className={labelClass}>{t('home.search.rentalTypeLabel')}</span>
          <Segmented
            value={draft.rentalType}
            onChange={handleRentalType}
            label={t('home.search.rentalTypeLabel')}
            size="sm"
            options={[
              { value: 'ALL', label: t('common.rentalType.all') },
              { value: 'FULL', label: t('common.rentalType.full') },
              { value: 'ROOMMATE', label: t('common.rentalType.roommate') },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <span className={labelClass}>{t('home.search.audienceLabel')}</span>
          <Segmented
            value={draft.audience}
            onChange={handleAudience}
            label={t('home.search.audienceLabel')}
            size="sm"
            options={[
              { value: 'ALL', label: t('common.audience.all') },
              { value: 'STUDENT', label: t('common.audience.student') },
              { value: 'FAMILY', label: t('common.audience.family') },
            ]}
          />
        </div>

        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={showAdvanced}
            className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 text-sm font-black text-content"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-brand" aria-hidden="true" />
              {showAdvanced ? t('home.search.advancedHide') : t('home.search.advancedShow')}
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-5">
              <fieldset className="space-y-1.5">
                <legend className={labelClass}>{t('home.search.priceLabel')}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    value={draft.minPrice ?? ''}
                    onChange={(event) => update({ minPrice: parseAmount(event.target.value) })}
                    placeholder={t('home.search.priceMinPlaceholder')}
                    aria-label={t('listings.filters.minPrice')}
                  />
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    value={draft.maxPrice ?? ''}
                    onChange={(event) => update({ maxPrice: parseAmount(event.target.value) })}
                    placeholder={t('home.search.priceMaxPlaceholder')}
                    aria-label={t('listings.filters.maxPrice')}
                  />
                </div>
                {draft.minPrice === null && draft.maxPrice === null && (
                  <p className="ml-1 text-[11px] font-medium text-subtle">
                    {t('home.search.priceAny')}
                  </p>
                )}
              </fieldset>

              <div className="space-y-1.5">
                <label htmlFor="home-search-sort" className={labelClass}>
                  {t('home.search.sortLabel')}
                </label>
                <SelectInput
                  id="home-search-sort"
                  value={draft.sortBy ?? 'RECOMMENDED'}
                  onChange={(event) =>
                    update({ sortBy: event.target.value as Filters['sortBy'] })
                  }
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <fieldset className="min-w-0 space-y-1.5">
                <legend className={labelClass}>{t('home.search.amenitiesLabel')}</legend>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity.id}
                      label={t(amenity.labelKey)}
                      size="sm"
                      selected={draft.amenities.includes(amenity.id)}
                      onClick={() => toggleAmenity(amenity.id)}
                    />
                  ))}
                </div>
                <p className="ml-1 text-[11px] font-medium text-subtle">
                  {t('home.search.amenitiesHint')}
                </p>
              </fieldset>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
};

export default SearchModal;
