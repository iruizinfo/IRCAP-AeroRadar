/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';

if (typeof window !== 'undefined') {
  (window as any).maplibregl = maplibregl;
  try {
    setWorkerUrl('/maplibre-gl-worker.mjs');
  } catch (e) {
    // ignore
  }
}

import '@maplibre/maplibre-gl-leaflet';
import { Aircraft, Airport } from '../types/aircraft';
import { FilterState } from './FiltersModal';
import { MAP_CONFIG } from '../config/mapConfig';
import { useAircraftAlerts } from '../hooks/useAircraftAlerts';
import { resolveCommercialFlight } from '../utils/flightCrossReference';

interface MapViewProps {
  aircraftList: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (ac: Aircraft) => void;
  showAirports: boolean;
  airports: Airport[];
  filters: FilterState;
  searchQuery: string;
  onBoundsChange: (lat: number, lon: number, radiusNm: number) => void;
  selectedAircraftHistory?: { lat: number; lon: number; timestamp: number }[];
  favorites: string[];
  onTriggerEmergency: (alert: any) => void;
  simulationAircraft: Aircraft | null;
  onLogSimulationStats?: (stats: { latency: number; source: string }) => void;
  selectedRoute?: any;
}

// OpenFreeMap MapLibre layer component with fallback to Esri Dark Raster
function CustomBaseMapLayer() {
  const map = useMap();

  useEffect(() => {
    let glLayer: any = null;
    let fallbackLayer: any = null;

    const useFallback = (reason?: string) => {
      if (reason) console.warn('Switching to Esri Dark Raster base layer:', reason);
      if (glLayer && map.hasLayer(glLayer)) {
        try {
          map.removeLayer(glLayer);
        } catch {
          // ignore
        }
        glLayer = null;
      }
      if (!fallbackLayer) {
        fallbackLayer = L.tileLayer(MAP_CONFIG.esriDarkRasterUrl, {
          attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        });
        fallbackLayer.addTo(map);
      }
    };

    // Check WebGL support
    let hasWebGL = false;
    try {
      const canvas = document.createElement('canvas');
      hasWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
      hasWebGL = false;
    }

    if (hasWebGL) {
      try {
        glLayer = (L as any).maplibreGL({
          style: MAP_CONFIG.openFreeMapDarkStyleUrl,
          attribution: MAP_CONFIG.attribution
        });
        glLayer.addTo(map);

        // Attach error interceptor to MapLibre instance to handle worker failures gracefully
        const glMap = glLayer.getMaplibreMap?.();
        if (glMap) {
          glMap.on('error', (e: any) => {
            const msg = e?.error?.message || '';
            if (msg.includes('Worker') || msg.includes('WebGL') || msg.includes('Failed to initialize')) {
              useFallback(msg);
            }
          });
        }
      } catch (err: any) {
        useFallback(err?.message || 'MapLibre GL initialization error');
      }
    } else {
      useFallback('WebGL is not available');
    }

    return () => {
      if (glLayer && map.hasLayer(glLayer)) {
        try {
          map.removeLayer(glLayer);
        } catch {
          // ignore
        }
      }
      if (fallbackLayer && map.hasLayer(fallbackLayer)) {
        try {
          map.removeLayer(fallbackLayer);
        } catch {
          // ignore
        }
      }
    };
  }, [map]);

  return null;
}

// Controller for bounds changes, zoom tracking, and initial geolocation / fitBounds
function MapController({
  onBoundsChange,
  onZoomChange,
  aircraftList,
  onMapChange,
  onMapReady
}: {
  onBoundsChange: (lat: number, lon: number, radiusNm: number) => void;
  onZoomChange: (zoom: number) => void;
  aircraftList: Aircraft[];
  onMapChange: () => void;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();
  const hasInitialized = useRef(false);

  // Notify parent on map instance readiness
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  // Initial location setup (Geolocation or fitBounds of first aircraft)
  useEffect(() => {
    if (hasInitialized.current) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 7);
          hasInitialized.current = true;
        },
        () => {
          if (aircraftList.length > 0) {
            const lats = aircraftList.map((a) => a.lat);
            const lons = aircraftList.map((a) => a.lon);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            map.fitBounds([
              [minLat, minLon],
              [maxLat, maxLon]
            ], { maxZoom: 8, padding: [50, 50] });
            hasInitialized.current = true;
          }
        },
        { timeout: 5000 }
      );
    } else if (aircraftList.length > 0) {
      const lats = aircraftList.map((a) => a.lat);
      const lons = aircraftList.map((a) => a.lon);
      map.fitBounds([
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      ], { maxZoom: 8, padding: [50, 50] });
      hasInitialized.current = true;
    }
  }, [map, aircraftList]);

  useEffect(() => {
    const updateMapState = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onZoomChange(zoom);

      const bounds = map.getBounds();
      const northEast = bounds.getNorthEast();
      const radiusMeters = center.distanceTo(northEast);
      const radiusNm = Math.min(250, Math.max(10, Math.round(radiusMeters / 1852)));
      onBoundsChange(center.lat, center.lng, radiusNm);
    };

    updateMapState();

    let timeoutId: any;
    const handleMoveEnd = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateMapState();
        onMapChange();
      }, 400);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      clearTimeout(timeoutId);
    };
  }, [map, onBoundsChange, onZoomChange]);

  return null;
}

function getAltitudeColor(alt: number | 'ground'): string {
  if (alt === 'ground') return '#64748b'; // slate grey
  if (alt < 10000) return '#06b6d4'; // cyan
  if (alt < 25000) return '#10b981'; // emerald
  if (alt < 38000) return '#f59e0b'; // amber
  return '#ec4899'; // rose
}

const iconCache = new Map<string, L.DivIcon>();

function createAircraftMarkerIcon(track: number, alt: number | 'ground', zoom: number, isSelected: boolean, isEmergency: boolean, useSimpleDot: boolean) {
  const roundedTrack = Math.round(track / 5) * 5; // Round to nearest 5 degrees to keep cache size reasonable
  const color = isEmergency ? '#ef4444' : getAltitudeColor(alt);
  const cacheKey = `${roundedTrack}_${alt}_${zoom}_${isSelected}_${isEmergency}_${useSimpleDot}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  let icon: L.DivIcon;
  if (useSimpleDot || zoom <= 5) {
    const dotSize = zoom <= 5 ? 6 : 8;
    const dotHtml = `
      <div style="width: ${dotSize}px; height: ${dotSize}px; background-color: ${color}; border: 1.5px solid #0f172a; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.9);"></div>
    `;
    icon = L.divIcon({
      html: dotHtml,
      className: 'custom-dot-marker',
      iconSize: [dotSize, dotSize],
      iconAnchor: [dotSize / 2, dotSize / 2]
    });
  } else {
    const size = zoom >= 9 ? 26 : 16;
    const strokeWidth = zoom >= 9 ? '1.5' : '1';

    const svgHtml = `
      <div style="transform: rotate(${roundedTrack}deg); width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.7)); transition: transform 0.2s ease;">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#0f172a" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="${isSelected ? 'filter: drop-shadow(0 0 6px ' + color + ');' : ''}">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.5 1c-.2.4 0 .9.4 1.1l5.8 2.9-3.2 3.2-2.1-.5c-.4-.1-.8.1-1 .4l-.6.9c-.2.3-.1.8.2 1l3.5 2.5 2.5 3.5c.2.3.7.4 1 .2l.9-.6c.3-.2.5-.6.4-1l-.5-2.1 3.2-3.2 2.9 5.8c.2.4.7.6 1.1.4l1-.5c.4-.2.6-.6.5-1.1z"></path>
        </svg>
      </div>
    `;

    icon = L.divIcon({
      html: svgHtml,
      className: 'custom-aircraft-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  iconCache.set(cacheKey, icon);
  return icon;
}

const airportIcon = L.divIcon({
  html: `<div style="background: #0284c7; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #ffffff;"></div>`,
  className: 'custom-airport-marker',
  iconSize: [8, 8],
  iconAnchor: [4, 4]
});

export const MapView: React.FC<MapViewProps> = ({
  aircraftList,
  selectedAircraft,
  onSelectAircraft,
  showAirports,
  airports,
  filters,
  searchQuery,
  onBoundsChange,
  selectedAircraftHistory = [],
  favorites,
  onTriggerEmergency,
  simulationAircraft,
  onLogSimulationStats,
  selectedRoute
}) => {
  const [zoom, setZoom] = useState(6);
  const [mapChangeCount, setMapChangeCount] = useState(0);
  const [map, setMap] = useState<L.Map | null>(null);

  const filteredAircraft = useMemo(() => {
    const list = aircraftList.filter((ac) => {
      if (filters.hideOnGround && (ac.onGround || ac.altBaroFt === 'ground')) return false;

      if (ac.altBaroFt !== 'ground') {
        if (ac.altBaroFt < filters.minAlt || ac.altBaroFt > filters.maxAlt) return false;
      }

      if (ac.groundSpeedKt < filters.minSpeed || ac.groundSpeedKt > filters.maxSpeed) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchCallsign = ac.callsign.toLowerCase().includes(q);
        const matchReg = ac.registration.toLowerCase().includes(q);
        const matchHex = ac.hex.toLowerCase().includes(q);
        const commFlight = resolveCommercialFlight(ac.callsign);
        const matchComm = commFlight ? commFlight.toLowerCase().includes(q) : false;
        if (!matchCallsign && !matchReg && !matchHex && !matchComm) return false;
      }

      return true;
    });

    if (simulationAircraft) {
      list.push(simulationAircraft);
    }

    return list;
  }, [aircraftList, filters, searchQuery, simulationAircraft]);

  const isFilterActive = useMemo(() => {
    return (
      filters.minAlt > 0 ||
      filters.maxAlt < 60000 ||
      filters.minSpeed > 0 ||
      filters.maxSpeed < 1000 ||
      filters.hideOnGround ||
      searchQuery.trim().length > 0
    );
  }, [filters, searchQuery]);

  // Anti-collision label positioning engine to avoid overlapping clutter on zoom-out
  const visibleLabelHexes = useMemo(() => {
    if (!map || zoom < 6) return new Set<string>(); // Hide all text labels on low zooms for an pristine radar sweep

    const occupied: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const visibleHexes = new Set<string>();

    // Sort to prioritize labels for: Selected, Emergencies, Favorites, then descending altitude
    const sortedAircraft = [...filteredAircraft].sort((a, b) => {
      const aSelected = selectedAircraft?.hex === a.hex ? 1 : 0;
      const bSelected = selectedAircraft?.hex === b.hex ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;

      const aEmerg = ['7500', '7600', '7700'].includes(a.squawk) ? 1 : 0;
      const bEmerg = ['7500', '7600', '7700'].includes(b.squawk) ? 1 : 0;
      if (aEmerg !== bEmerg) return bEmerg - aEmerg;

      const aFav = favorites.includes(a.hex) ? 1 : 0;
      const bFav = favorites.includes(b.hex) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const aAlt = a.altBaroFt === 'ground' ? 0 : Number(a.altBaroFt);
      const bAlt = b.altBaroFt === 'ground' ? 0 : Number(b.altBaroFt);
      return bAlt - aAlt;
    });

    for (const ac of sortedAircraft) {
      try {
        const latLng = L.latLng(ac.lat, ac.lon);
        const point = map.latLngToContainerPoint(latLng);

        // Standard bounding box dimensions for labels
        const width = 70;
        const height = 24;
        const yOffset = 18;

        const labelBox = {
          x1: point.x - width / 2,
          y1: point.y - yOffset - height,
          x2: point.x + width / 2,
          y2: point.y - yOffset
        };

        const overlaps = occupied.some((b) => {
          return !(
            labelBox.x2 < b.x1 ||
            labelBox.x1 > b.x2 ||
            labelBox.y2 < b.y1 ||
            labelBox.y1 > b.y2
          );
        });

        const isSelected = selectedAircraft?.hex === ac.hex;

        if (!overlaps || isSelected) {
          visibleHexes.add(ac.hex);
          if (!isSelected) {
            occupied.push(labelBox);
          }
        }
      } catch {
        // ignore conversion anomalies during panning transitions
      }
    }

    return visibleHexes;
  }, [filteredAircraft, map, zoom, selectedAircraft, favorites]);

  useAircraftAlerts({
    visibleAircraft: filteredAircraft,
    aircraftList: simulationAircraft ? [...aircraftList, simulationAircraft] : aircraftList,
    favorites,
    isFilterActive,
    mapChangeCount,
    onTriggerEmergency,
    onLogSimulationStats,
  });

  const handleMapChange = () => {
    setMapChangeCount((prev) => prev + 1);
  };

  const useSimpleDotMode = filteredAircraft.length > MAP_CONFIG.clusterThreshold;

  // Convert history buffer coordinates into Leaflet LatLng polyline positions
  const parsedHistoryPoints = useMemo(() => {
    return selectedAircraftHistory.map((item) => [item.lat, item.lon] as [number, number]);
  }, [selectedAircraftHistory]);

  return (
    <div className="flex-1 w-full h-full relative z-0">
      {/* Debug Overlay Widget */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 border border-slate-700 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 shadow-xl flex items-center space-x-3 pointer-events-none">
        <div>Zoom: <span className="font-bold text-white">{zoom}</span></div>
        <div>•</div>
        <div>Aviones visibles: <span className="font-bold text-white">{filteredAircraft.length}</span></div>
        {useSimpleDotMode && (
          <>
            <div>•</div>
            <span className="text-amber-400 text-[10px]">Modo Puntos (&gt;800)</span>
          </>
        )}
      </div>

      <MapContainer
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        minZoom={3}
        maxZoom={18}
        className="w-full h-full bg-slate-950"
        zoomControl={false}
      >
        <CustomBaseMapLayer />

        <MapController
          onBoundsChange={onBoundsChange}
          onZoomChange={setZoom}
          aircraftList={aircraftList}
          onMapChange={handleMapChange}
          onMapReady={setMap}
        />

        {/* Flight Trail Polyline */}
        {selectedAircraft && parsedHistoryPoints.length > 1 && (
          <Polyline
            positions={parsedHistoryPoints}
            pathOptions={{ color: '#38bdf8', weight: 3, opacity: 0.8, dashArray: '4, 8' }}
          />
        )}

        {/* Real-time Origin & Destination flight segments on map */}
        {selectedAircraft && selectedRoute && selectedRoute.origin && selectedRoute.origin.latitude && selectedRoute.origin.longitude && selectedRoute.origin.latitude !== 0 && (
          <>
            {/* Origin Airport Marker */}
            <Marker 
              position={[selectedRoute.origin.latitude, selectedRoute.origin.longitude]}
              icon={L.divIcon({
                html: `<div class="flex items-center justify-center bg-emerald-500 w-4 h-4 rounded-full border border-slate-950 text-[8px] font-black text-slate-950">D</div>`,
                className: 'custom-route-endpoint',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Tooltip permanent direction="top" className="custom-aircraft-tooltip" offset={[0, -4]}>
                <div className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono text-emerald-300 shadow-xl">
                  DEP: {selectedRoute.origin.iata || selectedRoute.origin.iata_code} ({selectedRoute.origin.city || selectedRoute.origin.municipality})
                </div>
              </Tooltip>
            </Marker>

            {/* Segment from Origin to Aircraft */}
            <Polyline
              positions={[[selectedRoute.origin.latitude, selectedRoute.origin.longitude], [selectedAircraft.lat, selectedAircraft.lon]]}
              pathOptions={{ color: '#10b981', weight: 2.5, opacity: 0.7, dashArray: '6, 6' }}
            />
          </>
        )}

        {/* Destination segment */}
        {selectedAircraft && selectedRoute && selectedRoute.destination && selectedRoute.destination.latitude && selectedRoute.destination.longitude && selectedRoute.destination.latitude !== 0 && (
          <>
            {/* Destination Airport Marker */}
            <Marker 
              position={[selectedRoute.destination.latitude, selectedRoute.destination.longitude]}
              icon={L.divIcon({
                html: `<div class="flex items-center justify-center bg-rose-500 w-4 h-4 rounded-full border border-slate-950 text-[8px] font-black text-slate-950">A</div>`,
                className: 'custom-route-endpoint',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Tooltip permanent direction="top" className="custom-aircraft-tooltip" offset={[0, -4]}>
                <div className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono text-rose-300 shadow-xl">
                  ARR: {selectedRoute.destination.iata || selectedRoute.destination.iata_code} ({selectedRoute.destination.city || selectedRoute.destination.municipality})
                </div>
              </Tooltip>
            </Marker>

            {/* Segment from Aircraft to Destination */}
            <Polyline
              positions={[[selectedAircraft.lat, selectedAircraft.lon], [selectedRoute.destination.latitude, selectedRoute.destination.longitude]]}
              pathOptions={{ color: '#f43f5e', weight: 2.5, opacity: 0.7, dashArray: '6, 6' }}
            />
          </>
        )}

        {/* Aircraft Markers */}
        {filteredAircraft.map((ac) => {
          const isSelected = selectedAircraft?.hex === ac.hex;
          const isEmergency = ['7500', '7600', '7700'].includes(ac.squawk);
          const icon = createAircraftMarkerIcon(ac.trackDeg, ac.altBaroFt, zoom, isSelected, isEmergency, useSimpleDotMode);
          const showLabel = visibleLabelHexes.has(ac.hex);

          return (
            <Marker
              key={ac.hex}
              position={[ac.lat, ac.lon]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectAircraft(ac)
              }}
            >
              {/* Dynamic tooltip label with anti-collision rules */}
              {showLabel && (() => {
                const commFlight = resolveCommercialFlight(ac.callsign);
                return (
                  <Tooltip
                    permanent
                    direction="top"
                    className="custom-aircraft-tooltip"
                    offset={[0, -12]}
                  >
                    <div className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold leading-none shadow-lg border backdrop-blur whitespace-nowrap flex flex-col items-center ${
                      isEmergency
                        ? 'bg-red-950/90 text-red-200 border-red-500/50'
                        : isSelected
                        ? 'bg-cyan-950/95 text-cyan-200 border-cyan-400'
                        : 'bg-slate-900/90 text-slate-200 border-slate-700/80'
                    }`}>
                      <span>{commFlight || ac.callsign || ac.hex}</span>
                      {commFlight && commFlight.toUpperCase() !== ac.callsign.toUpperCase() && (
                        <span className="text-[6.5px] text-cyan-300 font-normal">
                          {ac.callsign}
                        </span>
                      )}
                      <span className="text-[7px] text-slate-400 mt-0.5 font-normal">
                        {ac.altBaroFt === 'ground' ? 'GND' : `${Math.round(Number(ac.altBaroFt) / 100)}FL`}
                      </span>
                    </div>
                  </Tooltip>
                );
              })()}

              <Popup className="custom-dark-popup">
                {(() => {
                  const commFlight = resolveCommercialFlight(ac.callsign);
                  return (
                    <div className="bg-slate-900 text-slate-100 p-2 font-mono text-xs rounded shadow-lg border border-slate-700">
                      <div className="font-bold text-cyan-400 text-sm mb-1 flex items-center justify-between gap-2">
                        <span>{commFlight || ac.callsign}</span>
                        {commFlight && commFlight.toUpperCase() !== ac.callsign.toUpperCase() && (
                          <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-1 py-0.5 rounded">
                            ATC: {ac.callsign}
                          </span>
                        )}
                      </div>
                      <div>Matrícula: {ac.registration}</div>
                      <div>Tipo: {ac.type}</div>
                      <div>Altitud: {ac.altBaroFt === 'ground' ? 'Tierra' : `${ac.altBaroFt} ft`}</div>
                      <div>Velocidad: {ac.groundSpeedKt} kt</div>
                    </div>
                  );
                })()}
              </Popup>
            </Marker>
          );
        })}

        {/* Airports Layer */}
        {showAirports &&
          airports.map((ap) => (
            <Marker key={ap.id} position={[ap.lat, ap.lon]} icon={airportIcon}>
              <Popup>
                <div className="bg-slate-900 text-slate-100 p-2 font-mono text-xs rounded">
                  <div className="font-bold text-sky-400">{ap.name}</div>
                  <div>ICAO: {ap.ident} | IATA: {ap.iataCode || 'N/A'}</div>
                  <div>Elevación: {ap.elevationFt} ft</div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};
