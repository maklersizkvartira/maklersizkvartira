/**
 * The landing page.
 *
 * Composes the home sections in the order they were designed to be read:
 * the promise (hero), the ways in (categories), what we can actually show you
 * (recommendations), and the evidence (trust stats).
 */

import React from 'react';

import { AIRecommended } from './AIRecommended';
import { HeroSection } from './HeroSection';
import { QuickCategories } from './QuickCategories';
import { TrustStats } from './TrustStats';

export const HomePage: React.FC = () => (
  <>
    <HeroSection />
    <QuickCategories />
    <AIRecommended />
    <TrustStats />
  </>
);

export default HomePage;
