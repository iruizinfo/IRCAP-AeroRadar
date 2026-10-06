/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { LanguageCode } from '../types/aircraft';
import { translations } from '../i18n/translations';

export interface FilterState {
  minAlt: number;
  maxAlt: number;
  minSpeed: number;
  maxSpeed: number;
  hideOnGround: boolean;
}

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  lang: LanguageCode;
}

export const FiltersModal: React.FC<FiltersModalProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  lang
}) => {
  if (!isOpen) return null;
  const t = translations[lang];

  const handleReset = () => {
    setFilters({
      minAlt: 0,
      maxAlt: 60000,
      minSpeed: 0,
      maxSpeed: 1000,
      hideOnGround: false
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 text-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2 text-cyan-400">
            <SlidersHorizontal className="w-5 h-5" />
            <h3 className="text-lg font-bold text-white">{t.filters}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="space-y-4 text-sm">
          {/* Altitude Range */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{t.altitudeRange}</span>
              <span className="text-cyan-400">{filters.minAlt} ft - {filters.maxAlt} ft</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500">Mín (ft)</label>
                <input
                  type="number"
                  value={filters.minAlt}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minAlt: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Máx (ft)</label>
                <input
                  type="number"
                  value={filters.maxAlt}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxAlt: parseInt(e.target.value) || 60000 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Speed Range */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{t.speedRange}</span>
              <span className="text-cyan-400">{filters.minSpeed} kt - {filters.maxSpeed} kt</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500">Mín (kt)</label>
                <input
                  type="number"
                  value={filters.minSpeed}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minSpeed: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Máx (kt)</label>
                <input
                  type="number"
                  value={filters.maxSpeed}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxSpeed: parseInt(e.target.value) || 1000 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Hide on Ground Checkbox */}
          <div className="pt-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hideOnGround}
                onChange={(e) => setFilters((prev) => ({ ...prev, hideOnGround: e.target.checked }))}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-slate-300 text-xs font-medium">{t.hideOnGround}</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetFilters}</span>
          </button>
          <button
            onClick={onClose}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-lg shadow-cyan-900/30"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};
