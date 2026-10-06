/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Aircraft, LanguageCode, UnitsSystem } from '../types/aircraft';
import { ChartPieIcon, ChevronDownIcon, ChevronUpIcon, AlertTriangleIcon } from 'lucide-react';

interface StatsOverlayProps {
  aircraftList: Aircraft[];
  lang: LanguageCode;
  units: UnitsSystem;
}

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ aircraftList, lang, units }) => {
  const [isOpen, setIsOpen] = useState(true);

  const stats = useMemo(() => {
    const total = aircraftList.length;
    if (total === 0) {
      return {
        total: 0,
        avgAlt: 0,
        avgSpeed: 0,
        maxAlt: 0,
        maxSpeed: 0,
        emergencies: 0,
      };
    }

    let altSum = 0;
    let altCount = 0;
    let speedSum = 0;
    let maxAlt = 0;
    let maxSpeed = 0;
    let emergencies = 0;

    aircraftList.forEach((ac) => {
      // Altitude
      if (ac.altBaroFt !== 'ground') {
        altSum += ac.altBaroFt;
        altCount++;
        if (ac.altBaroFt > maxAlt) maxAlt = ac.altBaroFt;
      }
      // Speed
      speedSum += ac.groundSpeedKt;
      if (ac.groundSpeedKt > maxSpeed) maxSpeed = ac.groundSpeedKt;

      // Squawk emergency codes
      if (['7500', '7600', '7700'].includes(ac.squawk)) {
        emergencies++;
      }
    });

    return {
      total,
      avgAlt: altCount > 0 ? Math.round(altSum / altCount) : 0,
      avgSpeed: Math.round(speedSum / total),
      maxAlt,
      maxSpeed,
      emergencies,
    };
  }, [aircraftList]);

  // Conversions based on units
  const formatAlt = (ft: number) => {
    if (units === 'metric') {
      const meters = Math.round(ft * 0.3048);
      return `${meters.toLocaleString()} m`;
    }
    return `${ft.toLocaleString()} ft`;
  };

  const formatSpeed = (kt: number) => {
    if (units === 'metric') {
      const kmh = Math.round(kt * 1.852);
      return `${kmh.toLocaleString()} km/h`;
    }
    return `${kt.toLocaleString()} kt`;
  };

  const t = {
    es: {
      title: 'Estadísticas Globales',
      tracked: 'Aeronaves en vista',
      avgAlt: 'Altitud Promedio',
      avgSpeed: 'Velocidad Promedio',
      maxAlt: 'Altitud Máxima',
      maxSpeed: 'Velocidad Máxima',
      emergencies: 'Alertas de Emergencia',
      noData: 'Sin aeronaves en rango',
    },
    en: {
      title: 'Global Statistics',
      tracked: 'Tracked Aircraft',
      avgAlt: 'Average Altitude',
      avgSpeed: 'Average Speed',
      maxAlt: 'Max Altitude',
      maxSpeed: 'Max Speed',
      emergencies: 'Emergency Alerts',
      noData: 'No aircraft in range',
    },
  }[lang];

  return (
    <div className="absolute bottom-20 right-3 z-[1000] max-w-sm w-80 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl text-slate-100 backdrop-blur overflow-hidden transition-all duration-300">
      {/* Header (Toggle button) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-sm font-bold text-cyan-400 hover:bg-slate-950 transition cursor-pointer"
      >
        <div className="flex items-center space-x-2">
          <ChartPieIcon className="w-4 h-4 text-cyan-400" />
          <span>{t.title}</span>
        </div>
        {isOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 space-y-3 font-mono text-xs">
          {stats.total === 0 ? (
            <div className="text-center py-4 text-slate-400">{t.noData}</div>
          ) : (
            <>
              {/* Grid statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/60">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">{t.tracked}</div>
                  <div className="text-xl font-bold text-white">{stats.total}</div>
                </div>

                <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/60">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">{t.avgAlt}</div>
                  <div className="text-xl font-bold text-cyan-400">{formatAlt(stats.avgAlt)}</div>
                </div>

                <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/60">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">{t.avgSpeed}</div>
                  <div className="text-xl font-bold text-emerald-400">{formatSpeed(stats.avgSpeed)}</div>
                </div>

                <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/60">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">{t.maxAlt}</div>
                  <div className="text-sm font-bold text-purple-400">{formatAlt(stats.maxAlt)}</div>
                </div>
              </div>

              {/* Extras */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{t.maxSpeed}:</span>
                <span className="text-slate-200 font-bold">{formatSpeed(stats.maxSpeed)}</span>
              </div>

              {/* Emergency Alerts alert indicator */}
              {stats.emergencies > 0 && (
                <div className="flex items-center space-x-2 p-2 bg-red-950/60 border border-red-800 rounded text-red-300 animate-pulse mt-1">
                  <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="font-semibold text-[10px] uppercase tracking-wider">
                    {stats.emergencies} {t.emergencies} SQUAWK
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
