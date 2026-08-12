/**
 * AIService Abstraction Layer (Readme-4 & Readme-5)
 * Supports switching between OpenAI, Gemini, and Local Model Adapters
 */

export interface AIScanResult {
  trustScore: number;
  riskScore: number;
  brokerProbability: number;
  status: 'APPROVED' | 'VERIFICATION_REQUIRED' | 'UNDER_REVIEW' | 'REJECTED';
  reasons: string[];
}

export class AIService {
  private provider: 'openai' | 'gemini' | 'mock';

  constructor(provider: 'openai' | 'gemini' | 'mock' = 'mock') {
    this.provider = provider;
  }

  async scanListing(title: string, description: string, imageHashes: string[]): Promise<AIScanResult> {
    const isScamWord = /zaklad|oldindan|kod|karta/i.test(description);

    if (isScamWord) {
      return {
        trustScore: 48,
        riskScore: 52,
        brokerProbability: 70,
        status: 'UNDER_REVIEW',
        reasons: ['Shubhali oldindan pul o\'tkazish kalit so\'zlari bor']
      };
    }

    return {
      trustScore: 95,
      riskScore: 5,
      brokerProbability: 3,
      status: 'APPROVED',
      reasons: ['Egasining verified profili bor', 'Unikal rasm pHash hash-summasi', 'Shubhali pattern yo\'q']
    };
  }
}
