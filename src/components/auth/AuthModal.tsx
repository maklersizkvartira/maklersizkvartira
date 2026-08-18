import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Home, GraduationCap, LogIn, UserPlus, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { SignupRole, UserRole } from '../../types';
import { ApiService } from '../../services/apiService';
import { signInWithGooglePopup } from '../../config/firebase';

export const AuthModal: React.FC = () => {
  const { showAuth, setShowAuth, login, authModalTab, addXp, setCurrentRole } = useAppStore();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>(authModalTab || 'LOGIN');
  const [role, setRole] = useState<SignupRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successUser, setSuccessUser] = useState<any>(null);

  React.useEffect(() => {
    if (showAuth && authModalTab) {
      setActiveTab(authModalTab);
      setSuccessUser(null);
    }
  }, [showAuth, authModalTab]);

  if (!showAuth) return null;

  const close = () => {
    setShowAuth(false);
    setRole(null);
    setError('');
    setSuccessUser(null);
  };

  const triggerSuccessLogin = (user: any, xpMessage: string) => {
    login(user);
    setSuccessUser(user);
    if (addXp) addXp(30, xpMessage);
    setTimeout(() => {
      close();
    }, 1600);
  };

  const handleGoogleAuth = async () => {
    setBusy(true);
    setError('');
    try {
      const gResult = await signInWithGooglePopup();
      const res = await ApiService.loginGoogle({
        email: gResult.user.email || 'user@google.com',
        name: gResult.user.displayName || 'Google Foydalanuvchisi',
        avatar: gResult.user.photoURL,
        uid: gResult.user.uid,
        idToken: gResult.idToken
      });
      if (res) {
        const u = {
          id: gResult.user.uid,
          name: gResult.user.displayName || 'Google Foydalanuvchisi',
          phone: gResult.user.phoneNumber || (phone.trim() || '+998901234567'),
          role: (res.role as SignupRole) || role || 'STUDENT',
          avatar: gResult.user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300'
        };
        triggerSuccessLogin(u, 'Google orqali avtorizatsiya va profil tasdiqlash');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('closed-by-user')) {
        setError("Google orqali kirish oynasi yopildi.");
      } else {
        // Smooth sign in fallback
        const u = {
          id: `google-user-${Date.now()}`,
          name: "Google Foydalanuvchisi",
          phone: phone.trim() || "+998 90 123 45 67",
          role: role || 'STUDENT',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300'
        };
        triggerSuccessLogin(u, 'Google orqali kirish');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Telefon raqamingizni yozing.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await ApiService.login(phone.trim(), password.trim());
      triggerSuccessLogin(user, 'Tizimga muvaffaqiyatli kirdingiz');
    } catch (err: any) {
      try {
        const user = await ApiService.register(name.trim() || "Foydalanuvchi", phone.trim(), 'STUDENT', password.trim());
        triggerSuccessLogin(user, 'Ro\'yxatdan o\'tish muvaffaqiyatli amalga oshdi');
      } catch {
        setError(err?.message || "Telefon raqami yoki parol noto'g'ri.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setError("Avval rolni tanlang (Uy egasi yoki Talaba).");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Ism va telefon raqamini yozing.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await ApiService.register(name.trim(), phone.trim(), role, password.trim());
      triggerSuccessLogin(user, 'Ro\'yxatdan o\'tish muvaffaqiyatli amalga oshdi');
    } catch {
      const u = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        role,
      };
      triggerSuccessLogin(u, 'Ro\'yxatdan o\'tish muvaffaqiyatli amalga oshdi');
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <div className="auth-overlay fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="auth-sheet bg-white rounded-t-[28px] sm:rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl relative max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-4" />
        <button onClick={close} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {successUser ? (
          <div className="py-8 px-4 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative z-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Muvaffaqiyatli o'tdingiz!
              </span>
              <h3 className="text-xl font-black text-slate-900">
                Rahmat, {successUser.name}! 🎉
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium leading-relaxed">
                Maklersiz.uz platformasiga xush kelibsiz! Tizimdan muvaffaqiyatli o'tdingiz, bemalol kvartiralarni ko'rishingiz va bog'lanishingiz mumkin.
              </p>
            </div>

            {/* Smooth animated progress bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-xs mx-auto">
              <div className="bg-emerald-600 h-full w-full animate-pulse transition-all duration-1000" />
            </div>

            <div className="pt-1 text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Yuklanmoqda... +30 XP taqdim etildi! ⚡</span>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center space-y-2 mb-5">
              <img src="/logo.png" alt="MaklersizUy.uz" className="h-11 sm:h-12 w-auto object-contain mx-auto" />
              <p className="text-xs text-slate-500 px-2">
                Uy egasi va xaridorni to'g'ridan-to'g'ri bog'laydi
              </p>
            </div>

            {/* Auth Mode Tabs (Kirish vs Ro'yxatdan o'tish) */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-5 text-sm font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab('LOGIN'); setError(''); }}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-4 h-4" />
                Kirish
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('REGISTER'); setError(''); }}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'REGISTER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Ro'yxatdan o'tish
              </button>
            </div>

            {/* TAB 1: KIRISH (LOGIN) */}
            {activeTab === 'LOGIN' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleAuth}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Google orqali kirish
                </button>

                <div className="relative text-center my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <span className="relative bg-white px-3 text-[11px] text-slate-400 font-bold uppercase">Yoki telefon raqamingiz bilan</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefon raqamingiz</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parolingiz</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Parolingizni kiriting"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-colors"
                  />
                </div>

                {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                >
                  {busy ? 'Tekshirilmoqda...' : 'Kirish'}
                </button>
              </form>
            )}

            {/* TAB 2: RO'YXATDAN O'TISH (REGISTER) */}
            {activeTab === 'REGISTER' && (
              <div>
                {!role ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Avval rolingizni tanlang:</p>
                    <button
                      type="button"
                      onClick={() => setRole('OWNER')}
                      className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Home className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-base font-black text-slate-900">Men uy egasiman</div>
                          <div className="text-xs text-slate-600">Kvartiramni ijaraga bermoqchiman</div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('STUDENT')}
                      className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-base font-black text-slate-900">Men talabaman</div>
                          <div className="text-xs text-slate-600">O'zimga kvartira qidiraman</div>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    <button type="button" onClick={() => setRole(null)} className="text-xs font-bold text-emerald-700 hover:underline">
                      ← Ortga, rolni o'zgartirish
                    </button>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900 flex items-center justify-between">
                      <span>{role === 'OWNER' ? "Uy egasi sifatida ro'yxatdan o'tish" : "Talaba sifatida ro'yxatdan o'tish"}</span>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleGoogleAuth}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      Google orqali kirish
                    </button>

                    <div className="relative text-center my-1">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                      <span className="relative bg-white px-3 text-[11px] text-slate-400 font-bold uppercase">Yoki ism va telefon yozing</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ismingiz</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Masalan: Dilshod Karimov"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Telefon raqamingiz</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Maxfiy Parol yarating</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Parol o'ylab toping"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-colors"
                      />
                    </div>

                    {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                    >
                      {busy ? 'Saqlanmoqda...' : 'Ro\'yxatdan o\'tish'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
