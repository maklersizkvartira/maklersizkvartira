/**
 * Payment API client for Click Top-up, Wallet info and Service purchases.
 */

import { http } from './http';

export interface CreateTopUpResponse {
  status: string;
  transactionId: string;
  amount: number;
  clickUrl: string;
  clickCardUrl: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface WalletInfo {
  balance: number;
  isVerified: boolean;
  transactions: WalletTransaction[];
}

export interface BuyServiceResponse {
  status: string;
  message: string;
  balanceAfter: number;
}

export const PaymentApi = {
  /** Create a topup invoice and retrieve Click checkout URLs */
  createTopUp: async (amount: number, returnUrl?: string): Promise<CreateTopUpResponse> => {
    return http.post<CreateTopUpResponse>('/payments/topup', { amount, returnUrl });
  },

  /** Get user balance and transaction history */
  getWalletInfo: async (): Promise<WalletInfo> => {
    return http.get<WalletInfo>('/payments/wallet');
  },

  /** Purchase service using wallet balance */
  buyService: async (
    serviceType: 'VERIFIED_BADGE' | 'TOP_LISTING' | 'VIP_LISTING',
    listingId?: string,
  ): Promise<BuyServiceResponse> => {
    return http.post<BuyServiceResponse>('/payments/buy-service', {
      serviceType,
      listingId,
    });
  },
};
