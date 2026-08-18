import React, { useState } from 'react';
import { X, Save, Edit3, CheckCircle2, Video, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';

export const EditListingModal: React.FC = () => {
  const { editingListing, setEditingListing, updateListing } = useAppStore();

  if (!editingListing) return null;

  const [title, setTitle] = useState(editingListing.title);
  const [description, setDescription] = useState(editingListing.description);
  const [price, setPrice] = useState(editingListing.price);
  const [deposit, setDeposit] = useState(editingListing.depositPrice || 0);
  const [rooms, setRooms] = useState(editingListing.rooms);
  const [area, setArea] = useState(editingListing.area);
  const [floor, setFloor] = useState(editingListing.floor);
  const [totalFloors, setTotalFloors] = useState(editingListing.totalFloors);
  const [region, setRegion] = useState(editingListing.region);
  const [district, setDistrict] = useState(editingListing.district);
  const [address, setAddress] = useState(editingListing.address || '');
  const [metro, setMetro] = useState(editingListing.metroStation || "Yo'q");
  const [metroDist, setMetroDist] = useState(editingListing.metroDistanceMinutes || 5);
  const [videoUrl, setVideoUrl] = useState(editingListing.videoUrl || '');
  const [furnished, setFurnished] = useState(editingListing.furnished);
  const [utilities, setUtilities] = useState(editingListing.utilitiesIncluded);
  const [pets, setPets] = useState(editingListing.petsAllowed);
  const [parking, setParking] = useState(editingListing.parking);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === region) || UZBEKISTAN_REGIONS[0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateListing({
      ...editingListing,
      title,
      description,
      price,
      depositPrice: deposit,
      rooms,
      area,
      floor,
      totalFloors,
      region,
      district,
      address,
      metroStation: metro !== "Yo'q" ? metro : undefined,
      metroDistanceMinutes: metroDist,
      videoUrl: videoUrl.trim() || undefined,
      hasVirtualTour: false,
      furnished,
      utilitiesIncluded: utilities,
      petsAllowed: pets,
      parking,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">E'lonni Tahrirlash</h3>
              <p className="text-xs text-slate-500">Ma'lumotlarni o'zgartiring va saqlang</p>
            </div>
          </div>
          <button
            onClick={() => setEditingListing(null)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Title */}
          <div>
            <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">E'lon Sarlavhasi</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-900 mt-1 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Prices & Rooms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Oylik narx (so'm)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-emerald-600 mt-1 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Depozit (so'm)</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Xonalar</label>
              <select
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold mt-1 focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1 xona</option>
                <option value={2}>2 xona</option>
                <option value={3}>3 xona</option>
                <option value={4}>4+ xona</option>
              </select>
            </div>
          </div>

          {/* Area & Floor */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Maydon (m²)</label>
              <input
                type="number"
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Qavat</label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Jami qavat</label>
              <input
                type="number"
                value={totalFloors}
                onChange={(e) => setTotalFloors(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Viloyat</label>
              <select
                value={region}
                onChange={(e) => {
                  const newReg = e.target.value;
                  setRegion(newReg);
                  const newRegObj = UZBEKISTAN_REGIONS.find((r) => r.name === newReg);
                  if (newRegObj) setDistrict(newRegObj.districts[0]);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold mt-1 focus:outline-none focus:border-emerald-500"
              >
                {UZBEKISTAN_REGIONS.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Tuman</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold mt-1 focus:outline-none focus:border-emerald-500"
              >
                {activeRegionObj.districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Aniq Manzil</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Mustaqillik ko'chasi, 15-uy"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Tavsif</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium mt-1 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Direct Device Video Upload */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Video className="w-4 h-4 text-rose-500" />
                <span>Kvartira Video Sharhi (Qurilmangizdan Yuklash)</span>
              </label>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                Ixtiyoriy
              </span>
            </div>

            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="edit-video-upload-input"
              onChange={(e) => {
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
              }}
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
                    className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 transition-all active:scale-95"
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
                onClick={() => document.getElementById('edit-video-upload-input')?.click()}
                className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/40 hover:bg-rose-50/80 rounded-xl p-4 text-center space-y-2 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <Video className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">
                  📱 Telefoningiz yoki galereyangizdan video tanlang
                </div>
                <p className="text-[11px] text-slate-500">
                  MP4, MOV, WEBM formatdagi video sharhni qurilmangizdan yuklang.
                </p>
                <button
                  type="button"
                  className="bg-white border border-rose-200 text-rose-700 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm hover:bg-rose-100 transition-colors"
                >
                  🎥 Videoni yuklash
                </button>
              </div>
            )}
          </div>

          {/* Amenities checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Mebelli</span>
            </label>
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={utilities} onChange={(e) => setUtilities(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Kommunal kiradi</span>
            </label>
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Uy hayvoni</span>
            </label>
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={parking} onChange={(e) => setParking(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Avto-Parking</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingListing(null)}
              className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>O'zgarishlarni Saqlash</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
