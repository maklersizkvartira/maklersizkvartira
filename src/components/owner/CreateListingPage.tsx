import React, { useState } from 'react';
import { PlusCircle, Upload, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';
import { MOCK_OWNERS } from '../../data/mockUsers';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { ApiService } from '../../services/apiService';
import { ListingScanResult } from '../../services/aiGuard';
import { writeListingCopy, estimatePrice, analyzePhotos, scanListingDeep, formatSom } from '../../services/aiEngine';

export const CreateListingPage: React.FC = () => {
  const { addListing, setCurrentView, currentUser, setShowAuth, listings } = useAppStore();

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
  const [images] = useState<string[]>([
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200'
  ]);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scan, setScan] = useState<ListingScanResult | null>(null);

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

  const runScan = async () => {
    setStep(4);
    setIsScanningAI(true);
    setScan(null);
    const titleText = title || `${region}, ${district} tumanida shinam ${rooms} xonali kvartira`;
    const descText = description || "To'g'ridan-to'g'ri egasidan shinam kvartira.";
    const local = scanListingDeep(titleText, descText, price, rooms, {
      phone: currentUser.phone,
      images,
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
      latitude: 41.3110,
      longitude: 69.2790,
      metroStation: metro !== "Yo'q" ? metro : undefined,
      metroDistanceMinutes: metroDist,
      furnished,
      petsAllowed: pets,
      parking,
      internet: true,
      airConditioning: true,
      washingMachine: true,
      images,
      hasVirtualTour: true,
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
              <label className="font-bold text-slate-700 text-sm">Ko'cha va uy</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Masalan: Mustaqillik ko'chasi, 15-uy" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium mt-1" />
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
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">Rasmlar</h3>
            <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-2xl p-6 text-center space-y-2">
              <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-800">Hozircha namuna rasmlar qo'yildi</div>
              <p className="text-sm text-slate-500">Keyin o'z rasmlaringizni yuklaysiz.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200">
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {(() => {
              const photo = analyzePhotos({ rooms, furnished, images, washingMachine: true, airConditioning: true });
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-sm">
                  <div className="font-black text-slate-900 mb-1">AI rasm tahlili</div>
                  <div className="text-slate-700">Xonalar: {photo.roomsFound.join(', ')}</div>
                  <div className="text-slate-700">{photo.furnishedText}. {photo.condition}</div>
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
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                  <div className="font-black text-rose-900 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-5 h-5" /> E'lon joylanmadi
                  </div>
                  <p className="text-sm text-rose-800 leading-relaxed">{scan.message}</p>
                  <ul className="text-sm text-rose-700 mt-2 space-y-1">
                    {scan.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setStep(1)} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl">
                  Matnni o'zgartirish
                </button>
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
