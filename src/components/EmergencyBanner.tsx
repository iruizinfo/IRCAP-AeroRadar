/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Crosshair, X } from 'lucide-react';
import { EmergencyAlertData } from '../hooks/useAircraftAlerts';

interface EmergencyBannerProps {
  alerts: EmergencyAlertData[];
  onDismiss: (hex: string, squawk: string) => void;
  onCenterAircraft: (hex: string) => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  alerts,
  onDismiss,
  onCenterAircraft,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-lg px-4 space-y-2 pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={`${alert.hex}-${alert.squawk}`}
          className="pointer-events-auto flex items-center justify-between bg-red-950/95 border-2 border-red-500 rounded-xl px-4 py-3 shadow-2xl text-red-200 font-mono text-xs backdrop-blur animate-pulse flex-wrap gap-2"
        >
          {/* Main Info */}
          <div className="flex items-center space-x-3">
            <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/40 text-red-400">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-white tracking-widest">{alert.callsign}</span>
                <span className="bg-red-600 text-white font-black px-1.5 py-0.5 rounded text-[10px]">
                  SQUAWK {alert.squawk}
                </span>
                {alert.isSimulation && (
                  <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px]">
                    SIMULACIÓN
                  </span>
                )}
              </div>
              <p className="text-red-400 capitalize text-[11px] mt-0.5">
                {alert.meaning} • {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onCenterAircraft(alert.hex)}
              className="flex items-center space-x-1 bg-red-900/60 hover:bg-red-800 border border-red-500/40 px-2.5 py-1.5 rounded text-[10px] font-bold text-white transition cursor-pointer"
              title="Centrar aeronave en mapa"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Centrar</span>
            </button>
            <button
              onClick={() => onDismiss(alert.hex, alert.squawk)}
              className="p-1.5 hover:bg-red-900/40 rounded border border-transparent hover:border-red-500/20 text-red-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
