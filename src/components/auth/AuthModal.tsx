import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UserRole } from '../../types';
import { ApiService } from '../../services/apiService';
import { signInWithGooglePopup } from '../../config/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentRole, addXp } = useAppStore();

  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP' | 'PROFILE' | 'SUCCESS'>('PHONE');
  const [phone, setPhone] = useState('+998 90 123 45 67');
  const [otpCode, setOtpCode] = useState(['1', '2', '3', '4']);
  const [fullName, setFullName] = useState('Alisher Valiyev');
  const [selectedRole, setSelectedRole] = useState<UserRole>('TENANT');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const gResult = await signInWithGooglePopup();
      const res = await ApiService.loginGoogle({
        email: gResult.user.email || 'user@google.com',
        name: gResult.user.displayName || 'Google User',
        avatar: gResult.user.photoURL,
        uid: gResult.user.uid,
        idToken: gResult.idToken
      });

      if (res) {
        setFullName(gResult.user.displayName || 'Google User');
        setCurrentRole(res.role || 'TENANT');
        addXp(30, 'Google orqali avtorizatsiya va profil tasdiqlash');
        setAuthStep('SUCCESS');
        setTimeout(() => {
          onClose();
          setAuthStep('PHONE');
        }, 1500);
      }
    } catch (err: any) {
      console.error("Google login failed:", err);
      setErrorMessage('Google orqali kirishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };


  const handleSendPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      await ApiService.sendOtp(phone);
      setAuthStep('OTP');
    } catch (err: any) {
      setErrorMessage('SMS yuborishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      const codeStr = otpCode.join('');
      const res = await ApiService.verifyOtp(phone, codeStr);
      if (res.verified) {
        setAuthStep('PROFILE');
      } else {
        setErrorMessage('SMS kod noto\'g\'ri kiritildi');
      }
    } catch (err: any) {
      setErrorMessage('Kodni tasdiqlashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0] || 'Foydalanuvchi';
      const lastName = parts.slice(1).join(' ') || '';

      const regRes = await ApiService.register({
        phone,
        code: otpCode.join(''),
        first_name: firstName,
        last_name: lastName,
        role: selectedRole,
      });

      if (regRes) {
        setCurrentRole(selectedRole);
        addXp(20, 'Ro\'yxatdan o\'tish va SMS OTP tasdiqlash');
        setAuthStep('SUCCESS');
        setTimeout(() => {
          onClose();
          setAuthStep('PHONE');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage('Profilni saqlashda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const modal = (
    <div
      className="auth-overlay fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="auth-sheet bg-white rounded-t-[28px] sm:rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[88dvh] pb-8 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto shadow-md shadow-emerald-600/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Maklersiz<span className="text-emerald-600">.uz</span> Kirish
          </h2>
          <p className="text-xs text-slate-500 px-4">
            Maklersiz, komissiyasiz. Kvartirani egasidan o'zingiz toping.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        {authStep === 'PHONE' && (
          <form onSubmit={handleSendPhone} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Telefon raqamingiz</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-4" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-700/20 text-sm"
            >
              {isLoading ? 'SMS yuborilmoqda...' : 'SMS kod olish'}
            </button>

            <div className="pt-1 text-center">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] font-bold text-slate-400 uppercase">yoki</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {isLoading ? 'Google bilan kirilmoqda...' : 'Google bilan kirish'}
              </button>
            </div>
          </form>
        )}

        {authStep === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs text-center">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">4 xonali SMS kod</label>
              <p className="text-[11px] text-slate-500">{phone} raqamiga yuborildi</p>
              <div className="flex justify-center gap-2.5 py-3">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const newArr = [...otpCode];
                      newArr[idx] = e.target.value;
                      setOtpCode(newArr);
                    }}
                    className="w-12 h-14 bg-slate-50 border-2 border-emerald-500 rounded-xl text-center text-xl font-bold font-mono text-slate-900 shadow-sm"
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm"
            >
              {isLoading ? 'Tasdiqlanmoqda...' : 'Kodni tasdiqlash'}
            </button>
          </form>
        )}

        {authStep === 'PROFILE' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Ism va familiyangiz</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ism Familiya..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Siz kimsiz?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole('TENANT')}
                  className={`p-3 rounded-xl border font-bold text-center transition-all ${
                    selectedRole === 'TENANT'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  👤 Ijarachiman
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('OWNER')}
                  className={`p-3 rounded-xl border font-bold text-center transition-all ${
                    selectedRole === 'OWNER'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  🏠 Uy egasiman
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm"
            >
              {isLoading ? 'Profil yaratilmoqda...' : 'Davom etish'}
            </button>
          </form>
        )}

        {authStep === 'SUCCESS' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-bold text-slate-900">Xush kelibsiz, {fullName}!</h3>
            <p className="text-xs text-slate-500">Endi kvartirani maklersiz, o'zingiz topishingiz mumkin.</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
