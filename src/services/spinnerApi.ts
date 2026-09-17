/**
 * Spinner & Coin Mini App API Client
 */

import { http } from './http';

export interface SpinnerSector {
  index: number;
  label: string;
  coins: number;
  color: string;
  textColor?: string;
}

export interface SpinnerStatus {
  coins: number;
  canFreeSpin: boolean;
  secondsUntilNextFreeSpin: number;
  paidSpinsAvailable: number;
  balanceUzs: number;
  userRank: number;
  sectors: SpinnerSector[];
  spinCostUzs: number;
  spinsPerPurchase: number;
  minWithdrawalUzs: number;
  maxWithdrawalUzs: number;
  coinToUzsRate: number;
}

export interface SpinResult {
  sectorIndex: number;
  prizeType: string;
  coinsWon: number;
  newCoinsTotal: number;
  canFreeSpin: boolean;
  paidSpinsAvailable: number;
  message: string;
}

export interface BuySpinsResponse {
  status: string;
  paidSpinsAvailable: number;
  newBalance: number;
  message: string;
}

export interface LeaderboardItem {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  coins: number;
  isCurrentUser: boolean;
}

export interface LeaderboardData {
  topUsers: LeaderboardItem[];
  myRank: number;
  myCoins: number;
  totalParticipants: number;
}

export interface WithdrawResponse {
  status: string;
  requestId: string;
  amountUzs: number;
  coinsDeducted: number;
  remainingCoins: number;
  message: string;
}

export function fetchSpinnerStatus(): Promise<SpinnerStatus> {
  return http.get<SpinnerStatus>('/spinner/status');
}

export function spinWheel(usePaid: boolean = false): Promise<SpinResult> {
  return http.post<SpinResult>('/spinner/spin', { usePaid });
}

export function buySpins(): Promise<BuySpinsResponse> {
  return http.post<BuySpinsResponse>('/spinner/buy-spins');
}

export function fetchLeaderboard(): Promise<LeaderboardData> {
  return http.get<LeaderboardData>('/spinner/leaderboard');
}

export function requestWithdrawal(
  cardNumber: string,
  amountUzs: number,
  cardHolder?: string
): Promise<WithdrawResponse> {
  return http.post<WithdrawResponse>('/spinner/withdraw', {
    cardNumber,
    amountUzs,
    cardHolder,
  });
}

export function redeemCoinsToBalance(coins: number): Promise<{
  status: string;
  addedUzs: number;
  newBalance: number;
  remainingCoins: number;
  message: string;
}> {
  return http.post('/spinner/redeem-balance', { coins });
}

export function redeemCoinsForListing(
  listingId: string,
  serviceType: 'TOP_7_DAYS' | 'VIP_7_DAYS'
): Promise<{
  status: string;
  service: string;
  remainingCoins: number;
  message: string;
}> {
  return http.post('/spinner/redeem-listing', {
    listingId,
    serviceType,
  });
}
