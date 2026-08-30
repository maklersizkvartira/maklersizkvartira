'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  X,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Search,
  Plus,
  Shield,
} from 'lucide-react';
import { getFaceStatus, deleteFace, type FaceStatus, type FaceAdminItem } from '../api';
import { FaceModal } from './FaceModal';
import { useAuthStore } from '@/store/auth.store';

interface FaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FaceSettingsModal({ isOpen, onClose }: FaceSettingsModalProps) {
  const currentAdmin = useAuthStore((s) => s.admin);
  const [faceData, setFaceData] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingAdminUsername, setDeletingAdminUsername] = useState<string | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedAdminForEnroll, setSelectedAdminForEnroll] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFaceStatus();
      setFaceData(res);
    } catch (err) {
      console.error('Failed to fetch face status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setMsg(null);
      setSearchQuery('');
    }
  }, [isOpen, fetchStatus]);

  const handleDelete = async (username: string, fullName: string) => {
    if (
      !confirm(
        `Haqiqatan ham '${fullName}' (@${username}) uchun Face ID biometrikasini o'chirmoqchimisiz?`,
      )
    ) {
      return;
    }
    setDeletingAdminUsername(username);
    setMsg(null);
    try {
      const res = await deleteFace(username);
      setMsg({ type: 'success', text: res.message || `'${fullName}' uchun Face ID o'chirildi.` });
      await fetchStatus();
    } catch (err: unknown) {
      const errText = (err as { message?: string })?.message || 'Xatolik yuz berdi.';
      setMsg({ type: 'error', text: errText });
    } finally {
      setDeletingAdminUsername(null);
    }
  };

  const openEnrollFor = (username?: string) => {
    setSelectedAdminForEnroll(username || currentAdmin?.username);
    setIsEnrollModalOpen(true);
  };

  if (!isOpen) return null;

  const admins = faceData?.admins || [];
  const filteredAdmins = admins.filter((adm) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      adm.fullName.toLowerCase().includes(q) ||
      adm.username.toLowerCase().includes(q) ||
      adm.role.toLowerCase().includes(q)
    );
  });

  const enrolledCount = admins.filter((a) => a.hasFace).length;

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        <div
          className="w-full max-w-xl rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-6 md:p-8 flex flex-col max-h-[90vh]"
          style={{
            background:
              'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 18, 34, 0.99) 100%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Face ID Boshqaruvi
                </h3>
                <p className="text-xs text-slate-400">
                  Barcha adminlar uchun biometrik kirish sozlamalari
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats Bar & Quick Add */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>
                  Faol Face ID: {enrolledCount} / {admins.length} admin
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openEnrollFor(currentAdmin?.username)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yuzni Biriktirish</span>
            </button>
          </div>

          {/* Search bar if multiple admins */}
          {admins.length > 2 && (
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Admin qidirish (ism, login, rol)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Alert notification message */}
          {msg && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Body: Admins List */}
          <div className="my-4 flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Adminlar ro'yxati yuklanmoqda...</span>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                {searchQuery ? 'Qidiruv bo\'yicha admin topilmadi.' : 'Hech qanday admin topilmadi.'}
              </div>
            ) : (
              filteredAdmins.map((adm) => {
                const isCurrentUser = adm.username === currentAdmin?.username;
                const isDeleting = deletingAdminUsername === adm.username;

                return (
                  <div
                    key={adm.id}
                    className={`p-3.5 rounded-2xl bg-slate-900/80 border transition flex items-center justify-between gap-3 ${
                      isCurrentUser
                        ? 'border-emerald-500/40 bg-emerald-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Admin Avatar & Details */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700/70 overflow-hidden relative flex items-center justify-center shrink-0">
                        {adm.faceImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={adm.faceImage}
                            alt={adm.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-base font-bold text-slate-400">
                            {adm.fullName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">
                            {adm.fullName}
                          </h4>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                              Siz
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          @{adm.username} • <span className="text-slate-300 font-sans">{adm.role}</span>
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {adm.hasFace ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Face ID Faol
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-medium">
                              <AlertCircle className="w-3 h-3 text-amber-400" /> Saqlanmagan
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions for this admin */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEnrollFor(adm.username)}
                        className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                        title={adm.hasFace ? 'Yuzni qayta suratga olish' : 'Face ID ni biriktirish'}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {adm.hasFace ? 'Yangilash' : 'Suratga olish'}
                        </span>
                      </button>

                      {adm.hasFace && (
                        <button
                          type="button"
                          onClick={() => handleDelete(adm.username, adm.fullName)}
                          disabled={isDeleting}
                          className="p-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-xs transition disabled:opacity-50"
                          title="Face ID ni o'chirish"
                        >
                          {isDeleting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Camera Enrollment Modal */}
      <FaceModal
        isOpen={isEnrollModalOpen}
        onClose={() => {
          setIsEnrollModalOpen(false);
          fetchStatus();
        }}
        initialMode="register"
        initialAdminUsername={selectedAdminForEnroll}
        onSuccess={() => {
          setIsEnrollModalOpen(false);
          fetchStatus();
        }}
      />
    </>
  );
}
