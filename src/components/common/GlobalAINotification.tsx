import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { ApiService } from '../../services/apiService';
import { Listing } from '../../types';
import { EditListingModal } from '../owner/EditListingModal';

export const GlobalAINotification: React.FC = () => {
  const { listings, currentUser, fetchListings, setEditingListing } = useAppStore();

  if (!currentUser) return null;

  // Find any listing belonging to the user that has a WARNING status
  // Specifically looking for the OLX/copied images warning.
  const warningListings = listings.filter(
    (l) => l.owner.id === currentUser.id && l.aiCheckStatus === 'WARNING'
  );

  if (warningListings.length === 0) return null;

  const handleDelete = async (id: string) => {
    if (window.confirm("E'lonni o'chirishga ishonchingiz komilmi?")) {
      await ApiService.deleteListing(id);
      fetchListings();
    }
  };

  return (
    <>
      {warningListings.map((listing) => (
        <div key={listing.id} className="bg-rose-500 text-white shadow-md relative z-50 animate-fade-in-down">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-start sm:items-center flex-col sm:flex-row justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/20 rounded-lg shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="pt-0.5">
                  <h3 className="font-bold text-sm sm:text-base leading-tight">Diqqat! E'loningiz ommaga ko'rsatilmayapti</h3>
                  <p className="text-rose-100 text-xs sm:text-sm mt-1 leading-snug">
                    <span className="font-semibold text-white">"{listing.title}"</span> — {listing.aiRiskReasons[0] || "Boshqa manbadan ko'chirilgani aniqlandi."} 
                    Agar tahrirlamasangiz, e'lon o'chirib yuboriladi.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                <button
                  onClick={() => setEditingListing(listing)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-rose-600 rounded-lg text-sm font-semibold hover:bg-rose-50 transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Tahrirlash
                </button>
                <button
                  onClick={() => handleDelete(listing.id)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 border border-rose-400 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  O'chirish
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* The modal manages its own visibility via editingListing state */}
      <EditListingModal />
    </>
  );
};
