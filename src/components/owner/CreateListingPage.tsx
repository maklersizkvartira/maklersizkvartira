import React, { useState, useRef } from 'react';
import { PlusCircle, Upload, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, Trash2, Send, Video, Compass, MapPin } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';
import { MOCK_OWNERS } from '../../data/mockUsers';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { ApiService } from '../../services/apiService';
import { ListingScanResult } from '../../services/aiGuard';
import { writeListingCopy, estimatePrice, analyzePhotos, scanListingDeep, formatSom } from '../../services/aiEngine';

export const CreateListingPage: React.FC = () => {
  const { addListing, setCurrentView, currentUser, setShowAuth, listings } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [isRoommate, setIsRoommate] = useState(false);
  const [roommateGender, setRoommateGender] = useState<'BOYS' | 'GIRLS' | 'ANY'>('ANY');
  const [roommateSpots, setRoommateSpots] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsSuccessMsg, setGpsSuccessMsg] = useState('');
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scan, setScan] = useState<ListingScanResult | null>(null);

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
    "Mirzo Ulug'bek": [41.3350, 69.3300],
    'Bektemir': [41.2100, 69.3300],
    'Yangihoyot': [41.2000, 69.2100],
  };

  const fetchAddressFromCoords = async (detectedLat: number, detectedLng: number) => {
    let matchedRegion = 'Toshkent shahri';
    let matchedDistrict = 'Chilonzor';
    let fullStreet = '';

    // Calculate nearest district by mathematical coordinate distance
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
        <h1 className="text-2xl font-black">Avval kiring</h1>
        <p className="text-slate-600">E'lon joylash uchun uy egasi sifatida kiring.</p>
        <button onClick={() => setShowAuth(true)} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl">
          Kirish
        </button>
      </div>
    );
  }

  if (currentUser.role !== 'OWNER') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black">Talaba e'lon joylay olmaydi</h1>
        <p className="text-slate-600">Bu yerda faqat kvartira egasi e'lon qo'yadi. Siz kvartiralarni ko'rishingiz mumkin.</p>
        <button onClick={() => setCurrentView('SEARCH')} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl">
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
    const local = scanListingDeep(titleText, descText, price, rooms, {
      phone: currentUser.phone,
      images: finalImages,
      district,
      area,
      otherListings: listings.map((l) => ({ images: l.images, phone: l.owner.phone, price: l.price, district: l.district, rooms: l.rooms })),
    });
    if (!local.allowed) {
      setScan(local);
      setIsScanningAI(false);
      return;
    }
    const result = await ApiService.scanListing(titleText, descText, price, rooms);
    setScan(result.allowed === false ? result : local);
    setIsScanningAI(false);
  };

  const handleSubmitListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scan?.allowed) return;

    const owner = {
      ...MOCK_OWNERS.owner_jasur,
      id: currentUser.id,
      name: currentUser.name,
      phone: currentUser.phone,
      avatar: currentUser.avatar || MOCK_OWNERS.owner_jasur.avatar,
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
      address: address || `${district} ko'chasi, 12-uy`,
      latitude: lat || 41.3110,
      longitude: lng || 69.2790,
      metroStation: metro !== "Yo'q" ? metro : undefined,
      metroDistanceMinutes: metroDist,
      furnished,
      petsAllowed: pets,
      parking,
      internet: true,
      airConditioning: true,
      washingMachine: true,
      images: finalImages,
      videoUrl: videoUrl.trim() || undefined,
      hasVirtualTour: false,
      isRoommate,
      roommateGender: isRoommate ? roommateGender : undefined,
      roommateSpotsAvailable: isRoommate ? roommateSpots : undefined,
      owner,
      trustScore: scan.trustScore,
      riskScore: scan.riskScore,
      aiCheckStatus: 'APPROVED',
      aiRiskReasons: scan.reasons,
      safetyBadges: ['VERIFIED_OWNER', 'AI_CHECKED', 'NO_COMMISSION'],
      createdAt: new Date().toISOString(),
      viewsCount: 1,
      favoritesCount: 0,
      contactCount: 0,
    };

    addListing(newListing);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-emerald-600" /> Yangi e'lon
          </h1>
          <p className="text-sm text-slate-500">Oddiy yozing. AI makler e'lonini o'tkazmaydi.</p>
        </div>
        <button onClick={() => setCurrentView('HOME')} className="text-sm font-semibold text-slate-500">
          Bekor qilish
        </button>
      </div>

      {/* Auto Verification Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-2xl p-4 sm:p-5 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-black text-sm sm:text-base text-white">E'loningiz ko'rinish darajasini va ishonchini oshiring! 🚀</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Tasdiqlangan Uy Egasi (Verified Owner 🏠) nishonini oling hamda talabalar va ijarachilarning sizga bo'lgan ishonchini 3 baravarga oshiring.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('VERIFICATION')}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-[0.98]"
        >
          <span>Ishonchli Tekshiruvdan O'tish</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
        {[
          { num: 1, label: 'Asosiy' },
          { num: 2, label: 'Manzil' },
          { num: 3, label: 'Rasmlar' },
          { num: 4, label: 'Tekshiruv' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded-xl border ${
              step === s.num
                ? 'bg-emerald-600 text-white border-emerald-600'
                : step > s.num
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            {s.num}. {s.label}
          </div>
        ))}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-card">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">Kvartira haqida</h3>

            {/* Rental Category Choice */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-sm">Ijara Turi (Kategoriya)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoommate(false)}
                  className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    !isRoommate ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>🏠 Butun Kvartira</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoommate(true)}
                  className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isRoommate ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>🤝 Sherikchilikka (Kvartira Sherik)</span>
                </button>
              </div>
            </div>

            {isRoommate && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                <div className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                  <span>🤝 Sherikchilikka Sharoitlari</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">Kimlar uchun sheriklik?</label>
                    <select
                      value={roommateGender}
                      onChange={(e) => setRoommateGender(e.target.value as any)}
                      className="w-full bg-white border border-amber-300 rounded-xl p-2.5 font-bold mt-1"
                    >
                      <option value="ANY">Farqi yo'q (O'g'il / Qiz)</option>
                      <option value="BOYS">Faqat Yigitlar uchun</option>
                      <option value="GIRLS">Faqat Qizlar uchun</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Qancha sherik kerak?</label>
                    <select
                      value={roommateSpots}
                      onChange={(e) => setRoommateSpots(Number(e.target.value))}
                      className="w-full bg-white border border-amber-300 rounded-xl p-2.5 font-bold mt-1"
                    >
                      <option value={1}>1 ta sherik kerak</option>
                      <option value={2}>2 ta sherik kerak</option>
                      <option value={3}>3 ta sherik kerak</option>
                      <option value={4}>4+ ta sherik kerak</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="font-bold text-slate-700 text-sm">Sarlavha</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Yunusobodda 2 xonali kvartira"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-base mt-1"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 text-sm">Tavsif</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kvartirangiz haqida oddiy tilda yozing..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-sm py-3 rounded-xl"
              >
                AI matn yozsin
              </button>
              <button
                type="button"
                onClick={() => {
                  const est = estimatePrice({ region, district, rooms, area, furnished });
                  setPrice(est.suggested);
                }}
                className="bg-slate-100 text-slate-800 border border-slate-200 font-black text-sm py-3 rounded-xl"
              >
                AI narx: {formatSom(estimatePrice({ region, district, rooms, area, furnished }).suggested)}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 text-sm">Oylik narx (so'm)</label>
                <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-base mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700 text-sm">Depozit (so'm)</label>
                <input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-base mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700 text-sm">Xonalar</label>
                <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-base mt-1">
                  <option value={1}>1 xona</option>
                  <option value={2}>2 xona</option>
                  <option value={3}>3 xona</option>
                  <option value={4}>4+ xona</option>
                </select>
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2">
              Keyingi (manzil) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">Manzil</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 text-sm">Viloyat</label>
                <select
                  value={region}
                  onChange={(e) => {
                    const newReg = e.target.value;
                    setRegion(newReg);
                    const newRegObj = UZBEKISTAN_REGIONS.find((r) => r.name === newReg);
                    if (newRegObj) setDistrict(newRegObj.districts[0]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold mt-1"
                >
                  {UZBEKISTAN_REGIONS.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 text-sm">Tuman</label>
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold mt-1">
                  {activeRegionObj.districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 text-sm">Ko'cha va uy (Aniq Manzil)</label>
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
                            setGpsSuccessMsg(`📍 GPS Manzil topildi: ${geo.region}, ${geo.district}, ${geo.address}`);
                          } else {
                            setGpsSuccessMsg(`📍 GPS koordinatalar aniqlandi! (${detectedLat.toFixed(4)}, ${detectedLng.toFixed(4)})`);
                          }
                          setIsDetectingGps(false);
                        },
                        (err) => {
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5 text-white" />
                  <span>{isDetectingGps ? "Aniqlanmoqda..." : "📍 GPS Lokatsiyani Aniqlash"}</span>
                </button>
              </div>

              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Masalan: Mustaqillik ko'chasi, 15-uy"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium mt-1 focus:outline-none focus:border-emerald-500"
              />

              {gpsSuccessMsg && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-1.5 animate-in fade-in-50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{gpsSuccessMsg}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 text-sm">Metro</label>
                <select value={metro} onChange={(e) => setMetro(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium mt-1">
                  <option value="Yo'q">Yo'q</option>
                  <option value="Oybek">Oybek</option>
                  <option value="Yunusobod">Yunusobod</option>
                  <option value="Beruniy">Beruniy</option>
                  <option value="Mirzo Ulug'bek">Mirzo Ulug'bek</option>
                  <option value="Buyuk Ipak Yo'li">Buyuk Ipak Yo'li</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 text-sm">Metroga piyoda (daqiqa)</label>
                <input type="number" value={metroDist} onChange={(e) => setMetroDist(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 bg-slate-50 border rounded-xl p-3 text-sm font-bold"><input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} className="mr-2" />Mebelli</label>
              <label className="flex-1 bg-slate-50 border rounded-xl p-3 text-sm font-bold"><input type="checkbox" checked={utilities} onChange={(e) => setUtilities(e.target.checked)} className="mr-2" />Kommunal kiradi</label>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 bg-slate-50 border rounded-xl p-3 text-sm font-bold"><input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="mr-2" />Hayvon mumkin</label>
              <label className="flex-1 bg-slate-50 border rounded-xl p-3 text-sm font-bold"><input type="checkbox" checked={parking} onChange={(e) => setParking(e.target.checked)} className="mr-2" />Parking</label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(1)} className="w-1/3 bg-slate-100 text-slate-700 font-black py-4 rounded-xl">Orqaga</button>
              <button onClick={() => setStep(3)} className="w-2/3 bg-slate-900 text-white font-black py-4 rounded-xl">Keyingi (rasmlar)</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">Rasmlar ({images.length} ta yuklandi)</h3>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Rasm qo'shish
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Clickable Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-800 text-sm">
                Kvartirangiz rasmlarini yuklash uchun bosing
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Telefoningiz yoki kompyuteringizdan rasmlarni tanlang (JPG, PNG, WEBP). Bir vaqtda bir nechta rasm tanlashingiz mumkin.
              </p>
              <button
                type="button"
                className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
              >
                Fayllarni tanlash
              </button>
            </div>

            {/* Uploaded Images Preview Grid */}
            {images.length > 0 ? (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Yuklangan rasmlaringiz:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 group shadow-sm">
                      <img src={img} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-md">
                          Asosiy rasm
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-rose-600 text-white p-1.5 rounded-full transition-colors shadow-md"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 font-medium">
                Siz hali shaxsiy rasm yuklamadingiz. Yuqoridagi yashil joyni bosib telefoningizdan kvartira rasmlarini tanlang.
              </div>
            )}

            {/* Video URL Input Field */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 mt-4">
              <label className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-rose-500" />
                <span>Kvartira Video Sharhi (YouTube / Video URL - Ixtiyoriy)</span>
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Agarda kvartirangizning video sharhi (YouTube havolasi) bo'lsa kiriting (Majburiy emas).
              </p>
            </div>

            {(() => {
              const photo = analyzePhotos({ rooms, furnished, images: finalImages, washingMachine: true, airConditioning: true });
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-sm">
                  <div className="font-black text-slate-900 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> AI rasm tahlili
                  </div>
                  <div className="text-slate-700 text-xs">Xonalar: {photo.roomsFound.join(', ')}</div>
                  <div className="text-slate-700 text-xs">{photo.furnishedText}. {photo.condition}</div>
                </div>
              );
            })()}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(2)} className="w-1/3 bg-slate-100 text-slate-700 font-black py-4 rounded-xl">Orqaga</button>
              <button onClick={runScan} className="w-2/3 bg-emerald-700 text-white font-black py-4 rounded-xl">Tekshirish</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            {isScanningAI ? (
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg text-slate-900">Tekshiryapmiz...</h3>
                <p className="text-slate-500">Makler va firibgar belgilarini qidiramiz.</p>
              </div>
            ) : scan && !scan.allowed ? (
              <div className="space-y-4 max-w-md mx-auto text-left">
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-3 shadow-sm">
                  <div className="font-black text-rose-900 flex items-center gap-2 text-base">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" /> E'lon joylanmadi
                  </div>
                  <p className="text-xs sm:text-sm text-rose-800 leading-relaxed font-medium">{scan.message}</p>
                  <ul className="text-xs text-rose-700 space-y-1 pl-1">
                    {scan.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>

                  {/* Telegram Support Notice Box */}
                  <div className="bg-white/90 border border-rose-200 rounded-xl p-3.5 space-y-2 mt-3 text-slate-800">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>AI adashgan bo'lishi mumkin!</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Agar siz haqiqatdan ham kvartira egasi bo'lsangiz va AI e'loningizni noto'g'ri bloklagan bo'lsa, ma'lumotni darhol ko'rib chiqishimiz uchun Telegram orqali bog'laning.
                    </p>
                    <a
                      href="https://t.me/MaklersizUy_Support"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                      Telegram: @MaklersizUy_Support
                    </a>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-colors">
                    Matnni o'zgartirish
                  </button>
                  <a
                    href="https://t.me/MaklersizUy_Support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm text-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Admin bilan bog'lanish
                  </a>
                </div>
              </div>
            ) : scan ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-left space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tekshiruvdan o'tdi
                  </div>
                  <p className="text-sm text-emerald-800">{scan.message}</p>
                </div>
                <button onClick={handleSubmitListing} className="w-full bg-emerald-700 text-white font-black py-4 rounded-xl text-base">
                  E'lonni chiqarish
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
