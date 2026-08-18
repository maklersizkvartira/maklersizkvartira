import React, { useState } from 'react';
import { 
  ShieldAlert, ShieldCheck, Users, FileText, AlertTriangle, CheckCircle2, 
  XCircle, Eye, Activity, Database, Lock, Settings, BarChart3, Search, Image, RefreshCw 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MOCK_AUDIT_LOGS } from '../../data/mockAdminData';
import { TrustScoreBadge } from '../common/TrustScoreBadge';

export const AdminPage: React.FC = () => {
  const { 
    reports, verifications, fraudSignals, listings, removeListing, 
    resolveReport, updateVerification, setCurrentView, refreshAdminData, 
    setEditingListing, currentUser 
  } = useAppStore();

  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'LISTINGS' | 'USERS' | 'FRAUD' | 'VERIFICATION' | 'REPORTS' | 'AUDIT'>('DASHBOARD');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccessMsg, setRefreshSuccessMsg] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'OWNER' | 'STUDENT' | 'TENANT'>('ALL');

  const pendingVerifications = verifications.filter((v) => v.status === 'PENDING');
  const openReports = reports.filter((r) => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');

  // Filtered listings for admin view
  const filteredListings = listings.filter((l) => {
    if (!listingSearch.trim()) return true;
    const q = listingSearch.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.district.toLowerCase().includes(q) ||
      l.owner.name.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  // Unique users list derived from verifications + current user
  const allAdminUsers = Array.from(
    new Map(
      [
        ...(currentUser ? [{ id: currentUser.id, name: currentUser.name, phone: currentUser.phone, role: currentUser.role, status: 'APPROVED', time: "Faol foydalanuvchi" }] : []),
        ...verifications.map((v) => ({ id: v.id, name: v.userName, phone: v.userPhone, role: v.targetLevel === 3 ? 'OWNER' : 'STUDENT', status: v.status, time: v.submittedAt })),
        { id: 'user-jasur', name: 'Jasur Karimov', phone: '+998 90 123 45 67', role: 'OWNER', status: 'APPROVED', time: '2026-08-10' },
        { id: 'user-nodira', name: 'Nodira Alimova', phone: '+998 93 718 88 85', role: 'OWNER', status: 'APPROVED', time: '2026-08-11' },
        { id: 'user-dilnoza', name: 'Dilnoza Aliyeva', phone: '+998 97 700 11 22', role: 'STUDENT', status: 'APPROVED', time: '2026-08-12' },
        { id: 'user-sardor', name: 'Sardor Usmonov', phone: '+998 94 555 44 33', role: 'STUDENT', status: 'PENDING', time: '2026-08-14' },
      ].map((u) => [u.phone || u.id, u])
    ).values()
  );

  const filteredUsers = allAdminUsers.filter((u) => {
    if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q);
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshSuccessMsg('');
    await refreshAdminData();
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshSuccessMsg("✅ Ma'lumotlar va e'lonlar muvaffaqiyatli yangilandi!");
      setTimeout(() => setRefreshSuccessMsg(''), 4000);
    }, 600);
  };

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
              Platforma operatsiyalari, e'lonlar bazasi, foydalanuvchilar, verification va moderation boshqaruvi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Yangilanmoqda...' : '🔄 Yangilash'}</span>
          </button>

          <button
            onClick={() => setCurrentView('HOME')}
            className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-colors"
          >
            Exit Admin View
          </button>
        </div>
      </div>

      {refreshSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{refreshSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setAdminTab('DASHBOARD')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'DASHBOARD' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Dashboard & KPI
        </button>

        <button
          onClick={() => setAdminTab('LISTINGS')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'LISTINGS' ? 'bg-emerald-800 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" /> Barcha E'lonlar ({listings.length})
        </button>

        <button
          onClick={() => setAdminTab('USERS')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'USERS' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" /> Foydalanuvchilar ({allAdminUsers.length})
        </button>

        <button
          onClick={() => setAdminTab('FRAUD')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            adminTab === 'FRAUD' ? 'bg-rose-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" /> Fraud & Broker Center ({fraudSignals.length})
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

      {/* BARCHA E'LONLAR TAB */}
      {adminTab === 'LISTINGS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" /> Barcha Kvartira va Xonalar Bazasi ({listings.length})
                </h2>
                <p className="text-xs text-slate-500">Platformadagi barcha faol, tasdiqlangan va sinov e'lonlarini tahrirlash yoki o'chirish.</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="E'lon nomi, tuman yoki e me'yordagi egasi..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredListings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  Hech qanday e'lon topilmadi.
                </div>
              ) : (
                filteredListings.map((l) => (
                  <div key={l.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={l.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=70&w=300'}
                        alt={l.title}
                        className="w-16 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 truncate hover:text-emerald-700">{l.title}</span>
                          <TrustScoreBadge score={l.trustScore} size="sm" />
                          <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{l.id}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {l.district} tumani • <strong className="text-emerald-700">{l.price.toLocaleString('uz-UZ')} so'm</strong> • {l.rooms} xona ({l.area} m²) • Egasi: <span className="font-bold text-slate-700">{l.owner.name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs shrink-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setCurrentView('LISTING_DETAIL', l.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition"
                        title="Ko'rish"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingListing(l)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 transition"
                      >
                        Tahrirlash
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`"${l.title}" e'loni bazadan to'liq o'chirilsinmi?`)) {
                            removeListing(l.id);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white font-bold px-3.5 py-1.5 rounded-xl border border-rose-200 transition active:scale-95"
                      >
                        O'chirish (Delete)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOYDALANUVCHILAR BAZASI TAB */}
      {adminTab === 'USERS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Foydalanuvchilar va Mijozlar Bazasi ({allAdminUsers.length})
                </h2>
                <p className="text-xs text-slate-500">Ro'yxatdan o'tgan barcha uy egalari, talabalar va ijarachilar.</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setUserRoleFilter('ALL')}
                    className={`px-3 py-1 rounded-lg ${userRoleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    Barchasi
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('OWNER')}
                    className={`px-3 py-1 rounded-lg ${userRoleFilter === 'OWNER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    Uy Egalari
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('STUDENT')}
                    className={`px-3 py-1 rounded-lg ${userRoleFilter === 'STUDENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    Talabalar
                  </button>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ism yoki telefon..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  Hech qanday foydalanuvchi topilmadi.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-sm shadow-sm">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{u.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            u.role === 'OWNER' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {u.role === 'OWNER' ? 'Uy Egasi' : u.role === 'STUDENT' ? 'Talaba' : 'Ijarachi'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          📞 {u.phone} • Ro'yxatdan o'tgan: {u.time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-bold px-3 py-1 rounded-xl text-xs ${
                        u.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {u.status === 'APPROVED' ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda'}
                      </span>
                      <button
                        onClick={() => alert(`Siz ${u.name} profiliga verifikatsiya statusini berdingiz!`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl transition"
                      >
                        Verifikatsiya Berish
                      </button>
                    </div>
                  </div>
                ))
              )}
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
              {fraudSignals.map((signal) => (
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
