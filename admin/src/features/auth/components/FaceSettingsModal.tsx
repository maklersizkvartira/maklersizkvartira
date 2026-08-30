'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, Camera, Trash2, CheckCircle2, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import { getFaceStatus, deleteFace } from '../api';
import { FaceModal } from './FaceModal';

interface FaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FaceSettingsModal({ isOpen, onClose }: FaceSettingsModalProps) {
  const [faceData, setFaceData] = useState<{
    enrolled: boolean;
    count: number;
    username?: string | null;
    fullName?: string | null;
    faceImage?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    }
  }, [isOpen, fetchStatus]);

  const handleDelete = async () => {
    if (!confirm('Haqiqatan ham ushbu hisob uchun Face ID biometrikasini o\'chirmoqchimisiz?')) return;
    setDeleting(true);
    try {
      const res = await deleteFace();
      setMsg(res.message || 'Face ID o\'chirildi.');
      await fetchStatus();
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Xatolik yuz berdi.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        <div
          className="w-full max-w-md rounded-3xl relative overflow-hidden border border-slate-700/80 shadow-2xl p-6 md:p-8 flex flex-col"
          style={{
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 18, 34, 0.99) 100%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">Face ID Sozlamalari</h3>
                <p className="text-xs text-slate-400">Admin biometrik kirish boshqaruvi</p>
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

          {/* Body */}
          <div className="my-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Ma'lumotlar yuklanmoqda...</span>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Face Card */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-emerald-500/30 overflow-hidden relative flex items-center justify-center shrink-0">
                    {faceData?.faceImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={faceData.faceImage}
                        alt="Enrolled Face"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-7 h-7 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">
                      {faceData?.fullName || faceData?.username || 'Admin'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {faceData?.username ? `@${faceData.username}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {faceData?.enrolled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Face ID Faol
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                          <AlertCircle className="w-3 h-3" /> Saqlanmagan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {msg && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                    {msg}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(true)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 text-xs"
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      {faceData?.enrolled ? 'Yuzni Qayta Suratga Olish / Yangilash' : 'Face ID Ni Faollashtirish'}
                    </span>
                  </button>

                  {faceData?.enrolled && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Face ID Ma'lumotlarini O'chirish</span>
                    </button>
                  )}
                </div>
              </div>
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
        onSuccess={() => {
          setIsEnrollModalOpen(false);
          fetchStatus();
        }}
      />
    </>
  );
}
