'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  KeyRound,
  User,
  Lock,
  Upload,
  ChevronDown,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { useFaceLogin } from '../hooks/useFaceLogin';
import { faceRegister, getFaceStatus, type FaceAdminItem } from '../api';
import { useAuthStore } from '@/store/auth.store';

interface FaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  initialAdminUsername?: string;
  onSuccess?: () => void;
}

export function FaceModal({
  isOpen,
  onClose,
  initialMode = 'login',
  initialAdminUsername,
  onSuccess,
}: FaceModalProps) {
  const currentAdmin = useAuthStore((s) => s.admin);
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Kameraga to\'g\'ri qarang...');
  const [autoScan, setAutoScan] = useState(true);

  // Admin selector state
  const [adminsList, setAdminsList] = useState<FaceAdminItem[]>([]);
  const [selectedAdminUsername, setSelectedAdminUsername] = useState<string>(
    initialAdminUsername || currentAdmin?.username || 'admin',
  );
  const [regPassword, setRegPassword] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { mutate: doFaceLogin, isPending: isLoggingIn } = useFaceLogin();

  // Load admins and enrollment status
  const refreshStatus = useCallback(async () => {
    try {
      const res = await getFaceStatus();
      if (res.admins && res.admins.length > 0) {
        setAdminsList(res.admins);
        if (!initialAdminUsername && !currentAdmin?.username) {
          const firstEnrolled = res.admins.find((a) => a.hasFace);
          setSelectedAdminUsername(firstEnrolled?.username || res.admins[0].username);
        }
      }
      if (!res.enrolled && initialMode === 'login' && !isAuthenticated) {
        setMode('register');
      } else {
        setMode(initialMode);
      }
    } catch (err) {
      console.error('Failed to get face status:', err);
      setMode(initialMode);
    }
  }, [initialMode, initialAdminUsername, currentAdmin, isAuthenticated]);

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      if (initialAdminUsername) {
        setSelectedAdminUsername(initialAdminUsername);
      } else if (currentAdmin?.username) {
        setSelectedAdminUsername(currentAdmin.username);
      }
      setCapturedPreview(null);
      setErrorMsg(null);
    }
  }, [isOpen, initialAdminUsername, currentAdmin, refreshStatus]);

  // Sound chime on success
  const playSuccessSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Audio context might be restricted
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
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
      setStatusMsg('Yuzingizni doiraga to\'g\'rilang...');
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setErrorMsg(
        'Kameraga ruxsat berilmadi yoki kamera topilmadi. Brauzer sozlamalaridan kameraga ruxsat bering yoki quyidagi fayl yuklash tugmasidan foydalaning.',
      );
      setStatusMsg('Kamera ulanmadi');
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

  // Keep video playing if stream is active
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Capture frame from video or return captured preview
  const captureFrame = useCallback((): string | null => {
    if (capturedPreview) return capturedPreview;

    if (!videoRef.current) return null;
    const video = videoRef.current;

    let width = video.videoWidth;
    let height = video.videoHeight;

    if (!width || !height) {
      width = 640;
      height = 480;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [capturedPreview]);

  // Trigger flash effect
  const triggerFlash = () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);
  };

  // Main scan / capture function
  const handleScan = useCallback(
    async (isAuto = false, explicitBase64?: string) => {
      if (isProcessing || isLoggingIn) return;

      const base64Img = explicitBase64 || captureFrame();
      if (!base64Img) {
        if (!isAuto) {
          setErrorMsg('Kameradan tasvir olinmadi. Kamera ishga tushishini kuting yoki pastdagi fayl yuklash tugmasidan rasm tanlang.');
        }
        return;
      }

      if (!isAuto) {
        triggerFlash();
        setCapturedPreview(base64Img);
      }

      setIsProcessing(true);
      if (!isAuto) setErrorMsg(null);
      setStatusMsg('Biometrik ma\'lumotlar tahlil qilinmoqda...');

      try {
        if (mode === 'login') {
          const username = selectedAdminUsername.trim();
          if (!username) {
            setErrorMsg('Iltimos, kirish uchun adminni tanlang.');
            setIsProcessing(false);
            return;
          }
          doFaceLogin(
            { username, image: base64Img },
            {
              onSuccess: () => {
                playSuccessSound();
                setStatusMsg('✅ Muvaffaqiyatli tanildi!');
                stopCamera();
                if (onSuccess) onSuccess();
                onClose();
              },
              onError: (err: unknown) => {
                const msg =
                  (err as { message?: string })?.message ||
                  'Yuz aniqlanmadi yoki mos kelmadi.';
                if (!isAuto) {
                  setErrorMsg(msg);
                  setStatusMsg('Yuz mos kelmadi.');
                  setCapturedPreview(null);
                } else {
                  setStatusMsg('Yuz qidirilmoqda...');
                }
              },
              onSettled: () => {
                setIsProcessing(false);
              },
            },
          );
        } else {
          // Registration mode
          const targetUsername = selectedAdminUsername.trim();
          if (!targetUsername) {
            setErrorMsg('Iltimos, qaysi admin uchun ro\'yxatdan o\'tkazishni tanlang.');
            setIsProcessing(false);
            return;
          }

          // If NOT authenticated inside admin panel, require password
          if (!isAuthenticated && !regPassword) {
            setErrorMsg('Iltimos, admin parolini kiriting.');
            setIsProcessing(false);
            return;
          }

          const res = await faceRegister({
            image: base64Img,
            username: targetUsername,
            password: isAuthenticated ? undefined : regPassword,
          });

          playSuccessSound();
          setStatusMsg(res.message || '✅ Face ID muvaffaqiyatli saqlandi!');
          await refreshStatus();

          setTimeout(() => {
            setIsProcessing(false);
            setCapturedPreview(null);
            if (isAuthenticated) {
              if (onSuccess) onSuccess();
              onClose();
            } else {
              setMode('login');
              setStatusMsg('Endi Face ID orqali tizimga kirishingiz mumkin.');
            }
          }, 1200);
        }
      } catch (err: unknown) {
        console.error('Face error:', err);
        const msg =
          (err as { message?: string })?.message ||
          'Server bilan bog\'lanishda xatolik yuz berdi.';
        if (!isAuto) {
          setErrorMsg(msg);
          setStatusMsg('Xatolik yuz berdi');
          setCapturedPreview(null);
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
      selectedAdminUsername,
      regPassword,
      isAuthenticated,
      refreshStatus,
    ],
  );

  // Auto scan interval for login
  useEffect(() => {
    if (
      isOpen &&
      mode === 'login' &&
      autoScan &&
      stream &&
      !isProcessing &&
      !isLoggingIn &&
      !capturedPreview
    ) {
      autoScanTimerRef.current = setInterval(() => {
        handleScan(true);
      }, 1800);
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [
    isOpen,
    mode,
    autoScan,
    stream,
    isProcessing,
    isLoggingIn,
    capturedPreview,
    handleScan,
  ]);

  // Handle local file upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setCapturedPreview(b64);
      handleScan(false, b64);
    };
    reader.readAsDataURL(file);
  };

  const selectedAdmin = adminsList.find((a) => a.username === selectedAdminUsername);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in">
      <div
        className="w-full max-w-lg rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-6 md:p-8 flex flex-col max-h-[95vh] overflow-y-auto custom-scrollbar"
        style={{
          background:
            'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 18, 34, 0.99) 100%)',
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.15)',
        }}
      >
        {/* Shutter Flash Animation Layer */}
        {isFlashing && (
          <div className="absolute inset-0 z-50 bg-white/80 pointer-events-none transition-opacity duration-200" />
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {mode === 'login'
                  ? 'Face ID Bilan Kirish'
                  : 'Face ID Ro\'yxatdan O\'tkazish'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'login'
                  ? 'Kameraga to\'g\'ri qarang'
                  : 'Admin yuzini tizimga biriktirish'}
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

        {/* Mode Switch Tabs */}
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800 mt-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setCapturedPreview(null);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'login'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Face ID Kirish
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setCapturedPreview(null);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'register'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Yuzni Ro'yxatdan O'tkazish
          </button>
        </div>

        {/* Admin Selector for Registration & Login Modes */}
        <div className="mt-4 p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {mode === 'login'
                  ? 'Qaysi hisob bilan kirmoqchisiz?'
                  : 'Qaysi admin uchun ro\'yxatdan o\'tkazilsin?'}
              </span>
            </label>
            {adminsList.length > 0 && (
              <span className="text-[10px] text-slate-400">
                {adminsList.length} ta admin mavjud
              </span>
            )}
          </div>

          {adminsList.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-700/80 text-left hover:border-emerald-500/50 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0 overflow-hidden">
                    {selectedAdmin?.faceImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedAdmin.faceImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (selectedAdmin?.fullName || selectedAdminUsername)
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {selectedAdmin?.fullName || selectedAdminUsername}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-mono">
                        @{selectedAdmin?.username || selectedAdminUsername}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-semibold uppercase">
                        {selectedAdmin?.role || 'ADMIN'}
                      </span>
                      {selectedAdmin?.hasFace && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Face ID bor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>

              {/* Dropdown Options */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 space-y-1 custom-scrollbar">
                  {adminsList.map((adm) => {
                    const isSelected = adm.username === selectedAdminUsername;
                    return (
                      <button
                        key={adm.id}
                        type="button"
                        onClick={() => {
                          setSelectedAdminUsername(adm.username);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
                          isSelected
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-white'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 overflow-hidden">
                            {adm.faceImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={adm.faceImage}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              adm.fullName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {adm.fullName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              @{adm.username} • {adm.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {adm.hasFace && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                              Mavjud
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Admin Login (username)"
                value={selectedAdminUsername}
                onChange={(e) => setSelectedAdminUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Password input only in registration mode if user is NOT authenticated */}
          {mode === 'register' && !isAuthenticated && (
            <div className="pt-1">
              <div className="flex items-center gap-1 text-[11px] text-amber-400 font-medium mb-1">
                <KeyRound className="w-3 h-3" />
                <span>Xavfsizlik uchun ushbu admin parolini kiriting:</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  placeholder="Admin Paroli"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Video Viewport with HUD & Camera Controls */}
        <div className="my-4 relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border border-emerald-500/20 shadow-inner group">
          {capturedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedPreview}
              alt="Preview"
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
              className="w-full h-full object-cover transform -scale-x-100"
            />
          )}

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
                isProcessing
                  ? 'border-amber-400 animate-spin'
                  : 'border-emerald-400/60 animate-pulse'
              } flex items-center justify-center`}
            >
              <div className="w-40 h-40 rounded-full border border-emerald-500/30" />
            </div>

            {/* Sweeping Laser Line */}
            {!capturedPreview && (
              <div
                className="absolute left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
                style={{
                  animation: 'faceLaser 2.2s ease-in-out infinite',
                }}
              />
            )}
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

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Main Capture / Scan Button */}
            <button
              type="button"
              onClick={() => handleScan(false)}
              disabled={isProcessing || isLoggingIn}
              className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {isProcessing || isLoggingIn ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              <span>
                {mode === 'login'
                  ? '📸 Yuzni Skanerlash'
                  : '📸 Yuzni Suratga Olish Va Saqlash'}
              </span>
            </button>

            {/* Retake button if preview is frozen */}
            {capturedPreview && (
              <button
                type="button"
                onClick={() => {
                  setCapturedPreview(null);
                  setErrorMsg(null);
                  startCamera();
                }}
                className="w-full sm:w-auto px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Qayta suratga olish</span>
              </button>
            )}
          </div>

          {/* Alternative: File Upload Fallback */}
          <div className="flex items-center justify-between pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800/50"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fayldan rasm yuklash</span>
            </button>

            {mode === 'register' && isAuthenticated && (
              <span className="text-[10px] text-emerald-400/90 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin xavfsiz seansi faol</span>
              </span>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[11px] text-center text-slate-500 mt-4">
          🔒 Yuz tasviri shifrlangan matematik vektor ko'rinishida xavfsiz saqlanadi.
        </p>
      </div>

      <style jsx global>{`
        @keyframes faceLaser {
          0% {
            top: 12%;
            opacity: 0.2;
          }
          50% {
            top: 88%;
            opacity: 1;
          }
          100% {
            top: 12%;
            opacity: 0.2;
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
