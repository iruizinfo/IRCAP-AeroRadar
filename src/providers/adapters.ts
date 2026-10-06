/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Aircraft } from '../types/aircraft';

/**
 * Adapter utility class:
 * Normalizes different raw API response models to our clean, unified client-side Aircraft model.
 * Adheres strictly to official API schema shapes. Any missing data is left as null or default.
 */
export class AircraftAdapters {
  
  // Standard ADSBExchange / Readsb v2 Format
  // Used by: adsb.lol, airplanes.live, adsb.fi, ADSB One, Custom, and RapidAPI
  public static adaptAdsbExchangeV2(raw: any, source: string): Aircraft {
    const isGround = raw.alt_baro === 'ground' || raw.gnd === true;
    return {
      hex: (raw.hex || '000000').toLowerCase(),
      callsign: (raw.flight || raw.callsign || '').trim(),
      registration: (raw.r || raw.registration || '').trim(),
      type: raw.t || raw.type || '',
      lat: typeof raw.lat === 'number' ? raw.lat : 0,
      lon: typeof raw.lon === 'number' ? raw.lon : 0,
      altBaroFt: isGround ? 'ground' : (typeof raw.alt_baro === 'number' ? raw.alt_baro : (raw.alt_geom || 0)),
      groundSpeedKt: raw.gs || 0,
      trackDeg: raw.track || raw.true_heading || 0,
      vertRateFpm: raw.baro_rate || raw.geom_rate || 0,
      squawk: raw.squawk || '7000',
      onGround: isGround,
      lastSeenSec: raw.seen || 0,
      source
    };
  }

  // OpenSky Network API format
  // OpenSky /api/states/all response contains an array of states:
  // [0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
  //  5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
  //  10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk,
  //  15: spi, 16: position_source]
  public static adaptOpenSkyState(stateArray: any[], source = 'OpenSky Network'): Aircraft {
    const hex = (stateArray[0] || '000000').toLowerCase();
    const callsign = (stateArray[1] || '').trim();
    const lon = stateArray[5] || 0;
    const lat = stateArray[6] || 0;
    const altMeters = stateArray[7]; // OpenSky returns baro altitude in meters
    const onGround = stateArray[8] === true;
    const speedMps = stateArray[9] || 0; // OpenSky returns speed in m/s
    const track = stateArray[10] || 0;
    const vertRateMps = stateArray[11] || 0; // vertical rate in m/s
    const squawk = stateArray[14] || '7000';

    // Conversions: meters -> feet (1m = 3.28084 ft), m/s -> knots (1m/s = 1.94384 kt), vertical rate m/s -> fpm (1m/s = 196.85 fpm)
    const altFt = onGround ? 'ground' : (altMeters !== null ? Math.round(altMeters * 3.28084) : 0);
    const speedKt = Math.round(speedMps * 1.94384);
    const vertRateFpm = Math.round(vertRateMps * 196.85);

    return {
      hex,
      callsign,
      registration: '', // OpenSky does not provide registration in standard states feed
      type: '', // OpenSky does not provide aircraft type in standard states feed
      lat,
      lon,
      altBaroFt: altFt,
      groundSpeedKt: speedKt,
      trackDeg: track,
      vertRateFpm,
      squawk,
      onGround,
      lastSeenSec: 0,
      source
    };
  }

  // Local Receptor Tar1090 Format
  // Very similar to v2 format, sometimes uses slightly simplified keys
  public static adaptLocalReceptor(raw: any, source = 'Local RTL-SDR'): Aircraft {
    return this.adaptAdsbExchangeV2(raw, source);
  }
}
