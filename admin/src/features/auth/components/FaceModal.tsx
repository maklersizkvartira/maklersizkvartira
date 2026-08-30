'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles, KeyRound, User, Lock } from 'lucide-react';
import { useFaceLogin } from '../hooks/useFaceLogin';
import { faceRegister, getFaceStatus } from '../api';

interface FaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export function FaceModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}: FaceModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Kameraga to\'g\'ri qarang...');
  const [autoScan, setAutoScan] = useState(true);
  const [regUsername, setRegUsername] = useState('admin');
  const [regPassword, setRegPassword] = useState('');
  const [hasEnrolledFace, setHasEnrolledFace] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { mutate: doFaceLogin, isPending: isLoggingIn } = useFaceLogin();

  // Check enrollment status when opening
  useEffect(() => {
    if (isOpen) {
      getFaceStatus()
        .then((res) => {
          setHasEnrolledFace(res.enrolled);
          if (!res.enrolled && initialMode === 'login') {
            setMode('register');
          } else {
            setMode(initialMode);
          }
        })
        .catch(() => {
          setMode(initialMode);
        });
    }
  }, [isOpen, initialMode]);

  // Audio confirmation chime
  const playSuccessSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context might be restricted before interaction
    }
  }, []);

  // Camera start / stop
  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      setStatusMsg('Kamera faollashtirilmoqda...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatusMsg('Yuzingizni doiraga to\'g\'rilang...');
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setErrorMsg('Kameraga ruxsat berilmadi yoki kamera topilmadi. Brauzer sozlamalaridan kameraga ruxsat bering.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    }
    return () => {
      stopCamera();
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [isOpen, startCamera, stopCamera]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const handleScan = useCallback(
    async (isAuto = false) => {
      if (isProcessing || isLoggingIn) return;
      const base64Img = captureFrame();
      if (!base64Img) return;

      setIsProcessing(true);
      if (!isAuto) setErrorMsg(null);
      setStatusMsg('Biometrik ma\'lumotlar tekshirilmoqda...');

      try {
        if (mode === 'login') {
          doFaceLogin(base64Img, {
            onSuccess: () => {
              playSuccessSound();
              setStatusMsg('✅ Muvaffaqiyatli tanildi!');
              stopCamera();
              if (onSuccess) onSuccess();
              onClose();
            },
            onError: (err: unknown) => {
              const msg = (err as { message?: string })?.message || 'Yuz aniqlanmadi yoki mos kelmadi.';
              if (!isAuto) {
                setErrorMsg(msg);
                setStatusMsg('Yuz mos kelmadi.');
              } else {
                setStatusMsg('Yuz qidirilmoqda...');
              }
            },
            onSettled: () => {
              setIsProcessing(false);
            },
          });
        } else {
          // Registration mode
          if (!regUsername || !regPassword) {
            setErrorMsg('Iltimos, admin login va parolini kiriting.');
            setIsProcessing(false);
            return;
          }
          const res = await faceRegister({
            image: base64Img,
            username: regUsername.trim(),
            password: regPassword,
          });
          playSuccessSound();
          setStatusMsg(res.message || '✅ Face ID muvaffaqiyatli saqlandi!');
          setHasEnrolledFace(true);
          setTimeout(() => {
            setMode('login');
            setIsProcessing(false);
            setStatusMsg('Endi Face ID orqali kirishingiz mumkin.');
          }, 1200);
        }
      } catch (err: unknown) {
        console.error('Face error:', err);
        if (!isAuto) {
          setErrorMsg((err as { message?: string })?.message || 'Server bilan bog\'lanishda xatolik yuz berdi.');
        }
        setIsProcessing(false);
      }
    },
    [
      isProcessing,
      isLoggingIn,
      captureFrame,
      mode,
      doFaceLogin,
      playSuccessSound,
      stopCamera,
      onSuccess,
      onClose,
      regUsername,
      regPassword,
    ],
  );

  // Auto scan interval for login
  useEffect(() => {
    if (isOpen && mode === 'login' && autoScan && stream && !isProcessing && !isLoggingIn) {
      autoScanTimerRef.current = setInterval(() => {
        handleScan(true);
      }, 1600);
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [isOpen, mode, autoScan, stream, isProcessing, isLoggingIn, handleScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in">
      <div
        className="w-full max-w-lg rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-6 md:p-8 flex flex-col"
        style={{
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(11, 18, 34, 0.98) 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.15)',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {mode === 'login' ? 'Face ID Bilan Kirish' : 'Face ID Ro\'yxatdan O\'tkazish'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'login' ? 'Kameraga to\'g\'ri qarang' : 'Yuzingizni 1 marta tizimga biriktiring'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport with HUD */}
        <div className="my-5 relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border border-emerald-500/20 shadow-inner group">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Biometric Scanning Overlay Elements */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* HUD Corner Brackets */}
            <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-emerald-400/90 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-emerald-400/90 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-emerald-400/90 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-emerald-400/90 rounded-br-lg" />

            {/* Target Reticle Circle */}
            <div
              className={`w-44 h-44 rounded-full border-2 border-dashed ${
                isProcessing ? 'border-amber-400 animate-spin' : 'border-emerald-400/60 animate-pulse'
              } flex items-center justify-center`}
            >
              <div className="w-40 h-40 rounded-full border border-emerald-500/30" />
            </div>

            {/* Sweeping Laser Line */}
            <div
              className="absolute left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
              style={{
                animation: 'faceLaser 2.2s ease-in-out infinite',
              }}
            />
          </div>

          {/* Real-time Status Overlay Badge */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none px-2">
            <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 text-emerald-300 font-mono text-[11px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              {statusMsg}
            </span>
            {mode === 'login' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoScan(!autoScan);
                }}
                className="pointer-events-auto px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-semibold hover:border-emerald-400 transition"
              >
                Avto: {autoScan ? 'Yoqilgan' : 'O\'chirilgan'}
              </button>
            )}
          </div>
        </div>

        {/* Error message alert */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-300 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}

        {/* Registration Credentials Inputs (when enrolling) */}
        {mode === 'register' && (
          <div className="mb-4 space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 mb-1">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Admin Tasdig'i (Yuzni biriktirish uchun)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Admin Login"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  placeholder="Admin Parol"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => handleScan(false)}
            disabled={isProcessing || isLoggingIn}
            className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing || isLoggingIn ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span>
              {mode === 'login' ? 'Yuzni Skanerlash' : 'Yuzni Saqlash'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="w-full sm:w-auto px-4 py-3.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-slate-700/60"
          >
            {mode === 'login' ? 'Yangi Yuzni Saqlash' : 'Kirish Rejimiga O\'tish'}
          </button>
        </div>

        {/* Notice */}
        <p className="text-[11px] text-center text-slate-500 mt-4">
          🔒 Yuz tasviri shifrlangan matematik vektor ko'rinishida xavfsiz saqlanadi.
        </p>
      </div>

      <style jsx global>{`
        @keyframes faceLaser {
          0% { top: 12%; opacity: 0.2; }
          50% { top: 88%; opacity: 1; }
          100% { top: 12%; opacity: 0.2; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
