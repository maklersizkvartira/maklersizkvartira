import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Home, GraduationCap } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { SignupRole } from '../../types';
import { ApiService } from '../../services/apiService';

export const AuthModal: React.FC = () => {
  const { showAuth, setShowAuth, login } = useAppStore();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!showAuth) return null;

  const close = () => {
    setShowAuth(false);
    setRole(null);
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    if (!name.trim() || !phone.trim()) {
      setError("Ism va telefon raqamini yozing.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await ApiService.register(name.trim(), phone.trim(), role);
      login(user);
    } catch {
      login({
        id: `user-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        role,
      });
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <div className="auth-overlay fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="auth-sheet bg-white rounded-t-[28px] sm:rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl relative max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />
        <button onClick={close} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Kirish</h2>
          <p className="text-sm text-slate-600 px-2 leading-relaxed">
            Avval kimligingizni tanlang. Keyin ismingizni yozasiz — SMS hozircha yo'q.
          </p>
        </div>

        {!role ? (
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setRole('OWNER')}
              className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900">Men uy egasiman</div>
                  <div className="text-sm text-slate-600">Kvartiramni ijaraga bermoqchiman</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole('STUDENT')}
              className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900">Men talabaman</div>
                  <div className="text-sm text-slate-600">O'zimga kvartira qidiraman</div>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <button type="button" onClick={() => setRole(null)} className="text-sm font-bold text-emerald-700">
              ← Ortga, rolni o'zgartirish
            </button>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800">
              {role === 'OWNER' ? 'Uy egasi sifatida' : 'Talaba sifatida'}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Ismingiz</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Dilshod Karimov"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base font-semibold"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Telefon raqamingiz</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base font-semibold"
              />
            </div>
            {error && <p className="text-sm text-rose-600 font-semibold">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base py-4 rounded-xl"
            >
              {busy ? 'Kuting...' : 'Davom etish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
