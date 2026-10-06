/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Cpu, Activity, Database } from 'lucide-react';
import { LanguageCode } from '../types/aircraft';

interface PerformanceMonitorProps {
  apiLatency: number;
  totalAircraft: number;
  lang: LanguageCode;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  apiLatency,
  totalAircraft,
  lang
}) => {
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // High-fidelity FPS engine utilizing requestAnimationFrame
  useEffect(() => {
    let animationId: number;
    const calculateFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      animationId = requestAnimationFrame(calculateFps);
    };

    animationId = requestAnimationFrame(calculateFps);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  const getFpsColor = (f: number) => {
    if (f >= 55) return 'text-emerald-400';
    if (f >= 30) return 'text-amber-400';
    return 'text-rose-500';
  };

  const getLatencyColor = (l: number) => {
    if (l === 0) return 'text-slate-400';
    if (l < 150) return 'text-emerald-400';
    if (l < 600) return 'text-amber-400';
    return 'text-rose-500';
  };

  return (
    <div className="absolute bottom-16 right-4 sm:right-auto sm:left-4 z-[2000] bg-slate-900/95 border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-2xl text-slate-200 font-mono text-xs backdrop-blur w-56 pointer-events-auto select-none animate-fade-in flex flex-col space-y-2">
      {/* Title */}
      <div className="flex items-center space-x-1.5 text-cyan-400 font-bold uppercase border-b border-slate-800 pb-1.5">
        <Activity className="w-4 h-4 animate-pulse" />
        <span className="text-[10px] tracking-wider">
          {lang === 'es' ? 'Rendimiento' : 'Performance Monitor'}
        </span>
      </div>

      {/* Metrics list */}
      <div className="space-y-2 text-[10px]">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span>F.P.S.</span>
          </div>
          <span className={`font-bold ${getFpsColor(fps)}`}>
            {fps} Hz
          </span>
        </div>

        {/* API LATENCY */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'es' ? 'Latencia API' : 'API Latency'}</span>
          </div>
          <span className={`font-bold ${getLatencyColor(apiLatency)}`}>
            {apiLatency > 0 ? `${apiLatency} ms` : '...'}
          </span>
        </div>

        {/* DATA VOLUME */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-400">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'es' ? 'Objetos Activos' : 'Active Objects'}</span>
          </div>
          <span className="font-bold text-cyan-300">
            {totalAircraft}
          </span>
        </div>
      </div>
    </div>
  );
};
