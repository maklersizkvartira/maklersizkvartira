/**
 * Student programme — housing around the big Tashkent campuses.
 *
 * The old version filtered whatever happened to be in the global listings
 * array, so the grid was empty until the user had visited search first. It now
 * asks the API for listings in the selected university's district. The backend
 * combines filters conjunctively and `universityName` is set on only a
 * minority of listings, so the district is the reliable proxy for "near this
 * campus" — and it is the same filter the "view all" button applies, so the
 * preview and the full result set agree.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowRight, GraduationCap, MapPin, RefreshCw, Sparkles } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import { MOCK_UNIVERSITIES } from '../../data/mockUniversities';
import type { Listing, University } from '../../types';
import { Button } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from '../listings/ListingCard';

const PREVIEW_SIZE = 6;

export const StudentProgramPage: React.FC = () => {
  const { t } = useTranslation();

  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [selectedUni, setSelectedUni] = useState<University>(MOCK_UNIVERSITIES[0]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Guards against a slow response for a previously selected campus landing
  // after a faster one for the campus the user is actually looking at.
  const requestId = useRef(0);

  const load = useCallback(async (university: University) => {
    const thisRequest = ++requestId.current;
    setLoading(true);
    setFailed(false);
    try {
      const result = await ListingsApi.list({
        district: university.district,
        audience: 'STUDENT',
        sortBy: 'RECOMMENDED',
        page: 1,
        pageSize: PREVIEW_SIZE,
      });
      if (thisRequest !== requestId.current) return;
      setListings(result.data);
    } catch {
      setListings([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedUni);
  }, [load, selectedUni]);

  const viewAll = () => {
    setFilters({ district: selectedUni.district, audience: 'STUDENT' });
    setCurrentView('LISTINGS');
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* -------------------------------------------------------------- */}
        {/* Hero                                                            */}
        {/* -------------------------------------------------------------- */}
        <section className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-10 md:flex-row">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 12% 18%, var(--color-info) 0, transparent 45%), radial-gradient(circle at 88% 8%, var(--color-brand) 0, transparent 40%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-3 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-3.5 py-1 text-[11px] font-black uppercase tracking-wide text-info">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              {t('student.hero.eyebrow')}
            </span>
            <h1 className="text-3xl font-black tracking-tight text-content sm:text-4xl">
              {t('student.hero.title')}
            </h1>
            <p className="max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
              {t('student.hero.subtitle')}
            </p>
          </div>

          <div className="relative z-10 shrink-0 space-y-1 rounded-2xl border border-line bg-surface-2 p-4 text-center">
            <span className="block text-xs font-bold uppercase tracking-wide text-subtle">
              {t('student.hero.bonusLabel')}
            </span>
            <p className="flex items-center justify-center gap-1.5 text-base font-black text-brand-text">
              <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
              {t('student.hero.bonusValue')}
            </p>
            <span className="block text-[10px] font-semibold text-subtle">
              {t('student.hero.bonusHint')}
            </span>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* University picker                                               */}
        {/* -------------------------------------------------------------- */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-content" id="student-university-picker">
            {t('student.picker.title')}
          </h2>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
            role="group"
            aria-labelledby="student-university-picker"
          >
            {MOCK_UNIVERSITIES.map((uni) => {
              const active = selectedUni.id === uni.id;
              return (
                <button
                  key={uni.id}
                  type="button"
                  onClick={() => setSelectedUni(uni)}
                  aria-pressed={active}
                  aria-label={t('student.picker.select', { name: uni.name })}
                  className={`flex flex-col items-center justify-between gap-2 rounded-2xl border p-3 text-center transition-all ${
                    active
                      ? 'border-brand bg-brand text-on-brand shadow-brand'
                      : 'border-line bg-surface text-muted hover:border-brand hover:text-brand-text'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {uni.icon}
                  </span>
                  <span>
                    <span className="block text-xs font-bold">{uni.shortName}</span>
                    <span className="block text-[10px] opacity-75">{uni.district}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Selected university + nearby listings                           */}
        {/* -------------------------------------------------------------- */}
        <section className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-info">
                {t('student.selected.eyebrow')}
              </p>
              <h3 className="text-xl font-extrabold text-content">{selectedUni.name}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                {t('student.selected.location', {
                  district: selectedUni.district,
                  city: selectedUni.city,
                })}
              </p>
            </div>

            <Button onClick={viewAll} className="shrink-0 px-5 py-2.5 text-xs">
              {t('student.selected.viewAll')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <h3 className="sr-only">
            {t('student.selected.nearby', { name: selectedUni.shortName })}
          </h3>

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <ListingCardSkeleton key={index} />
              ))}
            </div>
          ) : failed ? (
            <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft p-8 text-center">
              <p className="text-sm font-bold text-danger">{t('student.error.title')}</p>
              <p className="text-xs text-danger">{t('common.error.network')}</p>
              <Button variant="secondary" onClick={() => void load(selectedUni)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('common.error.tryAgain')}
              </Button>
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-3">
              {listings.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} priority={index < 3} />
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-8 text-center">
              <h4 className="text-sm font-bold text-content">
                {t('student.empty.title', { name: selectedUni.shortName })}
              </h4>
              <p className="text-xs text-muted">{t('student.empty.body')}</p>
              <Button variant="secondary" onClick={() => setCurrentView('LISTINGS')}>
                {t('student.empty.cta')}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudentProgramPage;
