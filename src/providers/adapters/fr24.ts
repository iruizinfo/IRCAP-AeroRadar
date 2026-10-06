/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Aircraft } from '../../types/aircraft';

/**
 * Adapter for Flightradar24 API responses.
 * Maps the compact array format used by the FR24 /bounds endpoint to the standard Aircraft model.
 */
export const adaptFr24BoundsResponse = (rawArray: any[], source = 'Flightradar24'): Aircraft => {
  // Mapping schema based on FR24 API documentation for bounds endpoint:
  // [0: flight_id, 1: latitude, 2: longitude, 3: track, 4: altitude, 5: speed,
  //  6: squawk, 7: radar_id, 8: type, 9: registration, 10: time, 11: origin,
  //  12: destination, 13: flight_number, 14: on_ground, 15: vertical_rate,
  //  16: hex, 17: airline]

  const lat = rawArray[1] ?? 0;
  const lon = rawArray[2] ?? 0;
  const track = rawArray[3] ?? 0;
  const altFt = rawArray[4] ?? 0;
  const speedKt = rawArray[5] ?? 0;
  const squawk = rawArray[6] ?? '7000';
  const type = rawArray[8] ?? 'UNK';
  const registration = rawArray[9] ?? 'N/A';
  const onGround = rawArray[14] === 1 || rawArray[14] === true;
  const vertRateFpm = rawArray[15] ?? 0;
  const hex = (rawArray[16] ?? '000000').toLowerCase();
  const callsign = rawArray[13] ?? 'N/A';

  return {
    hex,
    callsign,
    registration,
    type,
    lat,
    lon,
    altBaroFt: onGround ? 'ground' : altFt,
    groundSpeedKt: speedKt,
    trackDeg: track,
    vertRateFpm,
    squawk,
    onGround,
    lastSeenSec: 0, // FR24 bounds endpoint doesn't provide explicit 'seen' in array
    source
  };
};

/**
 * Adapter for Flightradar24 flight-playback endpoint (Enrichment).
 * Maps detailed flight data to EnrichmentData interface if needed in future.
 */
export const adaptFr24Enrichment = (raw: any) => {
  // TODO: Implement based on FR24 enrichment endpoint structure when configured.
  return raw;
};
