/**
 * The home-page search sheet.
 *
 * It edits a local draft and commits it to the store in one go on submit:
 * `setFilters` refetches the listings, so binding the inputs straight to the
 * store would fire a request per keystroke and per dropdown change.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { TASHKENT_METRO_LINES, UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { useAppStore } from '../../stores/useAppStore';
import { Button, SelectInput } from '../ui/Field';

/** Metro only exists in and around Tashkent; 'ALL' keeps the filter reachable. */
const METRO_REGIONS = new Set(['ALL', 'Toshkent shahri', 'Toshkent viloyati']);

const ROOM_OPTIONS = [1, 2, 3, 4] as const;

const selectClass =
  'w-full appearance-none rounded-xl border border-line bg-surface-2 px-3 py-3 pr-9 ' +
  'text-sm font-bold text-content focus:border-brand focus:outline-none';

const chipClass = (active: boolean, activeTone = 'bg-brand text-on-brand') =>
  `whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
    active ? activeTone : 'border border-line bg-surface-2 text-muted hover:text-content'
  }`;

export const SearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();

  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [search, setSearch] = useState(filters.search);
  const [region, setRegion] = useState(filters.region);
  const [district, setDistrict] = useState(filters.district);
  const [metroStation, setMetroStation] = useState(filters.metroStation);
  const [rooms, setRooms] = useState<number | null>(filters.rooms);
  const [rentalType, setRentalType] = useState(filters.rentalType);
  const [audience, setAudience] = useState(filters.audience);

  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = 'home-search-modal-title';

  // Escape closes the sheet, which is the only dismissal a keyboard user has
  // besides the close button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    searchRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const districts = useMemo(() => {
    const match = UZBEKISTAN_REGIONS.find((item) => item.name === region);
    return match?.districts ?? [];
  }, [region]);

  const showMetro = METRO_REGIONS.has(region);

  const handleRegionChange = (value: string) => {
    setRegion(value);
    setDistrict('ALL');
    if (!METRO_REGIONS.has(value)) setMetroStation('ALL');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({
      search,
      region,
      district,
      metroStation: showMetro ? metroStation : 'ALL',
      rooms,
      rentalType,
      audience,
      sortBy: 'RECOMMENDED',
    });
    setCurrentView('LISTINGS');
    onClose();
  };

  return (
    <div
      className="auth-overlay fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="auth-sheet w-full overflow-hidden rounded-t-3xl bg-surface shadow-raised sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <h2 id={titleId} className="text-lg font-black text-content">
            {t('home.search.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.a11y.closeDialog')}
            className="rounded-full bg-surface-2 p-2 text-muted transition-colors hover:bg-surface-3 hover:text-content"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-1.5">
            <label htmlFor="home-search-query" className="ml-1 text-[10px] font-black uppercase text-subtle">
              {t('home.search.queryLabel')}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
                aria-hidden="true"
              />
              <input
                id="home-search-query"
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('home.search.queryPlaceholder')}
                className="w-full rounded-2xl border border-line bg-surface-2 py-4 pl-12 pr-4 text-sm font-bold text-content placeholder:text-subtle focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="home-search-region" className="ml-1 text-[10px] font-black uppercase text-subtle">
                {t('common.filters.region')}
              </label>
              <div className="relative">
                <SelectInput
                  id="home-search-region"
                  value={region}
                  onChange={(event) => handleRegionChange(event.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">{t('common.filters.all')}</option>
                  {UZBEKISTAN_REGIONS.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="home-search-district" className="ml-1 text-[10px] font-black uppercase text-subtle">
                {t('common.filters.district')}
              </label>
              <div className="relative">
                <SelectInput
                  id="home-search-district"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  disabled={districts.length === 0}
                  className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
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
          </div>

          {showMetro && (
            <div className="space-y-1.5">
              <label htmlFor="home-search-metro" className="ml-1 text-[10px] font-black uppercase text-info">
                {t('common.filters.metro')}
              </label>
              <div className="relative">
                <SelectInput
                  id="home-search-metro"
                  value={metroStation}
                  onChange={(event) => setMetroStation(event.target.value)}
                  className={`${selectClass} border-info/40 bg-info-soft`}
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
            </div>
          )}

          <fieldset className="space-y-1.5">
            <legend className="ml-1 text-[10px] font-black uppercase text-subtle">
              {t('common.filters.rooms')}
            </legend>
            <div className="flex gap-2">
              {ROOM_OPTIONS.map((count) => {
                const active = rooms === count;
                const label =
                  count === 4
                    ? t('common.filters.roomsPlus', { count })
                    : t('common.filters.roomsValue', { count });
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setRooms(active ? null : count)}
                    aria-pressed={active}
                    aria-label={label}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-colors ${
                      active
                        ? 'bg-brand text-on-brand'
                        : 'border border-line bg-surface-2 text-muted hover:text-content'
                    }`}
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

          <fieldset className="space-y-1.5">
            <legend className="ml-1 text-[10px] font-black uppercase text-subtle">
              {t('home.search.rentalTypeLabel')}
            </legend>
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setRentalType('ALL');
                  setAudience('ALL');
                }}
                aria-pressed={rentalType === 'ALL' && audience === 'ALL'}
                className={chipClass(rentalType === 'ALL' && audience === 'ALL')}
              >
                {t('common.rentalType.all')}
              </button>
              <button
                type="button"
                onClick={() => setRentalType('FULL')}
                aria-pressed={rentalType === 'FULL'}
                className={chipClass(rentalType === 'FULL')}
              >
                {t('common.rentalType.full')}
              </button>
              <button
                type="button"
                onClick={() => setRentalType('ROOMMATE')}
                aria-pressed={rentalType === 'ROOMMATE'}
                className={chipClass(
                  rentalType === 'ROOMMATE',
                  'border border-warning/50 bg-warning-soft text-warning',
                )}
              >
                {t('common.rentalType.roommate')}
              </button>
              <button
                type="button"
                onClick={() => setAudience(audience === 'STUDENT' ? 'ALL' : 'STUDENT')}
                aria-pressed={audience === 'STUDENT'}
                className={chipClass(
                  audience === 'STUDENT',
                  'border border-info/50 bg-info-soft text-info',
                )}
              >
                {t('common.audience.student')}
              </button>
            </div>
          </fieldset>

          <div className="pt-2">
            <Button type="submit" fullWidth className="py-4">
              <Search className="h-4 w-4" aria-hidden="true" />
              {t('home.search.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SearchModal;
