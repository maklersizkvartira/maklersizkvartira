/**
 * API Service Abstraction Layer (Readme-5 & Readme-6 Architecture)
 * Maps REST API endpoints /api/v1/* to the platform state
 */
import { Listing, VerificationRequest, ReportItem, ChatMessage } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';

export const API_BASE_URL = '/api/v1';

export const ApiService = {
  // Public Listings API
  getListings: async (params?: Record<string, any>): Promise<Listing[]> => {
    return Promise.resolve(MOCK_LISTINGS);
  },

  getListingById: async (id: string): Promise<Listing | undefined> => {
    const listing = MOCK_LISTINGS.find((l) => l.id === id);
    return Promise.resolve(listing);
  },

  createListing: async (listingData: Partial<Listing>): Promise<Listing> => {
    const newListing = { ...MOCK_LISTINGS[0], ...listingData, id: `listing-${Date.now()}` };
    return Promise.resolve(newListing as Listing);
  },

  // Verification API
  submitVerification: async (data: any): Promise<{ success: boolean; xpEarned: number }> => {
    return Promise.resolve({ success: true, xpEarned: 50 });
  },

  getVerificationQueue: async (): Promise<VerificationRequest[]> => {
    return Promise.resolve(MOCK_VERIFICATIONS);
  },

  // Fraud & Moderation Admin API
  getFraudSignals: async () => {
    return Promise.resolve(MOCK_FRAUD_SIGNALS);
  },

  getReports: async (): Promise<ReportItem[]> => {
    return Promise.resolve(MOCK_REPORTS);
  },

  // Chat API
  sendMessage: async (conversationId: string, text: string): Promise<ChatMessage> => {
    return Promise.resolve({
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'tenant_current',
      senderName: 'Siz',
      senderRole: 'TENANT',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }
};
