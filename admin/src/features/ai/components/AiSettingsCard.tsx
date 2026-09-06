'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';

import { ApiError, http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  AiModelOption,
  AiSettingSource,
  AiSettings,
  AiSettingsKey,
  AiSettingsPatch,
  AiSettingsPatchResult,
} from '@/shared/api/types';
import { Link } from '@/i18n/routing';
import { useConfirm } from '@/providers/confirm-provider';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Input } from '@/shared/ui/Input';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusPill } from '@/shared/ui/StatusPill';
import { toast } from '@/shared/ui/Toast';

import { SectionHead } from './ai-kit';

/**
 * The assistant's own controls: which model answers, which model writes the
 * answer after a search, and how many searches one answer may cost.
 *
 * Three things about `PATCH /admin/ai/settings` shape this whole file:
 *
 *  · The three states of a field are all different and all reachable. OMITTING
 *    a key leaves that setting alone; `null` DELETES the stored row so the
 *    deployed environment variable takes over again; a value stores it. So the
 *    patch is built key by key from what actually moved — spreading the form
 *    state would turn "I only raised the tool budget" into a silent reset of
 *    both models, and any unknown key is a 422 besides.
 *  · A 200 does not mean anything changed. `changed` is the list of
 *    `system_settings` keys that actually moved, and an empty one is a
 *    successful no-op. A "Saved" toast fired on the status alone tells the
 *    owner they changed the model when they changed nothing.
 *  · `models` is a SUGGESTION list, not a whitelist. The backend validates a
 *    model id by charset and length only, and OpenAI ships new names faster
 *    than we redeploy, so the picker has a typed-in escape hatch. A select
 *    that offered only these eight would put the newest model out of reach.
 *
 * Reading is ADMIN, writing is SUPERADMIN, and the two are separate controls
 * rather than one disabled form: an admin sees every value and its provenance
 * and no save button, never a button that collects a 403.
 */

/** Shared with the page so a save can write straight into the read's cache. */
export const AI_SETTINGS_KEY = ['ai-settings'] as const;

/** The sentinel the model select uses for "not in the list — I will type it". */
const CUSTOM_MODEL = '__custom__';

/**
 * The backend's own charset for a model id, mirrored so a typo is caught here
 * instead of coming back as a pydantic sentence in a 422.
 */
const MODEL_ID_RE = /^[A-Za-z0-9._:-]+$/;

/**
 * 'stored' is the only one of the three that means somebody chose this here.
 * 'env' and 'inherited' are both fallbacks and both read as neutral — they are
 * told apart by their labels, which say different things, not by colour.
 */
const SOURCE_VARIANT: Record<AiSettingSource, BadgeVariant> = {
  stored: 'info',
  env: 'neutral',
  inherited: 'neutral',
};

/**
 * Remounts the form whenever the server's answer differs from the one it was
 * seeded with — the same `key=` trick `ListingSheet` uses to reseed itself for
 * a different row. It is what puts the form back in step after a save without
 * an effect that could also wipe a half-typed value under a background
 * refetch.
 */
function formSignature(settings: AiSettings): string {
  return [
    settings.chatModel,
    settings.reasoningModel,
    settings.maxToolSteps,
    settings.sources.chatModel,
    settings.sources.reasoningModel,
    settings.sources.maxToolSteps,
  ].join('|');
}

interface AiSettingsCardProps {
  /** SUPERADMIN. Gates the save button and all three reset buttons. */
  canWrite: boolean;
}

export function AiSettingsCard({ canWrite }: AiSettingsCardProps) {
  const t = useTranslations('ai');
  const c = useTranslations('common');

  const settings = useQuery({
    queryKey: AI_SETTINGS_KEY,
    queryFn: ({ signal }) => http.get<AiSettings>(api.ai.settings, { signal }),
  });

  const data = settings.data;

  return (
    <section className="card tone-accent p-5">
      <SectionHead
        icon={<SlidersHorizontal size={17} />}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        aside={
          data?.assistantEnabled ? (
            <StatusPill status="ACTIVE" label={t('settings.assistantEnabled')} pulse />
          ) : null
        }
      />

      {settings.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton height={38} />
          <Skeleton height={38} />
          <Skeleton height={38} width="45%" />
        </div>
      ) : settings.error ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle size={26} />}
          title={c('error')}
          description={settings.error.message}
          size="sm"
          action={
            <Button variant="secondary" onClick={() => void settings.refetch()}>
              {c('retry')}
            </Button>
          }
        />
      ) : data ? (
        <>
          {/* The key being absent does not stop anybody editing these values —
              they are stored either way and take effect the moment a key is
              added — but it is the reason the assistant is silent on the site,
              and that belongs above the form rather than in a support call. */}
          {!data.assistantEnabled && (
            <p
              className="flex items-start gap-2 text-xs leading-relaxed mb-4 p-3 rounded-[var(--radius-md)]"
              style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              {t('settings.assistantDisabled')}
            </p>
          )}

          <SettingsForm key={formSignature(data)} settings={data} canWrite={canWrite} />
        </>
      ) : null}
    </section>
  );
}

interface SettingsFormProps {
  settings: AiSettings;
  canWrite: boolean;
}

function SettingsForm({ settings, canWrite }: SettingsFormProps) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const { defaults, limits, sources } = settings;

  const [chatModel, setChatModel] = useState(settings.chatModel);
  const [reasoningModel, setReasoningModel] = useState(settings.reasoningModel);
  /**
   * Whether the reasoning box has been touched in this session.
   *
   * While the reasoning tier is 'inherited' its effective value IS the everyday
   * model, so the box mirrors the everyday box rather than sitting on the value
   * the server sent: changing the everyday model to `gpt-4.1` and being left
   * looking at `gpt-4o-mini` underneath it is a preview of something that will
   * not happen. The first edit of the box breaks the mirror and pins a value of
   * its own.
   */
  const [reasoningTouched, setReasoningTouched] = useState(false);
  const [maxToolSteps, setMaxToolSteps] = useState(String(settings.maxToolSteps));

  const inherits = sources.reasoningModel === 'inherited' && !reasoningTouched;
  const reasoningValue = inherits ? chatModel : reasoningModel;

  const save = useMutation({
    mutationFn: (patch: AiSettingsPatch) =>
      http.patch<AiSettingsPatchResult>(api.ai.patchSettings, patch),
    onSuccess: (result) => {
      // The answer is a full, refreshed `AiSettings`, so it is written into the
      // cache rather than triggering a second round trip. The signature above
      // changes with it and the form reseeds itself from the saved values.
      queryClient.setQueryData(AI_SETTINGS_KEY, result);

      if (result.changed.length === 0) {
        // A successful no-op: the request asked for what was already stored.
        toast.info(t('settings.noChanges'));
        return;
      }
      toast.success(t('settings.saved', { count: result.changed.length }));
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.code : null;
      toast.error(
        c('error'),
        code === 'ai_settings_empty'
          ? t('settings.errors.empty')
          : error.message || t('settings.errors.save'),
      );
    },
  });

  const modelValid = (value: string) =>
    value.length > 0 && value.length <= limits.modelIdMaxLength && MODEL_ID_RE.test(value);

  const stepsNumber = Number(maxToolSteps);
  const stepsValid =
    maxToolSteps.trim() !== '' &&
    Number.isInteger(stepsNumber) &&
    stepsNumber >= limits.minToolSteps &&
    stepsNumber <= limits.maxToolSteps;

  const invalidModel = t('settings.errors.invalidModel', { max: limits.modelIdMaxLength });
  const chatError = modelValid(chatModel) ? undefined : invalidModel;
  const reasoningError = modelValid(reasoningValue) ? undefined : invalidModel;
  const stepsError = stepsValid
    ? undefined
    : t('settings.errors.range', { min: limits.minToolSteps, max: limits.maxToolSteps });
  const invalid = Boolean(chatError || reasoningError || stepsError);

  /**
   * Only what moved, field by field. An untouched inherited reasoning tier is
   * never sent: it would store the everyday model as a value of its own and
   * quietly stop following it.
   */
  const patch: AiSettingsPatch = {};
  if (chatModel !== settings.chatModel) patch.chatModel = chatModel;
  if (!inherits && reasoningModel !== settings.reasoningModel) patch.reasoningModel = reasoningModel;
  if (stepsValid && stepsNumber !== settings.maxToolSteps) patch.maxToolSteps = stepsNumber;
  const dirty = Object.keys(patch).length > 0;

  const busy = save.isPending;
  const disabled = !canWrite || busy;

  const label: Record<AiSettingsKey, string> = {
    ai_chat_model: t('settings.chatModel'),
    ai_reasoning_model: t('settings.reasoningModel'),
    ai_max_tool_steps: t('settings.maxToolSteps'),
  };

  /** What a reset lands on, written the way the field's own hint writes it. */
  const defaultText = (key: AiSettingsKey): string => {
    if (key === 'ai_chat_model') return t('settings.defaultValue', { value: defaults.chatModel });
    if (key === 'ai_max_tool_steps') {
      return t('settings.defaultValue', { value: defaults.maxToolSteps });
    }
    return defaults.reasoningModel === null
      ? t('settings.defaultInherits')
      : t('settings.defaultValue', { value: defaults.reasoningModel });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite || invalid) return;
    if (!dirty) {
      toast.info(t('settings.noChanges'));
      return;
    }

    /*
     * Every one of these changes what the assistant runs on for every visitor
     * of the site at once, so it goes through the same confirmation the
     * monetization switch does — and the dialog names the value it is leaving
     * as well as the one it is taking, because "are you sure" on its own tells
     * a reader nothing they did not already know.
     */
    const lines: string[] = [];
    if (patch.chatModel !== undefined) {
      lines.push(`${label.ai_chat_model}: ${settings.chatModel} → ${patch.chatModel}`);
    }
    if (patch.reasoningModel !== undefined) {
      lines.push(`${label.ai_reasoning_model}: ${settings.reasoningModel} → ${patch.reasoningModel}`);
    }
    if (patch.maxToolSteps !== undefined) {
      lines.push(`${label.ai_max_tool_steps}: ${settings.maxToolSteps} → ${patch.maxToolSteps}`);
    }

    const ok = await confirm({
      title: t('settings.save'),
      message: lines.join(' · '),
      confirmLabel: t('settings.save'),
      cancelLabel: c('cancel'),
    });
    if (!ok) return;

    save.mutate(patch);
  };

  /**
   * Reset is its own action, not a staged form value: `null` deletes the stored
   * row so the deployed variable applies again, which is a different outcome
   * from typing the default in by hand — that would store a copy of it and stop
   * following the deployment. Offered only where there is a stored row to
   * delete, i.e. where the source badge says 'stored'.
   *
   * Like any other save it re-seeds the whole form from the server's answer, so
   * an unsaved edit to a DIFFERENT field is dropped rather than carried across.
   * That is the safe direction: what is on screen afterwards is what the
   * backend holds, and nothing half-typed is ever sent by a control that only
   * named one setting.
   */
  const reset = async (key: AiSettingsKey) => {
    const from =
      key === 'ai_chat_model'
        ? settings.chatModel
        : key === 'ai_reasoning_model'
          ? settings.reasoningModel
          : String(settings.maxToolSteps);

    const ok = await confirm({
      title: t('settings.reset'),
      message: `${label[key]}: ${from} → ${defaultText(key)}`,
      confirmLabel: t('settings.reset'),
      cancelLabel: c('cancel'),
    });
    if (!ok) return;

    save.mutate(
      key === 'ai_chat_model'
        ? { chatModel: null }
        : key === 'ai_reasoning_model'
          ? { reasoningModel: null }
          : { maxToolSteps: null },
    );
  };

  /**
   * What sits at the end of a field's footnote row.
   *
   * A stored value is one somebody chose, and the first question about a model
   * that has been changed is who changed it and from what. The PATCH writes an
   * audit row per key for exactly that, so the link is the other half of it —
   * without it the panel keeps the record and offers no way to read it.
   * A value still on the deployed default has no history to show, and nothing
   * to reset.
   */
  const fieldActions = (key: AiSettingsKey, source: AiSettingSource) =>
    source === 'stored' ? (
      <div className="flex flex-wrap items-center gap-1">
        <Link href="/audit" className="text-xs font-medium text-[var(--accent)] hover:underline">
          {t('settings.historyLink')}
        </Link>
        {resetButton(key, source)}
      </div>
    ) : null;

  const resetButton = (key: AiSettingsKey, source: AiSettingSource) =>
    canWrite && source === 'stored' ? (
      // `sm`, and 44px on a phone. `xs` is `h-7` — a 28px target, and the only
      // use of that size in the panel — on the one control that can hand a
      // setting back to the deployed default. The panel's own idiom for this
      // is three files away in SmsScreen's facets: a tap target first and a
      // chip second.
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="max-sm:h-11 max-sm:px-4"
        icon={<RotateCcw size={12} />}
        onClick={() => void reset(key)}
        disabled={busy}
      >
        {t('settings.reset')}
      </Button>
    ) : null;

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field
          label={label.ai_chat_model}
          hint={t('settings.chatModelHint')}
          source={sources.chatModel}
          sourceLabel={t(`settings.source.${sources.chatModel}` as Parameters<typeof t>[0])}
          footnote={`${defaultText('ai_chat_model')} · ${t(
            `settings.sourceHint.${sources.chatModel}` as Parameters<typeof t>[0],
          )}`}
          action={fieldActions('ai_chat_model', sources.chatModel)}
        >
          <ModelPicker
            models={settings.models}
            value={chatModel}
            onChange={setChatModel}
            disabled={disabled}
            error={chatError}
          />
        </Field>

        <Field
          label={label.ai_reasoning_model}
          hint={t('settings.reasoningModelHint')}
          source={sources.reasoningModel}
          sourceLabel={t(`settings.source.${sources.reasoningModel}` as Parameters<typeof t>[0])}
          footnote={`${defaultText('ai_reasoning_model')} · ${t(
            `settings.sourceHint.${sources.reasoningModel}` as Parameters<typeof t>[0],
          )}`}
          action={fieldActions('ai_reasoning_model', sources.reasoningModel)}
        >
          <ModelPicker
            models={settings.models}
            value={reasoningValue}
            onChange={(next) => {
              setReasoningTouched(true);
              setReasoningModel(next);
            }}
            disabled={disabled}
            error={reasoningError}
          />
        </Field>
      </div>

      <div className="lg:max-w-[50%] lg:pr-2.5">
        <Field
          label={label.ai_max_tool_steps}
          hint={t('settings.maxToolStepsHint', { min: limits.minToolSteps, max: limits.maxToolSteps })}
          source={sources.maxToolSteps}
          sourceLabel={t(`settings.source.${sources.maxToolSteps}` as Parameters<typeof t>[0])}
          footnote={`${defaultText('ai_max_tool_steps')} · ${t(
            `settings.sourceHint.${sources.maxToolSteps}` as Parameters<typeof t>[0],
          )}`}
          action={fieldActions('ai_max_tool_steps', sources.maxToolSteps)}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={limits.minToolSteps}
            max={limits.maxToolSteps}
            step={1}
            value={maxToolSteps}
            onChange={(event) => setMaxToolSteps(event.target.value)}
            disabled={disabled}
            error={stepsError}
            aria-label={label.ai_max_tool_steps}
            className="max-w-[140px]"
          />
        </Field>
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            icon={<Save size={14} />}
            loading={busy}
            disabled={!dirty || invalid}
          >
            {busy ? t('settings.saving') : t('settings.save')}
          </Button>
          {dirty && !busy && (
            <span className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>
              {t('settings.unsaved')}
            </span>
          )}
          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {t('settings.resetHint')}
          </span>
        </div>
      ) : (
        /* An ADMIN reads every value and its provenance and is told plainly who
           may change it — rather than being given a save button that the
           backend answers with a 403. */
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('settings.readOnly')}
        </p>
      )}
    </form>
  );
}

interface FieldProps {
  label: string;
  hint: string;
  source: AiSettingSource;
  sourceLabel: string;
  /** The default this field falls back to, plus what its source badge means. */
  footnote: string;
  /** The reset button, when there is a stored row to delete. */
  action: ReactNode;
  children: ReactNode;
}

/**
 * One setting: what it is, where its current value came from, what clearing it
 * would land on, and the control itself.
 *
 * The provenance badge is not decoration. A screen that shows a value without
 * saying which layer it came from invites somebody to "change" a setting that
 * was never stored and then wonder why the badge never moves.
 */
function Field({ label, hint, source, sourceLabel, footnote, action, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <Badge variant={SOURCE_VARIANT[source]} label={sourceLabel} />
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {hint}
      </p>

      {children}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {footnote}
        </p>
        {action}
      </div>
    </div>
  );
}

interface ModelPickerProps {
  models: AiModelOption[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}

/**
 * The suggestion list, plus a way past it.
 *
 * `custom` is derived rather than stored on its own, so a value the list does
 * not contain — one typed here before, or one inherited from the everyday
 * model — opens straight into the text box instead of leaving the select
 * showing a placeholder for a model that is genuinely configured.
 */
function ModelPicker({ models, value, onChange, disabled, error }: ModelPickerProps) {
  const t = useTranslations('ai');
  const [customRequested, setCustomRequested] = useState(false);

  const known = models.some((model) => model.id === value);
  const custom = customRequested || !known;

  const options: SelectOption[] = [
    ...models.map((model) => ({
      value: model.id,
      label: `${model.id} · ${t(`settings.tier.${model.tier}` as Parameters<typeof t>[0])}`,
    })),
    { value: CUSTOM_MODEL, label: t('settings.modelCustom') },
  ];

  return (
    <div className="flex flex-col gap-2">
      <Select
        options={options}
        value={custom ? CUSTOM_MODEL : value}
        onChange={(next) => {
          if (next === CUSTOM_MODEL) {
            // The current value stays in the box as the starting point rather
            // than emptying it — most custom names are a suffix away from a
            // listed one.
            setCustomRequested(true);
            return;
          }
          setCustomRequested(false);
          onChange(next);
        }}
        disabled={disabled}
        placeholder={t('settings.modelPlaceholder')}
      />

      {custom && (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('settings.modelPlaceholder')}
          hint={t('settings.modelCustomHint')}
          error={error}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label={t('settings.modelCustom')}
          fullWidth
        />
      )}
    </div>
  );
}
