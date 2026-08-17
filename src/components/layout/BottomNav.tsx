import React from 'react';
import { Home, Search, Heart, MessageSquare, PlusCircle, User, List } from 'lucide-react';
import { useAppStore, ViewState } from '../../stores/useAppStore';

interface NavItem {
  id: ViewState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNav: React.FC = () => {
  const { currentView, setCurrentView, favorites, currentUser, setShowAuth } = useAppStore();
  const isOwner = currentUser?.role === 'OWNER';

  const navItems: NavItem[] = isOwner
    ? [
        { id: 'HOME', label: 'Bosh', icon: Home },
        { id: 'CREATE_LISTING', label: "E'lon", icon: PlusCircle },
        { id: 'MY_LISTINGS', label: "E'lonlarim", icon: List },
        { id: 'CHAT', label: 'Chat', icon: MessageSquare },
        { id: 'PROFILE', label: 'Profil', icon: User },
      ]
    : [
        { id: 'HOME', label: 'Bosh', icon: Home },
        { id: 'SEARCH', label: 'Qidiruv', icon: Search },
        { id: 'FAVORITES', label: 'Sevimli', icon: Heart, badge: favorites.length },
        { id: 'CHAT', label: 'Chat', icon: MessageSquare },
        { id: currentUser ? 'PROFILE' : 'HOME', label: currentUser ? 'Profil' : 'Kirish', icon: User },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] pb-safe">
      <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isAuthShortcut = !currentUser && !isOwner && item.label === 'Kirish';
          const isActive = !isAuthShortcut && currentView === item.id;
          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => {
                if (isAuthShortcut) setShowAuth(true);
                else setCurrentView(item.id);
              }}
              className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl ${
                isActive ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl ${isActive ? 'bg-emerald-50' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] leading-none truncate w-full text-center ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
