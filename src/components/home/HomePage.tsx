/**
 * The landing page.
 *
 * Composes the home sections in the order they were designed to be read:
 * the promise (hero), what we can actually show you (recommendations), the
 * ways in (categories), and the evidence (trust stats).
 *
 * The prose-and-links block that used to close the page is gone at the
 * owner's request. It carried `hubLinks()`, which is what put every category,
 * district and region hub one click from the root, so nothing links to those
 * pages from here any more — see the note in the handover.
 */

import React from 'react';
import { AIRecommended } from './AIRecommended';
import { HeroSection } from './HeroSection';
import { TrustStats } from './TrustStats';

export const HomePage: React.FC = () => {
  return (
    <>
      <HeroSection />
      <AIRecommended />
      <TrustStats />
    </>
  );
};

export default HomePage;
