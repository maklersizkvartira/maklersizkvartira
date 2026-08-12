import React, { useState } from 'react';
import { 
  ShieldCheck, Award, Upload, CheckCircle2, AlertCircle, FileText, 
  Camera, Lock, ChevronRight, Sparkles, Building, PhoneCall
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { VerificationLevel } from '../../types';
import { VerificationBadge } from '../common/VerificationBadge';

export const VerificationPage: React.FC = () => {
  const { userXp, addXp, setAiMascotMessage } = useAppStore();

  const [activeStep, setActiveStep] = useState<VerificationLevel>(2);
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [passportDone, setPassportDone] = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [cadastreDone, setCadastreDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLevel2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setPassportDone(true);
      setActiveStep(3);
      addXp(50, 'Pasport tasdiqlandi');
      setAiMascotMessage("✨ Pasport muvaffaqiyatli tasdiqlandi! +50 XP va Level 2 Badge berildi.");
    }, 1500);
  };

  const handleLevel3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSelfieDone(true);
      setActiveStep(4);
      addXp(50, 'Selfie tasdiqlandi');
      setAiMascotMessage("✨ Selfie va Liveness muvaffaqiyatli o'tdi! +50 XP yig'ildi.");
    }, 1500);
  };

  const handleLevel4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setCadastreDone(true);
      setActiveStep(5);
      addXp(100, 'Property Cadastre verified');
      setAiMascotMessage("🏆 Tabriklaymiz! Kvartirangiz mulk egaligi kadastri bo'yicha Level 4 Property Verified statusini oldi!");
    }, 1800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-500/40">
            <ShieldCheck className="w-3.5 h-3.5" /> 5-Bosqichli Verification Markazi
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Trust Score va Ishonch Darajasini Oshiring
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Verification ixtiyoriy emas, lekin yuqori Trust Score va Verified Owner nishonini olish orqali e'lonlaringiz 10 barobar ko'proq ko'riladi.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0 space-y-1">
          <span className="text-xs text-slate-300">Joriy Trust XP</span>
          <div className="text-3xl font-black text-amber-400 flex items-center justify-center gap-1">
            <Award className="w-7 h-7" /> {userXp} XP
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold block">Level 2 Silver Member</span>
        </div>
      </div>

      {/* 5 Steps Stepper Navigation */}
      <div className="grid grid-cols-5 gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
        {[
          { level: 1, title: 'Telefon', done: phoneVerified, xp: '+10 XP' },
          { level: 2, title: 'Pasport', done: passportDone, xp: '+50 XP' },
          { level: 3, title: 'Selfie', done: selfieDone, xp: '+50 XP' },
          { level: 4, title: 'Kadastr', done: cadastreDone, xp: '+100 XP' },
          { level: 5, title: 'VIP Owner', done: cadastreDone, xp: 'VIP' },
        ].map((step) => (
          <button
            key={step.level}
            onClick={() => setActiveStep(step.level as VerificationLevel)}
            className={`p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 ${
              activeStep === step.level
                ? 'bg-slate-900 text-white font-bold shadow-md'
                : step.done
                ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1">
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <span className="text-xs font-mono font-bold">L{step.level}</span>
              )}
            </div>
            <span className="text-xs hidden sm:inline">{step.title}</span>
            <span className="text-[10px] opacity-75 font-mono">{step.xp}</span>
          </button>
        ))}
      </div>

      {/* Active Step Panel Content */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-card">
        {activeStep === 1 && (
          <div className="space-y-4 max-w-md mx-auto text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <PhoneCall className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Level 1: Telefon Tasdiqlangan</h3>
            <p className="text-xs text-slate-500">
              Sizning +998 90 *** 45 67 raqamingiz SMS OTP orqali muvaffaqiyatli tasdiqlangan.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Telefon Nomer Tasdiqlangan (+10 XP)
            </div>
            <button
              onClick={() => setActiveStep(2)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-slate-800 transition-colors"
            >
              Keyingi Bosqich: Pasport Tasdiqlash ➔
            </button>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                L2
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Level 2: Pasport va Shaxsiyat Tasdiqlash</h3>
                <p className="text-xs text-slate-500">Pasport yoki ID-kartangizning bosh sahifasi suratini yuklang.</p>
              </div>
            </div>

            {passportDone ? (
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-900">Pasport Hujjatlari Tasdiqlangan</h4>
                <p className="text-xs text-emerald-700">Shaxsingiz tasdiqlandi va maxfiylik standartlari bo'yicha shifrlab saqlandi.</p>
              </div>
            ) : (
              <form onSubmit={handleLevel2Submit} className="space-y-4 text-xs">
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="font-bold text-slate-700">Pasport yoki ID kartani yuklang</div>
                  <p className="text-[11px] text-slate-400">PNG, JPG, PDF (Maks 10MB)</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Maxfiylik Kafolati: Shaxsiy hujjatlariz public e'lonlarda ko'rsatilmaydi, faqat verification uchun ishlatiladi.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'AI Skanerlamoqda...' : 'Pasportni Tasdiqlashga Yuborish (+50 XP)'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                L3
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Level 3: Selfie va Liveness Tekshiruvi</h3>
                <p className="text-xs text-slate-500">AI pasportdagi rasm va sizning selfigingizni mosligini tekshiradi.</p>
              </div>
            </div>

            {selfieDone ? (
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-900">Selfie Liveness O'tdi</h4>
                <p className="text-xs text-emerald-700">Yuz o'xshashligi 99.2% darajada mos keldi.</p>
              </div>
            ) : (
              <form onSubmit={handleLevel3Submit} className="space-y-4 text-xs">
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl p-8 text-center space-y-3">
                  <Camera className="w-10 h-10 text-indigo-500 mx-auto" />
                  <div className="font-bold text-slate-800">Kameraga qarab rasmga tushing</div>
                  <p className="text-[11px] text-slate-500">Yorug' joyda ko'zoynaksiz rasmga tushing.</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'AI Yuzni Solishtirmoqda...' : 'Selfie Skanerlash (+50 XP)'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                L4
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Level 4: Kadastr va Property Verification</h3>
                <p className="text-xs text-slate-500">Mulk egaligi hujjatlari yoki kadastr raqamini kiriting.</p>
              </div>
            </div>

            {cadastreDone ? (
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                <Building className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-900">Property Verified Badge Berildi!</h4>
                <p className="text-xs text-emerald-700">Kvartirangiz haqiqiy mulk egasi sifatida platformada belgilanadi.</p>
              </div>
            ) : (
              <form onSubmit={handleLevel4Submit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kadastr Raqami</label>
                  <input
                    type="text"
                    placeholder="10:01:04:02:01:0045..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono font-medium"
                    required
                  />
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 space-y-1">
                  <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="font-bold text-slate-700">Kadastr Hujjatining Nusxasi</div>
                  <p className="text-[11px] text-slate-400">Mulkiy huquq tasdiqnomasi</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Kadastr AI Tahlil Qilinmoqda...' : 'Property Verification Yuborish (+100 XP)'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeStep === 5 && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-4">
            <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-lg animate-pulse">
              <Sparkles className="w-10 h-10 fill-amber-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">Level 5: VIP Verified Owner</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Siz platformaning eng ishonchli egalari qatoriga kirdingiz! E'lonlaringiz qidiruvda eng yuqoriga chiqariladi.
            </p>
            <div className="inline-flex items-center gap-2">
              <VerificationBadge level={5} size="md" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
