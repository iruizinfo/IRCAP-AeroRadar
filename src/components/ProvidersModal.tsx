/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Radio, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LanguageCode } from '../types/aircraft';
import { translations } from '../i18n/translations';

interface ProviderStatus {
  id: string;
  name: string;
  active: boolean;
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
  latencyMs: number;
}

interface ProvidersModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

export const ProvidersModal: React.FC<ProvidersModalProps> = ({ isOpen, onClose, lang }) => {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/v2/providers/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.statuses) {
          setStatuses(data.statuses);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl p-6 text-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Radio className="w-5 h-5" />
            <h3 className="text-lg font-bold text-white">{t.providers} (ADSB Network & Failover)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            El sistema gestiona failover automático entre múltiples fuentes ADSB (adsb.lol, airplanes.live, adsb.fi) con limitación de tasa y caché.
          </p>

          {loading ? (
            <div className="text-center py-6 text-slate-500 text-xs animate-pulse">Comprobando estado de proveedores...</div>
          ) : (
            <div className="space-y-2">
              {statuses.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    p.active
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {p.healthy ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                    <div>
                      <div className="font-bold flex items-center space-x-2">
                        <span>{p.name}</span>
                        {p.active && (
                          <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-500/40">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Latencia: {p.latencyMs}ms • Errores: {p.errorCount}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${p.healthy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                      {p.healthy ? 'Saludable' : 'Degradado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
