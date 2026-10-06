/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CallsignMapping {
  atcCallsign: string;       // e.g. "IBS16LJ" (Transponder broadcast)
  commercialFlight: string;  // e.g. "IB1675" or "I21675" (Ticket / Commercial)
  airline?: string;          // e.g. "Iberia Express"
  originIata?: string;       // e.g. "MAD"
  destinationIata?: string;  // e.g. "PMI"
  source?: 'user' | 'auto_route' | 'excel' | 'system';
  updatedAt: number;
}

const STORAGE_KEY = 'ircap_callsign_mappings';

// Pre-seeded database of common European ATC callsigns ↔ Commercial flights
export const DEFAULT_CALLSIGN_MAPPINGS: CallsignMapping[] = [
  {
    atcCallsign: 'IBS16LJ',
    commercialFlight: 'IB1675',
    airline: 'Iberia Express',
    originIata: 'MAD',
    destinationIata: 'PMI',
    source: 'system',
    updatedAt: Date.now()
  },
  {
    atcCallsign: 'IBS1675',
    commercialFlight: 'IB1675',
    airline: 'Iberia Express',
    originIata: 'MAD',
    destinationIata: 'PMI',
    source: 'system',
    updatedAt: Date.now()
  },
  {
    atcCallsign: 'IBE3112',
    commercialFlight: 'IB3112',
    airline: 'Iberia',
    originIata: 'MAD',
    destinationIata: 'LIS',
    source: 'system',
    updatedAt: Date.now()
  },
  {
    atcCallsign: 'RYR45LJ',
    commercialFlight: 'FR4511',
    airline: 'Ryanair',
    originIata: 'STN',
    destinationIata: 'MAD',
    source: 'system',
    updatedAt: Date.now()
  },
  {
    atcCallsign: 'VLG12AB',
    commercialFlight: 'VY1234',
    airline: 'Vueling',
    originIata: 'BCN',
    destinationIata: 'MAD',
    source: 'system',
    updatedAt: Date.now()
  }
];

// ICAO ↔ IATA Airline prefix lookup dictionary
export const AIRLINE_PREFIX_MAP: Record<string, { icao: string; iata: string[]; name: string; altNames: string[] }> = {
  IBS: { icao: 'IBS', iata: ['I2', 'IB'], name: 'Iberia Express', altNames: ['IBERIA EXPRESS', 'IBERIA'] },
  IBE: { icao: 'IBE', iata: ['IB'], name: 'Iberia', altNames: ['IBERIA', 'IBERIA AIRLINES'] },
  VLG: { icao: 'VLG', iata: ['VY'], name: 'Vueling', altNames: ['VUELING', 'VUELING AIRLINES'] },
  AEA: { icao: 'AEA', iata: ['UX'], name: 'Air Europa', altNames: ['AIR EUROPA', 'EUROPA'] },
  ANE: { icao: 'ANE', iata: ['YW', 'IB'], name: 'Air Nostrum', altNames: ['AIR NOSTRUM', 'IBERIA REGIONAL'] },
  RYR: { icao: 'RYR', iata: ['FR'], name: 'Ryanair', altNames: ['RYANAIR'] },
  RUK: { icao: 'RUK', iata: ['RK'], name: 'Ryanair UK', altNames: ['RYANAIR UK'] },
  EZY: { icao: 'EZY', iata: ['U2'], name: 'easyJet', altNames: ['EASYJET'] },
  EJU: { icao: 'EJU', iata: ['EC'], name: 'easyJet Europe', altNames: ['EASYJET EUROPE'] },
  BAW: { icao: 'BAW', iata: ['BA'], name: 'British Airways', altNames: ['BRITISH AIRWAYS'] },
  DLH: { icao: 'DLH', iata: ['LH'], name: 'Lufthansa', altNames: ['LUFTHANSA'] },
  AFR: { icao: 'AFR', iata: ['AF'], name: 'Air France', altNames: ['AIR FRANCE'] },
  KLM: { icao: 'KLM', iata: ['KL'], name: 'KLM', altNames: ['KLM ROYAL DUTCH AIRLINES'] },
  TAP: { icao: 'TAP', iata: ['TP'], name: 'TAP Air Portugal', altNames: ['TAP', 'TAP PORTUGAL'] },
  SWR: { icao: 'SWR', iata: ['LX'], name: 'Swiss', altNames: ['SWISS', 'SWISS INTERNATIONAL AIR LINES'] },
  THY: { icao: 'THY', iata: ['TK'], name: 'Turkish Airlines', altNames: ['TURKISH AIRLINES'] },
  WZZ: { icao: 'WZZ', iata: ['W6'], name: 'Wizz Air', altNames: ['WIZZ AIR'] },
  VOE: { icao: 'VOE', iata: ['V7'], name: 'Volotea', altNames: ['VOLOTEA'] }
};

/**
 * Retrieve all registered ATC ↔ Commercial flight mappings from localStorage
 */
export function getCallsignMappings(): CallsignMapping[] {
  if (typeof window === 'undefined') return DEFAULT_CALLSIGN_MAPPINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CALLSIGN_MAPPINGS));
      return DEFAULT_CALLSIGN_MAPPINGS;
    }
    const parsed: CallsignMapping[] = JSON.parse(raw);
    
    // Ensure default mappings exist
    const map = new Map<string, CallsignMapping>();
    DEFAULT_CALLSIGN_MAPPINGS.forEach((m) => map.set(m.atcCallsign.toUpperCase(), m));
    parsed.forEach((m) => map.set(m.atcCallsign.toUpperCase(), m));
    return Array.from(map.values());
  } catch {
    return DEFAULT_CALLSIGN_MAPPINGS;
  }
}

/**
 * Save or update a callsign cross-reference mapping
 */
export function saveCallsignMapping(mapping: Omit<CallsignMapping, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getCallsignMappings();
    const cleanAtc = mapping.atcCallsign.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanComm = mapping.commercialFlight.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!cleanAtc || !cleanComm) return;

    const updated: CallsignMapping[] = current.filter((m) => m.atcCallsign.toUpperCase() !== cleanAtc);
    updated.push({
      ...mapping,
      atcCallsign: cleanAtc,
      commercialFlight: cleanComm,
      updatedAt: Date.now()
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error saving callsign mapping:', e);
  }
}

/**
 * Delete a specific mapping
 */
export function deleteCallsignMapping(atcCallsign: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getCallsignMappings();
    const clean = atcCallsign.trim().toUpperCase();
    const filtered = current.filter((m) => m.atcCallsign.toUpperCase() !== clean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error deleting callsign mapping:', e);
  }
}

/**
 * Reset mappings to defaults
 */
export function resetCallsignMappings(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CALLSIGN_MAPPINGS));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Helper to check if two airline names or codes represent the same airline
 */
export function matchAirline(carrierA?: string, carrierB?: string): boolean {
  if (!carrierA || !carrierB) return true; // If one is unknown, don't rule out
  const a = carrierA.trim().toUpperCase();
  const b = carrierB.trim().toUpperCase();
  if (a === b) return true;

  for (const info of Object.values(AIRLINE_PREFIX_MAP)) {
    const allIdentifiers = [info.icao, ...info.iata, info.name.toUpperCase(), ...info.altNames];
    const aMatches = allIdentifiers.some((id) => a.includes(id) || id.includes(a));
    const bMatches = allIdentifiers.some((id) => b.includes(id) || id.includes(b));
    if (aMatches && bMatches) return true;
  }

  return false;
}

/**
 * Resolve commercial flight number from an ATC callsign (e.g. "IBS16LJ" -> "IB1675")
 */
export function resolveCommercialFlight(callsign: string): string | null {
  const clean = callsign.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;

  const mappings = getCallsignMappings();
  const found = mappings.find((m) => m.atcCallsign.toUpperCase() === clean);
  return found ? found.commercialFlight : null;
}

/**
 * Resolve ATC callsign from a commercial flight number (e.g. "IB1675" -> "IBS16LJ")
 */
export function resolveAtcCallsign(flightNumber: string): string | null {
  const clean = flightNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;

  const mappings = getCallsignMappings();
  const found = mappings.find((m) => m.commercialFlight.toUpperCase() === clean);
  return found ? found.atcCallsign : null;
}

export interface RouteMatchResult {
  matchedRoute: any;
  commercialFlight: string;
  atcCallsign: string;
  matchType: 'direct' | 'mapping' | 'route_pair' | 'prefix_normalized';
}

/**
 * Core Cross-Referencing Resolver Engine
 * Searches the stored flight database (customRoutes) for a flight matching the given callsign/flight number.
 * Supports:
 *  1. Direct callsign or flight_number match
 *  2. Explicit mapping match (e.g. IBS16LJ -> IB1675)
 *  3. Route-pair match (same origin IATA + destination IATA + matching airline)
 *  4. Prefix normalization (e.g. IBS1675 <-> IB1675 <-> I21675)
 */
export function findRouteInDatabase(
  rawInput: string,
  customRoutes: any[],
  routeHint?: { originIata?: string; destinationIata?: string; airlineName?: string }
): RouteMatchResult | null {
  if (!rawInput || !customRoutes || customRoutes.length === 0) return null;

  const clean = rawInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const mappings = getCallsignMappings();

  // 1. Direct Match in customRoutes
  const directMatch = customRoutes.find((r) => {
    const c1 = (r.callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c2 = (r.callsign_iata || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c3 = (r.atcCallsign || r.atc_callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c4 = (r.flightNumber || r.flight_number || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c1 === clean || c2 === clean || c3 === clean || c4 === clean;
  });

  if (directMatch) {
    const comm = directMatch.flightNumber || directMatch.callsign_iata || directMatch.callsign;
    const atc = directMatch.atcCallsign || directMatch.atc_callsign || clean;
    return {
      matchedRoute: directMatch,
      commercialFlight: comm,
      atcCallsign: atc,
      matchType: 'direct'
    };
  }

  // 2. Explicit Callsign Mapping Match (e.g. IBS16LJ -> IB1675)
  const mappedToComm = mappings.find((m) => m.atcCallsign.toUpperCase() === clean);
  if (mappedToComm) {
    const targetComm = mappedToComm.commercialFlight.toUpperCase();
    const route = customRoutes.find((r) => {
      const c1 = (r.callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const c2 = (r.callsign_iata || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const c4 = (r.flightNumber || r.flight_number || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return c1 === targetComm || c2 === targetComm || c4 === targetComm;
    });

    if (route) {
      return {
        matchedRoute: route,
        commercialFlight: targetComm,
        atcCallsign: clean,
        matchType: 'mapping'
      };
    }
  }

  // Inverse Mapping: searching by commercial number (e.g. IB1675 -> IBS16LJ)
  const mappedToAtc = mappings.find((m) => m.commercialFlight.toUpperCase() === clean);
  if (mappedToAtc) {
    const targetAtc = mappedToAtc.atcCallsign.toUpperCase();
    const route = customRoutes.find((r) => {
      const c1 = (r.callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const c3 = (r.atcCallsign || r.atc_callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return c1 === targetAtc || c3 === targetAtc;
    });

    if (route) {
      return {
        matchedRoute: route,
        commercialFlight: clean,
        atcCallsign: targetAtc,
        matchType: 'mapping'
      };
    }
  }

  // 3. Prefix Normalization Match (e.g. IBS1675 <-> IB1675 <-> I21675)
  // Extract airline prefix & numeric digits
  const prefixMatch = clean.match(/^([A-Z]{2,3})(\d+)([A-Z]{0,2})$/);
  if (prefixMatch) {
    const [, carrierCode, flightNumStr] = prefixMatch;
    // Check known variations for this carrier
    const info = AIRLINE_PREFIX_MAP[carrierCode];
    if (info) {
      const allPossiblePrefixes = [info.icao, ...info.iata];
      const possibleFlightIds = allPossiblePrefixes.map((p) => `${p}${flightNumStr}`);

      for (const possibleId of possibleFlightIds) {
        const found = customRoutes.find((r) => {
          const c1 = (r.callsign || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          const c2 = (r.callsign_iata || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          return c1 === possibleId || c2 === possibleId;
        });

        if (found) {
          // Register dynamic mapping
          saveCallsignMapping({
            atcCallsign: clean,
            commercialFlight: found.callsign,
            airline: info.name,
            source: 'auto_route'
          });

          return {
            matchedRoute: found,
            commercialFlight: found.callsign,
            atcCallsign: clean,
            matchType: 'prefix_normalized'
          };
        }
      }
    }
  }

  // 4. Route-Pair Cross-Referencing Match (Origin IATA + Destination IATA + Airline)
  if (routeHint?.originIata && routeHint?.destinationIata) {
    const orig = routeHint.originIata.trim().toUpperCase();
    const dest = routeHint.destinationIata.trim().toUpperCase();

    // Look for routes in database between the same origin and destination
    const candidateRoutes = customRoutes.filter((r) => {
      const rOrig = (r.origin?.iata_code || r.origin?.iata || '').trim().toUpperCase();
      const rDest = (r.destination?.iata_code || r.destination?.iata || '').trim().toUpperCase();
      return rOrig === orig && rDest === dest;
    });

    if (candidateRoutes.length > 0) {
      // Find candidate matching airline
      const airlineMatch = candidateRoutes.find((r) => {
        const rAirline = r.airline?.name || '';
        return matchAirline(rAirline, routeHint.airlineName || clean);
      }) || candidateRoutes[0]; // If only 1 route between airports, high probability match

      if (airlineMatch) {
        // Automatically save this learned mapping so it's persisted permanently!
        saveCallsignMapping({
          atcCallsign: clean,
          commercialFlight: airlineMatch.callsign,
          airline: airlineMatch.airline?.name || routeHint.airlineName,
          originIata: orig,
          destinationIata: dest,
          source: 'auto_route'
        });

        return {
          matchedRoute: airlineMatch,
          commercialFlight: airlineMatch.callsign,
          atcCallsign: clean,
          matchType: 'route_pair'
        };
      }
    }
  }

  return null;
}
