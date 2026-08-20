import React, { useEffect } from 'react';
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
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-emerald-600 text-white">
        <div className="flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl mb-6 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest uppercase mb-2 animate-pulse">Maklersiz.uz</h1>
        <p className="text-xs sm:text-sm font-bold opacity-90 animate-pulse">E'lonlar va xarita yuklanmoqda...</p>
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
              <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 text-center">
                <p className="text-sm font-bold text-emerald-900">
                  Salom, {currentUser.name.split(' ')[0]}. Kvartirani o'zingiz, maklersiz tanlang.
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
