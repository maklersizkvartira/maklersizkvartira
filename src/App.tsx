import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useAppStore } from './stores/useAppStore';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { ShieldMascot } from './components/common/ShieldMascot';
import { GlobalAINotification } from './components/common/GlobalAINotification';

import { HeroSection } from './components/home/HeroSection';
import { QuickCategories } from './components/home/QuickCategories';
import { TrustStats } from './components/home/TrustStats';
import { AIRecommended } from './components/home/AIRecommended';
import { SearchPage } from './components/search/SearchPage';
import { MapView } from './components/map/MapView';
import { ListingDetailPage } from './components/listing/ListingDetailPage';
import { VerificationPage } from './components/verification/VerificationPage';
import { CreateListingPage } from './components/owner/CreateListingPage';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { MyListingsPage } from './components/owner/MyListingsPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { ChatPage } from './components/chat/ChatPage';
import { ReferralPage } from './components/growth/ReferralPage';
import { StudentProgramPage } from './components/student/StudentProgramPage';
import { EcosystemPreviewPage } from './components/ecosystem/EcosystemPreviewPage';
import { FavoritesPage } from './components/favorites/FavoritesPage';
import { AdminPage } from './components/admin/AdminPage';

export const App: React.FC = () => {
  const { currentView, currentUser, fetchListings, setCurrentView, initAuth } = useAppStore();
  const isOwner = currentUser?.role === 'OWNER';
  const isStudent = currentUser?.role === 'STUDENT';
  const [isAppReady, setIsAppReady] = React.useState(false);

  useEffect(() => {
    // 1. Restore session from token — must run before fetchListings
    initAuth();

    // 2. Load listings (also fetches owner's own listings if logged in)
    fetchListings();

    // 3. Auto-refresh listings every 10 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchListings();
    }, 10000);

    // Check for Deep Link URL parameters (e.g. ?listing=listing-1 or ?id=listing-1 or #listing-1)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const listingIdParam = urlParams.get('listing') || urlParams.get('id') || window.location.hash.replace('#', '');
      if (listingIdParam && listingIdParam.trim().length > 0) {
        setCurrentView('LISTING_DETAIL', listingIdParam.trim());
      }
    } catch {}

    try {
      let guestId = sessionStorage.getItem('maklersiz_guest_id');
      if (!guestId) {
        guestId = `guest_${Math.floor(100000 + Math.random() * 900000)}`;
        sessionStorage.setItem('maklersiz_guest_id', guestId);
      }

      fetch('https://maklersizkvartira-production.up.railway.app/api/v1/traffic/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: guestId, page_path: window.location.pathname || '/' }),
      }).catch(() => {});
    } catch (e) {}

    const timer = setTimeout(() => setIsAppReady(true), 1000);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timer);
    };
  }, [fetchListings, setCurrentView, initAuth]);

  if (!isAppReady) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white">
        {/* Minimalist Logo */}
        <div className="flex items-center gap-2">
          <span className="text-3xl sm:text-4xl font-black tracking-tighter text-white">
            MAKLERSIZ<span className="text-emerald-500">UY</span>
          </span>
        </div>

        {/* Minimalist Thin Animated Progress Line */}
        <div className="w-40 h-1 bg-slate-900 rounded-full overflow-hidden mt-8 border border-slate-800">
          <div className="h-full bg-emerald-500 rounded-full animate-pulse transition-all duration-500 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      <Header />
      <GlobalAINotification />

      <main className="flex-1 min-w-0 w-full pt-14 sm:pt-[5.5rem] pb-0">
        {currentView === 'HOME' && (
          <>


            {isStudent && (
              <div className="pt-4 pb-1 bg-slate-950 text-center px-4">
                <p className="text-sm sm:text-base font-extrabold text-slate-300">
                  Salom, <span className="text-emerald-400 font-black">{currentUser.name.split(' ')[0]}</span> 👋 Kvartirani egasidan to'g'ridan-to'g'ri, 0% komissiya bilan tanlang.
                </p>
              </div>
            )}

            <HeroSection />
            <QuickCategories />
            <AIRecommended />
            <TrustStats />
          </>
        )}

        {currentView === 'SEARCH' && <SearchPage />}
        {currentView === 'MAP' && <MapView />}
        {currentView === 'LISTING_DETAIL' && <ListingDetailPage />}
        {currentView === 'VERIFICATION' && <VerificationPage />}
        {currentView === 'CREATE_LISTING' && <CreateListingPage />}
        {currentView === 'MY_LISTINGS' && <MyListingsPage />}
        {currentView === 'PROFILE' && <ProfilePage />}
        {currentView === 'CHAT' && <ChatPage />}
        {currentView === 'REFERRAL' && <ReferralPage />}
        {currentView === 'STUDENT_PROGRAM' && <StudentProgramPage />}
        {currentView === 'ECOSYSTEM_PREVIEW' && <EcosystemPreviewPage />}
        {currentView === 'FAVORITES' && <FavoritesPage />}
        {currentView === 'ADMIN' && <AdminPage />}
      </main>

      {currentView !== 'CHAT' && <ShieldMascot />}
      <BottomNav />
      {currentView !== 'CHAT' && <Footer />}
    </div>
  );
};

export default App;
