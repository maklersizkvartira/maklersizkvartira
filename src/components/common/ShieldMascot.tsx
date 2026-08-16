import React, { useState } from 'react';
import { Shield, Sparkles, X, MessageSquare, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ShieldMascot: React.FC = () => {
  const { aiMascotMessage, setAiMascotMessage, setCurrentView } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!aiMascotMessage) return null;

  return (
    <div className="fixed bottom-[5.75rem] right-3 left-3 z-40 md:left-auto md:bottom-6 md:right-6 max-w-sm md:w-auto ml-auto transition-all duration-300 pb-safe">
      {isExpanded ? (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 backdrop-blur-lg animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-emerald-500/50 shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-1">
                  Shield AI <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                </h4>
                <p className="text-[10px] text-emerald-400">Xavfsizlik & Trust Yordamchisi</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-200 mb-3">{aiMascotMessage}</p>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setCurrentView('VERIFICATION')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              Trust Score oshirish <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setAiMascotMessage(null)}
              className="text-[11px] text-slate-400 hover:underline"
            >
              Yopish
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="group flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2.5 rounded-full shadow-xl border border-emerald-500/50 hover:bg-slate-800 transition-all hover:scale-105"
        >
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-semibold max-w-[180px] truncate hidden sm:inline">
            Shield AI Yordamchi
          </span>
          <MessageSquare className="w-4 h-4 text-emerald-400" />
        </button>
      )}
    </div>
  );
};
