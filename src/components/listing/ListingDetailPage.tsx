import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, MapPin, Train, GraduationCap, Phone, MessageSquare, 
  Heart, Share2, Flag, ArrowLeft, CheckCircle2, AlertTriangle, Eye, Sparkles, 
  Video, Compass, Info, Check, ShieldAlert, Edit, Trash2
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ApiService } from '../../services/apiService';
import { Listing } from '../../types';
import { TrustScoreBadge } from '../common/TrustScoreBadge';
import { VerificationBadge } from '../common/VerificationBadge';
import { ListingCard } from '../common/ListingCard';
import { EditListingModal } from '../owner/EditListingModal';

export const ListingDetailPage: React.FC = () => {
  const { 
    selectedListingId, listings, favorites, toggleFavorite, 
    openChatWithListing, setCurrentView, resolveReport,
    currentUser, setShowAuth, setEditingListing, removeListing,
    currency
  } = useAppStore();

  const [activeMedia, setActiveMedia] = useState<'IMAGE' | 'VIDEO' | 'TOUR360'>('IMAGE');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>('SCAM');
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [shareSuccessMsg, setShareSuccessMsg] = useState('');

  const [directListing, setDirectListing] = useState<Listing | null>(null);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);

  useEffect(() => {
    if (!selectedListingId) return;
    const foundInStore = listings.find(
      (l) =>
        l.id === selectedListingId ||
        l.id === `listing-${selectedListingId}` ||
        selectedListingId.endsWith(l.id) ||
        l.id.endsWith(selectedListingId)
    );
    if (foundInStore) {
      setDirectListing(foundInStore);
      return;
    }

    let isMounted = true;
    setIsLoadingDirect(true);
    ApiService.getListingById(selectedListingId)
      .then((item) => {
        if (isMounted && item) {
          setDirectListing(item);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingDirect(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedListingId, listings]);

  const listing = listings.find((l) =>
    selectedListingId && (
      l.id === selectedListingId ||
      l.id === `listing-${selectedListingId}` ||
      selectedListingId.endsWith(l.id) ||
      l.id.endsWith(selectedListingId)
    )
  ) || directListing || (selectedListingId ? undefined : listings[0]);

  if (!listing) {
    if (isLoadingDirect || (selectedListingId && listings.length === 0)) {
      return (
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-base font-extrabold text-slate-800">E'lon yuklanmoqda...</h2>
          <p className="text-xs text-slate-500 font-medium">Biroz kuting, e'lon ma'lumotlari yuklanmoqda.</p>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">E'lon topilmadi</h2>
        <p className="text-xs text-slate-500 font-medium">Ushbu e'lon mavjud emas yoki o'chirilgan bo'lishi mumkin.</p>
        <button
          onClick={() => setCurrentView('HOME')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md"
        >
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  const isFav = favorites.includes(listing.id);
  const displayImages = listing ? Array.from(new Set(listing.images || [])) : [];
  const activeImg = displayImages[activeImageIndex] || displayImages[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200';

  const USD_RATE = 12800;
  const priceInUsd = listing.price > 10000 ? Math.round(listing.price / USD_RATE) : listing.price;
  const priceInUzs = listing.price > 10000 ? listing.price : listing.price * USD_RATE;

  const formatPrice = (amount: number) => new Intl.NumberFormat('uz-UZ').format(amount);

  const handleShare = async () => {
    if (!listing) return;
    const shareUrl = `${window.location.origin}/?listing=${listing.id}`;
    const shareTitle = `${listing.title} — Maklersiz.uz`;
    const shareText = `🏠 ${listing.title} — ${formatPrice(listing.price)} so'm (${listing.district} tumani). Maklersiz, 0% komissiya!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (e) {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareSuccessMsg("🔗 E'lon havolasi nusxalandi! Endi Telegram yoki istalgan tarmoqqa yuborishingiz mumkin.");
      setTimeout(() => setShareSuccessMsg(''), 4000);
    } catch {
      alert(`E'lon havolasi: ${shareUrl}`);
    }
  };

  const getDisplayAddress = (l: typeof listing) => {
    if (!l) return '';
    const parts: string[] = [];
    const addr = (l.address || '').trim();
    const dist = (l.district || '').trim();
    const reg = (l.region || '').trim();

    if (addr) parts.push(addr);

    if (dist && !addr.toLowerCase().includes(dist.toLowerCase())) {
      parts.push(`${dist} tumani`);
    }

    if (reg && !addr.toLowerCase().includes(reg.toLowerCase()) && !dist.toLowerCase().includes(reg.toLowerCase())) {
      parts.push(reg);
    }

    return parts.join(', ');
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-6 sm:space-y-8 min-h-[85vh] w-full overflow-x-hidden">
      {/* Toast Share Alert */}
      {shareSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center justify-between gap-2 animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{shareSuccessMsg}</span>
          </div>
          <button onClick={() => setShareSuccessMsg('')} className="text-white hover:text-emerald-200 text-xs font-black">✕</button>
        </div>
      )}

      {/* Back Button & Top Actions */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">Orqaga</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => toggleFavorite(listing.id)}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all ${
              isFav ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{isFav ? 'Saralangan' : 'Saqlash'}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 sm:px-3.5 py-1.5 rounded-xl hover:bg-emerald-100 transition-all shadow-xs active:scale-95"
          >
            <Share2 className="w-4 h-4 text-emerald-600" /> <span className="inline">Ulashish</span>
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors"
          >
            <Flag className="w-4 h-4" /> <span className="hidden sm:inline">Shikoyat</span>
          </button>
        </div>
      </div>

      {/* Main Title & Trust Status */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <TrustScoreBadge score={listing.trustScore} size="md" />
          <VerificationBadge level={listing.owner.verificationLevel} size="md" />
          {listing.isRoommate && (
            <span className="bg-amber-500 text-slate-900 text-xs font-black px-3 py-1 rounded-md flex items-center gap-1 shadow-sm">
              🤝 Sherikchilikka ({listing.roommateSpotsAvailable || 1} ta sherik o'rni bor)
            </span>
          )}
          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {listing.viewsCount} ko'rishlar
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
          {listing.title}
        </h1>

        {currentUser?.id === listing.owner.id && (
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg my-2">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>🏠 Siz ushbu e'lon egasisiz</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingListing(listing)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-md active:scale-95"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Tahrirlash</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Haqiqatan ham ushbu e'lonni o'chirasizmi?")) {
                    removeListing(listing.id);
                    setCurrentView('MY_LISTINGS');
                  }
                }}
                className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O'chirish</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">{getDisplayAddress(listing)}</span>
          </div>

          {listing.metroStation && (
            <div className="flex items-center gap-1 text-blue-700 font-medium">
              <Train className="w-4 h-4" />
              <span>{listing.metroStation} metrosi ({listing.metroDistanceMinutes} daqiqa piyoda)</span>
            </div>
          )}

          {listing.universityName && (
            <div className="flex items-center gap-1 text-amber-700 font-medium">
              <GraduationCap className="w-4 h-4" />
              <span>{listing.universityName} ({listing.universityDistanceMinutes} min)</span>
            </div>
          )}
        </div>
      </div>

      {/* Media Gallery Section */}
      <div className="space-y-3">
        {/* Media Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveMedia('IMAGE')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all font-extrabold ${activeMedia === 'IMAGE' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Rasmlar ({displayImages.length})
          </button>
          
          {listing.videoUrl && (
            <button
              onClick={() => setActiveMedia('VIDEO')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all font-black text-xs shadow-xs shrink-0 ${
                activeMedia === 'VIDEO'
                  ? 'bg-rose-600 text-white ring-2 ring-rose-500 shadow-md'
                  : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Video className="w-4 h-4 fill-current shrink-0" />
              <span>Video Sharh 🎥</span>
            </button>
          )}
        </div>

        {/* Media Display Viewer */}
        <div className="aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] w-full bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-lg">
          {activeMedia === 'IMAGE' && (
            <img
              src={activeImg}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          )}

          {activeMedia === 'VIDEO' && listing.videoUrl && (
            <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
              {listing.videoUrl.includes('youtube.com') || listing.videoUrl.includes('youtu.be') ? (
                <iframe
                  src={
                    listing.videoUrl.includes('embed')
                      ? listing.videoUrl
                      : listing.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
                  }
                  title="Video sharh"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  controls
                  autoPlay
                  src={listing.videoUrl}
                  className="w-full h-full object-contain bg-black"
                >
                  Sizning brauzeringiz videoni qo'llab-quvvatlamaydi.
                </video>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail Selector */}
        {activeMedia === 'IMAGE' && displayImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {displayImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  activeImageIndex === idx ? 'border-emerald-600 scale-95' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="thumb" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Details & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details, Description, Features, Trust Report */}
        <div className="lg:col-span-2 space-y-8">
          {/* Key Specs Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-500 font-medium">Xonalar</span>
              <div className="text-base font-extrabold text-slate-900">{listing.rooms} xona</div>
            </div>
            <div className="space-y-0.5 border-l border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Maydon</span>
              <div className="text-base font-extrabold text-slate-900">{listing.area} m²</div>
            </div>
            <div className="space-y-0.5 border-l border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Qavat</span>
              <div className="text-base font-extrabold text-slate-900">{listing.floor}/{listing.totalFloors}</div>
            </div>
            <div className="space-y-0.5 border-l border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Mulk Turi</span>
              <div className="text-base font-extrabold text-slate-900">{listing.propertyType}</div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-3">
            <h3 className="font-extrabold text-lg text-slate-900">E'lon Haida Ma'lumot</h3>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Aniq Manzil Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span>Kvartiraning Aniq Manzili</span>
              </h3>
              <button
                onClick={() => setCurrentView('MAP')}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1 transition-colors"
              >
                <span>Xaritada ko'rish 🗺</span>
              </button>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-sm font-bold text-slate-900">
                📍 {listing.address || `${listing.district} tumani, ${listing.region}`}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>Shahar/Viloyat: <strong>{listing.region}</strong></span>
                <span>Tuman: <strong>{listing.district}</strong></span>
                {listing.metroStation && (
                  <span className="text-emerald-700 font-bold">🚇 Metro: {listing.metroStation} ({listing.metroDistanceMinutes || 5} min)</span>
                )}
              </div>
            </div>
          </div>

          {/* Amenities & Features */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900">Qulayliklar va Sharoitlar</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-700">
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.furnished ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Barcha Mebel Mavjud
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.internet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Yuqori Tezlikdagi Wi-Fi
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.airConditioning ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Кондиционер (Konditsioner)
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.washingMachine ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Kir yuvish mashinasi
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.parking ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Avto-Parking
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${listing.petsAllowed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                <Check className="w-4 h-4 text-emerald-600" /> Uy hayvonlari ruxsat etilgan
              </div>
            </div>
          </div>

          {/* AI Risk & Trust Breakdown Box */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-emerald-500/40 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Shield AI Risk & Trust Tahlili</h3>
                  <p className="text-[11px] text-emerald-400">Xavfsizlik skanerlash natijasi</p>
                </div>
              </div>
              <TrustScoreBadge score={listing.trustScore} size="md" />
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-300">AI Tekshiruv Natijalari:</span>
              <ul className="space-y-1.5 text-slate-300">
                {listing.aiRiskReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Owner Contact Box */}
        <div className="space-y-6">
          {/* Price & Direct Contact Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6 sticky top-24">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold">Oylik Ijara Narxi</span>
              <div className="text-3xl font-black text-slate-900">
                {currency === 'USD' ? (
                  <span>${priceInUsd} <span className="text-sm font-normal text-slate-500">{listing.isRoommate ? '/ kishi boshiga' : '/ oy'}</span></span>
                ) : (
                  <span>{new Intl.NumberFormat('uz-UZ').format(priceInUzs)} <span className="text-sm font-normal text-slate-500">{listing.isRoommate ? 'so\'m / kishi boshiga' : 'so\'m/oy'}</span></span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                  0% Komissiya
                </span>
                {listing.utilitiesIncluded ? (
                  <span className="text-emerald-700 font-medium">Kommunal kiritilgan</span>
                ) : (
                  <span className="text-slate-500">Kommunal alohida</span>
                )}
              </div>
            </div>

            {/* Owner Profile Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={listing.owner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'}
                  alt={listing.owner?.name || 'Uy Egasi'}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500"
                />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1">
                    {listing.owner?.name || 'Uy Egasi'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    A'zo bo'lgan: {listing.owner?.joinedDate || '2024'} • {listing.owner?.successfulRentals || 0} muvaffaqiyatli ijara
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <TrustScoreBadge score={listing.owner?.trustScore || 90} size="sm" />
                <VerificationBadge level={listing.owner?.verificationLevel || 4} size="sm" />
              </div>
            </div>

            {/* Direct Contact Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => openChatWithListing(listing)}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02]"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Egasiga Xabar Yozish (Chat)</span>
              </button>

              {showPhone ? (
                <div className="w-full bg-slate-900 text-emerald-400 font-mono text-center py-3 rounded-xl font-bold text-base border border-slate-700 animate-in fade-in-50">
                  {listing.owner.phone}
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!currentUser) {
                      setShowAuth(true);
                    } else {
                      setShowPhone(true);
                      listing.contactCount = (listing.contactCount || 0) + 1;
                    }
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02]"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>Telefon Raqamni Ko'rish</span>
                </button>
              )}
            </div>

            {/* Anti Scam Warning Notice */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Firibgarlikdan Himoyalanish Qoidasi</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                Hech qachon uyni va kadastr hujjatlarini shaxsan ko'rmasdan oldindan plastik kartaga pul o'tkazmang!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Complaint Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-1.5">
                <Flag className="w-5 h-5 text-rose-600" /> E'lon Ustidan Shikoyat
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {reportSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-bold text-slate-900">Shikoyatingiz Qabul Qilindi</h4>
                <p className="text-xs text-slate-500">Moderatorlar va AI 15 daqiqa ichida tekshirib chiqadi.</p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Shikoyat Sababi</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  >
                    <option value="SCAM">Firibgarlik (Oldindan pul so'radi)</option>
                    <option value="BROKER">Makler (O'zini egi deb yolg'on gapirdi)</option>
                    <option value="FAKE_LISTING">Soxta E'lon yoki rasm</option>
                    <option value="WRONG_PRICE">Noto'g'ri Narx</option>
                    <option value="SPAM">Spam / Keraksiz xabar</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tafsilotlar</label>
                  <textarea
                    rows={3}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Qo'shimcha ma'lumot qoldiring..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors"
                >
                  Shikoyatni Yuborish
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Global Edit Listing Modal */}
      <EditListingModal />
    </div>
  );
};
