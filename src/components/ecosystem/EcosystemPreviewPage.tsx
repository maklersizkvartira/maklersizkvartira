/**
 * The product roadmap, from today's rental marketplace to the wider ecosystem.
 *
 * Pure marketing copy: no data source, so there is nothing to load, fail or
 * empty out. The per-stage accent colours come from the status tokens, which
 * keeps the cards readable in dark mode without a second palette.
 */

import React from 'react';
import {
  Building2,
  CreditCard,
  FileText,
  Layers,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';

type StageId = 'marketplace' | 'profile' | 'agreement' | 'services' | 'mortgage';
type StatusId = 'active' | 'inProgress' | 'planned' | 'future' | 'vision';

interface Stage {
  id: StageId;
  status: StatusId;
  icon: LucideIcon;
  /** Solid fill plus the readable foreground for the icon tile. */
  accent: string;
  /** Matching text colour for the status line under the title. */
  statusColor: string;
}

const STAGES: Stage[] = [
  {
    id: 'marketplace',
    status: 'active',
    icon: ShieldCheck,
    accent: 'bg-brand text-on-brand',
    statusColor: 'text-brand-text',
  },
  {
    id: 'profile',
    status: 'inProgress',
    icon: FileText,
    accent: 'bg-info text-white',
    statusColor: 'text-info',
  },
  {
    id: 'agreement',
    status: 'planned',
    icon: CreditCard,
    accent: 'bg-info text-white',
    statusColor: 'text-info',
  },
  {
    id: 'services',
    status: 'future',
    icon: Truck,
    accent: 'bg-success text-white',
    statusColor: 'text-success',
  },
  {
    id: 'mortgage',
    status: 'vision',
    icon: Building2,
    accent: 'bg-warning text-white',
    statusColor: 'text-warning',
  },
];

export const EcosystemPreviewPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* -------------------------------------------------------------- */}
        {/* Header                                                          */}
        {/* -------------------------------------------------------------- */}
        <header className="mx-auto max-w-3xl space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-3.5 py-1 text-[11px] font-black uppercase tracking-wide text-info">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t('ecosystem.hero.eyebrow')}
          </span>
          <h1 className="text-balance text-3xl font-black tracking-tight text-content sm:text-4xl">
            {t('ecosystem.hero.title')}
          </h1>
          <p className="text-xs leading-relaxed text-muted sm:text-sm">
            {t('ecosystem.hero.subtitle')}
          </p>
        </header>

        {/* -------------------------------------------------------------- */}
        {/* Roadmap                                                         */}
        {/* -------------------------------------------------------------- */}
        <section aria-label={t('ecosystem.roadmapTitle')}>
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((stage, index) => (
              <li
                key={stage.id}
                className="flex flex-col justify-between space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-raised"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-subtle">
                    {t('ecosystem.stageLabel', { number: formatNumber(index + 1) })}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted">
                    {t(`ecosystem.stages.${stage.id}.badge`)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-card ${stage.accent}`}
                  >
                    <stage.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <h2 className="text-base font-extrabold text-content">
                      {t(`ecosystem.stages.${stage.id}.title`)}
                    </h2>
                    <span className={`text-[11px] font-semibold ${stage.statusColor}`}>
                      {t(`ecosystem.status.${stage.status}`)}
                    </span>
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-muted">
                  {t(`ecosystem.stages.${stage.id}.desc`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Call to action                                                  */}
        {/* -------------------------------------------------------------- */}
        <section className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-line bg-surface p-8 text-center shadow-raised">
          <Sparkles className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
          <h2 className="text-xl font-bold text-content">{t('ecosystem.cta.title')}</h2>
          <p className="text-xs text-muted">{t('ecosystem.cta.body')}</p>
          <Button onClick={() => setCurrentView('LISTINGS')} className="px-8">
            {t('ecosystem.cta.button')}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default EcosystemPreviewPage;
