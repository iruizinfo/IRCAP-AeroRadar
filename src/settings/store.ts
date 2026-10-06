/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import { settingsRegistry, SettingDefinition } from './registry';

const LOCAL_STORAGE_KEY = 'aeroradar.settings';
const SCHEMA_VERSION = 1;

interface SettingsState {
  schemaVersion: number;
  values: Record<string, any>;
}

// In-memory backing store for settings
let currentSettingsState: SettingsState = {
  schemaVersion: SCHEMA_VERSION,
  values: {}
};

// Subscriptions map by specific setting ID
const subscribers = new Map<string, Set<() => void>>();

function getSubscribersForId(id: string): Set<() => void> {
  if (!subscribers.has(id)) {
    subscribers.set(id, new Set());
  }
  return subscribers.get(id)!;
}

// Global notify helper
function notify(id: string) {
  const set = subscribers.get(id);
  if (set) {
    set.forEach((cb) => cb());
  }
}

/**
 * Validates a value against its SettingDefinition.
 * Returns the value if valid, or falls back to defaultValue.
 */
function validateValue(def: SettingDefinition, val: any): any {
  if (val === undefined || val === null) {
    return def.defaultValue;
  }

  // Type-specific validations
  if (def.type === 'toggle' && typeof val !== 'boolean') {
    return def.defaultValue;
  }
  if (def.type === 'slider' || def.type === 'number') {
    const num = Number(val);
    if (isNaN(num)) return def.defaultValue;
    if (def.min !== undefined && num < def.min) return def.min;
    if (def.max !== undefined && num > def.max) return def.max;
    return num;
  }
  if (def.type === 'select' && def.options) {
    const isValidOption = def.options.some((opt) => opt.value === val);
    if (!isValidOption) return def.defaultValue;
  }

  return val;
}

/**
 * Loads and initializes settings from localStorage, or falls back to in-memory state.
 * Performs migrations if loading older schema versions or legacy key states.
 */
export function initializeSettingsStore() {
  if (typeof window === 'undefined') return;

  let loadedState: SettingsState | null = null;

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      loadedState = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[SettingsStore] Failed to read localStorage, running in memory-only mode.');
  }

  const values: Record<string, any> = {};

  // Build values using definitions as baseline
  settingsRegistry.forEach((def, id) => {
    let loadedValue = loadedState?.values?.[id];
    values[id] = validateValue(def, loadedValue !== undefined ? loadedValue : def.defaultValue);
  });

  currentSettingsState = {
    schemaVersion: SCHEMA_VERSION,
    values
  };

  // 1. PERFORM LEGACY KEYS MIGRATION
  performLegacyMigration();

  // 2. PERSIST THE SYNCHRONIZED CLEAN STATE
  saveToLocalStorage();

  // 3. RUN DEVELOPMENT CHECKS (Warning duplicate IDs, missing dependencies, or invalid defaults)
  if (process.env.NODE_ENV !== 'production') {
    validateStoreIntegrity();
  }
}

/**
 * Validates all registered settings for referential integrity and valid default values.
 */
function validateStoreIntegrity() {
  settingsRegistry.forEach((def) => {
    // Check invalid defaults
    const validatedDefault = validateValue(def, def.defaultValue);
    if (validatedDefault !== def.defaultValue) {
      console.warn(`[SettingsStore] Validation warning: "${def.id}" has an invalid defaultValue:`, def.defaultValue);
    }

    // Check invalid dependencies
    if (def.dependsOn) {
      if (!settingsRegistry.has(def.dependsOn.id)) {
        console.warn(`[SettingsStore] Referral warning: "${def.id}" depends on a non-existent setting ID: "${def.dependsOn.id}"`);
      }
    }
  });
}

/**
 * Legacy key mapping list migrating ircap_* and general keys cleanly.
 */
function performLegacyMigration() {
  if (typeof window === 'undefined') return;

  let migrated = false;

  const legacyKeyMappings: Record<string, string> = {
    'ircap_audio_volume': 'audio.master.volume',
    'ircap_audio_muted': 'audio.master.enabled', // Note: inverse conversion or direct mapping
    'ircap_audio_tic_enabled': 'audio.tic.mode', // converted during check
    'ircap_audio_emergencies_enabled': 'audio.alarm.enabled',
    'ircap_audio_tts_enabled': 'audio.voice.enabled',
    'ircap_audio_voice_uri': 'audio.voice.browser_uri',
    'ircap_audio_gemini_tts_enabled': 'audio.voice.gemini_enabled',
    'ircap_audio_include_callsign': 'audio.voice.include_callsign',
    'ircap_audio_gemini_voice': 'audio.voice.gemini_voice_temp_id_ignored', // voice settings handled in audio.ts if needed
    'ircap_units': 'map.units',
    'ircap_lang': 'general.language',
    'ircap_active_provider': 'data.provider.preferred'
  };

  Object.entries(legacyKeyMappings).forEach(([oldKey, newId]) => {
    const rawVal = localStorage.getItem(oldKey);
    if (rawVal !== null) {
      migrated = true;
      const def = settingsRegistry.get(newId);
      if (def) {
        let finalVal: any = rawVal;

        // Custom conversions for key type mismatches
        if (oldKey === 'ircap_audio_muted') {
          finalVal = rawVal === 'false'; // muted=false means enabled=true
        } else if (oldKey === 'ircap_audio_tic_enabled') {
          const ticMode = localStorage.getItem('ircap_audio_tic_mode');
          finalVal = rawVal === 'true' ? (ticMode || 'all') : 'disabled';
        } else if (rawVal === 'true') {
          finalVal = true;
        } else if (rawVal === 'false') {
          finalVal = false;
        } else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') {
          finalVal = Number(rawVal);
        }

        currentSettingsState.values[newId] = validateValue(def, finalVal);
      }
      // Remove legacy key to mark as migrated
      localStorage.removeItem(oldKey);
    }
  });

  if (migrated) {
    console.info('[SettingsStore] Successfully migrated legacy local storage keys to the unified AeroRadar settings store.');
  }
}

function saveToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSettingsState));
  } catch (e) {
    // silent fail
  }
}

/**
 * Synchronize settings across browser tabs on storage events.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as SettingsState;
        if (parsed && parsed.values) {
          const prevValues = currentSettingsState.values;
          currentSettingsState = parsed;

          // Notify only changed keys
          settingsRegistry.forEach((_, id) => {
            if (prevValues[id] !== parsed.values[id]) {
              notify(id);
            }
          });
        }
      } catch {
        // ignore
      }
    }
  });
}

// --- API IMPLEMENTATION ---

export function getSetting<T = any>(id: string): T {
  const def = settingsRegistry.get(id);
  if (!def) {
    throw new Error(`[SettingsStore] Error: Attempted to get unregistered setting ID: "${id}"`);
  }
  const val = currentSettingsState.values[id];
  return val !== undefined ? val : def.defaultValue;
}

export function setSetting(id: string, value: any) {
  const def = settingsRegistry.get(id);
  if (!def) {
    throw new Error(`[SettingsStore] Error: Attempted to set unregistered setting ID: "${id}"`);
  }

  const validated = validateValue(def, value);
  const oldVal = currentSettingsState.values[id];

  if (oldVal !== validated) {
    currentSettingsState.values[id] = validated;
    saveToLocalStorage();
    notify(id);
  }
}

export function resetSetting(id: string) {
  const def = settingsRegistry.get(id);
  if (def) {
    setSetting(id, def.defaultValue);
  }
}

export function resetGroup(group: string) {
  settingsRegistry.forEach((def, id) => {
    if (def.group === group) {
      setSetting(id, def.defaultValue);
    }
  });
}

export function resetAll() {
  settingsRegistry.forEach((def, id) => {
    setSetting(id, def.defaultValue);
  });
}

/**
 * Dynamic React Hook subscribing to a specific setting ID.
 * Utilizing useSyncExternalStore guarantees zero excess re-renders on sibling setting updates.
 */
export function useSetting<T = any>(id: string): [T, (val: T) => void] {
  const subscribe = (callback: () => void) => {
    const set = getSubscribersForId(id);
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  };

  const getSnapshot = () => getSetting<T>(id);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setter = (val: T) => {
    setSetting(id, val);
  };

  return [value, setter];
}

// Autoloader execution
initializeSettingsStore();
