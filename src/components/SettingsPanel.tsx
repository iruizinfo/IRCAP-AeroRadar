/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { X, Search, RotateCcw, Download, Upload, AlertCircle, Trash2, Play, Check, AlertTriangle } from 'lucide-react';
import { settingsRegistry, SettingDefinition } from '../settings/registry';
import { useSetting, getSetting, setSetting, resetSetting, resetGroup, resetAll } from '../settings/store';
import { AudioEngine } from '../audio/AudioEngine';
import { ProvidersListEditor } from './ProvidersListEditor';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateEmergency: () => void;
}

const GROUPS = [
  { id: 'general', label: { es: 'General', en: 'General' } },
  { id: 'audio', label: { es: 'Audio', en: 'Audio' } },
  { id: 'widgets', label: { es: 'Banners y Paneles', en: 'Banners & Panels' } },
  { id: 'map', label: { es: 'Mapa y Etiquetas', en: 'Map & Labels' } },
  { id: 'data', label: { es: 'Datos y Proveedores', en: 'Data & Providers' } },
  { id: 'advanced', label: { es: 'Avanzado', en: 'Advanced' } }
] as const;

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, onSimulateEmergency }) => {
  const [activeGroup, setActiveGroup] = useState<typeof GROUPS[number]['id']>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [confirmResetGroup, setConfirmResetGroup] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // Get current language setting
  const [lang] = useSetting<'es' | 'en'>('general.language');

  // Trap keyboard focus and handle Escape to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab') {
        if (!panelRef.current) return;
        const focusableElements = panelRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
        );
        const first = focusableElements[0] as HTMLElement;
        const last = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus panel on open
    setTimeout(() => {
      panelRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render individual control values dynamically
  const SettingRow = ({ def }: { def: SettingDefinition }) => {
    const [value, setValue] = useSetting(def.id);

    if (def.type === 'providerList') {
      return (
        <div className="space-y-3 pt-2">
          <div className="border-b border-slate-800 pb-2.5 mb-2">
            <span className="font-extrabold text-slate-200 text-[10px] uppercase tracking-wider block">
              {lang === 'es' ? def.label.es : def.label.en}
            </span>
            <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
              {lang === 'es' ? def.description.es : def.description.en}
            </p>
          </div>
          <ProvidersListEditor />
        </div>
      );
    }

    // Evaluate dependency
    let isGreyedOut = false;
    if (def.dependsOn) {
      const parentVal = getSetting(def.dependsOn.id);
      isGreyedOut = !def.dependsOn.condition(parentVal);
    }

    const isModified = value !== def.defaultValue;

    const handleReset = () => {
      resetSetting(def.id);
    };

    // Render appropriate form control
    const renderControl = () => {
      if (def.type === 'toggle') {
        return (
          <label className={`relative inline-flex items-center cursor-pointer select-none ${isGreyedOut ? 'opacity-40 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={!!value}
              disabled={isGreyedOut}
              onChange={(e) => setValue(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950"></div>
          </label>
        );
      }

      if (def.type === 'slider') {
        return (
          <div className={`flex items-center space-x-2 w-full max-w-[200px] ${isGreyedOut ? 'opacity-40 pointer-events-none' : ''}`}>
            <input
              type="range"
              min={def.min ?? 0}
              max={def.max ?? 100}
              step={def.step ?? 1}
              value={value ?? def.defaultValue}
              disabled={isGreyedOut}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-800 rounded-lg appearance-none h-1.5 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {typeof value === 'number' && value < 1 ? `${Math.round(value * 100)}%` : value}
            </span>
          </div>
        );
      }

      if (def.type === 'select') {
        return (
          <select
            value={value}
            disabled={isGreyedOut}
            onChange={(e) => setValue(e.target.value)}
            className={`bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[200px] overflow-hidden text-ellipsis ${isGreyedOut ? 'opacity-40 pointer-events-none' : ''}`}
          >
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {lang === 'es' ? opt.label.es : opt.label.en}
              </option>
            ))}
          </select>
        );
      }

      if (def.type === 'number') {
        return (
          <input
            type="number"
            value={value}
            disabled={isGreyedOut}
            onChange={(e) => setValue(parseInt(e.target.value, 10) || def.defaultValue)}
            className={`w-20 bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs text-center font-mono text-slate-200 focus:outline-none focus:border-cyan-500 ${isGreyedOut ? 'opacity-40 pointer-events-none' : ''}`}
          />
        );
      }

      if (def.type === 'text') {
        return (
          <input
            type="text"
            value={value}
            disabled={isGreyedOut}
            onChange={(e) => setValue(e.target.value)}
            className={`w-full max-w-[200px] bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 ${isGreyedOut ? 'opacity-40 pointer-events-none' : ''}`}
          />
        );
      }

      return null;
    };

    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-950/20 border border-slate-800/40 rounded-xl gap-3 transition hover:bg-slate-950/40">
        <div className="flex-1 space-y-1 pr-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200 text-xs">
              {lang === 'es' ? def.label.es : def.label.en}
            </span>
            {isModified && (
              <span 
                className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" 
                title={lang === 'es' ? 'Valor modificado' : 'Modified value'}
              />
            )}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {lang === 'es' ? def.description.es : def.description.en}
          </p>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          {renderControl()}
          {isModified && (
            <button
              onClick={handleReset}
              className="p-1 text-slate-500 hover:text-slate-300 rounded border border-transparent hover:border-slate-800/60 bg-slate-950 hover:bg-slate-900 transition cursor-pointer"
              title={lang === 'es' ? 'Restablecer valor inicial' : 'Reset to initial value'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Filter definitions based on active tab and search criteria
  const filteredSettings = Array.from(settingsRegistry.values()).filter((def) => {
    const belongsToGroup = def.group === activeGroup;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchLabel = def.label.es.toLowerCase().includes(q) || def.label.en.toLowerCase().includes(q);
      const matchDesc = def.description.es.toLowerCase().includes(q) || def.description.en.toLowerCase().includes(q);
      return matchLabel || matchDesc;
    }
    return belongsToGroup;
  });

  // Bulk Actions
  const handleResetGroup = () => {
    resetGroup(activeGroup);
    setConfirmResetGroup(false);
  };

  const handleResetAll = () => {
    resetAll();
    setConfirmResetAll(false);
  };

  // Export Settings as JSON file
  const handleExport = () => {
    const rawData = localStorage.getItem('aeroradar.settings');
    if (!rawData) return;

    const blob = new Blob([rawData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aeroradar-settings-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import Settings from JSON file & validate schema
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Schema validation
        if (!parsed || typeof parsed !== 'object' || typeof parsed.schemaVersion !== 'number') {
          throw new Error(lang === 'es' ? 'Estructura JSON no válida' : 'Invalid JSON file structure');
        }

        if (!parsed.values || typeof parsed.values !== 'object') {
          throw new Error(lang === 'es' ? 'Formato de valores incorrecto' : 'Values key structure is corrupted');
        }

        // Apply setting by setting to trigger validate values and notify hooks
        Object.entries(parsed.values).forEach(([id, val]) => {
          if (settingsRegistry.has(id)) {
            setSetting(id, val);
          }
        });

        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err: any) {
        setImportError(err.message || (lang === 'es' ? 'Error al leer el archivo JSON' : 'Error reading JSON schema'));
      }
    };
    reader.readAsText(file);
  };

  // Sound Engine test handlers
  const handleTestTic = () => {
    AudioEngine.getInstance().playTic();
  };

  const handleTestEmergency = () => {
    const audio = AudioEngine.getInstance();
    audio.enqueuePlayAction(async () => {
      await audio.playEmergencyAlarm();
      const text = lang === 'es'
        ? "PRUEBA DE ALARMA. IRCAP AeroRadar operando de forma óptima."
        : "ALARM TEST. IRCAP AeroRadar operating at peak performance.";
      
      const settings = audio.getSettings();
      if (settings.ttsEnabled) {
        if (settings.geminiTtsEnabled) {
          const buffer = await audio.generateAndCacheGeminiTTS(text);
          if (buffer) {
            await audio.playPCMBuffer(buffer);
            return;
          }
        }
        await audio.playSpeechSynthesisFallback(text);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[4000] flex justify-end">
      {/* Dark Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide Out Panel Container */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-lg md:max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col focus:outline-none"
      >
        {/* Header bar */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
          <div className="flex items-center space-x-2 text-cyan-400">
            <SettingsIcon className="w-5 h-5 animate-spin-slow" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              {lang === 'es' ? 'Centro de Control' : 'Control Center'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 rounded border border-transparent hover:border-slate-800 bg-slate-900/40 hover:bg-slate-950 transition cursor-pointer"
            aria-label={lang === 'es' ? 'Cerrar panel' : 'Close panel'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={lang === 'es' ? 'Buscar opciones y widgets...' : 'Search options & widgets...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500 placeholder-slate-600 shadow-inner"
            />
          </div>
        </div>

        {/* Navigation Groups Menu */}
        {searchQuery.trim().length === 0 && (
          <div className="flex border-b border-slate-800/60 overflow-x-auto scrollbar-none bg-slate-950/10 shrink-0">
            {GROUPS.map((grp) => (
              <button
                key={grp.id}
                onClick={() => setActiveGroup(grp.id)}
                className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeGroup === grp.id
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-950/10'
                }`}
              >
                {lang === 'es' ? grp.label.es : grp.label.en}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Settings Rows Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {importError && (
            <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-3 flex items-start space-x-2 text-red-300 text-xs font-mono animate-fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3 flex items-start space-x-2 text-emerald-300 text-xs font-mono animate-fade-in">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>{lang === 'es' ? 'Ajustes cargados con éxito' : 'Settings imported successfully'}</span>
            </div>
          )}

          {/* Special Action Widgets for Audio settings */}
          {activeGroup === 'audio' && searchQuery.trim().length === 0 && (
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 flex items-start space-x-2.5 text-amber-200 text-[10px] leading-relaxed mb-1 font-mono">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400 animate-pulse" />
              <div>
                <span className="font-extrabold uppercase text-amber-400 block mb-0.5">
                  {lang === 'es' ? 'ADVERTENCIA OPERATIVA' : 'OPERATIONAL ADVISORY'}
                </span>
                {lang === 'es'
                  ? 'Herramienta de afición, no usar como alerta operativa de control de tráfico aéreo.'
                  : 'Hobbyist utility, do not use as real or operational air traffic advisory.'}
              </div>
            </div>
          )}

          {/* Loop over definitions */}
          <div className="space-y-3">
            {filteredSettings.length > 0 ? (
              filteredSettings.map((def) => <SettingRow key={def.id} def={def} />)
            ) : (
              <div className="text-center py-12 text-xs text-slate-600 font-mono">
                {lang === 'es' ? 'No se encontraron ajustes coincidentes.' : 'No matching settings found.'}
              </div>
            )}
          </div>

          {/* Diagnostic tests block inside audio settings */}
          {activeGroup === 'audio' && searchQuery.trim().length === 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                {lang === 'es' ? 'Comprobaciones y Pruebas' : 'Diagnostic Tests'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={handleTestTic}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-950/80 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-300 transition cursor-pointer"
                >
                  <Play className="w-3 h-3 text-cyan-400" />
                  <span>{lang === 'es' ? 'Probar Tic' : 'Test Tic'}</span>
                </button>
                <button
                  onClick={handleTestEmergency}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-950/80 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-300 transition cursor-pointer"
                >
                  <Play className="w-3 h-3 text-red-400 animate-pulse" />
                  <span>{lang === 'es' ? 'Probar Alerta' : 'Test Alarm'}</span>
                </button>
                <button
                  onClick={onSimulateEmergency}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-red-950/40 border border-red-500/30 hover:bg-red-950/60 rounded-lg text-[10px] font-bold text-red-200 transition cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>{lang === 'es' ? 'Simular Alerta' : 'Simulate Squawk'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Import/Export block inside advanced settings */}
          {activeGroup === 'advanced' && searchQuery.trim().length === 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                {lang === 'es' ? 'Copia de Seguridad' : 'Backup & Portability'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center space-x-1.5 py-2 px-4 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>{lang === 'es' ? 'Exportar Ajustes (JSON)' : 'Export Settings (JSON)'}</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center space-x-1.5 py-2 px-4 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'es' ? 'Importar Ajustes (JSON)' : 'Import Settings (JSON)'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bulk reset footers inside each group */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div>
            {!confirmResetGroup ? (
              <button
                onClick={() => setConfirmResetGroup(true)}
                className="flex items-center space-x-1.5 text-slate-500 hover:text-slate-300 transition text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Restablecer Sección' : 'Reset Section'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 animate-fade-in">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {lang === 'es' ? '¿Confirmar?' : 'Sure?'}
                </span>
                <button
                  onClick={handleResetGroup}
                  className="px-2 py-1 bg-red-950 text-red-300 border border-red-500/20 text-[9px] font-bold rounded hover:bg-red-900/60 transition cursor-pointer"
                >
                  {lang === 'es' ? 'Restablecer' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmResetGroup(false)}
                  className="px-2 py-1 bg-slate-800 text-slate-300 text-[9px] font-bold rounded hover:bg-slate-700 transition cursor-pointer"
                >
                  {lang === 'es' ? 'No' : 'Cancel'}
                </button>
              </div>
            )}
          </div>

          <div>
            {!confirmResetAll ? (
              <button
                onClick={() => setConfirmResetAll(true)}
                className="flex items-center space-x-1.5 text-red-500/70 hover:text-red-400 transition text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Restablecer Todo' : 'Reset All Settings'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 animate-fade-in">
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">
                  {lang === 'es' ? '¿REESTABLECER TODO?' : 'RESET ALL?'}
                </span>
                <button
                  onClick={handleResetAll}
                  className="px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded hover:bg-red-700 transition cursor-pointer"
                >
                  {lang === 'es' ? 'Confirmar Todo' : 'Reset Everything'}
                </button>
                <button
                  onClick={() => setConfirmResetAll(false)}
                  className="px-2 py-1 bg-slate-800 text-slate-300 text-[9px] font-bold rounded hover:bg-slate-700 transition cursor-pointer"
                >
                  {lang === 'es' ? 'No' : 'Cancel'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple utility SVG icon for Settings
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
