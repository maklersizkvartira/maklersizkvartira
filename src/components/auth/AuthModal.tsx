import React, { useState } from 'react';
import { Phone, Lock, UserCheck, ShieldCheck, Sparkles, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UserRole } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentRole, addXp, setAiMascotMessage } = useAppStore();

  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP' | 'PROFILE' | 'SUCCESS'>('PHONE');
  const [phone, setPhone] = useState('+998 90 123 45 67');
  const [otpCode, setOtpCode] = useState(['1', '2', '3', '4']);
  const [fullName, setFullName] = useState('Alisher Valiyev');
  const [selectedRole, setSelectedRole] = useState<UserRole>('TENANT');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setAuthStep('OTP');
    }, 1000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setAuthStep('PROFILE');
    }, 1000);
  };

  const handleCompleteProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCurrentRole(selectedRole);
      addXp(20, 'Ro\'yxatdan o\'tish va SMS OTP tasdiqlash');
      setAuthStep('SUCCESS');
      setTimeout(() => {
        onClose();
        setAuthStep('PHONE');
      }, 1500);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden animate-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto shadow-md shadow-emerald-600/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Maklersiz<span className="text-emerald-600">.uz</span> Kirish
          </h2>
          <p className="text-xs text-slate-500">SMS OTP orqali xavfsiz avtorizatsiya va profil yaratish</p>
        </div>

        {/* STEP 1: Phone Entry */}
        {authStep === 'PHONE' && (
          <form onSubmit={handleSendPhone} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Telefon Raqamingiz</label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-700/20 text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              {isLoading ? 'SMS Kodingiz Yuborilmoqda...' : 'SMS Kod Olish ➔'}
            </button>

            {/* Google OAuth Simulation */}
            <div className="pt-2 text-center">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] font-bold text-slate-400 uppercase">yoki</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={() => setAuthStep('PROFILE')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs transition-colors"
              >
                <span>🌐 Google Orqali Kirish</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: SMS OTP Entry */}
        {authStep === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs text-center">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">4 Xonali SMS Kodni Kiriting</label>
              <p className="text-[11px] text-slate-500">{phone} raqamiga yuborildi</p>
              
              <div className="flex justify-center gap-3 py-3">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
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
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow-md text-sm transition-all"
            >
              {isLoading ? 'Tasdiqlanmoqda...' : 'Kodni Tasdiqlash ➔'}
            </button>
          </form>
        )}

        {/* STEP 3: Profile Registration */}
        {authStep === 'PROFILE' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Ism va Familiyangiz</label>
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
              <label className="font-bold text-slate-700">Maqsadingiz (Rol)</label>
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
                  👤 Ijarachiman (Tenant)
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
                  🏠 Uy Egasiman (Owner)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-700/20 text-sm transition-all"
            >
              {isLoading ? 'Profil Yaratilmoqda...' : 'Profilni Yakunlash (+20 XP)'}
            </button>
          </form>
        )}

        {/* STEP 4: Success Message */}
        {authStep === 'SUCCESS' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-xl font-bold text-slate-900">Xush Kelibsiz, {fullName}!</h3>
            <p className="text-xs text-slate-500">Profil muvaffaqiyatli yaratildi. +20 Trust XP berildi.</p>
          </div>
        )}
      </div>
    </div>
  );
};
