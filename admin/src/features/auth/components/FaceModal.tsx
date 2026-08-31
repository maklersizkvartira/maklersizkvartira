'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  KeyRound,
  User,
  Lock,
  Upload,
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
  initialPassword?: string;
  onSuccess?: () => void;
}

// Compress and resize image to lightweight dimensions (< 40KB) for instant upload
function compressImage(imgSource: CanvasImageSource, srcWidth: number, srcHeight: number): string {
  const maxDim = 480;
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (targetWidth > targetHeight) {
    if (targetWidth > maxDim) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    }
  } else {
    if (targetHeight > maxDim) {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth || 480;
  canvas.height = targetHeight || 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export function FaceModal({
  isOpen,
  onClose,
  initialMode = 'login',
  initialAdminUsername,
  initialPassword,
  onSuccess,
}: FaceModalProps) {
  const currentAdmin = useAuthStore((s) => s.admin);
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Kameraga to\'g\'ri qarang...');
  const [autoScan, setAutoScan] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  // Admin selector state
  const [adminsList, setAdminsList] = useState<FaceAdminItem[]>([]);
  const [selectedAdminUsername, setSelectedAdminUsername] = useState<string>(
    initialAdminUsername || currentAdmin?.username || 'admin',
  );
  const [regPassword, setRegPassword] = useState(initialPassword || '');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const selectedAdmin = adminsList.find((a) => a.username === selectedAdminUsername);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { mutate: doFaceLogin, isPending: isLoggingIn } = useFaceLogin();

  // Load admins and enrollment status
  const refreshStatus = useCallback(async () => {
    try {
      const res = await getFaceStatus();
      if (res.admins && res.admins.length > 0) {
        setAdminsList(res.admins);
        const targetAdmin = initialAdminUsername
          ? res.admins.find((a) => a.username === initialAdminUsername)
          : currentAdmin?.username
          ? res.admins.find((a) => a.username === currentAdmin.username)
          : (initialMode === 'login' ? res.admins.find((a) => a.hasFace) : null) || res.admins[0];

        if (targetAdmin) {
          setSelectedAdminUsername(targetAdmin.username);
          if (!targetAdmin.hasFace && initialMode === 'login' && !isAuthenticated) {
            setMode('register');
            setStatusMsg(`@${targetAdmin.username} hisobida Face ID yo'q. Yuzingizni saqlang.`);
          } else {
            setMode(initialMode);
          }
        }
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

  // Audio confirmation chime
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
      // Ignore audio restriction
    }
  }, []);

  // Stable Camera Init Effect - runs strictly once when modal opens!
  useEffect(() => {
    let isMounted = true;
    let localStream: MediaStream | null = null;

    async function initCamera() {
      if (!isOpen) return;
      try {
        setErrorMsg(null);
        setStatusMsg('Kamera faollashtirilmoqda...');
        setCameraReady(false);

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback for devices without facingMode user
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!isMounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStream = mediaStream;
        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) {
              setCameraReady(true);
              setStatusMsg('Yuzingizni markazga to\'g\'rilang...');
              videoRef.current?.play().catch(console.error);
            }
          };
          videoRef.current.play().catch(() => {});
        }
      } catch (err: unknown) {
        console.error('Camera access error:', err);
        if (isMounted) {
          setErrorMsg(
            'Kameraga ulanib bo\'lmadi. Brauzerda kameraga ruxsat bering yoki quyidagi "Fayldan rasm yuklash" tugmasidan foydalaning.',
          );
          setStatusMsg('Kamera ulanmadi');
        }
      }
    }

    if (isOpen) {
      initCamera();
    }

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [isOpen]);

  // Callback ref when video element mounts
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        el.onloadedmetadata = () => {
          setCameraReady(true);
          el.play().catch(console.error);
        };
        el.play().catch(() => {});
      }
    }
  }, []);

  // Capture frame from video or preview
  const captureFrame = useCallback((): string | null => {
    if (capturedPreview) return capturedPreview;

    const video = videoRef.current;
    if (!video) return null;

    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    return compressImage(video, width, height);
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
          setErrorMsg(
            'Kameradan tasvir olinmadi. Iltimos, kamera to\'liq ishga tushishini kuting yoki pastdagi "Fayldan rasm yuklash" tugmasidan foydalaning.',
          );
        }
        return;
      }

      const targetUsername = selectedAdminUsername.trim();
      if (!targetUsername) {
        setErrorMsg('Iltimos, admin hisobini tanlang.');
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
          doFaceLogin(
            { username: targetUsername, image: base64Img },
            {
              onSuccess: () => {
                playSuccessSound();
                setStatusMsg('✅ Muvaffaqiyatli tanildi!');
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach((t) => t.stop());
                }
                if (onSuccess) onSuccess();
                onClose();
              },
              onError: (err: unknown) => {
                const errObj = err as { code?: string; message?: string };
                const rawCode = errObj.code || errObj.message || '';

                if (rawCode.includes('face_not_enrolled')) {
                  setErrorMsg(
                    `@${targetUsername} hisobida hali Face ID o'rnatilmagan. Iltimos, parolni kiritib yuzingizni ro'yxatdan o'tkazing.`,
                  );
                  setStatusMsg("Face ID o'rnatilmagan");
                  setMode('register');
                  setCapturedPreview(null);
                  return;
                }

                const msg = rawCode.includes('invalid_credentials')
                  ? 'Yuz aniqlanmadi yoki tanlangan admin hisobiga mos kelmadi.'
                  : rawCode.includes('face_not_detected')
                  ? 'Kadrda yuz aniqlanmadi. Iltimos, kameraga to\'g\'ri qarang.'
                  : errObj.message || 'Yuz aniqlanmadi yoki tanlangan admin hisobiga mos kelmadi.';

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
          if (!isAuthenticated && !regPassword.trim()) {
            setErrorMsg(`Iltimos, @${targetUsername} hisobining parolini kiriting.`);
            setStatusMsg('Parol kiritilishi shart');
            const pwdInput = document.getElementById('face-reg-password-input');
            pwdInput?.focus();
            return;
          }

          const res = await faceRegister(
            {
              image: base64Img,
              username: targetUsername,
              password: regPassword ? regPassword.trim() : undefined,
            },
            { skipAuth: !isAuthenticated },
          );

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
              setStatusMsg('Endi Face ID orqali kirishingiz mumkin.');
            }
          }, 1200);
        }
      } catch (err: unknown) {
        console.error('Face error:', err);
        const errObj = err as { code?: string; message?: string };
        const rawCode = errObj.code || errObj.message || '';

        let msg = 'Server bilan bog\'lanishda xatolik yuz berdi.';
        if (rawCode.includes('credentials_required')) {
          msg = `Iltimos, @${targetUsername} hisobi parolini kiriting.`;
        } else if (rawCode.includes('invalid_credentials')) {
          msg = 'Admin paroli noto\'g\'ri kiritildi.';
        } else if (rawCode.includes('face_not_detected')) {
          msg = 'Kadrda yuz aniqlanmadi. Iltimos, kameraga to\'g\'ri qarang.';
        } else if (rawCode.includes('admin_not_found')) {
          msg = 'Tanlangan admin hisobi topilmadi.';
        } else if (errObj.message) {
          msg = errObj.message;
        }

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
      selectedAdminUsername,
      mode,
      doFaceLogin,
      playSuccessSound,
      onSuccess,
      onClose,
      isAuthenticated,
      regPassword,
      refreshStatus,
    ],
  );

  // Auto scan interval for login
  useEffect(() => {
    if (
      isOpen &&
      mode === 'login' &&
      autoScan &&
      cameraReady &&
      !isProcessing &&
      !isLoggingIn &&
      !capturedPreview &&
      selectedAdminUsername.trim()
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
    cameraReady,
    isProcessing,
    isLoggingIn,
    capturedPreview,
    selectedAdminUsername,
    handleScan,
  ]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawB64 = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const compressed = compressImage(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
        setCapturedPreview(compressed);
        handleScan(false, compressed);
      };
      img.src = rawB64;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in">
      <div
        className="w-full max-w-lg rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-5 md:p-7 flex flex-col max-h-[95vh] overflow-y-auto custom-scrollbar"
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
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {mode === 'login'
                  ? 'Face ID Bilan Kirish'
                  : 'Face ID Ro\'yxatdan O\'tkazish'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'login'
                  ? 'Kameraga qarab tizimga kiring'
                  : 'Admin yuzini tizimga biriktiring'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800 mt-3">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setCapturedPreview(null);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'register'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Yuzni Ro'yxatdan O'tkazish
          </button>
        </div>

        {/* Admin Account Selection Cards */}
        <div className="mt-3 p-3 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin hisobini tanlang:</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              Tanlangan: <b className="text-emerald-400">@{selectedAdminUsername}</b>
            </span>
          </div>

          {/* Cards Grid for all admins in system */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {adminsList.map((adm) => {
              const isSelected = adm.username === selectedAdminUsername;
              return (
                <button
                  key={adm.id}
                  type="button"
                  onClick={() => {
                    setSelectedAdminUsername(adm.username);
                    setErrorMsg(null);
                    if (!adm.hasFace) {
                      setMode('register');
                      setStatusMsg(`@${adm.username} hisobida Face ID yo'q. Yuzingizni ro'yxatdan o'tkazing.`);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2.5 cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">
                      {adm.fullName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      @{adm.username}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                      {adm.hasFace ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Face ID bor
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                          O'rnatilmagan
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Password field in register mode */}
          {mode === 'register' && (
            <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>@{selectedAdminUsername} hisobi paroli:</span>
                </span>
                <span className="text-[10px] text-amber-400/80 font-medium">
                  (Yuzni biriktirish uchun talab qilinadi)
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="face-reg-password-input"
                  type="password"
                  placeholder="Admin parolini kiriting"
                  value={regPassword}
                  onChange={(e) => {
                    setRegPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition ${
                    !regPassword && errorMsg?.includes('parol')
                      ? 'border-rose-500 ring-2 ring-rose-500/30'
                      : 'border-slate-700/80 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Video Viewport with HUD & Camera Controls */}
        <div className="my-3 relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/30 shadow-inner">
          {capturedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedPreview}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 block"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Biometric Scanning Overlay Elements */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* HUD Corner Brackets */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400/90 rounded-tl-lg" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400/90 rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400/90 rounded-bl-lg" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400/90 rounded-br-lg" />

            {/* Target Reticle Circle */}
            <div
              className={`w-40 h-40 rounded-full border-2 border-dashed ${
                isProcessing
                  ? 'border-amber-400 animate-spin'
                  : 'border-emerald-400/60 animate-pulse'
              } flex items-center justify-center`}
            >
              <div className="w-36 h-36 rounded-full border border-emerald-500/30" />
            </div>

            {/* Sweeping Laser Line */}
            {!capturedPreview && (
              <div
                className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
                style={{
                  animation: 'faceLaser 2.2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Real-time Status Overlay Badge */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none px-1">
            <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 text-emerald-300 font-mono text-[11px] flex items-center gap-2">
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
                className="pointer-events-auto px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-semibold hover:border-emerald-400 transition cursor-pointer"
              >
                Avto: {autoScan ? 'Yoqilgan' : 'O\'chirilgan'}
              </button>
            )}
          </div>
        </div>

        {/* Error message alert */}
        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-xs text-rose-300 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Main Capture / Scan Button */}
            <button
              type="button"
              onClick={() => {
                if (mode === 'login' && selectedAdmin && !selectedAdmin.hasFace) {
                  setMode('register');
                  setStatusMsg(`@${selectedAdmin.username} hisobida Face ID yo'q. Yuzingizni ro'yxatdan o'tkazing.`);
                  return;
                }
                handleScan(false);
              }}
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
                  ? selectedAdmin && !selectedAdmin.hasFace
                    ? '📸 Face ID O\'rnatish (Ro\'yxatdan o\'tkazish)'
                    : '📸 Yuzni Skanerlash Va Kirish'
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
                  if (videoRef.current && streamRef.current) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="w-full sm:w-auto px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
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
              className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer"
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
        <p className="text-[11px] text-center text-slate-500 mt-3">
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
