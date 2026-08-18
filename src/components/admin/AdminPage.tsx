import React, { useState } from 'react';
import { 
  ShieldAlert, ShieldCheck, Users, FileText, AlertTriangle, CheckCircle2, 
  XCircle, Eye, Activity, Database, Lock, Settings, BarChart3, Search, Image
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MOCK_FRAUD_SIGNALS, MOCK_AUDIT_LOGS } from '../../data/mockAdminData';
import { TrustScoreBadge } from '../common/TrustScoreBadge';

export const AdminPage: React.FC = () => {
  const { 
    reports, verifications, resolveReport, 
    updateVerification, setCurrentView 
  } = useAppStore();

  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'FRAUD' | 'VERIFICATION' | 'REPORTS' | 'AUDIT'>('DASHBOARD');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const pendingVerifications = verifications.filter((v) => v.status === 'PENDING');
  const openReports = reports.filter((r) => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-6">
      {/* Admin Top Banner Header */}
      <div className="bg-slate-950 text-white p-6 rounded-3xl border border-rose-500/30 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-600/30">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Admin & Anti-Scam Control Center</h1>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Super Admin Access
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Platforma operatsiyalari, firibgarlik skanerlari, verification va moderation boshqaruvi.
            </p>
          </div>
        </div>

        <button
          onClick={() => setCurrentView('HOME')}
          className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors"
        >
          Exit Admin View
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold">
        <button
          onClick={() => setAdminTab('DASHBOARD')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'DASHBOARD' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Dashboard & KPI
        </button>

        <button
          onClick={() => setAdminTab('FRAUD')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'FRAUD' ? 'bg-rose-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" /> Fraud & Broker Center ({MOCK_FRAUD_SIGNALS.length})
        </button>

        <button
          onClick={() => setAdminTab('VERIFICATION')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'VERIFICATION' ? 'bg-emerald-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Verification Navbati ({pendingVerifications.length})
        </button>

        <button
          onClick={() => setAdminTab('REPORTS')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'REPORTS' ? 'bg-amber-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Moderation & Reports ({openReports.length})
        </button>

        <button
          onClick={() => setAdminTab('AUDIT')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'AUDIT' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-blue-400" /> Audit Loglar
        </button>
      </div>

      {/* DASHBOARD TAB */}
      {adminTab === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
              <span className="text-xs text-slate-500 font-medium">Jami Foydalanuvchilar</span>
              <div className="text-3xl font-black text-slate-900 mt-1">12,450</div>
              <span className="text-[10px] text-emerald-600 font-bold">+14% bu oy</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
              <span className="text-xs text-slate-500 font-medium">Faol Kvartira E'lonlari</span>
              <div className="text-3xl font-black text-slate-900 mt-1">3,520</div>
              <span className="text-[10px] text-emerald-600 font-bold">100% AI skan qilingan</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-card">
              <span className="text-xs text-rose-700 font-bold">Aniqlangan Risk Signallari</span>
              <div className="text-3xl font-black text-rose-600 mt-1">18 ta</div>
              <span className="text-[10px] text-rose-700 font-medium">Yuqori maklerlik ehtimoli</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
              <span className="text-xs text-slate-500 font-medium">Oylik Premium Tushum</span>
              <div className="text-3xl font-black text-emerald-800 mt-1">14.8 mln so'm</div>
              <span className="text-[10px] text-slate-400 font-medium">Listing Boost & Verified</span>
            </div>
          </div>

          {/* AI Insights & Market Analytics Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base text-white">Shield AI Bozori va Talab Analytics</h3>
              </div>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                AI Real-Time Insight
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-200 text-sm">O'rtacha Ijara Narxlari (Xonalar bo'yicha)</h4>
                <div className="space-y-1.5 pt-1 text-slate-300">
                  <div className="flex justify-between"><span>1 xonali studio:</span> <strong className="text-emerald-400">3.2 mln so'm ($250)</strong></div>
                  <div className="flex justify-between"><span>2 xonali kvartira:</span> <strong className="text-emerald-400">4.8 mln so'm ($375)</strong></div>
                  <div className="flex justify-between"><span>3 xonali kvartira:</span> <strong className="text-emerald-400">6.5 mln so'm ($508)</strong></div>
                  <div className="flex justify-between"><span>4+ xonali hovli:</span> <strong className="text-emerald-400">8.9 mln so'm ($695)</strong></div>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-200 text-sm">Eng Yuqori Qidiruv Talabi (Universitetlar)</h4>
                <div className="space-y-1.5 pt-1 text-slate-300">
                  <div className="flex justify-between"><span>TDIU (Iqtisodiyot Univ.):</span> <strong className="text-amber-400">34% qidiruv</strong></div>
                  <div className="flex justify-between"><span>TATU (IT Univ.):</span> <strong className="text-amber-400">28% qidiruv</strong></div>
                  <div className="flex justify-between"><span>NUUz (Milliy Univ.):</span> <strong className="text-amber-400">21% qidiruv</strong></div>
                  <div className="flex justify-between"><span>WIUT (Westminster):</span> <strong className="text-amber-400">17% qidiruv</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FRAUD CENTER TAB */}
      {adminTab === 'FRAUD' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" /> AI Fraud & Broker Detector Queue
              </h2>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                High Risk Signals
              </span>
            </div>

            <div className="space-y-4">
              {MOCK_FRAUD_SIGNALS.map((signal) => (
                <div key={signal.id} className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded">
                        {signal.type}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{signal.title}</h3>
                      <p className="text-xs text-slate-600 font-medium">{signal.entityName}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black text-rose-600">{signal.riskScore}% Risk</span>
                      <span className="text-[10px] text-slate-400 block">{signal.detectedAt}</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="font-bold text-slate-700">AI Isbotlari (Evidence):</span>
                    <ul className="space-y-1 text-slate-600">
                      {signal.evidenceReasons.map((reason, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => alert("Profil va e'lonlar vaqtincha bloklandi!")}
                      className="bg-rose-600 text-white font-bold px-4 py-1.5 rounded-lg hover:bg-rose-700 transition-colors"
                    >
                      Ban / Restriction Qo'llash
                    </button>
                    <button
                      onClick={() => alert("Shubhasiz deb belgilandi")}
                      className="bg-slate-200 text-slate-700 font-bold px-4 py-1.5 rounded-lg hover:bg-slate-300"
                    >
                      Ignore (False Positive)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION QUEUE TAB */}
      {adminTab === 'VERIFICATION' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Hujjatlar Verification Navbati
            </h2>

            <div className="divide-y divide-slate-100">
              {verifications.map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{req.userName}</span>
                      <span className="text-xs text-slate-500 font-mono">{req.userPhone}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        Level {req.targetLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Hujjat turi: {req.documentType} • Yuborilgan vaqt: {req.submittedAt}</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {req.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => updateVerification(req.id, 'APPROVED')}
                          className="bg-emerald-600 text-white font-bold px-3.5 py-1.5 rounded-xl hover:bg-emerald-700 transition-colors"
                        >
                          Tasdiqlash (Approve)
                        </button>
                        <button
                          onClick={() => updateVerification(req.id, 'REJECTED')}
                          className="bg-rose-100 text-rose-700 font-bold px-3.5 py-1.5 rounded-xl hover:bg-rose-200 transition-colors"
                        >
                          Rad Etish
                        </button>
                      </>
                    ) : (
                      <span className={`font-bold text-xs ${req.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Status: {req.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {adminTab === 'REPORTS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Moderatorlik Shikoyatlari
            </h2>

            <div className="divide-y divide-slate-100 text-xs">
              {reports.map((rep) => (
                <div key={rep.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-600 uppercase font-mono">{rep.reason}</span>
                      <span className="font-bold text-slate-900">{rep.listingTitle}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{rep.createdAt}</span>
                  </div>

                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{rep.description}" — <span className="font-semibold text-slate-800">Shikoyat qilgan: {rep.reporterName}</span>
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      rep.priority === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      Prioritet: {rep.priority}
                    </span>

                    {rep.status === 'OPEN' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveReport(rep.id, 'RESOLVED')}
                          className="bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg"
                        >
                          Hal Etildi (Resolved)
                        </button>
                        <button
                          onClick={() => resolveReport(rep.id, 'REJECTED')}
                          className="bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg"
                        >
                          Rad Etish
                        </button>
                      </div>
                    ) : (
                      <span className="font-bold text-emerald-600">Status: {rep.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {adminTab === 'AUDIT' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4 text-xs">
          <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" /> Tizim Harakatlari (Audit Log)
          </h2>

          <div className="divide-y divide-slate-100 font-mono">
            {MOCK_AUDIT_LOGS.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{log.timestamp}</span>
                  <span className="font-bold text-slate-900">{log.admin}</span>
                  <span className="text-emerald-700">{log.action}</span>
                  <span className="text-slate-600">[{log.target}]</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
