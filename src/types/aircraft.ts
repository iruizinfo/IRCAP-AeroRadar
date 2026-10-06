/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Aircraft {
  hex: string;
  callsign: string;
  registration: string;
  type: string;
  lat: number;
  lon: number;
  altBaroFt: number | 'ground';
  groundSpeedKt: number;
  trackDeg: number;
  vertRateFpm: number;
  squawk: string;
  onGround: boolean;
  lastSeenSec: number;
  source: string;
}

export interface Airport {
  id: string;
  ident: string;
  name: string;
  lat: number;
  lon: number;
  elevationFt: number;
  continent: string;
  isoCountry: string;
  municipality: string;
  scheduledService: string;
  iataCode: string;
  type: 'large_airport' | 'medium_airport' | string;
}

export interface ProviderStatusInfo {
  id: string;
  name: string;
  active: boolean;
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
  latencyMs: number;
}

export interface EnrichmentData {
  route?: {
    origin: { iata: string; name: string; city: string; latitude?: number; longitude?: number };
    destination: { iata: string; name: string; city: string; latitude?: number; longitude?: number };
    airline: { name: string; iata: string };
    flightNumber?: string;
    callsign?: string;
    matchType?: string;
  };
  photo?: {
    url: string;
    photographer: string;
    thumbnailUrl: string;
  };
}

export type UnitsSystem = 'metric' | 'imperial';
export type LanguageCode = 'es' | 'en';
