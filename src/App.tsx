import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { ShieldMascot } from './components/common/ShieldMascot';

import { HeroSection } from './components/home/HeroSection';
import { QuickCategories } from './components/home/QuickCategories';
import { TrustStats } from './components/home/TrustStats';
import { AIRecommended } from './components/home/AIRecommended';
import { SearchPage } from './components/search/SearchPage';
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
  const { currentView, currentUser, fetchListings, setCurrentView } = useAppStore();
  const isOwner = currentUser?.role === 'OWNER';
  const isStudent = currentUser?.role === 'STUDENT';

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className={`flex-1 min-w-0 w-full pt-14 sm:pt-[5.5rem] ${currentView === 'CHAT' ? 'pb-16 md:pb-0' : 'pb-24 md:pb-0'}`}>
        {currentView === 'HOME' && (
          <>
            {isOwner && (
              <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[11px] shrink-0">Uy Egasi</span>
                    <span className="font-semibold text-slate-300 truncate">Salom, {currentUser.name.split(' ')[0]}. Bosh sahifa va kvartiralar.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setCurrentView('MY_LISTINGS')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg transition-colors hidden sm:inline-block"
                    >
                      Mening e'lonlarim
                    </button>
                    <button
                      onClick={() => setCurrentView('CREATE_LISTING')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      + Yangi e'lon
                    </button>
                  </div>
                </div>
              </div>
            )}

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
