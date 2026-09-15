/**
 * Payment API client for Click Top-up, Wallet info and Service purchases.
 */

import { http } from './http';

export type PaymentGateway = 'click' | 'payme' | 'uzum';

export interface CreateTopUpResponse {
  status: string;
  transactionId: string;
  amount: number;
  clickUrl?: string;
  clickCardUrl?: string;
  paymeUrl?: string;
  uzumUrl?: string;
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
  /** Create a topup invoice and retrieve checkout URLs for Click, Payme or Uzum */
  createTopUp: async (
    amount: number,
    returnUrl?: string,
    gateway: PaymentGateway = 'click',
  ): Promise<CreateTopUpResponse> => {
    const payload: { amount: number; returnUrl?: string; gateway: string } = {
      amount,
      gateway,
    };
    if (returnUrl) payload.returnUrl = returnUrl;
    return http.post<CreateTopUpResponse>('/payments/topup', payload);
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
