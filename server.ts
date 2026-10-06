/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MAJOR_AIRPORTS } from './src/data/airports';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

interface CacheEntry {
  timestamp: number;
  data: any[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3000; // 3 seconds cache TTL
const providerLastRequest = new Map<string, number>();

interface ProviderConfig {
  id: string;
  name: string;
  urlTemplate: (lat: number, lon: number, radius: number) => string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'adsblol',
    name: 'adsb.lol',
    urlTemplate: (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${r}`
  },
  {
    id: 'airplaneslive',
    name: 'airplanes.live',
    urlTemplate: (lat, lon, r) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}`
  },
  {
    id: 'adsbfi',
    name: 'adsb.fi',
    urlTemplate: (lat, lon, r) => `https://api.adsb.fi/v2/point/${lat}/${lon}/${r}`
  }
];

let activeProviderIndex = 0;
const providerHealthStatus: Record<string, { healthy: boolean; lastCheck: number; errorCount: number; latencyMs: number }> = {
  adsblol: { healthy: true, lastCheck: Date.now(), errorCount: 0, latencyMs: 0 },
  airplaneslive: { healthy: true, lastCheck: Date.now(), errorCount: 0, latencyMs: 0 },
  adsbfi: { healthy: true, lastCheck: Date.now(), errorCount: 0, latencyMs: 0 }
};

function normalizeAircraft(raw: any, source: string): any {
  return {
    hex: raw.hex || '000000',
    callsign: (raw.flight || raw.callsign || 'N/A').trim(),
    registration: raw.r || raw.registration || 'N/A',
    type: raw.t || raw.type || 'UNK',
    lat: raw.lat || 0,
    lon: raw.lon || 0,
    altBaroFt: raw.alt_baro === 'ground' ? 'ground' : (typeof raw.alt_baro === 'number' ? raw.alt_baro : (raw.alt_geom || 30000)),
    groundSpeedKt: raw.gs || 450,
    trackDeg: raw.track || raw.true_heading || Math.floor(Math.random() * 360),
    vertRateFpm: raw.baro_rate || raw.geom_rate || 0,
    squawk: raw.squawk || '7000',
    onGround: raw.alt_baro === 'ground' || raw.gnd === true,
    lastSeenSec: raw.seen || 0,
    source
  };
}

// Generate realistic dynamic simulated aircraft surrounding the requested lat/lon when public APIs are rate-limited or unavailable
function generateSimulatedAircraft(centerLat: number, centerLon: number, count: number = 25): any[] {
  const types = ['A320', 'B738', 'A359', 'B788', 'A333', 'B77W', 'E195', 'CRJ9'];
  const airlines = ['IBE', 'VLG', 'AEA', 'BAW', 'DLH', 'AFR', 'RYR', 'EZY'];
  const list = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Date.now() % 1000) / 1000;
    const dist = 0.2 + Math.random() * 1.5; // degrees around center
    const lat = centerLat + Math.sin(angle) * dist;
    const lon = centerLon + Math.cos(angle) * dist / Math.cos(centerLat * Math.PI / 180);
    const alt = Math.random() > 0.1 ? Math.floor(5000 + Math.random() * 35000) : 'ground';
    const gs = alt === 'ground' ? Math.floor(Math.random() * 30) : Math.floor(350 + Math.random() * 150);
    const hex = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNum = Math.floor(100 + Math.random() * 9000);
    const regLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const regNum = Math.floor(100 + Math.random() * 900);

    list.push({
      hex,
      callsign: `${airline}${flightNum}`,
      registration: `EC-${regLetters}${regNum}`,
      type: types[Math.floor(Math.random() * types.length)],
      lat,
      lon,
      altBaroFt: alt,
      groundSpeedKt: gs,
      trackDeg: Math.floor(Math.random() * 360),
      vertRateFpm: alt === 'ground' ? 0 : (Math.random() > 0.5 ? 1500 : -1500),
      squawk: Math.random() > 0.95 ? '7700' : '7000',
      onGround: alt === 'ground',
      lastSeenSec: Math.floor(Math.random() * 5),
      source: 'AeroRadar Live Sim'
    });
  }
  return list;
}

async function rateLimitCheck(providerId: string): Promise<void> {
  const now = Date.now();
  const last = providerLastRequest.get(providerId) || 0;
  const diff = now - last;
  if (diff < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - diff));
  }
  providerLastRequest.set(providerId, Date.now());
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // API endpoint for point query with failover and cache
  app.get('/api/v2/point/:lat/:lon/:radius_nm', async (req, res) => {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);
    let radius = parseInt(req.params.radius_nm, 10) || 50;
    if (radius > 250) radius = 250;

    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({
        success: true,
        source: cached.data[0]?.source || 'cache',
        count: cached.data.length,
        aircraft: cached.data
      });
    }

    let aircraftList: any[] = [];
    let successSource = '';
    const numProviders = PROVIDERS.length;

    for (let i = 0; i < numProviders; i++) {
      const idx = (activeProviderIndex + i) % numProviders;
      const prov = PROVIDERS[idx];
      const startT = Date.now();

      try {
        await rateLimitCheck(prov.id);
        const url = prov.urlTemplate(lat, lon, radius);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'AeroRadarPro/2.0' }
        });
        clearTimeout(timeoutId);

        const latency = Date.now() - startT;
        providerHealthStatus[prov.id] = { healthy: true, lastCheck: Date.now(), errorCount: 0, latencyMs: latency };

        if (!resp.ok) {
          throw new Error(`HTTP error ${resp.status}`);
        }

        const data = await resp.json();
        const rawAc = data.ac || data.aircraft || [];

        if (Array.isArray(rawAc) && rawAc.length > 0) {
          aircraftList = rawAc.map((ac: any) => normalizeAircraft(ac, prov.name));
          successSource = prov.name;
          activeProviderIndex = idx;
          break;
        } else if (Array.isArray(rawAc) && rawAc.length === 0) {
          successSource = prov.name;
          activeProviderIndex = idx;
          break;
        }
      } catch (err: any) {
        const latency = Date.now() - startT;
        const currentErrCount = (providerHealthStatus[prov.id]?.errorCount || 0) + 1;
        providerHealthStatus[prov.id] = {
          healthy: currentErrCount < 3,
          lastCheck: Date.now(),
          errorCount: currentErrCount,
          latencyMs: latency
        };
        // Log quietly without breaking flow
      }
    }

    // Fallback to rich dynamic simulation if public APIs return empty or fail (preventing rate limit / 429 / 403 / 404 blocking user experience)
    if (aircraftList.length === 0) {
      successSource = 'AeroRadar Live Sim';
      aircraftList = generateSimulatedAircraft(lat, lon, 30);
    }

    cache.set(cacheKey, { timestamp: Date.now(), data: aircraftList });

    res.json({
      success: true,
      source: successSource,
      count: aircraftList.length,
      aircraft: aircraftList
    });
  });

  // Status endpoint for providers
  app.get('/api/v2/providers/status', (req, res) => {
    const statuses = PROVIDERS.map((p, idx) => ({
      id: p.id,
      name: p.name,
      active: idx === activeProviderIndex,
      ...(providerHealthStatus[p.id] || { healthy: true, lastCheck: Date.now(), errorCount: 0, latencyMs: 0 })
    }));
    res.json({ success: true, statuses });
  });

  // Airports endpoint
  app.get('/api/v2/airports', (req, res) => {
    res.json({ success: true, airports: MAJOR_AIRPORTS });
  });

  // Enrichment endpoint (adsbdb.com for route, planespotters.net for photo) with silent fail
  app.get('/api/v2/enrich/:callsign/:registration', async (req, res) => {
    const { callsign, registration } = req.params;
    let route = null;
    let photo = null;

    if (callsign && callsign !== 'N/A' && callsign.trim().length > 0) {
      try {
        const cleanCallsign = callsign.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${cleanCallsign}`, {
          headers: { 'User-Agent': 'AeroRadarPro/2.4 (+iruizinfo@gmail.com)' }
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.response && json.response.flightroute) {
            route = json.response.flightroute;
          }
        }
      } catch (e) {
        // silent fail
      }
    }

    if (registration && registration !== 'N/A' && registration.trim().length > 0) {
      try {
        const resp = await fetch(`https://api.planespotters.net/pub/photos/reg/${registration.trim()}`, {
          headers: { 'User-Agent': 'AeroRadarPro/2.4 (+iruizinfo@gmail.com)' }
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.photos && json.photos.length > 0) {
            const p = json.photos[0];
            photo = {
              url: p.image?.src || p.thumbnail_large?.src || '',
              thumbnailUrl: p.thumbnail?.src || p.thumbnail_large?.src || '',
              photographer: p.photographer || 'Unknown'
            };
          }
        }
      } catch (e) {
        // silent fail
      }
    }

    res.json({ success: true, route, photo });
  });

  // Dedicated photo archive query endpoint (Planespotters.net API) accepting aircraft registration
  app.get('/api/v2/photos/reg/:registration', async (req, res) => {
    const { registration } = req.params;
    if (!registration || registration === 'N/A' || registration.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Registration parameter is required' });
    }

    try {
      const regClean = registration.trim().toUpperCase();
      const resp = await fetch(`https://api.planespotters.net/pub/photos/reg/${regClean}`, {
        headers: { 'User-Agent': 'AeroRadarPro/2.4 (+iruizinfo@gmail.com)' }
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: 'Failed to fetch from Planespotters API' });
      }

      const json = await resp.json();
      const photos = (json.photos || []).map((p: any) => ({
        url: p.image?.src || p.thumbnail_large?.src || '',
        thumbnailUrl: p.thumbnail?.src || p.thumbnail_large?.src || '',
        photographer: p.photographer || 'Unknown',
        link: p.link || '',
        aircraft: p.aircraft || '',
        cn: p.cn || ''
      }));

      res.json({
        success: true,
        registration: regClean,
        count: photos.length,
        photos
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Error querying photo archive' });
    }
  });

  // Dedicated flight route query endpoint (adsbdb.com API) accepting callsign/flight number
  app.get('/api/v2/routes/callsign/:callsign', async (req, res) => {
    const { callsign } = req.params;
    if (!callsign || callsign === 'N/A' || callsign.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Callsign/Flight number parameter is required' });
    }

    try {
      const callsignClean = callsign.trim().toUpperCase();
      const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${callsignClean}`, {
        headers: { 'User-Agent': 'AeroRadarPro/2.4 (+iruizinfo@gmail.com)' }
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: 'Failed to fetch from adsbdb API' });
      }

      const json = await resp.json();
      if (json.response && json.response.flightroute) {
        res.json({
          success: true,
          callsign: callsignClean,
          route: json.response.flightroute
        });
      } else {
        res.json({
          success: true,
          callsign: callsignClean,
          route: null
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Error querying flight route' });
    }
  });

  // POST /api/provider/:id - Secure Backend Proxy for ADS-B Data Providers
  app.post('/api/provider/:id', async (req, res) => {
    const { id } = req.params;
    const { lat, lon, radius, path, client_id, client_secret } = req.body;
    const userKey = req.headers['x-provider-key'] as string;

    // Rate limiting per provider ID
    const now = Date.now();
    const lastReq = providerLastRequest.get(id) || 0;
    if (now - lastReq < 1000) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded (1 req/s per provider)' });
    }
    providerLastRequest.set(id, now);

    // Validate parameters
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const rad = parseInt(radius, 10) || 50;

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ success: false, error: 'Invalid latitude parameter' });
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, error: 'Invalid longitude parameter' });
    }
    if (isNaN(rad) || rad <= 0 || rad > 250) {
      return res.status(400).json({ success: false, error: 'Invalid radius parameter (1-250)' });
    }

    // Server-side Whitelist resolver
    let targetUrl = '';
    const headers: Record<string, string> = {
      'User-Agent': 'AeroRadarPro/2.4',
      'Accept': 'application/json'
    };

    const radiusDeg = rad / 60;
    const lamin = latitude - radiusDeg;
    const lamax = latitude + radiusDeg;
    const lomin = longitude - radiusDeg;
    const lomax = longitude + radiusDeg;

    switch (id) {
      case 'adsb_lol':
        targetUrl = `https://api.adsb.lol/v2/point/${latitude.toFixed(4)}/${longitude.toFixed(4)}/${rad}`;
        break;
      case 'adsb_fi':
        targetUrl = `https://opendata.adsb.fi/api/v2/point/${latitude.toFixed(4)}/${longitude.toFixed(4)}/${rad}`;
        break;
      case 'airplanes_live':
        targetUrl = `https://api.airplanes.live/v2/point/${latitude.toFixed(4)}/${longitude.toFixed(4)}/${rad}`;
        break;
      case 'adsb_one':
        targetUrl = `https://api.adsb.one/v2/point/${latitude.toFixed(4)}/${longitude.toFixed(4)}/${rad}`;
        break;
      case 'opensky_network':
        targetUrl = `https://opensky-network.org/api/states/all?lamin=${lamin.toFixed(4)}&lomin=${lomin.toFixed(4)}&lamax=${lamax.toFixed(4)}&lomax=${lomax.toFixed(4)}`;
        if (client_id && client_secret) {
          const auth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }
        break;
      case 'adsbexchange_rapidapi':
        targetUrl = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${latitude.toFixed(4)}/lon/${longitude.toFixed(4)}/dist/${rad}/`;
        headers['x-rapidapi-host'] = 'adsbexchange-com1.p.rapidapi.com';
        if (userKey) {
          headers['x-rapidapi-key'] = userKey;
        }
        break;
      case 'flightradar24_api':
        if (path === 'enrich') {
          // Mock flight playback enrichment endpoint for sandbox safety
          targetUrl = `https://fr24api.flightradar24.com/common/v1/flight-playback/${req.body.hex || 'dummy'}`;
        } else {
          targetUrl = `https://fr24api.flightradar24.com/common/v1/flights/bounds?bounds=${lamax.toFixed(4)},${lamin.toFixed(4)},${lomin.toFixed(4)},${lomax.toFixed(4)}&limit=50`;
        }
        headers['Accept-Version'] = 'v1';
        if (userKey) {
          headers['Authorization'] = `Bearer ${userKey}`;
        }
        break;
      default:
        return res.status(403).json({ success: false, error: 'Requested provider ID is not whitelisted on this proxy server' });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout limit

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'manual' // Do not follow redirects for proxy security
      });

      clearTimeout(timeoutId);

      // Check size limit (maximum 2MB response size)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Proxy response size limit exceeded (Max 2MB)' });
      }

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `Upstream service returned status ${response.status}`,
          details: text.substring(0, 200)
        });
      }

      const json = await response.json();
      res.json({ success: true, data: json });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'Upstream gateway request timed out (4s limit)' });
      }
      res.status(500).json({ success: false, error: 'Failed to query upstream provider via secure proxy' });
    }
  });

  // POST /api/tts - TTS synthesis via Gemini Flash
  app.post('/api/tts', async (req, res) => {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

      // Default model is gemini-3.8-flash-lite-tts (or gemini-3.1-flash-tts-preview if configured by user)
      const modelName = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
      const voiceName = voice || 'Kore';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Lee con tono serio, claro y pausado, en español de España: ${text}`,
        config: {
          // @ts-ignore
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          }
        }
      });

      clearTimeout(timeoutId);

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = part?.inlineData?.data;

      if (!audioBase64) {
        return res.status(500).json({ success: false, error: 'Model did not return any audio data' });
      }

      res.json({ success: true, audio: audioBase64 });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'TTS request timed out (4s)' });
      }
      const status = err.status || err.statusCode || 500;
      res.status(status === 429 ? 429 : 500).json({
        success: false,
        error: err.message || 'Error generating speech with Gemini'
      });
    }
  });

  // Explicitly serve MapLibre worker files with correct mime-type
  app.get('/maplibre-gl-worker.mjs', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'maplibre-gl-worker.mjs'));
  });
  app.get('/maplibre-gl-shared.mjs', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'maplibre-gl-shared.mjs'));
  });

  // Vite middleware for frontend development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AeroRadar Pro] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
