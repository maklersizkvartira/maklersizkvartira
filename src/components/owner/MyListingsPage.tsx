import React from 'react';
import { 
  PlusCircle, Trash2, Edit3, Eye, Heart, Phone, MessageSquare, 
  BarChart3, TrendingUp, ExternalLink, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { EditListingModal } from './EditListingModal';

export const MyListingsPage: React.FC = () => {
  const { currentUser, listings, conversations, setCurrentView, removeListing, setEditingListing, setShowAuth, clearAllExtraListings } = useAppStore();

  if (!currentUser || currentUser.role !== 'OWNER') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black">Faqat uy egasi uchun</h1>
        <p className="text-slate-600">E'lonlarni ko'rish va statistikani kuzatish uchun uy egasi sifatida kiring.</p>
        <button onClick={() => setShowAuth(true)} className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl shadow-md">
          Kirish
        </button>
      </div>
    );
  }

  const mine = listings.filter((l) => l.owner.id === currentUser.id);

  // Total summary statistics
  const totalViews = mine.reduce((acc, curr) => acc + (curr.viewsCount || 0), 0);
  const totalFavorites = mine.reduce((acc, curr) => acc + (curr.favoritesCount || 0), 0);
  const totalCalls = mine.reduce((acc, curr) => acc + (curr.contactCount || 0), 0);
  const totalChats = conversations.filter((c) => mine.some((m) => m.id === c.listingId)).length;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24 sm:pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-card">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Mening E'lonlarim va Statistika</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            E'lonlaringizni necha kishi ko'rgani, saqlagani, qo'ng'iroq qilgani va yozganini kuzatib boring
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (window.confirm("Barcha siz va sinov tariqasida yaratilgan e'lonlar bazadan o'chirilsinmi?")) {
                clearAllExtraListings();
              }
            }}
            className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-extrabold text-xs px-3.5 py-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
            title="Sinov e'lonlarini tozalash"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">Tozalash</span>
          </button>
          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all shrink-0 active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Yangi E'lon Joylash</span>
          </button>
        </div>
      </div>

      {/* Top 4 Overall Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Views */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-extrabold uppercase tracking-wider">Jami Ko'rishlar</span>
            <Eye className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalViews}</div>
          <p className="text-[11px] font-semibold text-blue-800">E'lonlaringizni ko'rib chiqqanlar</p>
        </div>

        {/* Card 2: Total Favorites */}
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200/80 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-extrabold uppercase tracking-wider">Saqlanganlar</span>
            <Heart className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalFavorites}</div>
          <p className="text-[11px] font-semibold text-rose-800">Sevimlilarga qo'shilganlar</p>
        </div>

        {/* Card 3: Total Calls */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-extrabold uppercase tracking-wider">Telefon Qilingan</span>
            <Phone className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalCalls}</div>
          <p className="text-[11px] font-semibold text-emerald-800">Raqamni ko'rib bosganlar</p>
        </div>

        {/* Card 4: Total Chats */}
        <div className="bg-gradient-to-br from-purple-50 to-amber-50 border border-purple-200/80 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-extrabold uppercase tracking-wider">Chat Suhbatlar</span>
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalChats}</div>
          <p className="text-[11px] font-semibold text-purple-800">Yozishgan ijarachilar</p>
        </div>
      </div>

      {/* Main Listings Detailed Analytics Section */}
      {mine.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <PlusCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Siz hali e'lon joylashtirmadingiz</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Kvartirangizni komissiyasiz, 0% makler to'lovisiz bepul e'lon qiling.
          </p>
          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
          >
            E'lon Joylash
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <span>Har bir e'lonning alohida statistikasi ({mine.length} ta e'lon)</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {mine.map((listing) => {
              const chatsCount = conversations.filter((c) => c.listingId === listing.id).length;
              const views = listing.viewsCount || 1;
              const favs = listing.favoritesCount || 0;
              const calls = listing.contactCount || 0;
              const conversionRate = (((calls + chatsCount) / views) * 100).toFixed(1);

              return (
                <div
                  key={listing.id}
                  className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-card space-y-4 transition-all hover:border-slate-300"
                >
                  {/* Top Listing Info Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=70&w=600'}
                        alt={listing.title}
                        className="w-16 h-14 sm:w-20 sm:h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> E'lon Aktiv 🟢
                          </span>
                          {listing.isRoommate && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                              🤝 Sherikchilikka
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate mt-1">
                          {listing.title}
                        </h3>
                        <div className="text-xs font-extrabold text-emerald-700 mt-0.5">
                          {(listing.price / 1000000).toFixed(1)} mln so'm {listing.isRoommate ? '/ kishi' : '/ oy'} • {listing.district} tumani
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => setCurrentView('LISTING_DETAIL', listing.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ko'rish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingListing(listing)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Tahrirlash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Haqiqatan ham ushbu e'lonni o'chirasizmi?")) {
                            removeListing(listing.id);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-extrabold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4 Analytics Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* Metric 1: Views */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px]">
                        <span>Ko'rishlar</span>
                        <Eye className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-lg font-black text-slate-900">{views} ta</div>
                      <div className="text-[10px] text-slate-400 font-medium">Sahifaga kirganlar</div>
                    </div>

                    {/* Metric 2: Favorites */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px]">
                        <span>Saqlaganlar</span>
                        <Heart className="w-4 h-4 text-rose-600 fill-rose-100" />
                      </div>
                      <div className="text-lg font-black text-slate-900">{favs} kishi</div>
                      <div className="text-[10px] text-slate-400 font-medium">Sevimlilarga qo'shgan</div>
                    </div>

                    {/* Metric 3: Telefon Calls */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px]">
                        <span>Telefon Qilgan</span>
                        <Phone className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-lg font-black text-emerald-700">{calls} kishi</div>
                      <div className="text-[10px] text-slate-400 font-medium">Raqamni bosib ko'rgan</div>
                    </div>

                    {/* Metric 4: Chat Messages */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px]">
                        <span>Chat Yozgan</span>
                        <MessageSquare className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-lg font-black text-purple-700">{chatsCount} suhbat</div>
                      <div className="text-[10px] text-slate-400 font-medium">Xabar yoza boshlagan</div>
                    </div>
                  </div>

                  {/* AI Performance & Interest Bar */}
                  <div className="bg-slate-900 text-white p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-slate-200">
                        Qiziqish Konversiyasi: <strong className="text-emerald-400">{conversionRate}%</strong> (Aloqa so'rovi nisbati)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-300 font-extrabold text-[11px] shrink-0">
                      <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
                      <span>Shield AI Reytingi: Top e'lonlar qatorida</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Edit Listing Modal */}
      <EditListingModal />
    </div>
  );
};
