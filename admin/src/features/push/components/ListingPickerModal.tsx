'use client';

import { useState, useEffect, useTransition } from 'react';
import { Search, Home, MapPin, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushListingItem } from '@/shared/api/types';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';

interface ListingPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (listing: PushListingItem) => void;
  selectedId?: string | null;
}

export function ListingPickerModal({
  open,
  onClose,
  onSelect,
  selectedId,
}: ListingPickerModalProps) {
  const t = useTranslations('pushPage.picker');
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<PushListingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Load listings whenever modal opens or query changes (with debounce)
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      setLoading(true);
      http
        .get<PushListingItem[]>(api.push.listings({ q: query.trim() || undefined, limit: 12 }))
        .then((data) => {
          startTransition(() => {
            setListings(Array.isArray(data) ? data : []);
          });
        })
        .catch(() => {
          setListings([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query]);

  const formatPrice = (price: number, currency: string) => {
    const formatted = new Intl.NumberFormat('uz-UZ').format(price);
    return `${formatted} ${currency === 'USD' ? '$' : 'soʻm'}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      subtitle="Foydalanuvchilarga tavsiya sifatida yuboriladigan eʼlonni tanlang"
      size="xl"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm"
          />
        </div>

        {/* Listings List */}
        <div className="max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {loading && listings.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Eʼlonlar qidirilmoqda...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Home className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">{t('empty')}</p>
            </div>
          ) : (
            listings.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className={`group flex items-center gap-3.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 relative border border-slate-200/50 dark:border-slate-700/50">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Home className="w-6 h-6 opacity-50" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      {item.rooms && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0">
                          {item.rooms} xonali
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{item.district || 'Toshkent'}</span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatPrice(item.price, item.currency)}
                    </div>
                  </div>

                  {/* Select button */}
                  <div className="flex-shrink-0">
                    <Button
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      className="rounded-lg text-xs"
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Tanlangan
                        </>
                      ) : (
                        t('select')
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
