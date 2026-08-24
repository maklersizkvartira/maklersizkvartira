/**
 * Verification centre.
 *
 * The five-level ladder is explained here and driven by two endpoints:
 * `AuthApi.submitVerification` queues a document for a moderator, and
 * `AuthApi.myVerifications` reports what happened to it. Nothing on this page
 * grants a level by itself — the level shown always comes from the server
 * (`currentUser.verificationLevel`), so a refused document cannot be papered
 * over by optimistic local state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Lock,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Video,
  XCircle,
  Zap,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { AuthApi } from '../../services/authApi';
import { ApiError } from '../../services/http';
import { useAppStore } from '../../stores/useAppStore';
import { Button, TextInput } from '../ui/Field';

type LadderLevel = 1 | 2 | 3 | 4 | 5;
type StepState = 'approved' | 'pending' | 'rejected' | 'locked' | 'todo';
type DocumentType = 'PASSPORT' | 'ID_CARD' | 'CADASTRE' | 'SELFIE_LIVENESS';

const LADDER: LadderLevel[] = [1, 2, 3, 4, 5];

interface VerificationRequestRow {
  id: string;
  targetLevel: number;
  documentType: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
}

/** An uploaded document, already encoded as the data URL the API expects. */
interface UploadedFile {
  dataUrl: string;
  isImage: boolean;
}

/** The example listing in the before/after comparison — illustration only. */
const EXAMPLE_PRICE = 4_500_000;
const EXAMPLE_TRUST_BEFORE = 70;
const EXAMPLE_TRUST_AFTER = 98;

/** Per-level copy, kept as a table so `t()` still sees literal key paths. */
const STEP_KEYS = {
  1: {
    short: 'verification.steps.l1.short',
    reward: 'verification.steps.l1.reward',
    title: 'verification.steps.l1.title',
    description: 'verification.steps.l1.description',
  },
  2: {
    short: 'verification.steps.l2.short',
    reward: 'verification.steps.l2.reward',
    title: 'verification.steps.l2.title',
    description: 'verification.steps.l2.description',
  },
  3: {
    short: 'verification.steps.l3.short',
    reward: 'verification.steps.l3.reward',
    title: 'verification.steps.l3.title',
    description: 'verification.steps.l3.description',
  },
  4: {
    short: 'verification.steps.l4.short',
    reward: 'verification.steps.l4.reward',
    title: 'verification.steps.l4.title',
    description: 'verification.steps.l4.description',
  },
  5: {
    short: 'verification.steps.l5.short',
    reward: 'verification.steps.l5.reward',
    title: 'verification.steps.l5.title',
    description: 'verification.steps.l5.description',
  },
} as const;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

// ---------------------------------------------------------------------------
// File handling
// ---------------------------------------------------------------------------
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Phone cameras produce 8+ MP files, and the base64 of one of those routinely
 * blows past the request timeout. A moderator only needs a legible copy, so the
 * long edge is capped before the document ever leaves the browser.
 */
function downscaleImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
      if (scale === 1 && dataUrl.length <= MAX_UPLOAD_BYTES) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function prepareUpload(file: File): Promise<UploadedFile> {
  const isImage = file.type.startsWith('image/');
  const raw = await readAsDataUrl(file);
  const dataUrl = isImage ? await downscaleImage(raw) : raw;
  if (dataUrl.length > MAX_UPLOAD_BYTES) throw new Error('too-large');
  return { dataUrl, isImage };
}

// ---------------------------------------------------------------------------
export const VerificationPage: React.FC = () => {
  const { t, formatNumber, formatPrice, formatDate } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const pushToast = useAppStore((state) => state.pushToast);

  const passportInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cadastreInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeStep, setActiveStep] = useState<LadderLevel>(2);
  const [requests, setRequests] = useState<VerificationRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [documentType, setDocumentType] = useState<'PASSPORT' | 'ID_CARD'>('PASSPORT');
  const [passportFile, setPassportFile] = useState<UploadedFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<UploadedFile | null>(null);
  const [cadastreFile, setCadastreFile] = useState<UploadedFile | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const currentLevel = currentUser?.verificationLevel ?? 0;

  // -- Requests ------------------------------------------------------------
  const loadRequests = useCallback(async () => {
    if (!currentUser) {
      setRequests([]);
      return;
    }
    setRequestsLoading(true);
    setRequestsError(false);
    try {
      const response = await AuthApi.myVerifications();
      setRequests(response.data ?? []);
    } catch {
      setRequests([]);
      setRequestsError(true);
    } finally {
      setRequestsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  /** The latest attempt per level decides what that step shows. */
  const latestByLevel = useMemo(() => {
    const map = new Map<number, VerificationRequestRow>();
    for (const row of requests) {
      const existing = map.get(row.targetLevel);
      if (!existing || Date.parse(row.createdAt) > Date.parse(existing.createdAt)) {
        map.set(row.targetLevel, row);
      }
    }
    return map;
  }, [requests]);

  const stepState = useCallback(
    (level: LadderLevel): StepState => {
      if (currentLevel >= level) return 'approved';
      const row = latestByLevel.get(level);
      if (row?.status === 'PENDING') return 'pending';
      if (row?.status === 'REJECTED') return 'rejected';
      if (level > currentLevel + 1) return 'locked';
      return 'todo';
    },
    [currentLevel, latestByLevel],
  );

  // Land the user on the first step they can actually act on, once.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !currentUser) return;
    landed.current = true;
    setActiveStep((LADDER.find((level) => level > currentLevel) ?? 5) as LadderLevel);
  }, [currentUser, currentLevel]);

  // -- Camera --------------------------------------------------------------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('verification.selfie.unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      // The component can unmount while the permission prompt is open; without
      // this the camera light stays on with nothing to turn it off.
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraActive(true);
      void videoRef.current.play().catch(() => undefined);
    } catch {
      setCameraError(t('verification.selfie.denied'));
      stopCamera();
    }
  }, [stopCamera, t]);

  useEffect(() => {
    if (activeStep !== 3) stopCamera();
  }, [activeStep, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Mirrored, so the capture matches the preview the user was looking at.
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    setSelfieFile({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), isImage: true });
    stopCamera();
  };

  // -- Uploads -------------------------------------------------------------
  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    apply: (file: UploadedFile) => void,
  ) => {
    const file = event.target.files?.[0];
    // Reset so re-picking the same file still fires a change event.
    event.target.value = '';
    if (!file) return;
    try {
      apply(await prepareUpload(file));
    } catch (error) {
      pushToast(
        error instanceof Error && error.message === 'too-large'
          ? 'verification.upload.tooLarge'
          : 'verification.upload.failed',
        'error',
      );
    }
  };

  // -- Submit --------------------------------------------------------------
  const submitDocument = async (
    targetLevel: LadderLevel,
    type: DocumentType,
    payload: { documentUrl?: string; selfieUrl?: string },
  ) => {
    if (!currentUser) {
      setShowAuth(true, 'LOGIN');
      return;
    }
    if (!payload.documentUrl && !payload.selfieUrl) {
      pushToast('verification.toast.fileRequired', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await AuthApi.submitVerification({ targetLevel, documentType: type, ...payload });
      pushToast('verification.toast.submitted', 'success');
      await loadRequests();
    } catch (error) {
      pushToast(
        error instanceof ApiError && error.isNetwork
          ? 'common.error.network'
          : 'verification.toast.failed',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // -- Presentation helpers ------------------------------------------------
  const stepMeta = (level: LadderLevel) => {
    const keys = STEP_KEYS[level];
    return {
      short: t(keys.short),
      reward: t(keys.reward),
      title: t(keys.title),
      description: t(keys.description),
    };
  };

  const documentLabel = (type: string): string => {
    switch (type) {
      case 'PASSPORT':
        return t('verification.requests.doc.passport');
      case 'ID_CARD':
        return t('verification.requests.doc.idCard');
      case 'CADASTRE':
        return t('verification.requests.doc.cadastre');
      case 'SELFIE_LIVENESS':
        return t('verification.requests.doc.selfie');
      default:
        return t('verification.requests.doc.unknown');
    }
  };

  const statusLabel = (status: string): string => {
    if (status === 'APPROVED') return t('common.status.approved');
    if (status === 'REJECTED') return t('common.status.rejected');
    return t('common.status.pending');
  };

  const statusClass = (status: string): string => {
    if (status === 'APPROVED') return 'bg-brand-soft text-brand-text';
    if (status === 'REJECTED') return 'bg-danger-soft text-danger';
    return 'bg-warning-soft text-warning';
  };

  /** Approved / pending / rejected / locked banner shown above a step's form. */
  const stepNotice = (level: LadderLevel, approvedText: string): React.ReactNode => {
    const state = stepState(level);
    const row = latestByLevel.get(level);

    if (state === 'approved') {
      const nextLevel = LADDER.find((candidate) => candidate > level);
      return (
        <div className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand" aria-hidden="true" />
          <h4 className="text-sm font-black text-brand-text">
            {t('verification.step.approvedTitle')}
          </h4>
          <p className="text-xs text-muted">{approvedText}</p>
          {nextLevel && (
            <Button
              type="button"
              onClick={() => setActiveStep(nextLevel)}
              className="mx-auto"
            >
              <span>{t('verification.step.next', { title: stepMeta(nextLevel).short })}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      );
    }

    if (state === 'pending') {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-warning">
              {t('verification.step.pendingTitle')}
            </h4>
            <p className="text-xs text-muted">{t('verification.step.pendingBody')}</p>
          </div>
        </div>
      );
    }

    if (state === 'rejected') {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-danger">
              {t('verification.step.rejectedTitle')}
            </h4>
            <p className="text-xs text-muted">
              {row?.rejectionReason
                ? t('verification.step.rejectedReason', { reason: row.rejectionReason })
                : t('verification.step.rejectedNoReason')}
            </p>
          </div>
        </div>
      );
    }

    if (state === 'locked') {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-content">
              {t('verification.step.lockedTitle')}
            </h4>
            <p className="text-xs text-muted">
              {t('verification.step.lockedBody', { level: level - 1 })}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  /** A step accepts a new document only while it is actionable. */
  const canSubmit = (level: LadderLevel) => {
    const state = stepState(level);
    return state === 'todo' || state === 'rejected';
  };

  const stepHeader = (level: LadderLevel, icon: React.ReactNode, tone: string) => {
    const meta = stepMeta(level);
    return (
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-black leading-tight text-content sm:text-lg">
            {meta.title}
          </h3>
          <p className="text-xs text-muted">{meta.description}</p>
        </div>
      </div>
    );
  };

  const uploadZone = (
    file: UploadedFile | null,
    onPick: () => void,
    onClear: () => void,
    title: string,
    subtitle: string,
  ) => (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPick}
        className="group w-full space-y-3 rounded-2xl border-2 border-dashed border-line-2 bg-surface-2 p-6 text-center transition-colors hover:bg-surface-3 sm:p-8"
      >
        {file ? (
          file.isImage ? (
            <img
              src={file.dataUrl}
              alt={t('verification.upload.preview')}
              className="mx-auto h-32 w-48 rounded-xl border border-line object-cover shadow-card"
            />
          ) : (
            <FileText className="mx-auto h-10 w-10 text-brand" aria-hidden="true" />
          )
        ) : (
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text transition-transform group-hover:scale-110">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </span>
        )}

        <span className="block text-sm font-black text-content">
          {file
            ? file.isImage
              ? t('verification.upload.selected')
              : t('verification.upload.document')
            : title}
        </span>
        <span className="block text-xs text-muted">
          {file ? t('verification.upload.replace') : subtitle}
        </span>
        <span className="block text-[11px] text-subtle">{t('verification.upload.hint')}</span>
      </button>

      {file && (
        <button
          type="button"
          onClick={onClear}
          className="mx-auto flex items-center gap-1 text-[11px] font-bold text-danger hover:underline"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.action.clear')}
        </button>
      )}
    </div>
  );

  // -- Render --------------------------------------------------------------
  return (
    <div className="mx-auto min-h-[85vh] max-w-6xl space-y-8 px-3 py-6 sm:px-6 sm:py-10">
      {/* Hidden pickers, driven by the visible upload buttons above. */}
      <input
        type="file"
        ref={passportInputRef}
        accept="image/*,.pdf"
        onChange={(event) => void handleFile(event, setPassportFile)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="file"
        ref={selfieInputRef}
        accept="image/*"
        capture="user"
        onChange={(event) => void handleFile(event, setSelfieFile)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="file"
        ref={cadastreInputRef}
        accept="image/*,.pdf"
        onChange={(event) => void handleFile(event, setCadastreFile)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Hero */}
      <header className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-brand p-6 text-on-brand shadow-raised sm:p-8 md:flex-row">
        <div className="space-y-3 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-on-brand/15 px-3.5 py-1.5 text-xs font-bold">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t('verification.page.eyebrow')}
          </span>
          <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {t('verification.page.title')}
          </h1>
          <p className="max-w-2xl text-xs leading-relaxed text-on-brand/85 sm:text-sm">
            {t('verification.page.subtitle')}
          </p>
        </div>

        <div className="w-full shrink-0 space-y-1.5 rounded-2xl border border-on-brand/25 bg-on-brand/10 p-5 text-center md:w-auto">
          <span className="text-xs font-bold text-on-brand/80">
            {t('verification.page.trustLabel')}
          </span>
          <p className="flex items-center justify-center gap-1.5 text-3xl font-black sm:text-4xl">
            <Award className="h-8 w-8" aria-hidden="true" />
            {formatNumber(currentUser?.trustScore ?? 0)}
          </p>
          <span className="block text-xs font-bold text-on-brand/85">
            {t('verification.page.xp', { count: formatNumber(currentUser?.xpPoints ?? 0) })}
          </span>
          <span className="block text-xs font-bold text-on-brand/85">
            {t('verification.page.currentLevel', {
              level:
                currentLevel > 0
                  ? t('common.badge.verificationLevel', { level: currentLevel })
                  : t('verification.page.levelZero'),
            })}
          </span>
        </div>
      </header>

      {!currentUser && (
        <section className="space-y-3 rounded-3xl border border-line bg-surface p-6 text-center shadow-card">
          <h2 className="text-base font-black text-content">
            {t('verification.page.guestTitle')}
          </h2>
          <p className="text-xs text-muted">{t('verification.page.guestBody')}</p>
          <Button type="button" onClick={() => setShowAuth(true, 'LOGIN')} className="mx-auto">
            {t('common.action.signIn')}
          </Button>
        </section>
      )}

      {/* Before / after illustration */}
      <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="mx-auto max-w-xl space-y-1.5 text-center">
          <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-text">
            {t('verification.compare.eyebrow')}
          </span>
          <h2 className="text-xl font-black text-content sm:text-2xl">
            {t('verification.compare.title')}
          </h2>
          <p className="text-xs text-muted">{t('verification.compare.subtitle')}</p>
          <p className="text-[11px] text-subtle">{t('verification.compare.note')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:gap-6 md:grid-cols-2">
          {/* Unverified */}
          <article className="space-y-4 rounded-2xl border-2 border-line bg-surface-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg bg-surface-3 px-2.5 py-1 text-xs font-bold text-muted">
                {t('verification.compare.beforeLabel')}
              </span>
              <span className="text-[11px] font-medium text-subtle">
                {t('verification.compare.beforeHint')}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-content">
                    {t('verification.compare.exampleTitle')}
                  </h3>
                  <p className="mt-1 text-xs font-black text-muted">
                    {formatPrice(EXAMPLE_PRICE)}
                    <span className="ml-1 font-semibold text-subtle">
                      {t('common.units.perMonth')}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {t('verification.compare.beforeTag')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 border-t border-line pt-2 text-xs text-subtle">
                <span>{t('verification.compare.beforeOwner')}</span>
                <span>
                  {t('verification.compare.beforeTrust', { score: EXAMPLE_TRUST_BEFORE })}
                </span>
              </div>
            </div>

            <ul className="space-y-2 pt-1 text-xs">
              <li className="flex items-center gap-2 text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('verification.compare.beforeConBadge')}</span>
              </li>
              <li className="flex items-center gap-2 text-muted">
                <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('verification.compare.beforeConRank')}</span>
              </li>
            </ul>
          </article>

          {/* Verified */}
          <article className="space-y-4 rounded-2xl border-2 border-brand/70 bg-brand-soft p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft-2 px-3 py-1 text-xs font-black text-brand-text">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('verification.compare.afterLabel')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-black text-brand-text">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                {t('verification.compare.afterHint')}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border-2 border-brand/30 bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase text-on-brand">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {t('verification.compare.afterBadge')}
                  </span>
                  <h3 className="text-sm font-black text-content">
                    {t('verification.compare.exampleTitle')}
                  </h3>
                  <p className="mt-1 text-sm font-black text-brand-text">
                    {formatPrice(EXAMPLE_PRICE)}
                    <span className="ml-1 text-xs font-semibold text-subtle">
                      {t('common.units.perMonth')}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-brand/30 bg-brand-soft-2 px-2 py-1 text-[10px] font-bold text-brand-text">
                  {t('verification.compare.afterRank')}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-content">
                  {t('verification.compare.afterOwner')}
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                </span>
                <span className="rounded border border-brand/30 bg-brand-soft px-2 py-0.5 font-extrabold text-brand-text">
                  {t('verification.compare.afterTrust', { score: EXAMPLE_TRUST_AFTER })}
                </span>
              </div>
            </div>

            <ul className="space-y-2 pt-1 text-xs font-semibold text-brand-text">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('verification.compare.afterProBadge')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span>{t('verification.compare.afterProRank')}</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* Ladder */}
      <section className="space-y-4">
        <div className="mx-auto max-w-xl space-y-1 text-center">
          <h2 className="text-xl font-black text-content sm:text-2xl">
            {t('verification.ladder.title')}
          </h2>
          <p className="text-xs text-muted">{t('verification.ladder.subtitle')}</p>
        </div>

        <nav aria-label={t('verification.ladder.navLabel')}>
          <ul className="grid grid-cols-5 gap-1.5 rounded-2xl border border-line bg-surface p-2.5 text-center shadow-card sm:gap-2 sm:p-3">
            {LADDER.map((level) => {
              const meta = stepMeta(level);
              const state = stepState(level);
              const isActive = activeStep === level;
              return (
                <li key={level}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(level)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-controls={`verification-step-${level}`}
                    aria-label={t('verification.ladder.stepAria', {
                      level,
                      title: meta.short,
                    })}
                    className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all sm:p-3 ${
                      isActive
                        ? 'bg-brand font-bold text-on-brand shadow-card'
                        : state === 'approved'
                          ? 'border border-brand/30 bg-brand-soft font-semibold text-brand-text'
                          : 'bg-surface-2 text-muted hover:bg-surface-3'
                    }`}
                  >
                    {state === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : state === 'pending' ? (
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : state === 'rejected' ? (
                      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <span className="font-mono text-xs font-bold">{level}</span>
                    )}
                    <span className="hidden text-[11px] font-bold leading-none sm:inline sm:text-xs">
                      {meta.short}
                    </span>
                    <span className="font-mono text-[9px] opacity-75 sm:text-[10px]">
                      {meta.reward}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          id={`verification-step-${activeStep}`}
          className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8"
        >
          {/* Level 1 — phone */}
          {activeStep === 1 && (
            <div className="mx-auto max-w-md space-y-4 py-4 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                <PhoneCall className="h-8 w-8" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-black text-content sm:text-xl">
                {stepMeta(1).title}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {currentUser?.phoneVerifiedAt || currentLevel >= 1
                  ? t('verification.phone.verified')
                  : t('verification.phone.pending')}
              </p>
              <div
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold ${
                  currentUser?.phoneVerifiedAt || currentLevel >= 1
                    ? 'border-brand/30 bg-brand-soft text-brand-text'
                    : 'border-warning/30 bg-warning-soft text-warning'
                }`}
              >
                {currentUser?.phoneVerifiedAt || currentLevel >= 1 ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                {currentUser?.phone ?? t('common.state.empty')}
              </div>
              <Button type="button" onClick={() => setActiveStep(2)} fullWidth>
                <span>{t('verification.step.next', { title: stepMeta(2).short })}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* Level 2 — passport / ID */}
          {activeStep === 2 && (
            <div className="mx-auto max-w-xl space-y-6">
              {stepHeader(
                2,
                <FileText className="h-6 w-6 text-info" aria-hidden="true" />,
                'bg-info-soft',
              )}

              {stepNotice(2, t('verification.passport.approved'))}

              {canSubmit(2) && (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitDocument(2, documentType, {
                      documentUrl: passportFile?.dataUrl,
                    });
                  }}
                >
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-muted">
                      {t('verification.passport.docTypeLabel')}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {(['PASSPORT', 'ID_CARD'] as const).map((option) => (
                        <label
                          key={option}
                          className={`cursor-pointer rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${
                            documentType === option
                              ? 'border-brand bg-brand-soft text-brand-text'
                              : 'border-line bg-surface-2 text-muted hover:bg-surface-3'
                          }`}
                        >
                          <input
                            type="radio"
                            name="verification-document-type"
                            value={option}
                            checked={documentType === option}
                            onChange={() => setDocumentType(option)}
                            className="sr-only"
                          />
                          {option === 'PASSPORT'
                            ? t('verification.passport.passport')
                            : t('verification.passport.idCard')}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {uploadZone(
                    passportFile,
                    () => passportInputRef.current?.click(),
                    () => setPassportFile(null),
                    t('verification.passport.uploadTitle'),
                    t('verification.passport.uploadSubtitle'),
                  )}

                  <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-[11px] text-muted">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <span>{t('verification.passport.privacy')}</span>
                  </p>

                  <Button
                    type="submit"
                    fullWidth
                    loading={submitting}
                    disabled={!passportFile}
                  >
                    {submitting
                      ? t('verification.step.submitting')
                      : t('verification.passport.submit')}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Level 3 — live selfie */}
          {activeStep === 3 && (
            <div className="mx-auto max-w-xl space-y-6">
              {stepHeader(
                3,
                <Camera className="h-6 w-6 text-info" aria-hidden="true" />,
                'bg-info-soft',
              )}

              {stepNotice(3, t('verification.selfie.approved'))}

              {canSubmit(3) && (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitDocument(3, 'SELFIE_LIVENESS', {
                      selfieUrl: selfieFile?.dataUrl,
                    });
                  }}
                >
                  <div className="space-y-4 rounded-3xl border border-line bg-surface-2 p-6 text-center">
                    {/* The video element must stay mounted: `startCamera` needs a
                        node to attach the stream to before the state flips. */}
                    <div className={cameraActive ? 'space-y-4' : 'hidden'}>
                      <div className="relative mx-auto h-64 w-64 overflow-hidden rounded-full border-4 border-brand bg-black shadow-raised sm:h-72 sm:w-72">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          aria-label={t('verification.selfie.videoLabel')}
                          className="h-full w-full -scale-x-100 object-cover"
                        />
                        <p className="absolute inset-x-0 bottom-3 bg-black/60 py-1 text-[10px] font-bold text-white">
                          {t('verification.selfie.guide')}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button type="button" onClick={captureSelfie}>
                          <Camera className="h-4 w-4" aria-hidden="true" />
                          {t('verification.selfie.capture')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={stopCamera}>
                          {t('common.action.close')}
                        </Button>
                      </div>
                    </div>

                    {!cameraActive && selfieFile && (
                      <div className="space-y-3">
                        <img
                          src={selfieFile.dataUrl}
                          alt={t('verification.selfie.previewAlt')}
                          className="mx-auto h-40 w-40 rounded-full border-4 border-brand object-cover shadow-raised"
                        />
                        <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-brand-text">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          {t('verification.selfie.captured')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelfieFile(null);
                            void startCamera();
                          }}
                          className="mx-auto flex items-center gap-1 text-xs font-bold text-brand-text hover:underline"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('verification.selfie.retake')}
                        </button>
                      </div>
                    )}

                    {!cameraActive && !selfieFile && (
                      <div className="space-y-4 py-3">
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                          <Camera className="h-8 w-8" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-base font-black text-content">
                            {t('verification.selfie.cameraTitle')}
                          </p>
                          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                            {t('verification.selfie.cameraBody')}
                          </p>
                        </div>

                        {cameraError && (
                          <p
                            role="alert"
                            className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-semibold text-danger"
                          >
                            {cameraError}
                          </p>
                        )}

                        <div className="flex flex-col items-center justify-center gap-2 pt-1 sm:flex-row">
                          <Button type="button" onClick={() => void startCamera()}>
                            <Video className="h-4 w-4" aria-hidden="true" />
                            {t('verification.selfie.openCamera')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => selfieInputRef.current?.click()}
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('verification.selfie.fromFile')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button type="submit" fullWidth loading={submitting} disabled={!selfieFile}>
                    {submitting
                      ? t('verification.step.submitting')
                      : t('verification.selfie.submit')}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Level 4 — cadastre */}
          {activeStep === 4 && (
            <div className="mx-auto max-w-xl space-y-6">
              {stepHeader(
                4,
                <Building2 className="h-6 w-6 text-brand-text" aria-hidden="true" />,
                'bg-brand-soft',
              )}

              {stepNotice(4, t('verification.cadastre.approved'))}

              {canSubmit(4) && (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitDocument(4, 'CADASTRE', {
                      documentUrl: cadastreFile?.dataUrl,
                    });
                  }}
                >
                  {/* The review API takes documents only — there is no field for a
                      cadastre number yet, so the input stays visible but inert. */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="verification-cadastre-code"
                      className="block text-xs font-bold text-muted"
                    >
                      {t('verification.cadastre.codeLabel')}
                    </label>
                    <TextInput
                      id="verification-cadastre-code"
                      type="text"
                      disabled
                      value=""
                      readOnly
                      placeholder={t('verification.cadastre.codePlaceholder')}
                      aria-describedby="verification-cadastre-code-hint"
                      className="font-mono"
                    />
                    <p id="verification-cadastre-code-hint" className="text-xs text-subtle">
                      {t('verification.cadastre.codeDisabled')}
                    </p>
                  </div>

                  {uploadZone(
                    cadastreFile,
                    () => cadastreInputRef.current?.click(),
                    () => setCadastreFile(null),
                    t('verification.cadastre.uploadTitle'),
                    t('verification.cadastre.uploadSubtitle'),
                  )}

                  <Button type="submit" fullWidth loading={submitting} disabled={!cadastreFile}>
                    {submitting
                      ? t('verification.step.submitting')
                      : t('verification.cadastre.submit')}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Level 5 — VIP */}
          {activeStep === 5 && (
            <div className="mx-auto max-w-xl space-y-6 py-4 text-center">
              <span
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
                  currentLevel >= 5 ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-subtle'
                }`}
              >
                {currentLevel >= 5 ? (
                  <Sparkles className="h-10 w-10" aria-hidden="true" />
                ) : (
                  <Lock className="h-9 w-9" aria-hidden="true" />
                )}
              </span>
              <h3 className="text-xl font-black text-content sm:text-2xl">
                {stepMeta(5).title}
              </h3>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-muted">
                {currentLevel >= 5 ? t('verification.vip.body') : t('verification.vip.locked')}
              </p>
              {currentUser?.role === 'OWNER' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCurrentView('MY_LISTINGS')}
                  className="mx-auto"
                >
                  {t('verification.vip.myListings')}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Submitted requests */}
      {currentUser && (
        <section className="space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-content">
                {t('verification.requests.title')}
              </h2>
              <p className="text-xs text-muted">{t('verification.requests.subtitle')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadRequests()}
              loading={requestsLoading}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.action.refresh')}
            </Button>
          </div>

          {requestsLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1].map((row) => (
                <div key={row} className="h-16 w-full animate-shimmer rounded-xl" />
              ))}
            </div>
          ) : requestsError ? (
            <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft p-5 text-center">
              <p className="text-xs font-semibold text-danger">
                {t('verification.requests.error')}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadRequests()}
                className="mx-auto"
              >
                {t('common.action.retry')}
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface-2 p-6 text-center text-xs text-muted">
              {t('verification.requests.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {requests.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-content">
                      {documentLabel(row.documentType)}
                    </p>
                    <p className="text-xs text-muted">
                      {t('verification.requests.level', { level: row.targetLevel })}
                    </p>
                    <p className="text-[11px] text-subtle">{formatDate(row.createdAt)}</p>
                    {row.status === 'REJECTED' && (
                      <p className="text-xs font-semibold text-danger">
                        {row.rejectionReason
                          ? t('verification.requests.reason', { reason: row.rejectionReason })
                          : t('verification.step.rejectedNoReason')}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Phone trust lookup — kept visible, inert until the server exposes it. */}
      <section className="space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-content sm:text-lg">
              {t('verification.checker.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{t('verification.checker.subtitle')}</p>
          </div>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="verification-phone-check" className="sr-only">
            {t('verification.checker.title')}
          </label>
          <TextInput
            id="verification-phone-check"
            type="tel"
            disabled
            placeholder={t('verification.checker.placeholder')}
            aria-describedby="verification-phone-check-hint"
            className="flex-1"
          />
          <Button type="submit" disabled className="shrink-0">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t('verification.checker.submit')}
          </Button>
        </form>

        <p
          id="verification-phone-check-hint"
          className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft p-3.5 text-xs text-muted"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <span>{t('verification.checker.unavailable')}</span>
        </p>
      </section>
    </div>
  );
};

export default VerificationPage;
