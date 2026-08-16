import React from 'react';
import { useAppStore } from './stores/useAppStore';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { ShieldMascot } from './components/common/ShieldMascot';

// Page Views
import { HeroSection } from './components/home/HeroSection';
import { QuickCategories } from './components/home/QuickCategories';
import { TrustStats } from './components/home/TrustStats';
import { AIRecommended } from './components/home/AIRecommended';
import { SearchPage } from './components/search/SearchPage';
import { ListingDetailPage } from './components/listing/ListingDetailPage';
import { VerificationPage } from './components/verification/VerificationPage';
import { CreateListingPage } from './components/owner/CreateListingPage';
import { ChatPage } from './components/chat/ChatPage';
import { ReferralPage } from './components/growth/ReferralPage';
import { StudentProgramPage } from './components/student/StudentProgramPage';
import { EcosystemPreviewPage } from './components/ecosystem/EcosystemPreviewPage';
import { FavoritesPage } from './components/favorites/FavoritesPage';
import { AdminPage } from './components/admin/AdminPage';

export const App: React.FC = () => {
  const { currentView } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Header Navigation */}
      <Header />

      {/* Main View Router Switcher */}
      <main className="flex-1 pb-24 md:pb-0 min-w-0 w-full">
        {currentView === 'HOME' && (
          <>
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
        {currentView === 'CHAT' && <ChatPage />}
        {currentView === 'REFERRAL' && <ReferralPage />}
        {currentView === 'STUDENT_PROGRAM' && <StudentProgramPage />}
        {currentView === 'ECOSYSTEM_PREVIEW' && <EcosystemPreviewPage />}
        {currentView === 'FAVORITES' && <FavoritesPage />}
        {currentView === 'ADMIN' && <AdminPage />}
      </main>

      {/* Shield AI Floating Mascot Assistant */}
      <ShieldMascot />

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
