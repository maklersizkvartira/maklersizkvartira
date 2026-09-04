/**
 * Choosing where the flat is, on a map, from anywhere.
 *
 * The form had one way to set coordinates: the phone's GPS. That works only
 * if the person filling it in is standing outside the property — which is the
 * one place an owner is least likely to be while writing a listing. Anybody
 * posting from home had no way to say where the flat was beyond a district and
 * a street name, and a listing without coordinates never appears on the map
 * page at all.
 *
 * The map opens on the best guess available, in this order: a point already
 * chosen, the centre of the district the form has selected, then Tashkent.
 * Somebody who has already picked their district therefore starts a street
 * away from the answer rather than a country away.
 *
 * Nothing is written to the form until "confirm" — the sheet can be opened,
 * panned around and dismissed without changing anything, which is what makes
 * it safe to open out of curiosity.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { createMapEngine, type LatLng, type MapEngine } from '../map/engine';
import { districtCentre } from '../../services/geocoding';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../ui/Field';

/** Tashkent, for a form that has not said anything about where it is yet. */
const TASHKENT: LatLng = [41.2995, 69.2401];

/** Close enough to see individual buildings, which is the point of picking. */
const PICK_ZOOM = 16;

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  /** Where the form already points, if anywhere. */
  value: LatLng | null;
  /** The district selected on the form, used to frame the first view. */
  district?: string;
  onConfirm: (position: LatLng) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  open,
  onClose,
  value,
  district,
  onConfirm,
}) => {
  const { t, language } = useTranslation();
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const [picked, setPicked] = useState<LatLng | null>(value);
  const [ready, setReady] = useState(false);

  // The marker is drawn through `setMarkers`, the same path the map page uses,
  // so it inherits whatever the engine already knows how to draw.
  const showMarker = (engine: MapEngine, position: LatLng) => {
    engine.setMarkers(
      [
        {
          id: 'picked',
          position,
          label: '',
          // The engines mount whatever markup they are handed; a bare pin is
          // all this needs, since there is exactly one and it is the answer.
          html:
            '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
            'background:#1447e6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></span>',
        },
      ],
      () => undefined,
    );
  };

  useEffect(() => {
    if (!open || !containerRef.current) return;
    let cancelled = false;

    const start = value ?? (district ? districtCentre(district) : null) ?? TASHKENT;

    void createMapEngine(containerRef.current, {
      center: start,
      zoom: PICK_ZOOM,
      dark: isDark,
      language,
      zoomInTitle: t('map.a11y.zoomIn'),
      zoomOutTitle: t('map.a11y.zoomOut'),
    }).then((engine) => {
      // The sheet can close while the map is still loading — Yandex is a
      // network round trip — and an engine created after that would attach to
      // a container React has already removed.
      if (cancelled) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      setReady(true);
      if (value) showMarker(engine, value);
      engine.onClick((position) => {
        setPicked(position);
        showMarker(engine, position);
      });
    });

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      setReady(false);
    };
    // `value` and `district` seed the first view only; re-running on either
    // would rebuild the map under somebody who is already panning it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDark, language]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-end justify-center bg-[var(--overlay)] backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('owner.create.location.pickTitle')}
        className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface sm:h-[80vh] sm:max-w-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <h2 className="text-base font-black text-content">
              {t('owner.create.location.pickTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {t('owner.create.location.pickBody')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.action.close')}
            className="press -m-1 rounded-xl p-2 text-subtle hover:bg-surface-2 hover:text-content"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
              <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-line p-4">
          {/* The coordinates are shown, not hidden. Somebody who pinned the
              wrong building has no other way to tell before publishing, and
              the numbers are the only part of this the form actually keeps. */}
          <p className="flex items-center gap-2 text-xs font-semibold text-muted">
            <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            {picked
              ? `${picked[0].toFixed(5)}, ${picked[1].toFixed(5)}`
              : t('owner.create.location.pickHint')}
          </p>
          <Button
            type="button"
            fullWidth
            disabled={!picked}
            onClick={() => {
              if (picked) onConfirm(picked);
            }}
          >
            {t('owner.create.location.pickConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
