import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UserRole } from '../../types';

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
                onClick={() => setAuthStep('PROFILE')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 text-xs"
              >
                Google orqali kirish
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
