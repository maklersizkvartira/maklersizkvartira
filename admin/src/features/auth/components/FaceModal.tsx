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

  const isSpecificAdminMode = Boolean(initialAdminUsername);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-2 sm:p-4 animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl sm:rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-4 sm:p-6 flex flex-col max-h-[94vh] overflow-y-auto custom-scrollbar"
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
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                {mode === 'login'
                  ? 'Face ID Tasdiqlash'
                  : 'Face ID Ro\'yxatdan O\'tkazish'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {mode === 'login'
                  ? 'Kameraga qarab tizimga kiring'
                  : 'Admin yuzini tizimga biriktiring'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Admin Account Header / Selector */}
        {isSpecificAdminMode ? (
          /* Compact Admin Header when specific admin is targeted */
          <div className="mt-2.5 p-2 sm:p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 overflow-hidden">
                {selectedAdmin?.faceImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedAdmin.faceImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  selectedAdminUsername.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {selectedAdmin?.fullName || selectedAdminUsername}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  @{selectedAdminUsername}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedAdmin?.hasFace ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Face ID faol
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Yuz kiritilmoqda
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Admin Selection Cards when choosing among staff */
          <div className="mt-2.5 p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin hisobi:</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                <b className="text-emerald-400">@{selectedAdminUsername}</b>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-0.5">
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
                    className={`p-2 rounded-lg text-left border transition flex items-center gap-2 cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden">
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
                      <p className="text-[11px] font-bold text-white truncate leading-tight">
                        {adm.fullName}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono truncate">
                        @{adm.username}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Video Viewport with HUD & Camera Controls */}
        <div className="my-2.5 sm:my-3 relative w-full aspect-[4/3] max-h-[260px] sm:max-h-[340px] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/30 shadow-inner shrink-0">
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
            <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-l-2 border-emerald-400/90 rounded-tl-lg" />
            <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-r-2 border-emerald-400/90 rounded-tr-lg" />
            <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-l-2 border-emerald-400/90 rounded-bl-lg" />
            <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-r-2 border-emerald-400/90 rounded-br-lg" />

            {/* Target Reticle Circle */}
            <div
              className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full border-2 border-dashed ${
                isProcessing
                  ? 'border-amber-400 animate-spin'
                  : 'border-emerald-400/60 animate-pulse'
              } flex items-center justify-center`}
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-emerald-500/30" />
            </div>

            {/* Sweeping Laser Line */}
            {!capturedPreview && (
              <div
                className="absolute left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
                style={{
                  animation: 'faceLaser 2.2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Real-time Status Overlay Badge */}
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between pointer-events-none px-1">
            <span className="px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-300 font-mono text-[10px] sm:text-[11px] flex items-center gap-1.5 truncate max-w-[70%]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
              <span className="truncate">{statusMsg}</span>
            </span>
            {mode === 'login' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoScan(!autoScan);
                }}
                className="pointer-events-auto px-2 sm:px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 text-[9px] sm:text-[10px] font-semibold hover:border-emerald-400 transition cursor-pointer shrink-0"
              >
                Avto: {autoScan ? 'Yoqilgan' : 'O\'chirilgan'}
              </button>
            )}
          </div>
        </div>

        {/* Error message alert */}
        {errorMsg && (
          <div className="mb-2.5 p-2.5 sm:p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl sm:rounded-2xl flex items-center gap-2 text-xs text-rose-300 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <p className="flex-1 text-[11px] sm:text-xs leading-tight">{errorMsg}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-col sm:flex-row items-center gap-2">
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
              className="w-full sm:flex-1 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              {isProcessing || isLoggingIn ? (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              <span>
                {mode === 'login'
                  ? selectedAdmin && !selectedAdmin.hasFace
                    ? '📸 Face ID O\'rnatish'
                    : '📸 Yuzni Skanerlash & Kirish'
                  : '📸 Yuzni Suratga Olish & Saqlash'}
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
                className="w-full sm:w-auto px-4 py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Qayta olish</span>
              </button>
            )}
          </div>

          {/* Alternative: File Upload Fallback */}
          <div className="flex items-center justify-between pt-0.5">
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
              className="text-[10px] sm:text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 py-1 px-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fayldan rasm yuklash</span>
            </button>

            {mode === 'register' && isAuthenticated && (
              <span className="text-[10px] text-emerald-400/90 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin xavfsiz seansi</span>
              </span>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[10px] text-center text-slate-500 mt-2">
          🔒 Shifrlangan biometrik Face ID himoyasi
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
