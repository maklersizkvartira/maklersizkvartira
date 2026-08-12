import React, { useState } from 'react';
import { 
  PlusCircle, Upload, CheckCircle2, ShieldCheck, MapPin, Train, 
  DollarSign, Home, AlertTriangle, Sparkles, ArrowRight, ArrowLeft 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';
import { MOCK_OWNERS } from '../../data/mockUsers';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';

export const CreateListingPage: React.FC = () => {
  const { addListing, setCurrentView } = useAppStore();

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
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200'
  ]);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [aiScanDone, setAiScanDone] = useState(false);

  // Live AI Risk Calculator simulation
  const isSuspiciousText = /zaklad|oldindan|kod|kartaga|zudlik|shoshiling/i.test(description);

  const handleAIScan = () => {
    setIsScanningAI(true);
    setTimeout(() => {
      setIsScanningAI(false);
      setAiScanDone(true);
    }, 1500);
  };

  const handleSubmitListing = (e: React.FormEvent) => {
    e.preventDefault();
    const newListing: Listing = {
      id: `listing-${Date.now()}`,
      title: title || `${region}, ${district} tumanida shinam ${rooms} xonali kvartira`,
      description: description || "To'g'ridan-to'g'ri egasidan shinam kvartira.",
      price: price,
      currency: 'UZS',
      depositPrice: deposit,
      utilitiesIncluded: utilities,
      rooms: rooms,
      area: area,
      floor: floor,
      totalFloors: totalFloors,
      propertyType: 'APARTMENT',
      region: region,
      district: district,
      address: address || `${district} ko'chasi, 12-uy`,
      latitude: 41.3110,
      longitude: 69.2790,
      metroStation: metro !== 'Yo\'q' ? metro : undefined,
      metroDistanceMinutes: metroDist,
      furnished: furnished,
      petsAllowed: pets,
      parking: parking,
      internet: true,
      airConditioning: true,
      washingMachine: true,
      images: images,
      hasVirtualTour: true,
      owner: MOCK_OWNERS.owner_jasur,
      trustScore: isSuspiciousText ? 55 : 94,
      riskScore: isSuspiciousText ? 45 : 6,
      aiCheckStatus: isSuspiciousText ? 'UNDER_REVIEW' : 'APPROVED',
      aiRiskReasons: isSuspiciousText 
        ? ['Matnda shubhali kalit so\'zlar aniqlandi'] 
        : ['Egasining verified profili tasdiqlangan', 'Barcha rasmlar o\'ziga xos', 'Maklerlik riski minimal (3%)'],
      safetyBadges: ['VERIFIED_OWNER', 'PROPERTY_VERIFIED', 'AI_CHECKED', 'NO_COMMISSION'],
      createdAt: new Date().toISOString(),
      viewsCount: 1,
      favoritesCount: 0,
      contactCount: 0,
    };

    addListing(newListing);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-6">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-emerald-600" /> Yangi Kvartira E'loni Yaratish
          </h1>
          <p className="text-xs text-slate-500">AI Trust Engine e'loningizni avtomatik skanerlaydi</p>
        </div>

        <button
          onClick={() => setCurrentView('HOME')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Bekor Qilish
        </button>
      </div>

      {/* Wizard Progress Steps */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
        {[
          { num: 1, label: 'Asosiy' },
          { num: 2, label: 'Joylashuv' },
          { num: 3, label: 'Rasmlar' },
          { num: 4, label: 'AI Skaner' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded-xl border transition-all ${
              step === s.num
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : step > s.num
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            {s.num}. {s.label}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-card">
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">1-Bosqich: Kvartira Ma'lumotlari</h3>
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700">E'lon Sarlavhasi</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Yunusobod 19-kvartalda shinam 2 xonali kvartira"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Tavsif (Description)</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kvartirangiz haqida batafsil yozing..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Oylik Narx (so'm)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-sm text-emerald-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Depozit (so'm)</label>
                <input
                  type="number"
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Xonalar Soni</label>
                <select
                  value={rooms}
                  onChange={(e) => setRooms(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-sm"
                >
                  <option value={1}>1 xona</option>
                  <option value={2}>2 xona</option>
                  <option value={3}>3 xona</option>
                  <option value={4}>4+ xona</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              Keyingi Bosqich (Joylashuv) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">2-Bosqich: Viloyat, Tuman va Manzil</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Viloyat / Shahar</label>
                <select
                  value={region}
                  onChange={(e) => {
                    const newReg = e.target.value;
                    setRegion(newReg);
                    const newRegObj = UZBEKISTAN_REGIONS.find((r) => r.name === newReg);
                    if (newRegObj) setDistrict(newRegObj.districts[0]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                >
                  {UZBEKISTAN_REGIONS.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tuman / Shahar</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                >
                  {activeRegionObj.districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Manzil (Ko'cha & Uy)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Masalan: Mustaqillik ko'chasi, 15-uy"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Metro Bekati (Toshkent uchun)</label>
                <select
                  value={metro}
                  onChange={(e) => setMetro(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                >
                  <option value="Yo'q">Yo'q</option>
                  <option value="Oybek">Oybek</option>
                  <option value="Yunusobod">Yunusobod</option>
                  <option value="Beruniy">Beruniy</option>
                  <option value="Mirzo Ulug'bek">Mirzo Ulug'bek</option>
                  <option value="Buyuk Ipak Yo'li">Buyuk Ipak Yo'li</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Metroga Piyoda Masofa (daqiqa)</label>
                <input
                  type="number"
                  value={metroDist}
                  onChange={(e) => setMetroDist(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Orqaga
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Keyingi (Rasmlar)
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 border-b pb-2">3-Bosqich: Kvartira Rasmlari</h3>
            
            <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-2xl p-6 text-center space-y-2">
              <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-800">Kvartiraning tiniq rasmlarini yuklang</div>
              <p className="text-[11px] text-slate-500">AI duplikat rasmlarni va internet rasmlarini tekshiradi.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200">
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-emerald-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                    pHash Verified
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl"
              >
                Orqaga
              </button>
              <button
                onClick={() => {
                  setStep(4);
                  handleAIScan();
                }}
                className="w-2/3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> AI Risk Engine Skaneri ➔
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 text-xs text-center py-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>

            {isScanningAI ? (
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg text-slate-900">Shield AI E'lonni Tahlil Qilmoqda...</h3>
                <p className="text-slate-500">Duplikat rasmlar, maklerlik belgilari va matn xavfsizligi tekshirilmoqda.</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-left space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> AI Verification Natijasi: APPROVED
                  </div>
                  <ul className="text-[11px] text-emerald-800 space-y-1">
                    <li>• Matnda maklerlik yoki firibgarlik shubhasi: 0%</li>
                    <li>• Perceptual Hash (pHash): Unikal rasm (Duplikat topilmadi)</li>
                    <li>• Taxminiy Trust Score: 94 / 100</li>
                  </ul>
                </div>

                {isSuspiciousText && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-left text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 inline mr-1" />
                    <span>Diqqat: Tavsifda "zaklad" yoki "oldindan pul" kalit so'zlari borligi sababli moderator review'ga tushishi mumkin.</span>
                  </div>
                )}

                <button
                  onClick={handleSubmitListing}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-700/20 text-sm transition-transform hover:scale-105"
                >
                  E'lonni Chop Etish (Publish) 🚀
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
