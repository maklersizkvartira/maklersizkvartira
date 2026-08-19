import React, { useState, useRef } from 'react';
import { 
  PlusCircle, Upload, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, ArrowLeft, 
  Trash2, Send, Video, MapPin, ChevronDown, Home, Check, Sparkles, Building2, 
  Phone, MessageSquare, Clock, ShieldAlert, Award, FileText
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';
import { MOCK_OWNERS } from '../../data/mockUsers';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { ApiService } from '../../services/apiService';
import { ListingScanResult } from '../../services/aiGuard';
import { writeListingCopy, estimatePrice, analyzePhotos, scanListingDeep, formatSom } from '../../services/aiEngine';

export const CreateListingPage: React.FC = () => {
  const { addListing, setCurrentView, currentUser, setShowAuth, listings, addFraudSignal, addReport } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(4500000);
  const [deposit, setDeposit] = useState(1000000);
  const [rooms, setRooms] = useState(2);
  const [area, setArea] = useState(65);
  const [floor, setFloor] = useState(3);
  const [totalFloors, setTotalFloors] = useState(9);
  const [region, setRegion] = useState('Toshkent shahri');
  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === region) || UZBEKISTAN_REGIONS[0];
  const [district, setDistrict] = useState(activeRegionObj.districts[0]);
  const [address, setAddress] = useState('');
  const [metro, setMetro] = useState('Yunusobod');
  const [metroDist, setMetroDist] = useState(5);

  const [furnished, setFurnished] = useState(true);
  const [utilities, setUtilities] = useState(true);
  const [pets, setPets] = useState(false);
  const [parking, setParking] = useState(true);
  const [airConditioning, setAirConditioning] = useState(true);
  const [washingMachine, setWashingMachine] = useState(true);
  const [internet, setInternet] = useState(true);

  const [isRoommate, setIsRoommate] = useState(false);
  const [roommateGender, setRoommateGender] = useState<'BOYS' | 'GIRLS' | 'ANY'>('ANY');
  const [roommateSpots, setRoommateSpots] = useState(1);
  
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  // Contact details for Step 4
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '+998 90 123 45 67');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [preferredTime, setPreferredTime] = useState("Har kuni 09:00 - 21:00");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsSuccessMsg, setGpsSuccessMsg] = useState('');
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scan, setScan] = useState<ListingScanResult | null>(null);

  React.useEffect(() => {
    if (step === 4 && !scan && !isScanningAI) {
      runScan();
    }
  }, [step]);

  const DISTRICT_COORDINATES: Record<string, [number, number]> = {
    'Chilonzor': [41.2780, 69.2080],
    'Yunusobod': [41.3650, 69.2920],
    'Mirobod': [41.3005, 69.2740],
    'Yakkasaroy': [41.2890, 69.2550],
    'Sergeli': [41.2250, 69.2200],
    'Uchtepa': [41.2950, 69.1750],
    'Olmazor': [41.3490, 69.2080],
    'Yashnobod': [41.2900, 69.3400],
    'Shayxontohur': [41.3200, 69.2400],
    "Mirzo Ulugʻbek": [41.3350, 69.3300],
    "Mirzo Ulug'bek": [41.3350, 69.3300],
    'Bektemir': [41.2100, 69.3300],
    'Yangihayot': [41.2000, 69.2100],
    'Samarqand sh.': [39.6542, 66.9597],
    'Farg\'ona sh.': [40.3842, 71.7843],
    'Andijon sh.': [40.7821, 72.3442],
    'Namangan sh.': [41.0011, 71.6683],
    'Buxoro sh.': [39.7747, 64.4286],
    'Qarshi sh.': [38.8606, 65.7891],
    'Termiz sh.': [37.2242, 67.2783],
    'Urganch sh.': [41.5504, 60.6317],
    'Navoiy sh.': [40.0844, 65.3792],
    'Jizzax sh.': [40.1158, 67.8422],
    'Nukus sh.': [42.4619, 59.6166],
  };

  const fetchAddressFromCoords = async (detectedLat: number, detectedLng: number) => {
    let matchedRegion = 'Toshkent shahri';
    let matchedDistrict = 'Chilonzor';
    let fullStreet = '';

    let closestDist = Infinity;
    for (const [dName, [dLat, dLng]] of Object.entries(DISTRICT_COORDINATES)) {
      const dist = Math.hypot(detectedLat - dLat, detectedLng - dLng);
      if (dist < closestDist) {
        closestDist = dist;
        matchedDistrict = dName;
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${detectedLat}&lon=${detectedLng}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const road = addr.road || addr.street || addr.neighbourhood || addr.suburb || `${matchedDistrict} tumani`;
        const houseNumber = addr.house_number ? `, ${addr.house_number}-uy` : '';
        fullStreet = `${road}${houseNumber}`;
      }
    } catch {
      // Fallback
    }

    if (!fullStreet) {
      fullStreet = `${matchedDistrict} ko'chasi, kvartira`;
    }

    return { region: matchedRegion, district: matchedDistrict, address: fullStreet };
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Avval kiring</h1>
        <p className="text-slate-600 text-sm">E'lon joylash uchun uy egasi sifatida tizimga kiring.</p>
        <button onClick={() => setShowAuth(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-md">
          Kirish
        </button>
      </div>
    );
  }

  if (currentUser.role !== 'OWNER') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Talaba e'lon joylay olmaydi</h1>
        <p className="text-slate-600 text-sm">Bu yerda faqat kvartira egasi e'lon qo'yadi. Siz kvartiralarni qidirishingiz va ko'rishingiz mumkin.</p>
        <button onClick={() => setCurrentView('SEARCH')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-md">
          Kvartiralarni ko'rish
        </button>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const finalImages = images.length > 0 ? images : [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200'
  ];

  const runScan = async () => {
    setStep(4);
    setIsScanningAI(true);
    setScan(null);
    const titleText = title || `${region}, ${district} tumanida shinam ${rooms} xonali kvartira`;
    const descText = description || "To'g'ridan-to'g'ri egasidan shinam kvartira.";
    const userPhone = contactPhone || currentUser?.phone || '+998900000000';
    const userName = currentUser?.name || 'Kvartira Egasi';
    const userId = currentUser?.id || `user-${Date.now()}`;

    const local = scanListingDeep(titleText, descText, price, rooms, {
      phone: userPhone,
      images: finalImages,
      district,
      area,
      otherListings: listings.map((l) => ({ images: l.images, phone: l.owner?.phone || '', price: l.price, district: l.district, rooms: l.rooms })),
    });

    if (!local.allowed) {
      setScan(local);
      setIsScanningAI(false);

      addFraudSignal({
        id: `fraud-${Date.now()}`,
        type: 'HIGH_BROKER_PROBABILITY',
        title: `AI Skaner: Shubhali e'lon rad etildi`,
        entityId: userId,
        entityName: `${userName} (${userPhone})`,
        riskScore: local.riskScore,
        evidenceReasons: local.reasons,
        detectedAt: 'Hozirgina',
        status: 'PENDING_MODERATION',
      });

      addReport({
        id: `rep-${Date.now()}`,
        listingId: `suspicious-${Date.now()}`,
        listingTitle: titleText,
        ownerName: userName,
        reporterName: 'Shield AI Guard (Anti-Broker)',
        reason: 'BROKER',
        description: `AI Skaner shubhali e'lonni blokladi: ${local.reasons.join(' | ')}`,
        status: 'OPEN',
        priority: 'CRITICAL',
        aiRiskScore: local.riskScore,
        createdAt: new Date().toLocaleDateString('uz-UZ'),
      });
      return;
    }

    try {
      const result = await ApiService.scanListing(titleText, descText, price, rooms);
      setScan(result.allowed === false ? result : local);
    } catch {
      setScan(local);
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleSubmitListing = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!lat || !lng) {
      alert("Iltimos, e'lon joylashdan avval 'GPS Lokatsiyani Aniqlash' tugmasini bosib manzilni aniqlang. Bu xaritada e'loningizni aniq ko'rsatish uchun majburiydir.");
      return;
    }

    const owner = {
      ...MOCK_OWNERS.owner_jasur,
      id: currentUser?.id || `owner-${Date.now()}`,
      name: currentUser?.name || 'Kvartira Egasi',
      phone: contactPhone || currentUser?.phone || '+998 90 000 00 00',
      avatar: currentUser?.avatar || MOCK_OWNERS.owner_jasur.avatar,
      role: 'OWNER' as const,
    };

    const newListing: Listing = {
      id: `listing-${Date.now()}`,
      title: title || `${region}, ${district} tumanida shinam ${rooms} xonali kvartira`,
      description: description || "To'g'ridan-to'g'ri egasidan shinam kvartira.",
      price,
      currency: 'UZS',
      depositPrice: deposit,
      utilitiesIncluded: utilities,
      rooms,
      area,
      floor,
      totalFloors,
      propertyType: 'APARTMENT',
      region,
      district,
      address: address.trim() || `${district} tumani, 12-uy`,
      latitude: lat || (DISTRICT_COORDINATES[district] ? DISTRICT_COORDINATES[district][0] : 41.3110),
      longitude: lng || (DISTRICT_COORDINATES[district] ? DISTRICT_COORDINATES[district][1] : 69.2790),
      metroStation: metro !== "Yo'q" ? metro : undefined,
      metroDistanceMinutes: metroDist,
      furnished,
      petsAllowed: pets,
      parking,
      internet,
      airConditioning,
      washingMachine,
      images: finalImages,
      videoUrl: videoUrl.trim() || undefined,
      hasVirtualTour: false,
      isRoommate,
      roommateGender: isRoommate ? roommateGender : undefined,
      roommateSpotsAvailable: isRoommate ? roommateSpots : undefined,
      owner,
      trustScore: scan?.trustScore || 95,
      riskScore: scan?.riskScore || 5,
      aiCheckStatus: 'APPROVED',
      aiRiskReasons: scan?.reasons || ["AI Tekshiruvidan muvaffaqiyatli o'tdi"],
      safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION', 'STUDENT_FRIENDLY'],
      createdAt: new Date().toISOString(),
      viewsCount: 1,
      favoritesCount: 0,
      contactCount: 0,
    };

    addListing(newListing);
    ApiService.createListing(newListing).catch((err) => {
      console.warn("Listing sync warning:", err);
    });

    setCurrentView('HOME');
  };

  // USD estimated price (approx 1 USD = 12,800 UZS)
  const usdPriceEstimate = Math.round(price / 12800);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 sm:pb-16 space-y-6 sm:space-y-8 min-h-[85vh] w-full overflow-x-hidden">
      
      {/* Top Header & Breadcrumb */}
      <div className="space-y-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button onClick={() => setCurrentView('HOME')} className="hover:text-emerald-600 transition-colors">Bosh sahifa</button>
          <span>/</span>
          <span className="text-slate-900 font-bold">E'lon berish</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              E'lon joylashtirish
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              4 ta oddiy qadam — 3 daqiqada e'loningiz tayyor. Maklerlarsiz, to'g'ridan-to'g'ri ijarachilar bilan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCurrentView('HOME')}
            className="self-start sm:self-center text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-all"
          >
            Bekor qilish
          </button>
        </div>
      </div>

      {/* 4-Step Progress Navigation Wizard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { num: 1, title: '1. Manzil', desc: 'Uy qayerda joylashgan?' },
          { num: 2, title: "2. Uy ma'lumoti", desc: 'Xonalar, maydon, narx' },
          { num: 3, title: '3. Rasmlar', desc: 'Kamida 3 ta rasm' },
          { num: 4, title: '4. Aloqa', desc: "Sizga qanday bog'lanishadi?" },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                if (s.num <= step) setStep(s.num);
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/70'
                  : 'bg-white text-slate-400 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${
                  isActive ? 'bg-white text-emerald-700' : isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-emerald-500/40 text-white' : 'text-slate-400'
                }`}>
                  {s.num}-qadam / 4
                </span>
              </div>
              <div className="font-black text-xs sm:text-sm mt-2.5">{s.title}</div>
              <div className={`text-[11px] truncate mt-0.5 font-medium ${isActive ? 'text-emerald-100' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                {s.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Main Form Card (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          
          {/* STEP 1: MANZIL */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Manzil va joylashuv
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kvartirangiz qaysi tuman va ko'chada joylashgan?</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  1-qadam
                </span>
              </div>

              {/* Region & District Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Viloyat / Shahar</label>
                  <div className="relative mt-1.5">
                    <select
                      value={region}
                      onChange={(e) => {
                        const newReg = e.target.value;
                        setRegion(newReg);
                        const newRegObj = UZBEKISTAN_REGIONS.find((r) => r.name === newReg);
                        if (newRegObj) setDistrict(newRegObj.districts[0]);
                      }}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl p-3.5 pr-9 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs text-sm"
                    >
                      {UZBEKISTAN_REGIONS.map((r) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Tuman</label>
                  <div className="relative mt-1.5">
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl p-3.5 pr-9 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs text-sm"
                    >
                      {activeRegionObj.districts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Exact Address + Geolocation Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Ko'cha va Mo'ljal (Aniq manzil)</label>
                  <button
                    type="button"
                    disabled={isDetectingGps}
                    onClick={() => {
                      setIsDetectingGps(true);
                      setGpsSuccessMsg('');
                      if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            const detectedLat = pos.coords.latitude;
                            const detectedLng = pos.coords.longitude;
                            setLat(detectedLat);
                            setLng(detectedLng);
                            
                            const geo = await fetchAddressFromCoords(detectedLat, detectedLng);
                            if (geo) {
                              setRegion(geo.region);
                              setDistrict(geo.district);
                              setAddress(geo.address);
                              setGpsSuccessMsg(`GPS Manzil topildi: ${geo.region}, ${geo.district}, ${geo.address}`);
                            } else {
                              setGpsSuccessMsg(`GPS koordinatalar aniqlandi! (${detectedLat.toFixed(4)}, ${detectedLng.toFixed(4)})`);
                            }
                            setIsDetectingGps(false);
                          },
                          () => {
                            setIsDetectingGps(false);
                            alert("GPS ruxsati berilmadi yoki aniqlab bo'lmadi. Manzilni matn ko'rinishida kiriting.");
                          },
                          { timeout: 8000 }
                        );
                      } else {
                        setIsDetectingGps(false);
                        alert("Qurilmangizda GPS qo'llab-quvvatlanmaydi.");
                      }
                    }}
                    className={`${lat && lng ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600 animate-pulse'} text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-white" />
                    <span>{isDetectingGps ? "Aniqlanmoqda..." : lat && lng ? "✅ GPS Aniqlangan" : "GPS Lokatsiyani Aniqlash (Majburiy)"}</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Masalan: Mustaqillik shoh ko'chasi, 14-uy (Mo'ljal: Mirzo Ulug'bek metrosi yaqinida)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-medium text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />

                {gpsSuccessMsg && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{gpsSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* Metro Station & Walking Distance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Yaqin Metro Bekati</label>
                  <div className="relative mt-1.5">
                    <select
                      value={metro}
                      onChange={(e) => setMetro(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl p-3.5 pr-9 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs text-sm"
                    >
                      <option value="Yo'q">Yo'q (Metro yaqin emas)</option>
                      {TASHKENT_METRO_LINES.map((line) => (
                        <optgroup key={line.id} label={line.name}>
                          {line.stations.map((st) => (
                            <option key={st} value={st}>{st} bekati</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Metroga piyoda masofa (daqiqa)</label>
                  <input
                    type="number"
                    value={metroDist}
                    onChange={(e) => setMetroDist(Number(e.target.value))}
                    min={1}
                    max={60}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-bold text-sm mt-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Next Step Action Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md text-sm active:scale-[0.99] cursor-pointer"
                >
                  <span>Keyingi (Uy ma'lumoti)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: UY MA'LUMOTI */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                    Uy va Ijara Ma'lumotlari
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Xonalar soni, oylik narxi va qulayliklar</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  2-qadam
                </span>
              </div>

              {/* Rental Category Choice */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Ijara Turi (Kategoriya)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRoommate(false)}
                    className={`p-3.5 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !isRoommate ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span>Butun Kvartira</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoommate(true)}
                    className={`p-3.5 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isRoommate ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sherikchilikka (Kvartira Sherik)</span>
                  </button>
                </div>
              </div>

              {/* Roommate Special Options */}
              {isRoommate && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                  <div className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Sherikchilikka Sharoitlari</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700">Kimlar uchun sheriklik?</label>
                      <div className="relative mt-1">
                        <select
                          value={roommateGender}
                          onChange={(e) => setRoommateGender(e.target.value as any)}
                          className="w-full appearance-none bg-white border border-amber-300 rounded-xl p-2.5 pr-8 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
                        >
                          <option value="ANY">Farqi yo'q (O'g'il / Qiz)</option>
                          <option value="BOYS">Faqat Yigitlar uchun</option>
                          <option value="GIRLS">Faqat Qizlar uchun</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-amber-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Qancha sherik kerak?</label>
                      <div className="relative mt-1">
                        <select
                          value={roommateSpots}
                          onChange={(e) => setRoommateSpots(Number(e.target.value))}
                          className="w-full appearance-none bg-white border border-amber-300 rounded-xl p-2.5 pr-8 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
                        >
                          <option value={1}>1 ta sherik kerak</option>
                          <option value={2}>2 ta sherik kerak</option>
                          <option value={3}>3 ta sherik kerak</option>
                          <option value={4}>4+ ta sherik kerak</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-amber-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div>
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">E'lon Sarlavhasi</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: Yunusobod 4-kvartalda shinam 2 xonali kvartira"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-bold text-sm mt-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Batafsil Tavsif</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kvartirangiz sharoitlari, ta'mir holati va qo'shnilari haqida yozing..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-medium text-sm mt-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              {/* AI Helper Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const text = writeListingCopy({
                      district,
                      region,
                      rooms,
                      area,
                      price,
                      furnished,
                      metro,
                      metroMinutes: metroDist,
                    });
                    setDescription(text);
                    if (!title.trim()) setTitle(`${district}da ${rooms} xonali kvartira`);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>✨ AI Matn Yozsin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const est = estimatePrice({ region, district, rooms, area, furnished });
                    setPrice(est.suggested);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-extrabold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-600" />
                  <span>💰 AI Narx: {formatSom(estimatePrice({ region, district, rooms, area, furnished }).suggested)}</span>
                </button>
              </div>

              {/* Price & Deposit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Oylik Narx (so'm)</label>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      ~${usdPriceEstimate}/oy
                    </span>
                  </div>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    step={100000}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-black text-base text-emerald-950 mt-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Depozit summasi (so'm)</label>
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    step={100000}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-black text-base text-slate-900 mt-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Rooms, Area, Floor, Total Floors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Xonalar</label>
                  <div className="relative mt-1">
                    <select
                      value={rooms}
                      onChange={(e) => setRooms(Number(e.target.value))}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl p-3 pr-7 font-bold text-sm text-slate-900 cursor-pointer shadow-xs"
                    >
                      <option value={1}>1 xona</option>
                      <option value={2}>2 xona</option>
                      <option value={3}>3 xona</option>
                      <option value={4}>4+ xona</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Maydoni (m²)</label>
                  <input
                    type="number"
                    value={area}
                    onChange={(e) => setArea(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm mt-1 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Qavat</label>
                  <input
                    type="number"
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm mt-1 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Jami qavat</label>
                  <input
                    type="number"
                    value={totalFloors}
                    onChange={(e) => setTotalFloors(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm mt-1 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Amenities Grid */}
              <div className="space-y-2 pt-1">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Mavjud Sharoitlar va Qulayliklar</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-bold text-slate-800">
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>🛋️ Mebelli</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={utilities} onChange={(e) => setUtilities(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>💡 Kommunal kiradi</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={airConditioning} onChange={(e) => setAirConditioning(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>❄️ Konditsioner</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={washingMachine} onChange={(e) => setWashingMachine(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>🧺 Kir yuvish m.</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={internet} onChange={(e) => setInternet(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>📶 Wi-Fi Internet</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                    <span>🐾 Hayvon joylash</span>
                  </label>
                </div>
              </div>

              {/* Step 2 Back & Next Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Orqaga</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md text-sm active:scale-[0.99] cursor-pointer"
                >
                  <span>Keyingi (Rasmlar)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RASMLAR VA VIDEO */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    Kvartira Rasmlari va Video
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kamida 3 ta sifatli rasm yuklang (ko'proq rasm = ko'proq ijarachi)</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  3-qadam
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Clickable Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50/80 rounded-3xl p-6 sm:p-8 text-center space-y-3 cursor-pointer transition-all shadow-xs"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Kvartirangiz rasmlarini yuklash uchun bosing
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-medium">
                    Telefoningiz yoki galereyangizdan rasmlarni tanlang (JPG, PNG, WEBP). Kamida 3 ta sifatli rasm joylang.
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-white border border-emerald-300 text-emerald-800 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:bg-emerald-50 transition-colors"
                >
                  📁 Fayllarni tanlash ({images.length} ta yuklandi)
                </button>
              </div>

              {/* Uploaded Images Preview Grid */}
              {images.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-extrabold text-slate-700">Yuklangan rasmlaringiz:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 group shadow-xs">
                        <img src={img} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-2 left-2 bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-md">
                            Asosiy rasm
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1.5 rounded-full transition-colors shadow-md cursor-pointer"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-medium">
                  Siz hali shaxsiy rasm yuklamadingiz. Yuqoridagi yashil joyni bosib telefoningizdan kvartira rasmlarini tanlang.
                </div>
              )}

              {/* Direct Device Video Upload */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-xs text-slate-800 flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-500" />
                    <span>Kvartira Video Sharhi (Qurilmangizdan Yuklash)</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    Ixtiyoriy
                  </span>
                </div>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                />

                {videoUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-md">
                      <video
                        controls
                        src={videoUrl}
                        className="w-full max-h-56 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setVideoUrl('')}
                        className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Videoni O'chirish</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Video muvaffaqiyatli yuklandi!
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/40 hover:bg-rose-50/80 rounded-2xl p-4 text-center space-y-2 cursor-pointer transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-slate-800 text-xs">
                      📱 Telefoningiz yoki galereyangizdan video tanlang
                    </div>
                    <p className="text-[11px] text-slate-500">
                      MP4, MOV, WEBM formatdagi kvartira video sharhini yuklashingiz mumkin.
                    </p>
                  </div>
                )}
              </div>

              {/* AI Photo Analysis Card */}
              {(() => {
                const photo = analyzePhotos({ rooms, furnished, images: finalImages, washingMachine: true, airConditioning: true });
                return (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs space-y-1">
                    <div className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> AI Rasm Tahlili Natijasi:
                    </div>
                    <div className="text-slate-700 font-medium">Xonalar: {photo.roomsFound.join(', ')}</div>
                    <div className="text-slate-700 font-medium">{photo.furnishedText}. {photo.condition}</div>
                  </div>
                );
              })()}

              {/* Step 3 Back & Next Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Orqaga</span>
                </button>
                <button
                  type="button"
                  onClick={runScan}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md text-sm active:scale-[0.99] cursor-pointer"
                >
                  <span>Keyingi (Aloqa va Tekshiruv)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ALOQA VA TEKSHIRUV */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in-50">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-emerald-600" />
                    Aloqa va AI Xavfsizlik Tekshiruvi
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ijarachilar sizga qanday bog'lanishadi?</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  4-qadam
                </span>
              </div>

              {/* Contact Information Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Telefon Raqamingiz</label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-10 font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Telegram Username (ixtiyoriy)</label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      value={telegramHandle}
                      onChange={(e) => setTelegramHandle(e.target.value)}
                      placeholder="@username"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-10 font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Qulay Aloqa Vaqti</label>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    placeholder="Har kuni 09:00 - 21:00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-10 font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* AI Verification Scanner Display */}
              {isScanningAI ? (
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-6 rounded-3xl animate-pulse space-y-3 text-center">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <h4 className="font-extrabold text-base text-emerald-950">🤖 AI E'loningizni tekshirmoqda...</h4>
                  <p className="text-xs text-emerald-800 font-medium">
                    Maklerlik belgilari, firibgarlik va narx mantiqi sun'iy intellekt tomonidan tahlil qilinmoqda. Biroz kutib turing...
                  </p>
                </div>
              ) : scan && !scan.allowed ? (
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-3xl space-y-3 text-left">
                  <div className="font-black text-rose-900 flex items-center gap-2 text-base">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" /> E'lon rad etildi: Aniq xatolik joyi aniqlandi
                  </div>
                  <p className="text-xs text-rose-800 font-medium leading-relaxed">{scan.message}</p>

                  {scan.fieldErrors && scan.fieldErrors.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {scan.fieldErrors.map((err, idx) => (
                        <div key={idx} className="bg-white border border-rose-200 p-3 rounded-xl space-y-1 shadow-xs">
                          <span className="font-black text-rose-700 text-[10px] uppercase bg-rose-100 px-2 py-0.5 rounded">
                            📍 {err.field}
                          </span>
                          <p className="text-xs text-slate-800 font-bold">{err.issue}</p>
                          <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            💡 AI Maslahati: {err.fixSuggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        let cleanedTitle = title.replace(/\b(makler|zaklad|vositachi|agentlik)\b/gi, '').trim();
                        let cleanedDesc = description.replace(/\b(makler|zaklad|vositachi|agentlik|kartaga|oldindan pul)\b/gi, '').trim();
                        if (!cleanedDesc.includes("Maklersiz")) {
                          cleanedDesc += " Egasidan to'g'ridan-to'g'ri, 0% komissiya.";
                        }
                        setTitle(cleanedTitle || `${region}, ${district} tumanida 2 xonali kvartira`);
                        setDescription(cleanedDesc);
                        setStep(2);
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ✨ AI Matnni Tuzatish
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitListing}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 px-4 rounded-xl text-xs transition-colors shadow-md cursor-pointer"
                    >
                      Baribir Nashr Qilish
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl text-left space-y-2">
                  <div className="font-extrabold text-emerald-950 flex items-center gap-2 text-base">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> AI Tekshiruvidan Muvaffaqiyatli O'tdi!
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    {scan?.message || "E'loningiz va suratlaringiz qoidalarga mos keladi. E'loningizni darhol nashr qilishingiz mumkin."}
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Orqaga</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitListing}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black py-4 px-6 rounded-2xl text-base shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>E'lonni chiqarish</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: "Yaxshi E'lon Qoidalari" Rules Card */}
        <div className="space-y-4">
          
          {/* Rules Card matching Lovable reference */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 sticky top-24">
            <div className="flex items-center gap-3 text-slate-900 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg shrink-0">
                📋
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Yaxshi e'lon qoidalari</h3>
                <p className="text-xs text-slate-500">Tez va ishonchli ijara uchun tavsiyalar</p>
              </div>
            </div>

            <ul className="space-y-4 text-xs font-medium text-slate-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-black mt-0.5">
                  📸
                </span>
                <span className="leading-relaxed">
                  <strong className="font-bold text-slate-900">Haqiqiy rasmlar joylang</strong> — internetdan olingan rasmlar AI tomonidan rad etiladi.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-black mt-0.5">
                  💰
                </span>
                <span className="leading-relaxed">
                  <strong className="font-bold text-slate-900">Narxni oylik va USD da</strong> aniq ko'rsating.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-black mt-0.5">
                  📍
                </span>
                <span className="leading-relaxed">
                  <strong className="font-bold text-slate-900">Manzilni mo'ljal bilan yozing</strong>, ijarachi tez topadi.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-black mt-0.5">
                  📝
                </span>
                <span className="leading-relaxed">
                  <strong className="font-bold text-slate-900">Shartlarni (depozit, kommunal)</strong> tavsifda aniq yozing.
                </span>
              </li>
            </ul>

            {/* Highlighted Commission-Free Badge */}
            <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 space-y-1 text-xs">
              <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Bepul Joylashtirish</span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                E'lon joylashtirish butunlay bepul. Biz hech qanday komissiya olmaymiz — ijarachi siz bilan to'g'ridan-to'g'ri bog'lanadi.
              </p>
            </div>

            {/* Verified Owner Prompt Banner */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Verified Owner badge 🏠</div>
                  <button
                    type="button"
                    onClick={() => setCurrentView('VERIFICATION')}
                    className="text-emerald-600 hover:text-emerald-700 font-extrabold text-[11px] underline mt-0.5 inline-block cursor-pointer"
                  >
                    Ishonchlilik belgisini olish →
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
