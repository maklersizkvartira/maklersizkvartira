'use client';

import { useState } from 'react';
import {
  Send,
  Sparkles,
  Users,
  Building,
  Home,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Layers,
  GraduationCap,
  Flame,
  Zap,
  MapPin,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushListingItem, SendPushPayload, SendPushResult } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { ListingPickerModal } from './ListingPickerModal';

interface PushComposerProps {
  onSent?: () => void;
}

export function PushComposer({ onSent }: PushComposerProps) {
  const t = useTranslations('pushPage.composer');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'students' | 'tenants' | 'owners' | 'specific'>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [selectedListing, setSelectedListing] = useState<PushListingItem | null>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Preset templates
  const presets = [
    {
      id: 'students',
      name: t('presetStudents'),
      icon: GraduationCap,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      title: '🎓 Talabalar uchun metro yonida arzon kvartiralar!',
      body: 'Universitetlar va metro yaqinida hamyonbop ijaralar chiqdi. Koʻrib chiqing!',
      audience: 'students' as const,
    },
    {
      id: 'cheap',
      name: t('presetCheap'),
      icon: Flame,
      color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
      title: '🔥 Yangi hamyonbop kvartiralar!',
      body: 'Bozor narxidan ancha arzon va qulay ijara xonadonlari yangilandi.',
      audience: 'all' as const,
    },
    {
      id: 'urgent',
      name: t('presetUrgent'),
      icon: Zap,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
      title: '⚡️ Shoshilinch arzon narxdagi uylar!',
      body: 'Toʻgʻridan-toʻgʻri egasidan maklersiz ijara uylari. Imkoniyatni boy bermang!',
      audience: 'tenants' as const,
    },
    {
      id: 'metro',
      name: t('presetMetro'),
      icon: MapPin,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
      title: '🚇 Metro bekatlari yaqinidagi kvartiralar',
      body: 'Toshkent metrosi atrofidagi eng qulay va toza xonadonlar roʻyxati.',
      audience: 'all' as const,
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setTitle(preset.title);
    setBody(preset.body);
    setAudience(preset.audience);
    setFeedback(null);
  };

  const handleSelectListing = (listing: PushListingItem) => {
    setSelectedListing(listing);
    // If title or body are empty, provide smart defaults for that listing
    if (!title) {
      setTitle(`🏠 ${listing.title}`);
    }
    if (!body) {
      const priceFormatted = new Intl.NumberFormat('uz-UZ').format(listing.price);
      const cur = listing.currency === 'USD' ? '$' : 'soʻm';
      setBody(`${listing.district ? listing.district + ', ' : ''}${priceFormatted} ${cur}/oy. Egasidan toʻgʻridan-toʻgʻri ijara!`);
    }
    setCustomUrl(`/?listing=${listing.id}`);
  };

  const handleRemoveListing = () => {
    setSelectedListing(null);
    if (customUrl.startsWith('/?listing=')) {
      setCustomUrl('');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFeedback({ type: 'error', message: 'Sarlavha va xabar matnini kiriting' });
      return;
    }

    setSending(true);
    setFeedback(null);

    const payload: SendPushPayload = {
      title: title.trim(),
      body: body.trim(),
      target_audience: audience,
      target_user_id: audience === 'specific' ? targetUserId.trim() || undefined : undefined,
      listing_id: selectedListing ? selectedListing.id : undefined,
      url: customUrl.trim() || (selectedListing ? `/?listing=${selectedListing.id}` : '/'),
      image: selectedListing?.image || undefined,
    };

    try {
      const res = await http.post<SendPushResult>(api.push.send, payload);
      setFeedback({
        type: 'success',
        message: `Push xabar muvaffaqiyatli joʻnatildi! Qamrov: ${res.sent_count || 0} ta qurilma.`,
      });
      // Clear or reset fields
      setTitle('');
      setBody('');
      setSelectedListing(null);
      setCustomUrl('');
      setTargetUserId('');
      if (onSent) onSent();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Xatolik yuz berdi. Iltimos qaytadan urinib koʻring.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Composer Form */}
      <div className="lg:col-span-7 card p-5 md:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Foydalanuvchilar brauzer va telefonlariga push bildirishnoma tarqatish
              </p>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t('presetsTitle')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-xl border text-xs font-medium transition hover:scale-[1.02] active:scale-[0.98] ${preset.color}`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="line-clamp-1">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          {/* Audience Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {t('audienceLabel')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'all', label: t('allUsers'), icon: Layers },
                { id: 'students', label: t('students'), icon: GraduationCap },
                { id: 'tenants', label: t('tenants'), icon: Home },
                { id: 'owners', label: t('owners'), icon: Building },
                { id: 'specific', label: t('specific'), icon: Users },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = audience === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAudience(opt.id as any)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific User ID input if selected */}
          {audience === 'specific' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('userIdLabel')}
              </label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="UUID yoki +998901234567"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('titleLabel')} <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.length}/60</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={60}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('bodyLabel')} <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{body.length}/140</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('bodyPlaceholder')}
              rows={3}
              maxLength={140}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Attached Listing Card */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                {t('attachListing')}
              </span>
              {selectedListing && (
                <button
                  type="button"
                  onClick={handleRemoveListing}
                  className="text-[11px] text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {t('removeListing')}
                </button>
              )}
            </label>

            {selectedListing ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                    {selectedListing.image ? (
                      <img
                        src={selectedListing.image}
                        alt={selectedListing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Home className="w-6 h-6 m-3 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {selectedListing.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedListing.district} •{' '}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('uz-UZ').format(selectedListing.price)}{' '}
                        {selectedListing.currency === 'USD' ? '$' : 'soʻm'}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPickerOpen(true)}
                  className="rounded-lg text-xs ml-2 flex-shrink-0"
                >
                  {t('changeListing')}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="w-full py-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                + Eʼlon biriktirish (Tavsiya berish)
              </button>
            )}
          </div>

          {/* Custom URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              {t('customUrl')}
            </label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Masalan: /?listing=abc yoki https://uyiz.uz"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
          </div>

          {/* Feedback alert */}
          {feedback && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={sending || !title.trim() || !body.trim()}
              className="w-full py-3 rounded-xl shadow-md shadow-indigo-500/20 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? t('sending') : t('sendButton')}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Column: Live Mobile Preview */}
      <div className="lg:col-span-5 space-y-4">
        <div className="card p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              {t('preview')}
            </h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
              Jonli simulyatsiya
            </span>
          </div>

          {/* Smartphone Frame */}
          <div className="relative mx-auto w-full max-w-[320px] rounded-[38px] p-3 bg-slate-900 shadow-2xl border-4 border-slate-800 text-white">
            {/* Speaker notch / dynamic island */}
            <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-4 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-800 ml-auto mr-2" />
            </div>

            {/* Simulated lock screen wallpaper */}
            <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 p-4 min-h-[380px] flex flex-col justify-between">
              {/* Clock */}
              <div className="text-center pt-2">
                <div className="text-3xl font-light tracking-tight text-white/90">
                  {new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[11px] text-white/60 font-medium">
                  {new Date().toLocaleDateString('uz-UZ', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Push Notification Banner */}
              <div className="my-auto">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white rounded-2xl p-3 shadow-xl border border-white/20 dark:border-slate-700/50 transition-all duration-300 animate-in fade-in slide-in-from-top-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                        U
                      </div>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white">Uyiz.uz</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">hozirgina</span>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                      {title.trim() || 'Sarlavha shu yerda aks etadi'}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {body.trim() || 'Xabaringiz foydalanuvchilar ekranida aynan shu koʻrinishda ochiladi...'}
                    </div>
                  </div>

                  {/* Attached Listing Thumbnail if present */}
                  {selectedListing && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                        {selectedListing.image ? (
                          <img
                            src={selectedListing.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Home className="w-5 h-5 m-2.5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold text-slate-900 dark:text-white truncate">
                          {selectedListing.title}
                        </div>
                        <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Intl.NumberFormat('uz-UZ').format(selectedListing.price)}{' '}
                          {selectedListing.currency === 'USD' ? '$' : 'soʻm'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom hint */}
              <div className="text-center pb-2 text-[10px] text-white/40">
                Ochish uchun bosing
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Listing Picker Modal */}
      <ListingPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectListing}
        selectedId={selectedListing?.id}
      />
    </div>
  );
}
