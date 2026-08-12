import React from 'react';
import { Home, Search, Heart, MessageSquare, Shield } from 'lucide-react';
import { useAppStore, ViewState } from '../../stores/useAppStore';

interface NavItem {
  id: ViewState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNav: React.FC = () => {
  const { currentView, setCurrentView, favorites } = useAppStore();

  const navItems: NavItem[] = [
    { id: 'HOME', label: 'Bosh sahifa', icon: Home },
    { id: 'SEARCH', label: 'Qidiruv', icon: Search },
    { id: 'FAVORITES', label: 'Saralangan', icon: Heart, badge: favorites.length },
    { id: 'CHAT', label: 'Chat', icon: MessageSquare },
    { id: 'VERIFICATION', label: 'Verification', icon: Shield },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all relative ${
              isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
