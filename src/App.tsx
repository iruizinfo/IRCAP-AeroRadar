/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { FiltersModal, FilterState } from './components/FiltersModal';
import { ProvidersModal } from './components/ProvidersModal';
import { PhotoArchiveModal } from './components/PhotoArchiveModal';
import { RouteSearchModal } from './components/RouteSearchModal';
import { Footer } from './components/Footer';
import { Aircraft, Airport, LanguageCode, UnitsSystem, EnrichmentData } from './types/aircraft';
import { StatsOverlay } from './components/StatsOverlay';
import { AudioEngine } from './audio/AudioEngine';
import { useAircraftAlerts } from './hooks/useAircraftAlerts';
import { EmergencyBanner } from './components/EmergencyBanner';
import { useSetting } from './settings/store';
import { SettingsPanel } from './components/SettingsPanel';
import { WidgetHost } from './widgets/registry';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { PROVIDERS_REGISTRY } from './providers/registry';
import { ProviderState } from './providers/types';
import { SecretsManager } from './providers/secrets';
import { QuotaManager } from './providers/quota';
import { AircraftAdapters } from './providers/adapters';
import { adaptFr24BoundsResponse } from './providers/adapters/fr24';
import { findRouteInDatabase, resolveCommercialFlight } from './utils/flightCrossReference';

export default function App() {
  const [lang, setLang] = useSetting<LanguageCode>('general.language');
  const [units, setUnits] = useSetting<UnitsSystem>('map.units');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAirports, setShowAirports] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [activeProviderName, setActiveProviderName] = useState('ADSB.lol');
  const [apiLatency, setApiLatency] = useState(0);
  const [providerStates] = useSetting<ProviderState[]>('data.provider.list');
  const [mergeSources] = useSetting<boolean>('data.provider.merge_sources');
  const [failoverStatus, setFailoverStatus] = useState<string>('');
  const [selectedEnrichment, setSelectedEnrichment] = useState<EnrichmentData | null>(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);
  
  // Modals state
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isProvidersOpen, setIsProvidersOpen] = useState(false);
  const [isPhotoArchiveOpen, setIsPhotoArchiveOpen] = useState(false);
  const [isRouteSearchOpen, setIsRouteSearchOpen] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<FilterState>({
    minAlt: 0,
    maxAlt: 60000,
    minSpeed: 0,
    maxSpeed: 1000,
    hideOnGround: false
  });

  // Current map viewport bounds ref for polling
  const viewportRef = useRef({ lat: 40.4168, lon: -3.7038, radius: 100 });

  // Rich Audio Alert system states & persistent favorites list
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ircap_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'unlocked' | 'suspended' | 'muted' | 'blocked'>(() => {
    if (typeof window === 'undefined') return 'blocked';
    return AudioEngine.getInstance().getStatus();
  });

  const [audioEnabled, setAudioEnabled] = useSetting<boolean>('audio.master.enabled');

  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [mapChangeCount, setMapChangeCount] = useState(0);
  const [simulationAircraft, setSimulationAircraft] = useState<Aircraft | null>(null);
  const [simulationStats, setSimulationStats] = useState<{ latency: number; source: string } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<'Gemini TTS' | 'navegador' | 'sin voz'>(() => {
    if (typeof window === 'undefined') return 'sin voz';
    return AudioEngine.getInstance().getVoiceSourceStatus();
  });

  // Sync state with AudioEngine status on timer and settings changes
  useEffect(() => {
    const audio = AudioEngine.getInstance();
    setAudioStatus(audio.getStatus());
    setVoiceStatus(audio.getVoiceSourceStatus());

    const timer = setInterval(() => {
      setAudioStatus(audio.getStatus());
      setVoiceStatus(audio.getVoiceSourceStatus());
    }, 1000);

    return () => clearInterval(timer);
  }, [audioEnabled]);

  // Synchronize audio enabled/muted updates
  const handleToggleAudio = (enabled: boolean) => {
    setAudioEnabled(enabled);
    AudioEngine.getInstance().saveSettings({ muted: !enabled });
  };

  const handleUnlockAudio = async () => {
    const success = await AudioEngine.getInstance().unlockAudio();
    if (success) {
      setAudioStatus(AudioEngine.getInstance().getStatus());
    }
  };

  // Load airports dataset on mount
  useEffect(() => {
    fetch('/api/v2/airports')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.airports) {
          setAirports(data.airports);
        }
      })
      .catch(() => {});
  }, []);

  const [historyBuffer, setHistoryBuffer] = useState<Record<string, { lat: number; lon: number; timestamp: number }[]>>({});

  // Fetch aircraft data function
  const fetchAircraft = useCallback(async (lat: number, lon: number, radius: number) => {
    const activeLiveProviders = [...providerStates]
      .filter((p) => p.enabled && p.role !== 'enrich-only')
      .sort((a, b) => a.priority - b.priority);

    if (activeLiveProviders.length === 0) {
      // Fallback: simple inline center generation if no provider is selected
      const simList: Aircraft[] = Array.from({ length: 15 }).map((_, i) => {
        const hex = `sim${1000 + i}`;
        return {
          hex,
          callsign: `SIM${100 + i}`,
          registration: `EC-SIM${i}`,
          type: 'A320',
          lat: lat + (Math.sin(i) * 0.1),
          lon: lon + (Math.cos(i) * 0.1),
          altBaroFt: 15000 + (i * 1000),
          groundSpeedKt: 320,
          trackDeg: (i * 24) % 360,
          vertRateFpm: 0,
          squawk: '7000',
          onGround: false,
          lastSeenSec: 0,
          source: 'Simulador Local'
        };
      });
      setAircraftList(simList);
      setActiveProviderName('Simulación Local');
      return;
    }

    const fetchFromProvider = async (state: ProviderState): Promise<Aircraft[] | null> => {
      const def = PROVIDERS_REGISTRY.find((p) => p.id === state.id);
      if (!def) return null;

      if (QuotaManager.isCoolingDown(state.id)) {
        return null;
      }

      const secrets = SecretsManager.getCredentials(state.id);
      const targetUrl = state.customUrl || def.defaultUrl;

      try {
        if (state.id === 'receptor_local') {
          // Direct browser query for local receptor (bypassing the proxy)
          const resp = await fetch(targetUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const rawData = await resp.json();
          const rawList = rawData.aircraft || rawData || [];
          const normalized = Array.isArray(rawList)
            ? rawList.map((ac) => AircraftAdapters.adaptLocalReceptor(ac, 'Local receptor'))
            : [];
          QuotaManager.recordRequest(state.id);
          return normalized;
        } else {
          // Secure query whitelisted endpoints through the proxy
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (secrets.apiKey) {
            headers['X-Provider-Key'] = secrets.apiKey;
          }

          const bodyPayload = {
            lat,
            lon,
            radius,
            client_id: secrets.clientId,
            client_secret: secrets.clientSecret
          };

          const resp = await fetch(`/api/provider/${state.id}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyPayload)
          });

          if (resp.status === 429) {
            QuotaManager.setCooldown(state.id, 120); // 2 minutes cooldown on rate limit
            throw new Error('429 Rate Limit');
          }

          if (!resp.ok) {
            throw new Error(`Upstream status ${resp.status}`);
          }

          const json = await resp.json();
          QuotaManager.recordRequest(state.id);

          let normalized: Aircraft[] = [];
          if (state.id === 'opensky_network') {
            const states = json.data?.states || [];
            normalized = states.map((s: any[]) => AircraftAdapters.adaptOpenSkyState(s, 'OpenSky Network'));
          } else if (state.id === 'flightradar24_api') {
            const flights = json.data?.flights || [];
            normalized = flights.map((f: any[]) => adaptFr24BoundsResponse(f, 'Flightradar24'));
          } else {
            const rawList = json.data?.aircraft || json.data?.ac || json.data || [];
            normalized = Array.isArray(rawList)
              ? rawList.map((ac) => AircraftAdapters.adaptAdsbExchangeV2(ac, def.name))
              : [];
          }

          return normalized;
        }
      } catch (err: any) {
        console.warn(`[App] Polling from ${state.id} failed:`, err.message || err);
        return null;
      }
    };

    const startTime = performance.now();
    let aircraft: Aircraft[] | null = null;
    let chosenSource = '';

    if (mergeSources) {
      // Fetch from all enabled position providers and merge uniquely by Hex code
      const promises = activeLiveProviders.map((p) => fetchFromProvider(p));
      const results = await Promise.all(promises);

      const mergedMap = new Map<string, Aircraft>();
      let hasAnySuccess = false;
      results.forEach((list, idx) => {
        if (!list) return;
        hasAnySuccess = true;
        const pState = activeLiveProviders[idx];
        const pDef = PROVIDERS_REGISTRY.find((pr) => pr.id === pState.id);
        list.forEach((ac) => {
          mergedMap.set(ac.hex, { ...ac, source: pDef?.name || ac.source });
        });
      });

      if (hasAnySuccess) {
        aircraft = Array.from(mergedMap.values());
        chosenSource = `Fusión (${activeLiveProviders.map(p => PROVIDERS_REGISTRY.find(pr => pr.id === p.id)?.name || p.id).join(' + ')})`;
      }
    } else {
      // Standard Priority-based Failover Polling sequence
      for (const provState of activeLiveProviders) {
        const result = await fetchFromProvider(provState);
        if (result !== null) {
          aircraft = result;
          const pDef = PROVIDERS_REGISTRY.find((pr) => pr.id === provState.id);
          chosenSource = pDef?.name || 'ADS-B';
          break; // Stop sequencing down-chain upon success
        } else {
          setFailoverStatus(provState.id);
        }
      }
    }

    const endTime = performance.now();
    setApiLatency(Math.round(endTime - startTime));

    if (aircraft !== null) {
      setAircraftList(aircraft);
      if (chosenSource) {
        setActiveProviderName(chosenSource);
      }

      // Maintain coordinate histories buffer
      setHistoryBuffer((prev) => {
        const now = Date.now();
        const limit = now - 5 * 60 * 1000;
        const next: Record<string, { lat: number; lon: number; timestamp: number }[]> = {};

        Object.keys(prev).forEach((hex) => {
          const filtered = prev[hex].filter((item) => item.timestamp >= limit);
          if (filtered.length > 0) {
            next[hex] = filtered;
          }
        });

        aircraft.forEach((ac) => {
          if (!next[ac.hex]) {
            next[ac.hex] = [];
          }
          const list = next[ac.hex];
          const last = list[list.length - 1];
          if (!last || last.lat !== ac.lat || last.lon !== ac.lon) {
            list.push({ lat: ac.lat, lon: ac.lon, timestamp: now });
          }
        });

        return next;
      });
    }
  }, [providerStates, mergeSources]);

  // Poll aircraft data every 5 seconds based on current viewport
  useEffect(() => {
    const interval = setInterval(() => {
      const { lat, lon, radius } = viewportRef.current;
      fetchAircraft(lat, lon, radius);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAircraft]);

  // Load enrichment (photo & route) for selected aircraft, prioritising local custom Excel DB!
  useEffect(() => {
    if (!selectedAircraft) {
      setSelectedEnrichment(null);
      return;
    }

    let isMounted = true;
    setLoadingEnrichment(true);

    const loadRouteAndPhoto = async () => {
      let customRoute = null;
      let matchedFlightNumber = '';
      let matchType = '';
      let customRoutes: any[] = [];
      const flightClean = selectedAircraft.callsign.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      try {
        const saved = localStorage.getItem('ircap_custom_routes');
        if (saved) {
          customRoutes = JSON.parse(saved);
          const matchResult = findRouteInDatabase(flightClean, customRoutes);
          if (matchResult) {
            customRoute = matchResult.matchedRoute;
            matchedFlightNumber = matchResult.commercialFlight;
            matchType = matchResult.matchType;
          }
        }
      } catch (e) {
        console.error(e);
      }

      if (customRoute) {
        // Resolve coordinates dynamically from the master airports database
        const origIata = customRoute.origin?.iata_code || customRoute.origin?.iata || '';
        const destIata = customRoute.destination?.iata_code || customRoute.destination?.iata || '';
        const originAp = airports.find((a) => a.iataCode?.toUpperCase() === origIata.toUpperCase());
        const destAp = airports.find((a) => a.iataCode?.toUpperCase() === destIata.toUpperCase());

        const adaptedRoute = {
          origin: {
            iata: origIata,
            name: customRoute.origin?.name || `${origIata} Airport`,
            city: customRoute.origin?.municipality || customRoute.origin?.city || origIata,
            latitude: originAp ? originAp.lat : (customRoute.origin?.latitude || 0),
            longitude: originAp ? originAp.lon : (customRoute.origin?.longitude || 0)
          },
          destination: {
            iata: destIata,
            name: customRoute.destination?.name || `${destIata} Airport`,
            city: customRoute.destination?.municipality || customRoute.destination?.city || destIata,
            latitude: destAp ? destAp.lat : (customRoute.destination?.latitude || 0),
            longitude: destAp ? destAp.lon : (customRoute.destination?.longitude || 0)
          },
          airline: {
            name: customRoute.airline?.name || 'Unknown Airline',
            iata: customRoute.airline?.iata || ''
          },
          flightNumber: matchedFlightNumber || customRoute.flightNumber || customRoute.callsign,
          callsign: selectedAircraft.callsign,
          matchType
        };

        try {
          const resp = await fetch(`/api/v2/enrich/N_A/${encodeURIComponent(selectedAircraft.registration)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (isMounted) {
              setSelectedEnrichment({
                route: adaptedRoute,
                photo: data.photo || undefined
              });
              setLoadingEnrichment(false);
            }
          } else {
            if (isMounted) {
              setSelectedEnrichment({ route: adaptedRoute, photo: undefined });
              setLoadingEnrichment(false);
            }
          }
        } catch (e) {
          if (isMounted) {
            setSelectedEnrichment({ route: adaptedRoute, photo: undefined });
            setLoadingEnrichment(false);
          }
        }
      } else {
        // Fetch from API enrich endpoint
        try {
          const resp = await fetch(`/api/v2/enrich/${encodeURIComponent(selectedAircraft.callsign)}/${encodeURIComponent(selectedAircraft.registration)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (isMounted) {
              let finalRoute = data.route;

              // If API returned a route, cross-reference with our stored custom database!
              if (finalRoute && customRoutes.length > 0) {
                const origIata = finalRoute.origin?.iata_code || finalRoute.origin?.iata;
                const destIata = finalRoute.destination?.iata_code || finalRoute.destination?.iata;
                const crossMatch = findRouteInDatabase(flightClean, customRoutes, {
                  originIata: origIata,
                  destinationIata: destIata,
                  airlineName: finalRoute.airline?.name
                });

                if (crossMatch) {
                  finalRoute = {
                    ...finalRoute,
                    flightNumber: crossMatch.commercialFlight,
                    callsign: selectedAircraft.callsign,
                    matchType: crossMatch.matchType
                  };
                }
              }

              // Also check direct callsign mapping store
              if (finalRoute && !finalRoute.flightNumber) {
                const comm = resolveCommercialFlight(flightClean);
                if (comm) {
                  finalRoute = {
                    ...finalRoute,
                    flightNumber: comm,
                    callsign: selectedAircraft.callsign,
                    matchType: 'mapping'
                  };
                }
              }

              setSelectedEnrichment({
                route: finalRoute,
                photo: data.photo || undefined
              });
              setLoadingEnrichment(false);
            }
          } else {
            if (isMounted) setLoadingEnrichment(false);
          }
        } catch (e) {
          if (isMounted) setLoadingEnrichment(false);
        }
      }
    };

    loadRouteAndPhoto();

    // Watch for local custom database changes to immediately update selected aircraft route
    const handleStorageChange = () => {
      loadRouteAndPhoto();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedAircraft]);

  // Handle bounds change from map
  const handleBoundsChange = useCallback((lat: number, lon: number, radiusNm: number) => {
    viewportRef.current = { lat, lon, radius: radiusNm };
    fetchAircraft(lat, lon, radiusNm);
  }, [fetchAircraft]);

  // Triggered when the useAircraftAlerts hook detects a persistent emergency
  const handleTriggerEmergency = useCallback((alert: any) => {
    setEmergencyAlerts((prev) => {
      if (prev.some((a) => a.hex === alert.hex && a.squawk === alert.squawk)) return prev;
      return [...prev, alert];
    });
  }, []);

  const handleDismissEmergency = useCallback((hex: string, squawk: string) => {
    setEmergencyAlerts((prev) => prev.filter((a) => !(a.hex === hex && a.squawk === squawk)));
  }, []);

  const handleCenterAircraft = useCallback((hex: string) => {
    const combined = simulationAircraft ? [...aircraftList, simulationAircraft] : aircraftList;
    const target = combined.find((ac) => ac.hex === hex);
    if (target) {
      setSelectedAircraft(target);
    }
  }, [aircraftList, simulationAircraft]);

  const handleSimulateEmergency = useCallback(() => {
    setSimulationStats(null); // Reset diagnostics for new simulation runs
    const fakeAc: Aircraft = {
      hex: 'SIM7700',
      callsign: 'SIM7700',
      registration: 'EC-SIM',
      type: 'A320-SIM',
      lat: viewportRef.current.lat + 0.04,
      lon: viewportRef.current.lon + 0.04,
      altBaroFt: 14500,
      groundSpeedKt: 340,
      trackDeg: 210,
      vertRateFpm: -1200,
      squawk: '7700',
      onGround: false,
      lastSeenSec: 1,
      source: 'SIMULADOR',
      isSimulation: true
    } as any;

    setSimulationAircraft(fakeAc);

    // Auto-clear simulated emergency after 15 seconds
    setTimeout(() => {
      setSimulationAircraft(null);
      setEmergencyAlerts((prev) => prev.filter((a) => a.hex !== 'SIM7700'));
    }, 15000);
  }, []);

  // Check if any aircraft has emergency squawk (7500, 7600, 7700)
  const hasEmergency = aircraftList.some((ac) => ['7500', '7600', '7700'].includes(ac.squawk)) || !!simulationAircraft;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-mono">
      {/* Top Navbar */}
      <Navbar
        lang={lang}
        setLang={setLang}
        units={units}
        setUnits={setUnits}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenFilters={() => setIsFiltersOpen(true)}
        onOpenProviders={() => setIsProvidersOpen(true)}
        showAirports={showAirports}
        setShowAirports={setShowAirports}
        aircraftCount={aircraftList.length}
        activeProviderName={activeProviderName}
        hasEmergency={hasEmergency}
        audioEnabled={audioEnabled}
        setAudioEnabled={handleToggleAudio}
        audioStatus={audioStatus}
        onUnlockAudio={handleUnlockAudio}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPhotoArchive={() => setIsPhotoArchiveOpen(true)}
        onOpenRouteSearch={() => setIsRouteSearchOpen(true)}
      />

      {/* Main Map & Sidebar Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
        <MapView
          aircraftList={aircraftList}
          selectedAircraft={selectedAircraft}
          onSelectAircraft={setSelectedAircraft}
          showAirports={showAirports}
          airports={airports}
          filters={filters}
          searchQuery={searchQuery}
          onBoundsChange={handleBoundsChange}
          selectedAircraftHistory={selectedAircraft ? (historyBuffer[selectedAircraft.hex] || []) : []}
          favorites={favorites}
          onTriggerEmergency={handleTriggerEmergency}
          simulationAircraft={simulationAircraft}
          onLogSimulationStats={setSimulationStats}
          selectedRoute={selectedEnrichment?.route}
        />

        {/* Floating overlays wrapped in dynamic WidgetHost controllers */}
        <WidgetHost id="banner_emergency">
          <EmergencyBanner
            alerts={emergencyAlerts}
            onDismiss={handleDismissEmergency}
            onCenterAircraft={handleCenterAircraft}
          />
        </WidgetHost>

        {/* Simulation Diagnostics Box */}
        {simulationStats && (
          <div className="absolute bottom-16 left-4 z-[2000] bg-slate-900/95 border border-amber-500/50 rounded-xl px-4 py-3 shadow-2xl text-amber-200 font-mono text-xs backdrop-blur max-w-sm pointer-events-auto animate-fade-in">
            <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase mb-1">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
              <span>Diagnóstico de Simulación</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 leading-tight">
              Flujo completo: Candidato ➔ Generación ➔ Confirmación ➔ Reproducción
            </p>
            <div className="space-y-1.5 border-t border-slate-800/80 pt-1.5">
              <div>Latencia de Generación: <span className="text-white font-bold">{simulationStats.latency} ms</span></div>
              <div>Fuente de voz utilizada: <span className="text-cyan-400 font-bold uppercase">{simulationStats.source}</span></div>
            </div>
          </div>
        )}

        <WidgetHost id="global_stats">
          <StatsOverlay
            aircraftList={aircraftList}
            lang={lang}
            units={units}
          />
        </WidgetHost>

        <WidgetHost id="debug.performance">
          <PerformanceMonitor
            apiLatency={apiLatency}
            totalAircraft={aircraftList.length}
            lang={lang}
          />
        </WidgetHost>

        {selectedAircraft && (
          <Sidebar
            aircraft={selectedAircraft}
            onClose={() => setSelectedAircraft(null)}
            lang={lang}
            units={units}
            enrichment={selectedEnrichment}
            loadingEnrich={loadingEnrichment}
          />
        )}
      </div>

      {/* Footer */}
      <Footer lang={lang} voiceStatus={voiceStatus} />

      {/* Modals */}
      <FiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        setFilters={setFilters}
        lang={lang}
      />

      <ProvidersModal
        isOpen={isProvidersOpen}
        onClose={() => setIsProvidersOpen(false)}
        lang={lang}
      />

      <PhotoArchiveModal
        isOpen={isPhotoArchiveOpen}
        onClose={() => setIsPhotoArchiveOpen(false)}
        lang={lang}
      />

      <RouteSearchModal
        isOpen={isRouteSearchOpen}
        onClose={() => setIsRouteSearchOpen(false)}
        lang={lang}
        aircraftList={aircraftList}
        onSelectAircraft={setSelectedAircraft}
      />

      {/* Modern, comprehensive slider-out configuration manager */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSimulateEmergency={handleSimulateEmergency}
      />
    </div>
  );
}
