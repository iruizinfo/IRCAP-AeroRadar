/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, Search, Plane, Sparkles, AlertCircle, ArrowRightLeft, 
  Building2, Upload, Download, Trash2, Database, Table, FileSpreadsheet, Plus, CheckCircle, RotateCcw
} from 'lucide-react';
import { LanguageCode, Aircraft } from '../types/aircraft';
import * as XLSX from 'xlsx';
import { 
  getCallsignMappings, saveCallsignMapping, deleteCallsignMapping, resetCallsignMappings, 
  CallsignMapping, findRouteInDatabase, resolveCommercialFlight, resolveAtcCallsign 
} from '../utils/flightCrossReference';

interface RouteSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  aircraftList: Aircraft[];
  onSelectAircraft: (ac: Aircraft) => void;
}

interface AirportInfo {
  name: string;
  municipality: string;
  country_name: string;
  iata_code: string;
  icao_code: string;
  elevation: number;
  latitude: number;
  longitude: number;
}

interface RouteResult {
  callsign: string;
  flightNumber?: string;
  atcCallsign?: string;
  callsign_iata?: string;
  matchType?: string;
  airline?: {
    name: string;
    icao: string;
    iata: string;
    country: string;
    callsign: string;
  };
  origin: AirportInfo;
  destination: AirportInfo;
}

export const RouteSearchModal: React.FC<RouteSearchModalProps> = ({ 
  isOpen, onClose, lang, aircraftList, onSelectAircraft 
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'database' | 'mappings'>('search');
  const [flightNumber, setFlightNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [searchedFlight, setSearchedFlight] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Custom Database state
  const [customRoutes, setCustomRoutes] = useState<RouteResult[]>([]);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message: string } | null>(null);

  // Callsign Mappings state
  const [mappings, setMappings] = useState<CallsignMapping[]>([]);
  const [mappingsQuery, setMappingsQuery] = useState('');
  const [newAtc, setNewAtc] = useState('');
  const [newCommercial, setNewCommercial] = useState('');
  const [newAirline, setNewAirline] = useState('');
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);

  // Load custom database routes and mappings from local storage
  const loadData = () => {
    try {
      const savedRoutes = localStorage.getItem('ircap_custom_routes');
      if (savedRoutes) {
        setCustomRoutes(JSON.parse(savedRoutes));
      }
      setMappings(getCallsignMappings());
    } catch (e) {
      console.error('Error loading custom routes or mappings:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const saveCustomRoutes = (routes: RouteResult[]) => {
    try {
      localStorage.setItem('ircap_custom_routes', JSON.stringify(routes));
      setCustomRoutes(routes);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Error saving custom routes:', e);
    }
  };

  if (!isOpen) return null;

  // Search including live radar auto-focus, local custom DB, and API
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!flightNumber.trim()) return;

    const flightClean = flightNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. Check if matching aircraft is currently flying on the live radar!
    // Checks direct transponder callsign or mapped commercial flight
    const targetAtc = resolveAtcCallsign(flightClean) || flightClean;
    const targetComm = resolveCommercialFlight(flightClean) || flightClean;

    const activeFlight = aircraftList.find((ac) => {
      const acCall = ac.callsign.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const acComm = resolveCommercialFlight(acCall);
      return acCall === flightClean || acCall === targetAtc || (acComm && (acComm === flightClean || acComm === targetComm));
    });

    if (activeFlight) {
      onSelectAircraft(activeFlight);
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSearchedFlight(flightClean);

    // 2. Check local custom database using cross-referencing engine!
    const matchResult = findRouteInDatabase(flightClean, customRoutes);
    if (matchResult) {
      const routeData = matchResult.matchedRoute;
      setResult({
        ...routeData,
        flightNumber: matchResult.commercialFlight,
        atcCallsign: matchResult.atcCallsign,
        matchType: matchResult.matchType
      });
      setLoading(false);
      return;
    }

    // 3. Fallback to API lookup
    try {
      const resp = await fetch(`/api/v2/routes/callsign/${encodeURIComponent(flightClean)}`);
      const data = await resp.json();

      if (data.success && data.route) {
        let finalRoute = data.route;

        // If API returned a route, cross-reference with our stored custom database!
        if (customRoutes.length > 0) {
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
              atcCallsign: flightClean,
              matchType: crossMatch.matchType
            };
          }
        }

        // Also check if flightClean maps to a commercial flight
        if (!finalRoute.flightNumber) {
          const comm = resolveCommercialFlight(flightClean);
          if (comm) {
            finalRoute = {
              ...finalRoute,
              flightNumber: comm,
              atcCallsign: flightClean,
              matchType: 'mapping'
            };
          }
        }

        setResult(finalRoute);
      } else {
        setError(lang === 'es' 
          ? `No se encontró información de ruta para el indicativo "${flightClean}".` 
          : `No flight route info found for identifier "${flightClean}".`);
      }
    } catch {
      setError(lang === 'es' ? 'Error de conexión con el servicio de rutas de vuelo.' : 'Connection error with flight routes service.');
    } finally {
      setLoading(false);
    }
  };

  // Generate and download template Excel with cross-reference column
  const downloadTemplate = () => {
    const headers = [
      [
        "Flight Number (Comercial)",
        "ATC Callsign (Transponder)",
        "Airline Name",
        "Origin IATA",
        "Origin Full Name",
        "Origin City",
        "Origin Country",
        "Destination IATA",
        "Destination Full Name",
        "Destination City",
        "Destination Country"
      ]
    ];
    const sampleData = [
      ["IB1675", "IBS16LJ", "Iberia Express", "MAD", "Adolfo Suárez Madrid-Barajas Airport", "Madrid", "Spain", "PMI", "Palma de Mallorca Airport", "Palma de Mallorca", "Spain"],
      ["IB3112", "IBE3112", "Iberia", "MAD", "Adolfo Suárez Madrid-Barajas Airport", "Madrid", "Spain", "LIS", "Humberto Delgado Airport", "Lisbon", "Portugal"],
      ["FR4511", "RYR45LJ", "Ryanair", "STN", "London Stansted Airport", "London", "United Kingdom", "MAD", "Adolfo Suárez Madrid-Barajas Airport", "Madrid", "Spain"],
      ["VY1234", "VLG12AB", "Vueling", "BCN", "Josep Tarradellas Barcelona-El Prat", "Barcelona", "Spain", "MAD", "Adolfo Suárez Madrid-Barajas Airport", "Madrid", "Spain"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Rutas y Cruces");
    XLSX.writeFile(wb, "plantilla_rutas_con_cruce_atc.xlsx");
  };

  // Export current routes database to Excel
  const exportDatabase = () => {
    if (customRoutes.length === 0) {
      alert(lang === 'es' ? 'La base de datos está vacía.' : 'The database is empty.');
      return;
    }

    const exportRows = customRoutes.map((r) => ({
      "Flight Number (Comercial)": r.flightNumber || r.callsign,
      "ATC Callsign (Transponder)": r.atcCallsign || resolveAtcCallsign(r.callsign) || '',
      "Airline Name": r.airline?.name || '',
      "Origin IATA": r.origin.iata_code,
      "Origin Full Name": r.origin.name,
      "Origin City": r.origin.municipality,
      "Origin Country": r.origin.country_name,
      "Destination IATA": r.destination.iata_code,
      "Destination Full Name": r.destination.name,
      "Destination City": r.destination.municipality,
      "Destination Country": r.destination.country_name
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base de Datos de Rutas");
    XLSX.writeFile(wb, "radar_rutas_personalizadas.xlsx");
  };

  // Import from Excel file with smart 10 or 11 column detection & ATC cross-reference registration
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    setImportStatus(null);

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        if (rows.length <= 1) {
          throw new Error(lang === 'es' ? 'El archivo Excel no contiene registros de datos válidos.' : 'The Excel file contains no valid data rows.');
        }

        // Inspect header row to determine column layout
        const headerRow = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
        const hasAtcCol = headerRow.length >= 11 || headerRow.some((h: string) => h.includes('atc') || h.includes('transponder'));

        const parsed: RouteResult[] = [];
        let errorsCount = 0;
        let mappingsRegistered = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let rawCol0 = String(row[0] || '').trim();
          let rawCol1 = String(row[1] || '').trim();

          let commercialFlight = '';
          let atcCallsign = '';
          let airlineName = '';
          let originIata = '';
          let originName = '';
          let originCity = '';
          let originCountry = '';
          let destinationIata = '';
          let destinationName = '';
          let destinationCity = '';
          let destinationCountry = '';

          if (hasAtcCol) {
            // 11-column format
            commercialFlight = rawCol0.toUpperCase().replace(/[^A-Z0-9]/g, '');
            atcCallsign = rawCol1.toUpperCase().replace(/[^A-Z0-9]/g, '');
            airlineName = String(row[2] || '').trim();
            originIata = String(row[3] || '').trim().toUpperCase();
            originName = String(row[4] || '').trim();
            originCity = String(row[5] || '').trim();
            originCountry = String(row[6] || '').trim();
            destinationIata = String(row[7] || '').trim().toUpperCase();
            destinationName = String(row[8] || '').trim();
            destinationCity = String(row[9] || '').trim();
            destinationCountry = String(row[10] || '').trim();
          } else {
            // 10-column format: check if col0 contains combined e.g. "IB1675 / IBS16LJ"
            const parts = rawCol0.split(/[\/,\|\(\)]/).map((p) => p.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean);
            commercialFlight = parts[0] || '';
            atcCallsign = parts[1] || '';
            airlineName = rawCol1;
            originIata = String(row[2] || '').trim().toUpperCase();
            originName = String(row[3] || '').trim();
            originCity = String(row[4] || '').trim();
            originCountry = String(row[5] || '').trim();
            destinationIata = String(row[6] || '').trim().toUpperCase();
            destinationName = String(row[7] || '').trim();
            destinationCity = String(row[8] || '').trim();
            destinationCountry = String(row[9] || '').trim();
          }

          if (!commercialFlight || !originIata || !destinationIata) {
            errorsCount++;
            continue;
          }

          // If ATC callsign is present, register in the cross-reference mapping engine!
          if (atcCallsign && atcCallsign !== commercialFlight) {
            saveCallsignMapping({
              atcCallsign,
              commercialFlight,
              airline: airlineName || 'Airline',
              originIata,
              destinationIata,
              source: 'excel'
            });
            mappingsRegistered++;
          }

          parsed.push({
            callsign: commercialFlight,
            flightNumber: commercialFlight,
            atcCallsign: atcCallsign || undefined,
            callsign_iata: commercialFlight,
            airline: {
              name: airlineName || 'Airline',
              icao: '',
              iata: '',
              country: '',
              callsign: ''
            },
            origin: {
              name: originName || `${originIata} Airport`,
              municipality: originCity || originIata,
              country_name: originCountry || 'Unknown',
              iata_code: originIata,
              icao_code: '',
              elevation: 0,
              latitude: 0,
              longitude: 0
            },
            destination: {
              name: destinationName || `${destinationIata} Airport`,
              municipality: destinationCity || destinationIata,
              country_name: destinationCountry || 'Unknown',
              iata_code: destinationIata,
              icao_code: '',
              elevation: 0,
              latitude: 0,
              longitude: 0
            }
          });
        }

        if (parsed.length > 0) {
          const mergedMap = new Map<string, RouteResult>();
          customRoutes.forEach((r) => mergedMap.set(r.callsign, r));
          parsed.forEach((r) => mergedMap.set(r.callsign, r));

          const newList = Array.from(mergedMap.values());
          saveCustomRoutes(newList);
          setMappings(getCallsignMappings());

          setImportStatus({
            success: true,
            message: lang === 'es'
              ? `¡Importación exitosa! Se añadieron/actualizaron ${parsed.length} rutas y se registraron ${mappingsRegistered} cruces ATC ↔ Comercial (Omitidas: ${errorsCount}).`
              : `Import successful! Added/updated ${parsed.length} routes and registered ${mappingsRegistered} ATC ↔ Commercial cross-references (Skipped: ${errorsCount}).`
          });
        } else {
          setImportStatus({
            success: false,
            message: lang === 'es' ? 'No se encontraron registros de rutas válidos en el archivo.' : 'No valid flight route rows found in the sheet.'
          });
        }
      } catch (err: any) {
        setImportStatus({
          success: false,
          message: lang === 'es' ? `Fallo al leer el archivo Excel: ${err.message}` : `Error parsing Excel: ${err.message}`
        });
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const deleteRoute = (callsign: string) => {
    const updated = customRoutes.filter((r) => r.callsign !== callsign);
    saveCustomRoutes(updated);
  };

  const clearAllRoutes = () => {
    if (confirm(lang === 'es' ? '¿Estás seguro de que quieres borrar TODAS las rutas personalizadas?' : 'Are you sure you want to clear ALL custom routes?')) {
      saveCustomRoutes([]);
    }
  };

  const handleAddMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAtc.trim() || !newCommercial.trim()) return;

    saveCallsignMapping({
      atcCallsign: newAtc,
      commercialFlight: newCommercial,
      airline: newAirline.trim() || undefined,
      source: 'user'
    });

    setMappings(getCallsignMappings());
    setNewAtc('');
    setNewCommercial('');
    setNewAirline('');
    setMappingMessage(lang === 'es' ? '¡Cruce guardado con éxito!' : 'Cross-reference saved successfully!');
    setTimeout(() => setMappingMessage(null), 3000);
  };

  const handleDeleteMapping = (atcCallsign: string) => {
    deleteCallsignMapping(atcCallsign);
    setMappings(getCallsignMappings());
  };

  const handleResetMappings = () => {
    if (confirm(lang === 'es' ? '¿Restaurar los cruces a los valores por defecto del sistema?' : 'Reset cross-references to system defaults?')) {
      resetCallsignMappings();
      setMappings(getCallsignMappings());
    }
  };

  const filteredDbRoutes = customRoutes.filter((r) => {
    const q = dbSearchQuery.toLowerCase();
    return (
      r.callsign.toLowerCase().includes(q) ||
      (r.atcCallsign || '').toLowerCase().includes(q) ||
      (r.flightNumber || '').toLowerCase().includes(q) ||
      r.origin.iata_code.toLowerCase().includes(q) ||
      r.destination.iata_code.toLowerCase().includes(q) ||
      (r.airline?.name || '').toLowerCase().includes(q)
    );
  });

  const filteredMappings = mappings.filter((m) => {
    const q = mappingsQuery.toLowerCase();
    return (
      m.atcCallsign.toLowerCase().includes(q) ||
      m.commercialFlight.toLowerCase().includes(q) ||
      (m.airline || '').toLowerCase().includes(q) ||
      (m.originIata || '').toLowerCase().includes(q) ||
      (m.destinationIata || '').toLowerCase().includes(q)
    );
  });

  const presetFlights = ['IBS16LJ', 'IB1675', 'IBE3112', 'DLH400', 'BAW257', 'RYR4511'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col font-mono text-slate-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="bg-cyan-500/20 p-2 rounded-xl border border-cyan-500/40 text-cyan-400">
              <Plane className="w-5 h-5 rotate-45" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {lang === 'es' ? 'Módulo de Rutas y Cruce de Vuelos' : 'Flight Route & Callsign Cross-Reference'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'es' ? 'Cruce inteligente entre indicativos ATC (IBS16LJ) y vuelos comerciales (IB1675)' : 'Intelligent cross-referencing between ATC callsigns and commercial flights'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('search');
              setError(null);
            }}
            className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center space-x-2 cursor-pointer shrink-0 ${
              activeTab === 'search'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'Buscador de Rutas' : 'Route Search'}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('database');
              setImportStatus(null);
            }}
            className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center space-x-2 cursor-pointer shrink-0 ${
              activeTab === 'database'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'Base de Datos Excel' : 'Excel Database'}</span>
            <span className="bg-slate-800 text-[10px] text-cyan-300 px-1.5 py-0.5 rounded-full font-bold">
              {customRoutes.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('mappings');
              setMappingMessage(null);
            }}
            className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center space-x-2 cursor-pointer shrink-0 ${
              activeTab === 'mappings'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'Cruce de Vuelos (ATC ↔ Comercial)' : 'ATC ↔ Commercial Cross-Ref'}</span>
            <span className="bg-slate-800 text-[10px] text-cyan-300 px-1.5 py-0.5 rounded-full font-bold">
              {mappings.length}
            </span>
          </button>
        </div>

        {activeTab === 'search' && (
          <>
            {/* Search Form */}
            <div className="p-6 border-b border-slate-800/80 bg-slate-900/50 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder={lang === 'es' ? 'Ej. IBS16LJ, IB1675, IBE3112...' : 'Flight # or ATC (e.g. IBS16LJ, IB1675)...'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 uppercase font-bold tracking-wider"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !flightNumber.trim()}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-2 shrink-0"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{lang === 'es' ? 'Buscar' : 'Search'}</span>
                </button>
              </form>

              {/* Preset Chips */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 shrink-0">{lang === 'es' ? 'Probar ejemplos:' : 'Try presets:'}</span>
                {presetFlights.map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => {
                      setFlightNumber(fl);
                    }}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-cyan-400 font-bold transition cursor-pointer shrink-0"
                  >
                    {fl}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30">
              {loading && (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">
                    {lang === 'es' ? `Cruzando información de ruta para "${searchedFlight}"...` : `Cross-referencing flight route for "${searchedFlight}"...`}
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-center space-x-3 text-amber-300 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && !result && searchedFlight === '' && (
                <div className="py-16 text-center space-y-2 text-slate-500">
                  <Plane className="w-12 h-12 mx-auto stroke-1 text-slate-600 rotate-45" />
                  <p className="text-xs max-w-md mx-auto">
                    {lang === 'es' 
                      ? 'Introduce un indicativo de radio ATC (ej. "IBS16LJ") o el número de vuelo comercial (ej. "IB1675"). El sistema cruzará automáticamente los datos.' 
                      : 'Enter an ATC radio callsign (e.g. "IBS16LJ") or a commercial flight number (e.g. "IB1675"). The system will cross-reference them.'}
                  </p>
                </div>
              )}

              {!loading && result && (
                <div className="space-y-4">
                  {/* Flight Summary Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        {lang === 'es' ? 'Identificación de Vuelo' : 'Flight Identification'}
                      </span>
                      <div className="text-2xl font-black text-white flex items-center gap-2 flex-wrap">
                        <span>{result.flightNumber || result.callsign}</span>
                        {result.atcCallsign && result.atcCallsign.toUpperCase() !== (result.flightNumber || result.callsign).toUpperCase() && (
                          <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold px-2 py-0.5 rounded-md font-mono">
                            ATC: {result.atcCallsign}
                          </span>
                        )}
                      </div>
                    </div>

                    {result.airline && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{lang === 'es' ? 'Línea Aérea' : 'Airline'}</span>
                        <div className="font-bold text-cyan-300 flex items-center justify-end gap-1 text-sm">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{result.airline.name}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cross-Reference Badge Banner */}
                  {(result.flightNumber && result.atcCallsign && result.flightNumber.toUpperCase() !== result.atcCallsign.toUpperCase()) && (
                    <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-3 flex items-center justify-between text-xs text-cyan-200">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>
                          {lang === 'es' ? 'Cruce verificado con éxito:' : 'Verified cross-reference:'}{' '}
                          <strong className="text-white">ATC {result.atcCallsign}</strong> ➔ <strong className="text-cyan-400">Vuelo {result.flightNumber}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] bg-cyan-900/60 px-2 py-0.5 rounded uppercase font-bold">
                        {result.matchType || 'Vinculado'}
                      </span>
                    </div>
                  )}

                  {/* Graphic Journey Representation */}
                  <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />

                    {/* Origin */}
                    <div className="flex-1 space-y-2 z-10 w-full text-center md:text-left">
                      <span className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {lang === 'es' ? 'Origen' : 'Origin'}
                      </span>
                      <div className="text-4xl font-black text-white">{result.origin.iata_code}</div>
                      <div className="font-bold text-sm text-slate-200">{result.origin.municipality}</div>
                      <p className="text-xs text-slate-400 font-normal leading-normal">{result.origin.name}</p>
                      <p className="text-[10px] text-slate-500">{result.origin.country_name}</p>
                    </div>

                    {/* Transition Line */}
                    <div className="flex flex-col items-center justify-center w-full md:w-auto shrink-0 z-10">
                      <div className="text-cyan-400 flex items-center justify-center space-x-1 animate-pulse">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div className="h-[2px] w-24 bg-gradient-to-r from-cyan-500/40 via-cyan-400 to-transparent my-1 hidden md:block" />
                    </div>

                    {/* Destination */}
                    <div className="flex-1 space-y-2 z-10 w-full text-center md:text-right">
                      <span className="bg-rose-500/25 border border-rose-500/40 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {lang === 'es' ? 'Destino' : 'Destination'}
                      </span>
                      <div className="text-4xl font-black text-white">{result.destination.iata_code}</div>
                      <div className="font-bold text-sm text-slate-200">{result.destination.municipality}</div>
                      <p className="text-xs text-slate-400 font-normal leading-normal">{result.destination.name}</p>
                      <p className="text-[10px] text-slate-500">{result.destination.country_name}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'database' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Action Buttons Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={downloadTemplate}
                className="flex items-center justify-center space-x-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer text-slate-300"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'es' ? 'Plantilla con Cruce ATC' : 'Template with ATC'}</span>
              </button>

              <label className="flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer shrink-0">
                <Upload className="w-4 h-4" />
                <span>{lang === 'es' ? 'Importar Excel' : 'Import Excel'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <button
                onClick={exportDatabase}
                disabled={customRoutes.length === 0}
                className="flex items-center justify-center space-x-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 disabled:opacity-50 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer text-slate-300"
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'es' ? 'Exportar Excel' : 'Export Excel'}</span>
              </button>
            </div>

            {/* Import Status Alert Banner */}
            {importStatus && (
              <div className={`p-3.5 border rounded-xl flex items-start space-x-3 text-xs leading-normal font-normal ${
                importStatus.success
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                <AlertCircle className={`w-5 h-5 shrink-0 ${importStatus.success ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span>{importStatus.message}</span>
              </div>
            )}

            {/* Search and Database Table Control */}
            <div className="flex-1 flex flex-col space-y-3 min-h-[180px]">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    placeholder={lang === 'es' ? 'Filtrar por vuelo comercial, ATC, aerolínea, origen/destino...' : 'Filter by commercial flight, ATC, origin/destination...'}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {customRoutes.length > 0 && (
                  <button
                    onClick={clearAllRoutes}
                    className="p-2 bg-rose-950/50 hover:bg-rose-900 border border-rose-800/60 rounded-xl text-rose-400 transition cursor-pointer"
                    title={lang === 'es' ? 'Borrar base de datos' : 'Clear Database'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Database Table / Rows */}
              <div className="flex-1 overflow-y-auto border border-slate-800 bg-slate-950/20 rounded-xl max-h-[30vh]">
                {filteredDbRoutes.length === 0 ? (
                  <div className="py-12 text-center space-y-2 text-slate-500">
                    <Table className="w-8 h-8 mx-auto stroke-1 text-slate-600" />
                    <p className="text-xs">
                      {dbSearchQuery
                        ? (lang === 'es' ? 'No se encontraron rutas que coincidan con el filtro.' : 'No routes matching filter.')
                        : (lang === 'es' ? 'Base de datos vacía. Descarga la plantilla para importar tus rutas.' : 'Database empty. Download the template to import custom flight routes.')}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {filteredDbRoutes.map((route, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs hover:bg-slate-900/60 transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{route.callsign}</span>
                            {(route.atcCallsign || resolveAtcCallsign(route.callsign)) && (
                              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono">
                                ATC: {route.atcCallsign || resolveAtcCallsign(route.callsign)}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">({route.airline?.name || 'Airlines'})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                            <span className="text-emerald-400 font-bold">{route.origin.iata_code}</span>
                            <span className="text-slate-500 font-normal">{route.origin.municipality}</span>
                            <span>➔</span>
                            <span className="text-rose-400 font-bold">{route.destination.iata_code}</span>
                            <span className="text-slate-500 font-normal">{route.destination.municipality}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRoute(route.callsign)}
                          className="p-1.5 hover:bg-rose-950/45 hover:border-rose-900/50 rounded text-rose-400/80 hover:text-rose-400 transition border border-transparent cursor-pointer"
                          title="Eliminar ruta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Quick Add Form */}
            <form onSubmit={handleAddMapping} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  {lang === 'es' ? 'Añadir Cruce Manual (ATC ↔ Vuelo Comercial)' : 'Add Manual Mapping (ATC ↔ Commercial)'}
                </span>
                {mappingMessage && (
                  <span className="text-xs text-emerald-400 font-bold animate-pulse">{mappingMessage}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {lang === 'es' ? 'Indicativo ATC (Transponder)' : 'ATC Callsign'}
                  </label>
                  <input
                    type="text"
                    value={newAtc}
                    onChange={(e) => setNewAtc(e.target.value)}
                    placeholder="Ej. IBS16LJ"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 uppercase font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {lang === 'es' ? 'Número Comercial' : 'Commercial Flight #'}
                  </label>
                  <input
                    type="text"
                    value={newCommercial}
                    onChange={(e) => setNewCommercial(e.target.value)}
                    placeholder="Ej. IB1675"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 uppercase font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {lang === 'es' ? 'Aerolínea (Opcional)' : 'Airline (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={newAirline}
                    onChange={(e) => setNewAirline(e.target.value)}
                    placeholder="Ej. Iberia Express"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={!newAtc.trim() || !newCommercial.trim()}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'es' ? 'Guardar Cruce' : 'Save Mapping'}</span>
                </button>
              </div>
            </form>

            {/* Mappings Filter & Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={mappingsQuery}
                  onChange={(e) => setMappingsQuery(e.target.value)}
                  placeholder={lang === 'es' ? 'Buscar cruce (ej. IBS16LJ, IB1675)...' : 'Search mapping (e.g. IBS16LJ, IB1675)...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              <button
                onClick={handleResetMappings}
                className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition cursor-pointer flex items-center gap-1.5 text-xs"
                title={lang === 'es' ? 'Restaurar valores del sistema' : 'Reset to defaults'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'es' ? 'Por defecto' : 'Defaults'}</span>
              </button>
            </div>

            {/* Mappings List */}
            <div className="flex-1 overflow-y-auto border border-slate-800 bg-slate-950/20 rounded-xl max-h-[35vh]">
              {filteredMappings.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {lang === 'es' ? 'No se encontraron cruces coincidentes.' : 'No matching cross-references.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filteredMappings.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs hover:bg-slate-900/60 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-cyan-300 font-mono font-bold">
                          ATC: {m.atcCallsign}
                        </div>
                        <span className="text-cyan-400 font-bold">➔</span>
                        <div className="bg-cyan-950/80 border border-cyan-500/40 px-2 py-1 rounded text-white font-mono font-black">
                          {m.commercialFlight}
                        </div>
                        {m.airline && (
                          <span className="text-[11px] text-slate-400 hidden sm:inline">({m.airline})</span>
                        )}
                        {m.originIata && m.destinationIata && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            [{m.originIata} ➔ {m.destinationIata}]
                          </span>
                        )}
                        {m.source && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                            {m.source}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteMapping(m.atcCallsign)}
                        className="p-1.5 hover:bg-rose-950/45 rounded text-rose-400/80 hover:text-rose-400 transition cursor-pointer"
                        title="Eliminar cruce"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
