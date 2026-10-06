/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plane, Search, SlidersHorizontal, Radio, MapPin, Globe, Maximize2, ShieldAlert, Volume2, VolumeX, Settings, Camera } from 'lucide-react';
import { LanguageCode, UnitsSystem } from '../types/aircraft';
import { translations } from '../i18n/translations';
import { IrcapLogo } from './IrcapLogo';

interface NavbarProps {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  units: UnitsSystem;
  setUnits: (u: UnitsSystem) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenFilters: () => void;
  onOpenProviders: () => void;
  showAirports: boolean;
  setShowAirports: (v: boolean | ((prev: boolean) => boolean)) => void;
  aircraftCount: number;
  activeProviderName: string;
  hasEmergency: boolean;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
  audioStatus: 'unlocked' | 'suspended' | 'muted' | 'blocked';
  onUnlockAudio: () => Promise<void>;
  onOpenSettings: () => void;
  onOpenPhotoArchive: () => void;
  onOpenRouteSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  setLang,
  units,
  setUnits,
  searchQuery,
  setSearchQuery,
  onOpenFilters,
  onOpenProviders,
  showAirports,
  setShowAirports,
  aircraftCount,
  activeProviderName,
  hasEmergency,
  audioEnabled,
  setAudioEnabled,
  audioStatus,
  onUnlockAudio,
  onOpenSettings,
  onOpenPhotoArchive,
  onOpenRouteSearch
}) => {
  const t = translations[lang];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl z-50 relative">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center">
          <IrcapLogo className="w-10 h-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-lg tracking-wider text-white font-mono">{t.appTitle}</h1>
            {hasEmergency && (
              <span className="bg-rose-600/30 border border-rose-500 text-rose-400 text-xs px-2 py-0.5 rounded-full font-mono flex items-center space-x-1 animate-bounce">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>EMERGENCY</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono hidden sm:block">{t.subtitle}</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-1 max-w-md mx-2 min-w-[220px]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
          />
        </div>
      </div>

      {/* Controls & Status Bar */}
      <div className="flex items-center space-x-2 sm:space-x-3 text-xs font-mono">
        {/* Active Provider Badge */}
        <button
          onClick={onOpenProviders}
          className="hidden md:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 transition-colors"
          title="Estado de Proveedores"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-cyan-300">{activeProviderName || 'ADSB.lol'}</span>
          <span className="text-slate-400">({aircraftCount})</span>
        </button>

        {/* Filters Button */}
        <button
          onClick={onOpenFilters}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-200 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">{t.filters}</span>
        </button>

        {/* Airports Toggle */}
        <button
          onClick={() => setShowAirports((prev: boolean) => !prev)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
            showAirports
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.airports}</span>
        </button>

        {/* Photo Archive Button */}
        <button
          onClick={onOpenPhotoArchive}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-200 transition-colors cursor-pointer"
          title="Archivo Gráfico de Aviación"
        >
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">{lang === 'es' ? 'Fotos' : 'Photos'}</span>
        </button>

        {/* Flight Routes Button */}
        <button
          onClick={onOpenRouteSearch}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-200 transition-colors cursor-pointer"
          title="Buscador de Rutas de Vuelos"
        >
          <Plane className="w-3.5 h-3.5 text-cyan-400 rotate-45" />
          <span className="hidden sm:inline">{lang === 'es' ? 'Rutas' : 'Routes'}</span>
        </button>

        {/* Units Switcher */}
        <button
          onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-300 font-mono"
          title="Cambiar Unidades"
        >
          {units === 'metric' ? 'Mtr/Km' : 'Ft/Kt'}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-300 flex items-center space-x-1"
          title="Cambiar Idioma"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Audio Unlocking or Toggle Button */}
        {(audioStatus === 'blocked' || audioStatus === 'suspended') ? (
          <button
            onClick={onUnlockAudio}
            className="flex items-center space-x-1.5 bg-cyan-500 hover:bg-cyan-450 text-slate-950 font-black px-3 py-1.5 rounded-lg border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.45)] animate-pulse transition-all cursor-pointer"
            title="Desbloquear motor de sonido y voz"
          >
            <Volume2 className="w-4 h-4 text-slate-950" />
            <span className="text-[10px] uppercase tracking-wider">Activar Sonido</span>
          </button>
        ) : (
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center justify-center p-1.5 rounded-lg border transition-colors cursor-pointer ${
              audioEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
            }`}
            title={audioEnabled ? 'Silenciar Audio' : 'Activar Audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* Settings Panel Button */}
        <button
          onClick={onOpenSettings}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1.5 rounded-lg text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          title="Centro de Control / Configuración"
          aria-label="Abrir centro de control y configuración"
        >
          <Settings className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="hidden lg:flex bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1.5 rounded-lg text-slate-300"
          title={t.fullscreen}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
