/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Search, Image as ImageIcon, ExternalLink, Camera, Sparkles, AlertCircle } from 'lucide-react';
import { LanguageCode } from '../types/aircraft';

interface PhotoArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

interface PhotoResult {
  url: string;
  thumbnailUrl: string;
  photographer: string;
  link: string;
  aircraft: string;
  cn: string;
}

export const PhotoArchiveModal: React.FC<PhotoArchiveModalProps> = ({ isOpen, onClose, lang }) => {
  const [registration, setRegistration] = useState('');
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [searchedReg, setSearchedReg] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!registration.trim()) return;

    const regClean = registration.trim().toUpperCase();
    setLoading(true);
    setError(null);
    setPhotos([]);
    setSearchedReg(regClean);

    try {
      const resp = await fetch(`/api/v2/photos/reg/${encodeURIComponent(regClean)}`);
      const data = await resp.json();

      if (data.success) {
        setPhotos(data.photos || []);
        if (data.photos.length === 0) {
          setError(lang === 'es' ? `No se encontraron fotografías para la matrícula "${regClean}".` : `No photos found for registration "${regClean}".`);
        }
      } else {
        setError(data.error || (lang === 'es' ? 'Error al consultar el archivo gráfico.' : 'Error querying photo archive.'));
      }
    } catch (err: any) {
      setError(lang === 'es' ? 'Error de conexión con el servicio de archivos gráficos.' : 'Connection error with photo archive service.');
    } finally {
      setLoading(false);
    }
  };

  const presetRegistrations = ['EC-MXM', 'D-AINA', 'N12345', 'F-GZCP', 'JA381A', 'G-XLEB'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col font-mono text-slate-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="bg-cyan-500/20 p-2 rounded-xl border border-cyan-500/40 text-cyan-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {lang === 'es' ? 'Archivo Gráfico de Aviación' : 'Aviation Photo Archive'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'es' ? 'Consulta fotografías por matrícula de aeronave (Planespotters.net)' : 'Query aircraft photos by registration'}
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

        {/* Search Form */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/50 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder={lang === 'es' ? 'Introduce matrícula (ej. EC-MXM, D-AINA)...' : 'Enter registration (e.g. EC-MXM)...'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 uppercase font-bold tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !registration.trim()}
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
            <span className="text-slate-500 shrink-0">{lang === 'es' ? 'Ejemplos:' : 'Presets:'}</span>
            {presetRegistrations.map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => {
                  setRegistration(reg);
                }}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-cyan-400 font-bold transition cursor-pointer shrink-0"
              >
                {reg}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">
                {lang === 'es' ? `Buscando fotografías para ${searchedReg}...` : `Searching photos for ${searchedReg}...`}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-center space-x-3 text-amber-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && photos.length === 0 && searchedReg === '' && (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <ImageIcon className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
              <p className="text-xs">
                {lang === 'es' ? 'Introduce una matrícula para consultar el archivo gráfico oficial.' : 'Enter an aircraft registration to query official photo archives.'}
              </p>
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {lang === 'es' ? `Resultados para ${searchedReg} (${photos.length} fotos)` : `Results for ${searchedReg} (${photos.length} photos)`}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {photos.map((photo, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col group">
                    <div className="aspect-video bg-slate-950 relative overflow-hidden">
                      <img
                        src={photo.url || photo.thumbnailUrl}
                        alt={searchedReg}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {photo.link && (
                        <a
                          href={photo.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 text-[10px]"
                        >
                          <span>Planespotters</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="p-3 space-y-1 text-xs">
                      {photo.aircraft && (
                        <div className="font-bold text-white truncate">{photo.aircraft}</div>
                      )}
                      <div className="text-slate-400 flex justify-between items-center">
                        <span>{lang === 'es' ? 'Fotógrafo:' : 'Photographer:'} <span className="text-slate-200 font-semibold">{photo.photographer}</span></span>
                        {photo.cn && <span className="text-[10px] text-slate-500 font-mono">c/n {photo.cn}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
