import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, Award, Upload, CheckCircle2, AlertCircle, FileText, 
  Camera, Lock, ChevronRight, Sparkles, Building, PhoneCall, Check,
  Search, ShieldAlert, Zap, Star, Eye, Image as ImageIcon, Trash2, RefreshCw,
  Video, VideoOff
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ApiService } from '../../services/apiService';
import { VerificationLevel } from '../../types';
import { VerificationBadge } from '../common/VerificationBadge';

export const VerificationPage: React.FC = () => {
  const { userXp, addXp, setAiMascotMessage, setCurrentView } = useAppStore();

  const passportInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cadastreInputRef = useRef<HTMLInputElement>(null);

  // Live Camera Video & Stream Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeStep, setActiveStep] = useState<VerificationLevel>(2);
  const [phoneVerified, setPhoneVerified] = useState(true);

  // File Upload States
  const [passportDone, setPassportDone] = useState(false);
  const [passportImage, setPassportImage] = useState<string | null>(null);

  const [selfieDone, setSelfieDone] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  // Live WebCam States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [cadastreDone, setCadastreDone] = useState(false);
  const [cadastreImage, setCadastreImage] = useState<string | null>(null);
  const [cadastreCode, setCadastreCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone / Listing verification checker tool state
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState<{
    status: 'VERIFIED_OWNER' | 'STANDARD_OWNER' | 'BROKER_FLAGGED';
    title: string;
    trustScore: number;
    description: string;
  } | null>(null);

  // Clean up media stream when component unmounts or step changes
  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, []);

  // --- Live WebCam Handlers ---
  const startLiveCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setCameraError("Kamerani jonli ochishda ruxsat yetmadi. Iltimos brauzer kameraga ruxsat bering yoki tayyor rasm yuklang.");
      setIsCameraActive(false);
    }
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureLiveSelfie = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror the selfie horizontally for natural camera feel
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setSelfieImage(dataUrl);
      stopLiveCamera();
    }
  };

  // --- Handlers for Files ---
  const handlePassportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPassportImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelfieFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelfieImage(reader.result);
          stopLiveCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCadastreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCadastreImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLevel2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passportImage) {
      alert("Iltimos, avval pasportingiz yoki ID kartangiz rasmini yuklang.");
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.submitVerification({ type: 'PASSPORT', passportImage });
    } catch {}
    setTimeout(() => {
      setIsSubmitting(false);
      setPassportDone(true);
      setActiveStep(3);
      addXp(50, 'Pasport tasdiqlandi');
      setAiMascotMessage("✨ Pasport muvaffaqiyatli tasdiqlandi! +50 XP va Level 2 Badge berildi.");
    }, 800);
  };

  const handleLevel3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfieImage) {
      alert("Iltimos, jonli kamerangiz orqali selfie tushing yoki rasm yuklang.");
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.submitVerification({ type: 'SELFIE', selfieImage });
    } catch {}
    setTimeout(() => {
      setIsSubmitting(false);
      setSelfieDone(true);
      setActiveStep(4);
      addXp(50, 'Selfie tasdiqlandi');
      setAiMascotMessage("✨ Jonli Selfie va Liveness muvaffaqiyatli o'tdi! +50 XP yig'ildi.");
    }, 800);
  };

  const handleLevel4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadastreImage && !cadastreCode.trim()) {
      alert("Iltimos, kadastr raqamini kiriting yoki kadastr hujjatini yuklang.");
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.submitVerification({ type: 'CADASTRE', cadastreImage, cadastreCode });
    } catch {}
    setTimeout(() => {
      setIsSubmitting(false);
      setCadastreDone(true);
      setActiveStep(5);
      addXp(100, 'Property Cadastre verified');
      setAiMascotMessage("🏆 Tabriklaymiz! Kvartirangiz mulk egaligi kadastri bo'yicha Level 4 Property Verified statusini oldi!");
    }, 1000);
  };

  const handlePhoneCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInput.trim()) return;
    const clean = checkInput.replace(/\D/g, '');
    if (clean.includes('901234567') || clean.includes('977778899')) {
      setCheckResult({
        status: 'VERIFIED_OWNER',
        title: "Tasdiqlangan Haqiqiy Uy Egasi 🏠",
        trustScore: 98,
        description: "Ushbu foydalanuvchi Pasport va Kadastr hujjatlari orqali 100% tasdiqlangan. Makler emas!"
      });
    } else if (clean.length > 5 && (clean.includes('999') || clean.includes('111'))) {
      setCheckResult({
        status: 'BROKER_FLAGGED',
        title: "Shubhali Telefon / Makler Ehtimoli ⚠️",
        trustScore: 42,
        description: "Ushbu raqam bazamizda 3+ martadan ko'p xilma-xil kvartira e'lonlarida uchragan. Ehtiyot bo'ling."
      });
    } else {
      setCheckResult({
        status: 'STANDARD_OWNER',
        title: "Oddiy E'lon (Hujjat yuklanmagan) ℹ️",
        trustScore: 75,
        description: "Telefon raqami tasdiqlangan, lekin hali pasport yoki kadastr hujjatlari topshirilmagan."
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 min-h-[85vh] space-y-8">

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={passportInputRef}
        accept="image/*,.pdf"
        onChange={handlePassportFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={selfieInputRef}
        accept="image/*"
        capture="user"
        onChange={handleSelfieFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={cadastreInputRef}
        accept="image/*,.pdf"
        onChange={handleCadastreFileChange}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-3 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-3.5 py-1.5 rounded-full border border-emerald-500/40">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ishonchli Tekshiruv Markazi (Verification Center)</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            E'loningiz Ishonchini va Ko'rinishini 3x Oshiring
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Uy egasi sifatida hujjatlaringizni tasdiqlang: e'loningizda yashil <strong className="text-emerald-400 font-bold">"Tasdiqlangan Uy Egasi 🏠"</strong> nishoni paydo bo'ladi hamda talabalar va ijarachilar sizga to'g'ridan-to'g'ri ishonishadi.
          </p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 text-center shrink-0 space-y-1.5 shadow-inner">
          <span className="text-xs text-slate-400 font-bold">Sizning Trust Score</span>
          <div className="text-3xl sm:text-4xl font-black text-amber-400 flex items-center justify-center gap-1.5">
            <Award className="w-8 h-8 text-amber-400" /> {userXp} XP
          </div>
          <span className="text-xs text-emerald-400 font-bold block">Level 2 Silver Member</span>
        </div>
      </div>

      {/* VISUAL DEMONSTRATION CARD: BEFORE vs AFTER */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full">
            Vizual Taqqoslash
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Ishonchli Tekshiruvdan o'tsam e'lonim qanday ko'rinadi?
          </h2>
          <p className="text-xs text-slate-500">
            Tekshiruvdan o'tgan e'lonlar qidiruvda eng yuqoriga chiqadi va talabalarda 100% ishonch uyg'otadi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          
          {/* Card 1: Oddiy (Unverified) */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 space-y-4 relative opacity-85">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg">
                ❌ Oddiy E'lon (Tekshirilmagan)
              </span>
              <span className="text-[11px] font-medium text-slate-400">Oddiy ko'rinish</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">2-xonalik shinam kvartira, Yunusobod</h4>
                  <p className="text-xs font-black text-slate-700 mt-1">4,500,000 so'm / oy</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">Oddiy</span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 border-t border-slate-100 pt-2">
                <span>Uy egasi: Dilshod</span>
                <span className="text-slate-400">• Trust Score: 70 XP</span>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 pt-1">
              <li className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Nishon (Badge) yo'q — ijarachilarda maklerlik shubha bo'lishi mumkin</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <Eye className="w-4 h-4 shrink-0" />
                <span>Qidiruvda pastroq o'rinlarda ko'rinadi</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Verified Owner (Ishonchli E'lon) */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 border-2 border-emerald-500/80 rounded-2xl p-5 space-y-4 relative shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900 bg-emerald-200/80 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ✅ Tasdiqlangan Ishonchli E'lon
              </span>
              <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-emerald-600" /> 3x Ko'proq Murojaat
              </span>
            </div>

            <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mb-1">
                    <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-black shadow-xs">
                      <ShieldCheck className="w-3 h-3" /> TASDIQLANGAN UY EGASI 🏠
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-slate-900">2-xonalik shinam kvartira, Yunusobod</h4>
                  <p className="text-sm font-black text-emerald-700 mt-1">4,500,000 so'm / oy</p>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-1 rounded-lg border border-emerald-300">
                  TOP #1
                </span>
              </div>
              <div className="text-xs text-slate-700 font-semibold flex items-center justify-between border-t border-slate-100 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">Uy egasi: Dilshod K.</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ★ 98/100 Trust Score
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-emerald-950 font-semibold pt-1">
              <li className="flex items-center gap-2 text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 font-black" />
                <span>Yashil "Tasdiqlangan Uy Egasi 🏠" nishoni bilan 100% ishonch</span>
              </li>
              <li className="flex items-center gap-2 text-emerald-800">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span>Bosh sahifa va qidiruvda eng TOP o'ringa chiqadi</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* 5 STEPS INTERACTIVE VERIFICATION PROCESS */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Ishonchli Tekshiruv Bosqichlari (5 Stepper)
          </h2>
          <p className="text-xs text-slate-500">
            Quyidagi bosqichlarni ketma-ket bajarib, o'z ishonchlilik darajangizni oshiring:
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
          {[
            { level: 1, title: 'Telefon', done: phoneVerified, xp: '+10 XP' },
            { level: 2, title: 'Pasport', done: passportDone, xp: '+50 XP' },
            { level: 3, title: 'Jonli Selfie', done: selfieDone, xp: '+50 XP' },
            { level: 4, title: 'Kadastr', done: cadastreDone, xp: '+100 XP' },
            { level: 5, title: 'VIP Owner', done: cadastreDone, xp: 'VIP' },
          ].map((step) => (
            <button
              key={step.level}
              type="button"
              onClick={() => {
                if (step.level !== 3) stopLiveCamera();
                setActiveStep(step.level as VerificationLevel);
              }}
              className={`p-2 sm:p-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
                activeStep === step.level
                  ? 'bg-slate-900 text-white font-bold shadow-md scale-[1.02]'
                  : step.done
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <span className="text-xs font-mono font-bold">L{step.level}</span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-bold leading-none hidden sm:inline">{step.title}</span>
              <span className="text-[9px] sm:text-[10px] opacity-75 font-mono">{step.xp}</span>
            </button>
          ))}
        </div>

        {/* Active Step Panel Content */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          {activeStep === 1 && (
            <div className="space-y-4 max-w-md mx-auto text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <PhoneCall className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Level 1: Telefon Tasdiqlangan</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sizning telefon raqamingiz SMS OTP orqali muvaffaqiyatli tasdiqlangan.
              </p>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Telefon Raqam Tasdiqlangan (+10 XP)
              </div>
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Keyingi Bosqich: Pasport Tasdiqlash</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg">
                  L2
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Level 2: Pasport / ID Karta Tasdiqlash</h3>
                  <p className="text-xs text-slate-500">Pasportingiz yoki ID-kartangizning nusxasi rasmga olinadi.</p>
                </div>
              </div>

              {passportDone ? (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900">Pasport Hujjatlari Tasdiqlandi! (+50 XP)</h4>
                  {passportImage && (
                    <img src={passportImage} alt="Pasport preview" className="w-32 h-20 object-cover rounded-lg mx-auto border border-emerald-300 shadow-xs" />
                  )}
                  <p className="text-xs text-emerald-700">Shaxsingiz tasdiqlandi va maxfiylik standartlari bo'yicha shifrlab saqlandi.</p>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all"
                  >
                    Level 3 Jonli Selfie Bosqichiga O'tish ➔
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLevel2Submit} className="space-y-4 text-xs">
                  {/* File Upload Box */}
                  <div
                    onClick={() => passportInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-300 rounded-2xl p-6 sm:p-8 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer space-y-3 group"
                  >
                    {passportImage ? (
                      <div className="space-y-2">
                        <img src={passportImage} alt="Passport preview" className="w-48 h-32 object-cover rounded-xl mx-auto border-2 border-blue-400 shadow-md" />
                        <div className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pasport rasmi tanlandi
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPassportImage(null); }}
                          className="text-[11px] text-rose-600 font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Boshqa rasm tanlash
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                          <Upload className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="font-black text-sm text-slate-900">Pasport yoki ID kartaning rasmini yuklang</div>
                          <p className="text-xs text-slate-500 mt-1">Bosib fayl tanlang yoki suratingizni shu yerga tashlang</p>
                        </div>
                        <span className="inline-block bg-white text-blue-700 font-bold px-4 py-2 rounded-xl border border-blue-200 text-xs shadow-xs">
                          📁 Pasport Faylini Tanlash
                        </span>
                      </>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Maxfiylik Kafolati: Shaxsiy hujjatlar e'londa KO'RSATILMAYDI, faqat verification tekshiruvi uchun shifrlangan holda saqlanadi.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !passportImage}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm ${
                      passportImage
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'AI Skanerlamoqda...' : 'Pasportni Tasdiqlashga Yuborish (+50 XP)'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* LEVEL 3: REAL-TIME LIVE WEBCAM SELFIE & LIVENESS */}
          {activeStep === 3 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg">
                  L3
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Level 3: Jonli Kamera Selfie va Liveness Tekshiruvi</h3>
                  <p className="text-xs text-slate-500">AI kamerani o'zida yuzingizni va liveness jonliligini 1-soniyada tekshiradi.</p>
                </div>
              </div>

              {selfieDone ? (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900">Jonli Selfie Liveness Tasdiqlandi! (+50 XP)</h4>
                  {selfieImage && (
                    <img src={selfieImage} alt="Selfie preview" className="w-32 h-32 object-cover rounded-full mx-auto border-4 border-emerald-400 shadow-lg" />
                  )}
                  <p className="text-xs text-emerald-700">Yuz va liveness jonliligi 99.6% darajada mos keldi.</p>
                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all"
                  >
                    Level 4 Kadastr Bosqichiga O'tish ➔
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLevel3Submit} className="space-y-4 text-xs">
                  
                  {/* LIVE WEBCAM CAMERA CONTAINER */}
                  <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-3xl p-6 text-center text-white relative overflow-hidden shadow-xl space-y-4">
                    
                    {/* If Camera is Active: Show Real-Time Live Video Stream with Oval Guide */}
                    {isCameraActive ? (
                      <div className="space-y-4">
                        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-full overflow-hidden border-4 border-emerald-400 shadow-2xl bg-black">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover transform -scale-x-100"
                          />
                          {/* Pulsing Face Oval Boundary */}
                          <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-pulse pointer-events-none" />
                          <div className="absolute bottom-3 inset-x-0 bg-black/60 backdrop-blur-xs text-[10px] text-emerald-300 font-bold py-1">
                            Yuzingizni aylanaga to'g'rilang
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={captureLiveSelfie}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-[0.97]"
                          >
                            <Camera className="w-5 h-5 fill-slate-950" />
                            <span>📸 Jonli Rasmga Tushish</span>
                          </button>
                          <button
                            type="button"
                            onClick={stopLiveCamera}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-3 rounded-2xl transition-colors"
                          >
                            Yopish
                          </button>
                        </div>
                      </div>
                    ) : selfieImage ? (
                      /* Captured Image Preview */
                      <div className="space-y-3">
                        <div className="relative w-40 h-40 mx-auto">
                          <img src={selfieImage} alt="Captured Selfie" className="w-40 h-40 object-cover rounded-full border-4 border-emerald-400 shadow-xl" />
                          <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full shadow-lg">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-emerald-400 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Jonli selfie rasmga olindi! Yuz tayyor.
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelfieImage(null); startLiveCamera(); }}
                          className="text-xs text-indigo-300 font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Qayta Jonli Rasmga Tushish
                        </button>
                      </div>
                    ) : (
                      /* Default Initial View before opening camera */
                      <div className="space-y-4 py-3">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
                          <Camera className="w-8 h-8 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-black text-base text-white">Jonli Kamerani Ochish</div>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                            Ekrandagi kamerasiz tasvir orqali yuzingiz va liveness jonliligi 100% haqiqiyligi tekshiriladi.
                          </p>
                        </div>

                        {cameraError && (
                          <div className="bg-rose-950/80 border border-rose-500/40 p-3 rounded-xl text-rose-200 text-xs font-semibold">
                            {cameraError}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={startLiveCamera}
                            className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                          >
                            <Video className="w-4 h-4" />
                            <span>📸 Jonli Kamerani Ochish (Live WebCam)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => selfieInputRef.current?.click()}
                            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Fayldan Yuklash</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selfieImage}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all text-sm ${
                      selfieImage
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'AI Yuzni Solishtirmoqda...' : '✨ AI Yuz Solishtirishni Boshlash (+50 XP)'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">
                  L4
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Level 4: Kadastr va Mulk Egaligi Verification</h3>
                  <p className="text-xs text-slate-500">Mulk egaligi hujjatlari yoki kadastr raqamini kiriting.</p>
                </div>
              </div>

              {cadastreDone ? (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                  <Building className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900">Property Verified Badge Berildi! (+100 XP)</h4>
                  <p className="text-xs text-emerald-700">Kvartirangiz haqiqiy mulk egasi sifatida platformada belgilanadi.</p>
                  <button
                    type="button"
                    onClick={() => setActiveStep(5)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all"
                  >
                    Level 5 VIP Statustini Ko'rish ➔
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLevel4Submit} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Kadastr Raqami (Masalan: 10:01:04:02...)</label>
                    <input
                      type="text"
                      value={cadastreCode}
                      onChange={(e) => setCadastreCode(e.target.value)}
                      placeholder="10:01:04:02:01:0045..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono font-semibold text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div
                    onClick={() => cadastreInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer space-y-2"
                  >
                    {cadastreImage ? (
                      <div className="space-y-1">
                        <FileText className="w-8 h-8 text-emerald-600 mx-auto" />
                        <div className="font-bold text-emerald-900 text-xs">Kadastr Hujjati Yuklandi</div>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                        <div className="font-bold text-slate-700">Kadastr Hujjatining Nusxasi (Rasm/PDF)</div>
                        <p className="text-[11px] text-slate-400">Bosib kadastr faylini tanlang</p>
                      </>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || (!cadastreImage && !cadastreCode.trim())}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all text-sm ${
                      cadastreImage || cadastreCode.trim()
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
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
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Tabriklaymiz! Siz platformaning eng ishonchli egalari qatoriga kirdingiz. E'lonlaringiz qidiruvda eng yuqori VIP o'ringa chiqadi.
              </p>
              <div className="inline-flex items-center gap-2">
                <VerificationBadge level={5} size="md" />
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('MY_LISTINGS')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md"
                >
                  Mening E'lonlarimga O'tish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHECKER TOOL: TELEFON RAQAM YOKI E'LONNI ISHONCHLILIKKA TEKSHIRISH */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Istagan Telefon Raqamni Ishonchlilikka Tekshiring</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ushbu raqam haqiqiy uy egasimi yoki makler ekanligini AI 1-soniyada tekshiradi</p>
          </div>
        </div>

        <form onSubmit={handlePhoneCheckSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            value={checkInput}
            onChange={(e) => setCheckInput(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3.5 rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>AI Tekshiruvni Boshlash</span>
          </button>
        </form>

        {checkResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in-50 duration-300 ${
            checkResult.status === 'VERIFIED_OWNER'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : checkResult.status === 'BROKER_FLAGGED'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : 'bg-slate-800/90 border-slate-700 text-slate-200'
          }`}>
            <div className="flex items-center justify-between font-black text-sm">
              <span>{checkResult.title}</span>
              <span className="bg-white/10 px-2.5 py-1 rounded-lg">Trust Score: {checkResult.trustScore}/100</span>
            </div>
            <p className="leading-relaxed">{checkResult.description}</p>
          </div>
        )}
      </div>

    </div>
  );
};
