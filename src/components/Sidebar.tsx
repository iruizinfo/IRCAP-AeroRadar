/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Plane, ShieldAlert, Navigation, Gauge, ArrowUpRight, Radio, ExternalLink, Image as ImageIcon, MapPin, Building2 } from 'lucide-react';
import { Aircraft, EnrichmentData, LanguageCode, UnitsSystem } from '../types/aircraft';
import { translations } from '../i18n/translations';

interface SidebarProps {
  aircraft: Aircraft | null;
  onClose: () => void;
  lang: LanguageCode;
  units: UnitsSystem;
  enrichment: EnrichmentData | null;
  loadingEnrich: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ aircraft, onClose, lang, units, enrichment, loadingEnrich }) => {
  const t = translations[lang];

  if (!aircraft) return null;

  const isEmergency = ['7500', '7600', '7700'].includes(aircraft.squawk);

  // Convert units if imperial vs metric
  const altDisplay = aircraft.altBaroFt === 'ground' 
    ? t.ground 
    : units === 'metric' 
      ? `${Math.round(aircraft.altBaroFt * 0.3048)} m` 
      : `${aircraft.altBaroFt.toLocaleString()} ft`;

  const speedDisplay = units === 'metric'
    ? `${Math.round(aircraft.groundSpeedKt * 1.852)} km/h`
    : `${aircraft.groundSpeedKt} kt`;

  const vertDisplay = units === 'metric'
    ? `${Math.round(aircraft.vertRateFpm * 0.3048 / 60)} m/s`
    : `${aircraft.vertRateFpm} fpm`;

  return (
    <div className="absolute right-0 top-16 bottom-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 text-slate-200 z-40 shadow-2xl flex flex-col font-mono animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/40 text-cyan-400">
            <Plane className="w-5 h-5" style={{ transform: `rotate(${aircraft.trackDeg}deg)` }} />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">
                {enrichment?.route?.flightNumber || aircraft.callsign}
              </h2>
              {enrichment?.route?.flightNumber && enrichment.route.flightNumber.toUpperCase() !== aircraft.callsign.toUpperCase() && (
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                  ATC: {aircraft.callsign}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{aircraft.registration} • {aircraft.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Emergency banner if 7500/7600/7700 */}
      {isEmergency && (
        <div className="bg-rose-900/80 border-b border-rose-600 p-3 flex items-center space-x-2 text-rose-200 animate-pulse">
          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <div className="font-bold text-xs uppercase">{t.emergency}</div>
            <div className="text-sm font-bold">SQUAWK {aircraft.squawk}</div>
          </div>
        </div>
      )}

      {/* Content scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs flex items-center space-x-1 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.altitude}</span>
            </div>
            <div className="text-lg font-bold text-white">{altDisplay}</div>
          </div>

          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs flex items-center space-x-1 mb-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.groundSpeed}</span>
            </div>
            <div className="text-lg font-bold text-white">{speedDisplay}</div>
          </div>

          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs flex items-center space-x-1 mb-1">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.track}</span>
            </div>
            <div className="text-lg font-bold text-white">{Math.round(aircraft.trackDeg)}°</div>
          </div>

          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs flex items-center space-x-1 mb-1">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.squawk}</span>
            </div>
            <div className={`text-lg font-bold ${isEmergency ? 'text-rose-400' : 'text-white'}`}>
              {aircraft.squawk}
            </div>
          </div>
        </div>

        {/* Detailed Info */}
        <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">{t.hexCode}:</span>
            <span className="text-slate-200 font-semibold uppercase">{aircraft.hex}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">{t.vertRate}:</span>
            <span className="text-slate-200">{vertDisplay}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">{t.source}:</span>
            <span className="text-cyan-400 font-semibold">{aircraft.source}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Coordenadas:</span>
            <span className="text-slate-300">{aircraft.lat.toFixed(4)}, {aircraft.lon.toFixed(4)}</span>
          </div>
        </div>

        {/* Route Enrichment (adsbdb) */}
        <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3">
          <div className="text-xs font-semibold text-cyan-400 mb-2 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{t.route}</span>
          </div>
          {loadingEnrich ? (
            <div className="text-xs text-slate-500 animate-pulse">Cargando información de ruta...</div>
          ) : enrichment?.route ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">{t.origin}</div>
                  <div className="font-bold text-white">{enrichment.route.origin.iata} - {enrichment.route.origin.city}</div>
                </div>
                <div className="text-cyan-400 font-bold">➔</div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">{t.destination}</div>
                  <div className="font-bold text-white">{enrichment.route.destination.iata} - {enrichment.route.destination.city}</div>
                </div>
              </div>
              {enrichment.route.flightNumber && enrichment.route.flightNumber.toUpperCase() !== aircraft.callsign.toUpperCase() && (
                <div className="bg-cyan-950/40 border border-cyan-500/30 rounded p-2 text-[11px] text-cyan-300 flex items-center justify-between">
                  <span>Cruce: <strong className="text-white">{aircraft.callsign}</strong> (ATC)</span>
                  <span className="text-slate-400">➔</span>
                  <span>Vuelo: <strong className="text-white">{enrichment.route.flightNumber}</strong></span>
                </div>
              )}
              {enrichment.route.airline && (
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{enrichment.route.airline.name}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Ruta no disponible para este callsign.</div>
          )}
        </div>

        {/* Photo Enrichment (Planespotters) */}
        <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3">
          <div className="text-xs font-semibold text-cyan-400 mb-2 flex items-center space-x-1">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{t.photo}</span>
          </div>
          {loadingEnrich ? (
            <div className="text-xs text-slate-500 animate-pulse">Buscando fotografía...</div>
          ) : enrichment?.photo ? (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900 aspect-video relative group">
                <img
                  src={enrichment.photo.url}
                  alt={aircraft.registration}
                  className="w-full h-full object-cover"
                />
                <a
                  href={enrichment.photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs space-x-1"
                >
                  <span>Ver original</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="text-[11px] text-slate-400">
                {t.photographer}: <span className="text-slate-200">{enrichment.photo.photographer}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">Sin fotografía registrada para {aircraft.registration}.</div>
          )}
        </div>
      </div>
    </div>
  );
};
