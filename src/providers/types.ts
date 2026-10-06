/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProviderQuotaSchema {
  requestsPerDay?: number;
  requestsPerMonth?: number;
  creditsPerMonth?: number;
  minIntervalSec: number;
}

export type AuthType = 'none' | 'bearer' | 'header-key' | 'oauth2-client-credentials';
export type ProviderCostModel = 'gratuito' | 'créditos' | 'pago';
export type ProviderRole = 'live' | 'enrich' | 'history';

export interface AircraftProvider {
  id: string;
  name: string;
  roles: ProviderRole[];
  authType: AuthType;
  headerName?: string;
  defaultUrl: string;
  quotaSchema: ProviderQuotaSchema;
  costModel: ProviderCostModel;
  licenseLabel: string;
  docUrl: string;
  description: { es: string; en: string };
}

export interface ProviderState {
  id: string;
  enabled: boolean;
  role: 'primary' | 'backup' | 'enrich-only';
  priority: number;
  customUrl?: string;
  monthlyLimitPercent: number; // 80% warning, 100% block
}
