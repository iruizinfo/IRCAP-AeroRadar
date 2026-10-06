/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface ProviderQuotaState {
  requestsToday: number;
  requestsMonth: number;
  creditsThisMonth: number;
  cooldownUntil: number;
  lastRequestTime: number;
}

const QUOTA_STORAGE_KEY = 'aeroradar.quota.v1';

class QuotaManagerImpl {
  private quotaStates: Record<string, ProviderQuotaState> = {};
  private enrichmentCache = new Map<string, { timestamp: number; data: any }>();
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes cache TTL

  constructor() {
    this.loadQuotas();
  }

  private loadQuotas() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (raw) {
        this.quotaStates = JSON.parse(raw);
      }
    } catch {
      // ignore
    }
  }

  private saveQuotas() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(this.quotaStates));
    } catch {
      // ignore
    }
  }

  private getOrInitState(providerId: string): ProviderQuotaState {
    if (!this.quotaStates[providerId]) {
      this.quotaStates[providerId] = {
        requestsToday: 0,
        requestsMonth: 0,
        creditsThisMonth: 0,
        cooldownUntil: 0,
        lastRequestTime: 0
      };
    }
    return this.quotaStates[providerId];
  }

  // Record an API request event and track credits
  public recordRequest(providerId: string, creditsCost = 0) {
    const state = this.getOrInitState(providerId);
    state.requestsToday += 1;
    state.requestsMonth += 1;
    state.creditsThisMonth += creditsCost;
    state.lastRequestTime = Date.now();
    this.saveQuotas();
  }

  // Put a provider in cooldown on errors (e.g. 429)
  public setCooldown(providerId: string, durationSec = 120) {
    const state = this.getOrInitState(providerId);
    state.cooldownUntil = Date.now() + durationSec * 1000;
    this.saveQuotas();
  }

  public isCoolingDown(providerId: string): boolean {
    const state = this.quotaStates[providerId];
    if (!state) return false;
    return Date.now() < state.cooldownUntil;
  }

  public getRemainingCooldownSec(providerId: string): number {
    const state = this.quotaStates[providerId];
    if (!state) return 0;
    const diff = state.cooldownUntil - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  // Calculate dynamic polling interval securely based on quota remaining
  public calculateIntervalSec(providerId: string, minIntervalSec: number, quotaLimit?: number): number {
    if (!quotaLimit) return minIntervalSec;

    const state = this.getOrInitState(providerId);
    const consumed = state.requestsToday;

    // Remaining fraction of the day
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const timeRemainingSec = (endOfDay.getTime() - now.getTime()) / 1000;

    const remainingRequests = Math.max(0, quotaLimit - consumed);
    if (remainingRequests === 0) {
      return 3600; // Lock for an hour if quota is completely depleted
    }

    const calculatedInterval = Math.ceil(timeRemainingSec / remainingRequests);
    return Math.max(minIntervalSec, calculatedInterval);
  }

  // --- ENRICHMENT CACHE ---
  
  public getCachedEnrichment(hex: string): any | null {
    const entry = this.enrichmentCache.get(hex.toLowerCase());
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.enrichmentCache.delete(hex.toLowerCase());
      return null;
    }
    return entry.data;
  }

  public setCachedEnrichment(hex: string, data: any) {
    this.enrichmentCache.set(hex.toLowerCase(), {
      timestamp: Date.now(),
      data
    });
  }

  public setTtl(minutes: number) {
    this.cacheTtlMs = minutes * 60 * 1000;
  }

  public clearCache() {
    this.enrichmentCache.clear();
  }
}

export const QuotaManager = new QuotaManagerImpl();
export type { ProviderQuotaState };
