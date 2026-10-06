/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Trash2, 
  Plus, 
  Activity, 
  Link, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  DollarSign, 
  ShieldAlert, 
  Lock, 
  Unlock,
  RefreshCw
} from 'lucide-react';
import { PROVIDERS_REGISTRY } from '../providers/registry';
import { ProviderState, AircraftProvider } from '../providers/types';
import { SecretsManager } from '../providers/secrets';
import { QuotaManager } from '../providers/quota';
import { useSetting } from '../settings/store';

export const ProvidersListEditor: React.FC = () => {
  const [lang] = useSetting<'es' | 'en'>('general.language');
  const [providerStates, setProviderStates] = useSetting<ProviderState[]>('data.provider.list');
  const [isKeysProtected, setIsKeysProtected] = useSetting<boolean>('data.provider.keys_password_protected');
  
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string } | undefined>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  
  // Custom password states
  const [securityPassword, setSecurityPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Synchronize credentials protection status
  useEffect(() => {
    if (isKeysProtected && !SecretsManager.getPassword()) {
      // Prompt state
    }
  }, [isKeysProtected]);

  const handleToggleProtect = async () => {
    if (!isKeysProtected) {
      if (!securityPassword) {
        setPasswordError(lang === 'es' ? 'Ingresa una contraseña válida.' : 'Enter a valid password.');
        return;
      }
      const ok = await SecretsManager.setPasswordProtection(true, securityPassword);
      if (ok) {
        setIsKeysProtected(true);
        setPasswordSuccess(true);
        setPasswordError('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(lang === 'es' ? 'Error al cifrar.' : 'Encryption failed.');
      }
    } else {
      await SecretsManager.setPasswordProtection(false);
      setIsKeysProtected(false);
      setSecurityPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const handleUnlockKeys = async () => {
    const success = await SecretsManager.unlockWithPassword(passwordInput);
    if (success) {
      setPasswordSuccess(true);
      setPasswordError('');
      setPasswordInput('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(lang === 'es' ? 'Contraseña incorrecta' : 'Incorrect password');
    }
  };

  // Up/down priority reordering
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= providerStates.length) return;

    const copy = [...providerStates];
    const temp = copy[index];
    copy[index] = copy[nextIndex];
    copy[nextIndex] = temp;

    // Reset priority counts sequentially
    copy.forEach((item, idx) => {
      item.priority = idx + 1;
    });

    setProviderStates(copy);
  };

  const handleToggleProvider = (id: string, checked: boolean) => {
    const registryDef = PROVIDERS_REGISTRY.find(p => p.id === id);
    const costModel = registryDef?.costModel || 'gratuito';

    if (checked && costModel === 'pago') {
      const confirmMsg = lang === 'es' 
        ? 'ADVERTENCIA: Este proveedor de datos consume créditos o dinero real por peticiones. ¿Quieres activarlo?' 
        : 'WARNING: This data provider consumes credits or real currency. Do you wish to enable it?';
      if (!window.confirm(confirmMsg)) return;
    }

    setProviderStates(providerStates.map(p => p.id === id ? { ...p, enabled: checked } : p));
  };

  const handleChangeRole = (id: string, role: ProviderState['role']) => {
    setProviderStates(providerStates.map(p => p.id === id ? { ...p, role } : p));
  };

  const handleUrlChange = (id: string, url: string) => {
    setProviderStates(providerStates.map(p => p.id === id ? { ...p, customUrl: url } : p));
  };

  const handleResetUrl = (id: string) => {
    setProviderStates(providerStates.map(p => p.id === id ? { ...p, customUrl: undefined } : p));
  };

  const handleLimitChange = (id: string, percent: number) => {
    setProviderStates(providerStates.map(p => p.id === id ? { ...p, monthlyLimitPercent: percent } : p));
  };

  // Test connection to provider securely
  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResults({ ...testResults, [id]: undefined });

    const state = providerStates.find(p => p.id === id);
    const def = PROVIDERS_REGISTRY.find(p => p.id === id);
    if (!state || !def) {
      setTestingId(null);
      return;
    }

    const secrets = SecretsManager.getCredentials(id);
    const targetUrl = state.customUrl || def.defaultUrl;

    const startTime = performance.now();

    try {
      if (id === 'receptor_local') {
        // Direct browser fetch to local RTL-SDR receiver (CORS test)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (resp.ok) {
          const delta = Math.round(performance.now() - startTime);
          setTestResults({ ...testResults, [id]: { success: true, latency: delta } });
        } else {
          setTestResults({ ...testResults, [id]: { success: false, error: `HTTP ${resp.status}` } });
        }
      } else {
        // Fetch whitelisted source through our secure proxy
        const bodyPayload = {
          lat: 40.4830,
          lon: -3.5670,
          radius: 10,
          client_id: secrets.clientId,
          client_secret: secrets.clientSecret
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (secrets.apiKey) {
          headers['X-Provider-Key'] = secrets.apiKey;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const resp = await fetch(`/api/provider/${id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const delta = Math.round(performance.now() - startTime);

        if (resp.ok) {
          setTestResults({ ...testResults, [id]: { success: true, latency: delta } });
        } else {
          const errData = await resp.json().catch(() => ({}));
          setTestResults({ ...testResults, [id]: { success: false, error: errData.error || `HTTP ${resp.status}` } });
        }
      }
    } catch (e: any) {
      setTestResults({ ...testResults, [id]: { success: false, error: e.name === 'AbortError' ? 'Timeout (4s)' : 'CORS / Offline' } });
    } finally {
      setTestingId(null);
    }
  };

  const handleAddCustomProvider = () => {
    const customId = `custom_prov_${Date.now()}`;
    const newProvider: AircraftProvider = {
      id: customId,
      name: `Custom Endpoint ${providerStates.length + 1}`,
      roles: ['live'],
      authType: 'header-key',
      headerName: 'X-Provider-Key',
      defaultUrl: 'https://api.custom-server.com/v2',
      quotaSchema: { minIntervalSec: 2 },
      costModel: 'gratuito',
      licenseLabel: 'personal',
      docUrl: '',
      description: { es: 'Servidor personalizado compatible ADSBExchange.', en: 'Custom ADSBExchange compatible server.' }
    };

    // Register dynamically
    PROVIDERS_REGISTRY.push(newProvider);

    setProviderStates([
      ...providerStates,
      {
        id: customId,
        enabled: true,
        role: 'backup',
        priority: providerStates.length + 1,
        monthlyLimitPercent: 100
      }
    ]);
  };

  const handleClearKeys = () => {
    if (window.confirm(lang === 'es' ? '¿Quieres borrar todas las credenciales de este navegador?' : 'Are you sure you want to purge all stored keys from this device?')) {
      SecretsManager.clearAll();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Secrets crypt lock block */}
      <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Lock className="w-4 h-4" />
            <span className="font-bold tracking-wider">
              {lang === 'es' ? 'PROTECCIÓN DE CLAVES' : 'CREDENTIALS ENCRYPTION'}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
            isKeysProtected ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/40' : 'bg-slate-900 text-slate-500'
          }`}>
            {isKeysProtected ? (lang === 'es' ? 'Cifrado' : 'Encrypted') : (lang === 'es' ? 'Texto Plano' : 'Plaintext')}
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-normal">
          {lang === 'es' 
            ? 'Cifra las claves de RapidAPI y Flightradar24 guardadas en tu navegador. Si lo activas, deberás ingresar la contraseña elegida para poder usar el radar.'
            : 'Encrypt credentials locally with browser WebCrypto GCM block. If active, you must key in your passphrase to unlock traffic.'}
        </p>

        {passwordError && (
          <div className="text-red-400 flex items-center space-x-1.5 text-[10px]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="text-emerald-400 flex items-center space-x-1.5 text-[10px]">
            <Check className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'Operación completada' : 'Protection status updated!'}</span>
          </div>
        )}

        {isKeysProtected && !SecretsManager.getPassword() ? (
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <input
              type="password"
              placeholder={lang === 'es' ? 'Introduce contraseña para desbloquear...' : 'Key in passphrase to unlock...'}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleUnlockKeys}
              className="w-full sm:w-auto px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs transition cursor-pointer"
            >
              {lang === 'es' ? 'Desbloquear' : 'Unlock'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            {!isKeysProtected && (
              <input
                type="password"
                placeholder={lang === 'es' ? 'Contraseña para cifrar...' : 'Passphrase for encryption...'}
                value={securityPassword}
                onChange={(e) => setSecurityPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              />
            )}
            <button
              onClick={handleToggleProtect}
              className={`w-full sm:w-auto px-4 py-1.5 font-bold rounded text-xs transition cursor-pointer shrink-0 ${
                isKeysProtected ? 'bg-red-950 text-red-200 border border-red-500/20 hover:bg-red-900/40' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/20'
              }`}
            >
              {isKeysProtected ? (lang === 'es' ? 'Desactivar Protección' : 'Disable Encryption') : (lang === 'es' ? 'Activar Cifrado' : 'Encrypt Secrets')}
            </button>
          </div>
        )}
      </div>

      {/* Providers Cards Stack */}
      <div className="space-y-4">
        {providerStates.map((state, idx) => {
          const def = PROVIDERS_REGISTRY.find(p => p.id === state.id);
          if (!def) return null;

          const isTesting = testingId === state.id;
          const test = testResults[state.id];
          
          const storedSecrets = SecretsManager.getCredentials(state.id);
          const [secretsState, setSecretsState] = useState(storedSecrets);

          // Quota stats
          const quota = QuotaManager.isCoolingDown(state.id) 
            ? `${lang === 'es' ? 'Enfriamiento' : 'Cooldown'} (${QuotaManager.getRemainingCooldownSec(state.id)}s)` 
            : 'OK';

          const handleSecretChange = (field: 'apiKey' | 'clientId' | 'clientSecret', val: string) => {
            const updated = { ...secretsState, [field]: val };
            setSecretsState(updated);
            SecretsManager.setCredentials(state.id, updated);
          };

          const handleToggleReveal = (field: string) => {
            const k = `${state.id}-${field}`;
            setShowPasswordMap(prev => ({ ...prev, [k]: !prev[k] }));
          };

          return (
            <div 
              key={state.id}
              className={`p-4 rounded-xl border transition ${
                state.enabled 
                  ? 'bg-slate-900/60 border-slate-800/80 shadow-md' 
                  : 'bg-slate-950/20 border-slate-900/60 opacity-60'
              }`}
            >
              {/* Header section with status badges */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/60 pb-3">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-xs text-white tracking-wide">{def.name}</span>
                    {/* Cost model badge */}
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-widest ${
                      def.costModel === 'gratuito' 
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20' 
                        : def.costModel === 'créditos' 
                        ? 'bg-amber-950/50 text-amber-400 border border-amber-500/20' 
                        : 'bg-red-950/50 text-red-400 border border-red-500/20'
                    }`}>
                      {def.costModel}
                    </span>
                    {/* License badge */}
                    <span className="text-[8px] text-slate-500 font-mono uppercase">
                      {def.licenseLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono leading-relaxed max-w-sm">
                    {lang === 'es' ? def.description.es : def.description.en}
                  </p>
                </div>

                {/* Primary switch */}
                <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={state.enabled}
                      onChange={(e) => handleToggleProvider(state.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-400 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950"></div>
                  </label>
                </div>
              </div>

              {/* Dynamic controls and input credentials */}
              {state.enabled && (
                <div className="mt-3 space-y-3 font-mono text-[10px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Role selector */}
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                        {lang === 'es' ? 'Rol Operativo' : 'Assigned Role'}
                      </span>
                      <select
                        value={state.role}
                        onChange={(e) => handleChangeRole(state.id, e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none"
                      >
                        <option value="primary">{lang === 'es' ? 'Principal' : 'Primary Source'}</option>
                        <option value="backup">{lang === 'es' ? 'Respaldo' : 'Backup Failover'}</option>
                        <option value="enrich-only">{lang === 'es' ? 'Solo Enriquecimiento' : 'Metadata Only'}</option>
                      </select>
                    </div>

                    {/* Priority sorting controls */}
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                        {lang === 'es' ? 'Orden de Failover' : 'Failover Order'}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="flex-1 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-400 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowUp className="w-3 h-3 mr-1" />
                          <span>{lang === 'es' ? 'Subir' : 'Up'}</span>
                        </button>
                        <button
                          disabled={idx === providerStates.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="flex-1 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-400 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowDown className="w-3 h-3 mr-1" />
                          <span>{lang === 'es' ? 'Bajar' : 'Down'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Fields according to AuthType */}
                  {def.authType === 'header-key' && (
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                        {lang === 'es' ? `Clave API (${def.headerName || 'API Key'})` : `API Credentials (${def.headerName || 'Key'})`}
                      </span>
                      <div className="relative">
                        <input
                          type={showPasswordMap[`${state.id}-apiKey`] ? 'text' : 'password'}
                          value={secretsState.apiKey || ''}
                          onChange={(e) => handleSecretChange('apiKey', e.target.value)}
                          placeholder="**************************************"
                          className="w-full bg-slate-950 border border-slate-800 rounded py-1 px-2.5 pr-8 text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => handleToggleReveal('apiKey')}
                          className="absolute right-2 top-1 text-slate-500 hover:text-slate-300"
                        >
                          {showPasswordMap[`${state.id}-apiKey`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {def.authType === 'bearer' && (
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                        Token Bearer (JWT)
                      </span>
                      <div className="relative">
                        <input
                          type={showPasswordMap[`${state.id}-token`] ? 'text' : 'password'}
                          value={secretsState.apiKey || ''}
                          onChange={(e) => handleSecretChange('apiKey', e.target.value)}
                          placeholder="ey..."
                          className="w-full bg-slate-950 border border-slate-800 rounded py-1 px-2.5 pr-8 text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => handleToggleReveal('token')}
                          className="absolute right-2 top-1 text-slate-500 hover:text-slate-300"
                        >
                          {showPasswordMap[`${state.id}-token`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {def.authType === 'oauth2-client-credentials' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                          Client ID
                        </span>
                        <input
                          type="text"
                          value={secretsState.clientId || ''}
                          onChange={(e) => handleSecretChange('clientId', e.target.value)}
                          placeholder="client_id_name"
                          className="w-full bg-slate-950 border border-slate-800 rounded py-1 px-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                          Client Secret
                        </span>
                        <div className="relative">
                          <input
                            type={showPasswordMap[`${state.id}-secret`] ? 'text' : 'password'}
                            value={secretsState.clientSecret || ''}
                            onChange={(e) => handleSecretChange('clientSecret', e.target.value)}
                            placeholder="**********************"
                            className="w-full bg-slate-950 border border-slate-800 rounded py-1 px-2.5 pr-8 text-slate-200 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleToggleReveal('secret')}
                            className="absolute right-2 top-1 text-slate-500 hover:text-slate-300"
                          >
                            {showPasswordMap[`${state.id}-secret`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editable base URL */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider block">
                      {lang === 'es' ? 'Dirección URL Base' : 'Endpoint Base URL'}
                    </span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={state.customUrl || def.defaultUrl}
                        onChange={(e) => handleUrlChange(state.id, e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded py-1 px-2.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono text-[9px]"
                      />
                      {state.customUrl !== undefined && (
                        <button
                          onClick={() => handleResetUrl(state.id)}
                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded hover:bg-slate-900 text-slate-400 text-[9px] cursor-pointer"
                        >
                          {lang === 'es' ? 'Reset' : 'Reset'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Test Connection Row */}
                  <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center space-x-3">
                      <button
                        disabled={isTesting}
                        onClick={() => handleTestConnection(state.id)}
                        className="py-1 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-[9px] font-bold text-slate-300 transition cursor-pointer flex items-center space-x-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{lang === 'es' ? 'Probar Conexión' : 'Test Route'}</span>
                      </button>

                      {/* Display results */}
                      {test && (
                        <div className="flex items-center space-x-1 text-[9px] font-bold">
                          {test.success ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">{test.latency} ms</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3 text-rose-500" />
                              <span className="text-rose-400">{test.error}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quota details */}
                    <div className="text-[9px] font-bold text-slate-500">
                      <span>Status: </span>
                      <span className="text-cyan-400 uppercase">{quota}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer controls: Add custom provider/receptor & Purge secrets */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleAddCustomProvider}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>{lang === 'es' ? 'Añadir Proveedor Personalizado' : 'Add Custom Feed'}</span>
        </button>
        <button
          onClick={handleClearKeys}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 rounded-lg text-xs font-bold text-red-300 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>{lang === 'es' ? 'Limpiar todas las claves' : 'Purge All Secrets'}</span>
        </button>
      </div>
    </div>
  );
};
