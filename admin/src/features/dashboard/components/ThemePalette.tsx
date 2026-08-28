'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/providers';

/* ─── Color Schemes ────────────────────────────────────────────────────────
   The first entry is the product default. Its id stays 'ocean' even though it
   is now the Maklersiz brand blue: the id is the value persisted under the
   'accent-scheme' localStorage key and the key of two duplicate maps in
   providers/index.tsx (the SSR pre-paint script and the rehydrate helper).
   Renaming it would silently drop every existing user back to the fallback.
   All three copies must carry the same hex — change one, change all three. */
const COLOR_SCHEMES = [
  { id: 'ocean',   label: 'Maklersiz', primary: '#1447e6', secondary: '#06b6d4', gradient: 'linear-gradient(135deg,#1447e6,#06b6d4)' },
  { id: 'violet',  label: 'Violet',  primary: '#7c3aed', secondary: '#a78bfa', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { id: 'emerald', label: 'Emerald', primary: '#059669', secondary: '#34d399', gradient: 'linear-gradient(135deg,#059669,#34d399)' },
  { id: 'rose',    label: 'Rose',    primary: '#e11d48', secondary: '#fb7185', gradient: 'linear-gradient(135deg,#e11d48,#fb7185)' },
  { id: 'amber',   label: 'Amber',   primary: '#d97706', secondary: '#fbbf24', gradient: 'linear-gradient(135deg,#d97706,#fbbf24)' },
  { id: 'slate',   label: 'Slate',   primary: '#475569', secondary: '#94a3b8', gradient: 'linear-gradient(135deg,#475569,#94a3b8)' },
  { id: 'pink',    label: 'Pink',    primary: '#db2777', secondary: '#f472b6', gradient: 'linear-gradient(135deg,#db2777,#f472b6)' },
  { id: 'teal',    label: 'Teal',    primary: '#0f766e', secondary: '#2dd4bf', gradient: 'linear-gradient(135deg,#0f766e,#2dd4bf)' },
  { id: 'orange',  label: 'Orange',  primary: '#ea580c', secondary: '#fb923c', gradient: 'linear-gradient(135deg,#ea580c,#fb923c)' },
];

const FONTS = [
  { id: 'inter',   label: 'Inter',          preview: 'Ag' },
  { id: 'syne',    label: 'Syne',            preview: 'Ag' },
  { id: 'mono',    label: 'JetBrains Mono',  preview: 'Ag' },
];

/* `labelKey` rather than `label`: these are module constants, so the string
   cannot be translated where it is declared. The key is resolved at render
   against `settings.palette.*`. Typeface and colour-scheme names stay as they
   are — they are proper nouns. */
const RADIUS_PRESETS = [
  { id: 'compact', labelKey: 'compact', value: { sm: '4px', md: '8px',  lg: '12px', xl: '16px' } },
  { id: 'default', labelKey: 'default', value: { sm: '8px', md: '12px', lg: '16px', xl: '22px' } },
  { id: 'rounded', labelKey: 'rounded', value: { sm: '12px',md: '18px', lg: '24px', xl: '32px' } },
  { id: 'pill',    labelKey: 'pill',    value: { sm: '20px',md: '28px', lg: '36px', xl: '48px' } },
] as const;

/* ─── Background Presets ─────────────────────────────────────────────────── */
const BG_PRESETS = [
  {
    id: 'none',
    labelKey: 'none',
    preview: null,
  },
  {
    id: 'aurora',
    labelKey: 'aurora',
    preview: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
    css: `
      radial-gradient(ellipse at 20% 50%, rgba(120,80,255,0.35) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(0,200,180,0.25) 0%, transparent 55%),
      radial-gradient(ellipse at 60% 80%, rgba(80,120,255,0.3) 0%, transparent 50%),
      linear-gradient(135deg,#0f0c29 0%,#1a1440 50%,#0d1a2e 100%)
    `,
  },
  {
    id: 'sunset',
    labelKey: 'sunset',
    preview: 'linear-gradient(135deg,#1a0533,#6b1a3a,#c04b2b,#f4a24a)',
    css: `
      radial-gradient(ellipse at 50% 100%, rgba(255,120,50,0.4) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 60%, rgba(200,50,100,0.3) 0%, transparent 50%),
      radial-gradient(ellipse at 20% 40%, rgba(120,20,80,0.35) 0%, transparent 55%),
      linear-gradient(180deg,#0d0118 0%,#2d0a2e 35%,#7a1a35 70%,#c04020 100%)
    `,
  },
  {
    id: 'ocean-deep',
    labelKey: 'oceanDeep',
    preview: 'linear-gradient(135deg,#001f3f,#003d7a,#005f9e)',
    css: `
      radial-gradient(ellipse at 30% 30%, rgba(0,120,200,0.3) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 70%, rgba(0,60,140,0.4) 0%, transparent 60%),
      radial-gradient(ellipse at 50% 0%, rgba(0,200,255,0.15) 0%, transparent 40%),
      linear-gradient(180deg,#000d1a 0%,#001428 40%,#002244 100%)
    `,
  },
  {
    id: 'forest',
    labelKey: 'forest',
    preview: 'linear-gradient(135deg,#0a1f0a,#1a3a1a,#2d5a1b)',
    css: `
      radial-gradient(ellipse at 40% 60%, rgba(20,100,20,0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 80% 20%, rgba(80,180,30,0.2) 0%, transparent 50%),
      radial-gradient(ellipse at 10% 80%, rgba(0,80,20,0.4) 0%, transparent 55%),
      linear-gradient(135deg,#050f05 0%,#0d200d 50%,#142814 100%)
    `,
  },
  {
    id: 'galaxy',
    labelKey: 'galaxy',
    preview: 'linear-gradient(135deg,#0a0010,#1a0030,#0a0a20)',
    css: `
      radial-gradient(ellipse at 50% 50%, rgba(100,50,200,0.2) 0%, transparent 60%),
      radial-gradient(ellipse at 20% 20%, rgba(200,100,255,0.15) 0%, transparent 40%),
      radial-gradient(ellipse at 80% 80%, rgba(50,100,255,0.2) 0%, transparent 45%),
      radial-gradient(ellipse at 60% 10%, rgba(255,200,100,0.08) 0%, transparent 30%),
      linear-gradient(135deg,#02000a 0%,#0a0018 50%,#050010 100%)
    `,
  },
  {
    id: 'rose-gold',
    labelKey: 'roseGold',
    preview: 'linear-gradient(135deg,#1a0a0a,#3d1a1a,#7a3535)',
    css: `
      radial-gradient(ellipse at 30% 40%, rgba(200,80,80,0.25) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 60%, rgba(150,50,100,0.3) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 20%, rgba(255,150,100,0.15) 0%, transparent 40%),
      linear-gradient(135deg,#0f0505 0%,#1f0808 45%,#2d0f0f 100%)
    `,
  },
  {
    id: 'northern-lights',
    labelKey: 'northernLights',
    preview: 'linear-gradient(135deg,#001a10,#003320,#005540)',
    css: `
      radial-gradient(ellipse at 20% 50%, rgba(0,255,150,0.2) 0%, transparent 55%),
      radial-gradient(ellipse at 80% 30%, rgba(0,200,255,0.18) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, rgba(100,0,255,0.15) 0%, transparent 45%),
      radial-gradient(ellipse at 60% 10%, rgba(0,255,100,0.12) 0%, transparent 35%),
      linear-gradient(180deg,#000a05 0%,#001510 50%,#000d0a 100%)
    `,
  },
];

function applyColorScheme(schemeId: string, originX?: number, originY?: number) {
  const sc = COLOR_SCHEMES.find(s => s.id === schemeId) || COLOR_SCHEMES[0];
  if (originX !== undefined && originY !== undefined) {
    flashColorRipple(sc.primary, originX, originY);
  }
  const root = document.documentElement;
  const adj = (hex: string, amt: number) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };
  root.style.setProperty('--accent', sc.primary);
  root.style.setProperty('--accent-light', adj(sc.primary, 25));
  root.style.setProperty('--accent-dark', adj(sc.primary, -25));
  root.style.setProperty('--accent-glow', sc.primary + '4D');
  root.style.setProperty('--accent-subtle', sc.primary + '12');
  root.style.setProperty('--accent-border', sc.primary + '33');
  root.style.setProperty('--gradient-brand', sc.gradient);
  root.style.setProperty('--color-brand-500', sc.primary);
  root.style.setProperty('--color-brand-400', adj(sc.primary, 25));
  root.style.setProperty('--color-brand-600', adj(sc.primary, -25));
  root.style.setProperty('--color-info', sc.primary);
  root.style.setProperty('--color-info-bg', sc.primary + '12');
  root.style.setProperty('--color-info-border', sc.primary + '33');
  localStorage.setItem('accent-scheme', schemeId);
}

function applyFont(fontId: string) {
  const fontMap: Record<string, string> = {
    inter: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    syne:  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono:  "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
  };
  const fv = fontMap[fontId] || fontMap.inter;
  document.documentElement.style.setProperty('--font-sans', fv);
  document.body.style.fontFamily = fv;
  localStorage.setItem('ui-font', fontId);
}

function applyRadius(presetId: string) {
  const preset = RADIUS_PRESETS.find(p => p.id === presetId) || RADIUS_PRESETS[1];
  const root = document.documentElement;
  root.style.setProperty('--radius-sm', preset.value.sm);
  root.style.setProperty('--radius-md', preset.value.md);
  root.style.setProperty('--radius-lg', preset.value.lg);
  root.style.setProperty('--radius-xl', preset.value.xl);
  localStorage.setItem('ui-radius', presetId);
}

/* ─── Color ripple animation on accent change ────────────────────────────── */
function flashColorRipple(color: string, originX: number, originY: number) {
  const el = document.createElement('div');
  const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.4;
  el.style.cssText = `
    position: fixed;
    width: ${size}px; height: ${size}px;
    left: ${originX - size / 2}px; top: ${originY - size / 2}px;
    border-radius: 50%;
    background: ${color};
    opacity: 0;
    pointer-events: none;
    z-index: 999997;
    transform: scale(0.04);
    transition: transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s ease;
    will-change: transform, opacity;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '0.13';
      el.style.transform = 'scale(1)';
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.4s ease';
        setTimeout(() => el.remove(), 420);
      }, 360);
    });
  });
}

/* ─── Background Application ─────────────────────────────────────────────── */
/*
 * Background is set directly on the <html> element — it lives below every
 * stacking context and is always visible through transparent body/surfaces.
 * The overlay (darkness + blur) is driven by CSS custom properties that feed
 * the `body::before` pseudo-element defined in globals.css.
 * This avoids all z-index tricks and div-injection complexity.
 */
function applyBackground(opts: {
  type: 'none' | 'preset' | 'image';
  presetId?: string;
  imageUrl?: string;
  blur?: number;
  overlay?: number;
  noise?: boolean;
}) {
  const root = document.documentElement;

  // Clean up any legacy divs from old implementation
  document.getElementById('__theme_bg_layer__')?.remove();
  document.getElementById('__theme_bg_overlay__')?.remove();

  if (opts.type === 'none') {
    root.style.backgroundImage   = '';
    root.style.backgroundSize    = '';
    root.style.backgroundPosition= '';
    root.style.backgroundAttachment = '';
    root.style.removeProperty('--bg-overlay-opacity');
    root.style.removeProperty('--bg-blur-px');
    root.removeAttribute('data-has-bg');
    root.removeAttribute('data-bg-noise');
    localStorage.removeItem('bg-type');
    localStorage.removeItem('bg-preset');
    localStorage.removeItem('bg-image');
    localStorage.removeItem('bg-blur');
    localStorage.removeItem('bg-overlay');
    localStorage.removeItem('bg-noise');
    return;
  }

  const blur    = opts.blur    ?? 0;
  const overlay = opts.overlay ?? 40;
  const noiseOn = opts.noise   ?? false;

  if (opts.type === 'preset') {
    const preset = BG_PRESETS.find(p => p.id === opts.presetId);
    if (!preset?.css) return;
    root.style.backgroundImage    = preset.css.replace(/\s+/g, ' ').trim();
    root.style.backgroundSize     = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundAttachment = 'fixed';
    localStorage.setItem('bg-type',   'preset');
    localStorage.setItem('bg-preset', opts.presetId!);
  } else if (opts.type === 'image' && opts.imageUrl) {
    root.style.backgroundImage    = `url(${opts.imageUrl})`;
    root.style.backgroundSize     = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundAttachment = 'fixed';
    localStorage.setItem('bg-type',  'image');
    localStorage.setItem('bg-image', opts.imageUrl);
  }

  // Feed CSS variables → body::before overlay in globals.css
  root.style.setProperty('--bg-overlay-opacity', String((overlay / 100) * 0.52));
  root.style.setProperty('--bg-blur-px', blur > 0 ? `${blur}px` : '0px');

  root.setAttribute('data-has-bg', 'true');
  if (noiseOn) {
    root.setAttribute('data-bg-noise', 'true');
  } else {
    root.removeAttribute('data-bg-noise');
  }

  localStorage.setItem('bg-blur',    String(blur));
  localStorage.setItem('bg-overlay', String(overlay));
  localStorage.setItem('bg-noise',   noiseOn ? '1' : '0');
}

export function restoreBackground() {
  const type = localStorage.getItem('bg-type') as 'preset' | 'image' | null;
  if (!type) return;

  const blur = Number(localStorage.getItem('bg-blur') || '0');
  const overlay = Number(localStorage.getItem('bg-overlay') || '40');
  const noise = localStorage.getItem('bg-noise') === '1';

  if (type === 'preset') {
    const presetId = localStorage.getItem('bg-preset') || '';
    applyBackground({ type: 'preset', presetId, blur, overlay, noise });
  } else if (type === 'image') {
    const imageUrl = localStorage.getItem('bg-image');
    if (imageUrl) {
      applyBackground({ type: 'image', imageUrl, blur, overlay, noise });
    }
  }
}

interface Props {
  onClose: () => void;
}

export function ThemePalette({ onClose }: Props) {
  const t = useTranslations('settings.palette');
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeScheme, setActiveScheme]     = useState<string>('ocean');
  const [activeFont, setActiveFont]         = useState<string>('inter');
  const [activeRadius, setActiveRadius]     = useState<string>('default');
  const [activeBgPreset, setActiveBgPreset]     = useState<string>('none');
  const [bgBlur, setBgBlur]                     = useState<number>(0);
  const [bgOverlay, setBgOverlay]               = useState<number>(55);
  const [bgNoise, setBgNoise]                   = useState<boolean>(false);
  const [customBgUrl, setCustomBgUrl]           = useState<string | null>(null);
  const [bgMode, setBgMode]                     = useState<'none' | 'preset' | 'image'>('none');
  // The KEY, not the sentence: an upload error raised in one locale must not
  // stay in that locale when the panel re-renders.
  const [uploadError, setUploadError]           = useState<'tooLarge' | 'saveFailed' | null>(null);
  const [animatingBgId, setAnimatingBgId]       = useState<string | null>(null);

  // Reading the saved appearance is exactly the "subscribe to an external
  // system" case: localStorage is unreachable during the server render, so the
  // panel opens on its defaults and corrects itself once mounted.
  /* eslint-disable react-hooks/set-state-in-effect -- see above */
  useEffect(() => {
    setActiveScheme(localStorage.getItem('accent-scheme') || 'ocean');
    setActiveFont(localStorage.getItem('ui-font') || 'inter');
    setActiveRadius(localStorage.getItem('ui-radius') || 'default');
    setBgBlur(Number(localStorage.getItem('bg-blur') || '0'));
    setBgOverlay(Number(localStorage.getItem('bg-overlay') || '55'));
    setBgNoise(localStorage.getItem('bg-noise') === '1');

    const savedType = (localStorage.getItem('bg-type') || 'none') as typeof bgMode;
    setBgMode(savedType);
    if (savedType === 'preset') {
      setActiveBgPreset(localStorage.getItem('bg-preset') || 'none');
    } else if (savedType === 'image') {
      const saved = localStorage.getItem('bg-image');
      if (saved) setCustomBgUrl(saved);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleScheme = (id: string, e?: React.MouseEvent) => {
    setActiveScheme(id);
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : window.innerHeight / 2;
    applyColorScheme(id, x, y);
  };
  const handleFont   = (id: string) => { setActiveFont(id);   applyFont(id);         };
  const handleRadius = (id: string) => { setActiveRadius(id); applyRadius(id);       };

  const handleBgPreset = (id: string) => {
    setActiveBgPreset(id);
    setCustomBgUrl(null);
    // Trigger pop animation on the selected card
    setAnimatingBgId(id);
    setTimeout(() => setAnimatingBgId(null), 400);
    if (id === 'none') {
      setBgMode('none');
      applyBackground({ type: 'none' });
    } else {
      setBgMode('preset');
      applyBackground({ type: 'preset', presetId: id, blur: bgBlur, overlay: bgOverlay, noise: bgNoise });
    }
  };

  const handleBlurChange = (val: number) => {
    setBgBlur(val);
    localStorage.setItem('bg-blur', String(val));
    if (bgMode === 'preset') {
      applyBackground({ type: 'preset', presetId: activeBgPreset, blur: val, overlay: bgOverlay, noise: bgNoise });
    } else if (bgMode === 'image' && customBgUrl) {
      applyBackground({ type: 'image', imageUrl: customBgUrl, blur: val, overlay: bgOverlay, noise: bgNoise });
    }
  };

  const handleOverlayChange = (val: number) => {
    setBgOverlay(val);
    if (bgMode !== 'none') {
      if (bgMode === 'preset') {
        applyBackground({ type: 'preset', presetId: activeBgPreset, blur: bgBlur, overlay: val, noise: bgNoise });
      } else if (customBgUrl) {
        applyBackground({ type: 'image', imageUrl: customBgUrl, blur: bgBlur, overlay: val, noise: bgNoise });
      }
    }
    localStorage.setItem('bg-overlay', String(val));
  };

  const handleNoiseToggle = () => {
    const next = !bgNoise;
    setBgNoise(next);
    if (bgMode !== 'none') {
      if (bgMode === 'preset') {
        applyBackground({ type: 'preset', presetId: activeBgPreset, blur: bgBlur, overlay: bgOverlay, noise: next });
      } else if (customBgUrl) {
        applyBackground({ type: 'image', imageUrl: customBgUrl, blur: bgBlur, overlay: bgOverlay, noise: next });
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('tooLarge');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        localStorage.setItem('bg-image', dataUrl);
      } catch {
        setUploadError('saveFailed');
      }
      setCustomBgUrl(dataUrl);
      setActiveBgPreset('none');
      setBgMode('image');
      applyBackground({ type: 'image', imageUrl: dataUrl, blur: bgBlur, overlay: bgOverlay, noise: bgNoise });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setCustomBgUrl(null);
    setBgMode('none');
    setActiveBgPreset('none');
    applyBackground({ type: 'none' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasActiveBg = bgMode !== 'none';

  return (
    <>
      {/* Overlay */}
      <div className="palette-overlay animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="palette-panel animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {t('title')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex-center rounded-xl transition-all"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-3)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* ── Dark / Light mode ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('themeMode')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { mode: 'dark',  labelKey: 'dark',  icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )},
                { mode: 'light', labelKey: 'light', icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )},
              ] as const).map(({ mode, labelKey, icon }) => {
                const isActive = theme === mode;
                return (
                  <button
                    key={mode}
                    onClick={(e) => { if (theme !== mode) toggleTheme(e); }}
                    className="flex flex-col items-center gap-2 py-3 rounded-[var(--radius-md)] transition-all"
                    style={{
                      background: isActive ? 'var(--accent-subtle)' : 'var(--color-surface-2)',
                      border: `1.5px solid ${isActive ? 'var(--accent-border)' : 'var(--color-border)'}`,
                      color: isActive ? 'var(--accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {icon}
                    <span className="text-xs font-semibold">{t(labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Background ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {t('background')}
              </p>
              {hasActiveBg && (
                <button
                  onClick={handleRemoveImage}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                  style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }}
                >
                  {t('clear')}
                </button>
              )}
            </div>

            {/* Gradient Presets */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {BG_PRESETS.map((preset) => {
                const isActive = bgMode === 'preset' && activeBgPreset === preset.id;
                const isNone   = preset.id === 'none' && bgMode === 'none';
                const active   = isActive || isNone;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleBgPreset(preset.id)}
                    className="relative flex flex-col items-center gap-1 group"
                    style={{ outline: 'none' }}
                  >
                    <div
                      className={`w-full aspect-square rounded-[10px] overflow-hidden transition-all${animatingBgId === preset.id ? ' bg-card-selected' : ''}`}
                      style={{
                        background: preset.preview ?? 'var(--color-surface-3)',
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--color-border)'}`,
                        boxShadow: active ? '0 0 0 3px var(--accent-glow)' : 'none',
                        transform: active && animatingBgId !== preset.id ? 'scale(1.04)' : undefined,
                      }}
                    >
                      {preset.id === 'none' && (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-medium truncate w-full text-center" style={{ color: active ? 'var(--accent)' : 'var(--color-text-muted)' }}>
                      {t(`presets.${preset.labelKey}`)}
                    </span>
                    {active && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                        <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] transition-all"
              style={{
                background: bgMode === 'image' ? 'var(--accent-subtle)' : 'var(--color-surface-2)',
                border: `1.5px ${bgMode === 'image' ? 'solid var(--accent-border)' : 'dashed var(--color-border)'}`,
                color: bgMode === 'image' ? 'var(--accent)' : 'var(--color-text-muted)',
              }}
            >
              {bgMode === 'image' && customBgUrl ? (
                <>
                  <div
                    className="w-9 h-9 rounded-lg shrink-0 overflow-hidden"
                    style={{ backgroundImage: `url(${customBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{t('customImage')}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('tapToChange')}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-3)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">{t('upload')}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('uploadHint')}</p>
                  </div>
                </>
              )}
            </button>

            {uploadError && (
              <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--color-danger)' }}>{t(uploadError)}</p>
            )}

            {/* Sliders — show when bg is active */}
            {hasActiveBg && (
              <div className="mt-4 space-y-4 p-4 rounded-[var(--radius-md)]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>

                {/* Blur */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {t('blur')}
                    </p>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-primary)' }}>
                      {bgBlur}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={bgMode === 'image' ? 20 : 8}
                    step={1}
                    value={bgBlur}
                    onChange={(e) => handleBlurChange(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </div>

                {/* Overlay opacity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {t('overlay')}
                    </p>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-primary)' }}>
                      {bgOverlay}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={90}
                    step={5}
                    value={bgOverlay}
                    onChange={(e) => handleOverlayChange(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </div>

                {/* Noise texture toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('grain')}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('grainHint')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bgNoise}
                    onClick={handleNoiseToggle}
                    style={{
                      position: 'relative', width: 40, height: 24, borderRadius: 12,
                      background: bgNoise ? 'var(--accent)' : 'rgba(120,120,128,0.28)',
                      border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                      transition: 'background 0.25s ease',
                      boxShadow: bgNoise ? '0 0 0 3px var(--accent-glow)' : 'none',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: bgNoise ? 18 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.22)',
                      transition: 'left 0.25s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }} />
                  </button>
                </div>

              </div>
            )}
          </section>

          {/* ── Accent Color ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('accent')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_SCHEMES.map((sc) => {
                const isActive = activeScheme === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={(e) => handleScheme(sc.id, e)}
                    className="relative flex flex-col items-center gap-2 pt-2 pb-2.5 rounded-[var(--radius-md)] transition-all group"
                    style={{
                      background: isActive ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
                      border: `1.5px solid ${isActive ? sc.primary + '55' : 'var(--color-border)'}`,
                      boxShadow: isActive ? `0 0 0 2px ${sc.primary}22, 0 4px 12px ${sc.primary}15` : 'none',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg transition-all"
                      style={{
                        background: sc.gradient,
                        boxShadow: isActive ? `0 4px 12px ${sc.primary}50` : `0 2px 6px ${sc.primary}25`,
                        transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                    <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {sc.label}
                    </span>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex-center" style={{ background: sc.primary }}>
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Font ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('font')}
            </p>
            <div className="space-y-2">
              {FONTS.map((font) => {
                const isActive = activeFont === font.id;
                const fontStyle = font.id === 'mono'
                  ? "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace"
                  : "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                return (
                  <button
                    key={font.id}
                    onClick={() => handleFont(font.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all text-left"
                    style={{
                      background: isActive ? 'var(--accent-subtle)' : 'var(--color-surface-2)',
                      border: `1.5px solid ${isActive ? 'var(--accent-border)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div
                      className="w-9 h-9 flex-center rounded-lg text-lg font-bold shrink-0"
                      style={{
                        fontFamily: fontStyle,
                        background: isActive ? 'var(--accent-subtle)' : 'var(--color-surface-3)',
                        color: isActive ? 'var(--accent)' : 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {font.preview}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ fontFamily: fontStyle, color: isActive ? 'var(--accent)' : 'var(--color-text-primary)' }}>
                        {font.label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: fontStyle }}>
                        {t('fontPreview')}
                      </p>
                    </div>
                    {isActive && (
                      <div className="w-5 h-5 rounded-full flex-center" style={{ background: 'var(--accent)' }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Border Radius ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('radius')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RADIUS_PRESETS.map((preset) => {
                const isActive = activeRadius === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleRadius(preset.id)}
                    className="flex flex-col items-center gap-2 py-3 rounded-[var(--radius-md)] transition-all"
                    style={{
                      background: isActive ? 'var(--accent-subtle)' : 'var(--color-surface-2)',
                      border: `1.5px solid ${isActive ? 'var(--accent-border)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div
                      className="w-9 h-9"
                      style={{
                        background: isActive ? 'var(--accent)' : 'var(--color-surface-3)',
                        border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--color-border)'}`,
                        borderRadius: preset.value.md,
                        transition: 'all 0.2s',
                      }}
                    />
                    <span className="text-xs font-medium" style={{ color: isActive ? 'var(--accent)' : 'var(--color-text-muted)' }}>
                      {t(`radiusPresets.${preset.labelKey}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => {
              handleScheme('ocean');
              handleFont('inter');
              handleRadius('default');
              handleRemoveImage();
              if (theme === 'light') toggleTheme();
            }}
            className="w-full py-2 text-sm rounded-[var(--radius-md)] transition-all font-medium"
            style={{
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)'; }}
          >
            {t('reset')}
          </button>
        </div>
      </div>
    </>
  );
}
