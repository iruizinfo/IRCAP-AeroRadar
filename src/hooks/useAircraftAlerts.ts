/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { Aircraft } from '../types/aircraft';
import { AudioEngine } from '../audio/AudioEngine';
import { AudioCache } from '../audio/AudioCache';
import { getSpokenCallsignEs, spellDigitsEs } from '../utils/phonetics';

interface UseAircraftAlertsProps {
  visibleAircraft: Aircraft[];
  aircraftList: Aircraft[];
  favorites: string[];
  isFilterActive: boolean;
  mapChangeCount: number;
  onTriggerEmergency: (alert: EmergencyAlertData) => void;
  onLogSimulationStats?: (stats: { latency: number; source: string }) => void;
}

export interface EmergencyAlertData {
  hex: string;
  callsign: string;
  squawk: string;
  meaning: string;
  timestamp: number;
  isSimulation?: boolean;
}

export const SQUAWK_MEANINGS: Record<string, string> = {
  '7500': 'Interferencia ilícita',
  '7600': 'Fallo de comunicaciones',
  '7700': 'Emergencia general',
};

export function useAircraftAlerts({
  visibleAircraft,
  aircraftList,
  favorites,
  isFilterActive,
  mapChangeCount,
  onTriggerEmergency,
  onLogSimulationStats,
}: UseAircraftAlertsProps) {
  const prevHexesRef = useRef<Set<string>>(new Set());
  const lastMapChangeCountRef = useRef(mapChangeCount);
  const baselineResetRef = useRef(true);
  const lastTicTimeRef = useRef(0);

  // Candidates Map tracking when we first saw a candidate emergency squawk
  // Key: hex-squawk, Value: { firstSeen: timestamp, text: ttsText, consecutiveSeen: number }
  const candidatesRef = useRef<Map<string, { firstSeen: number; text: string; seenCount: number }>>(new Map());

  // Memory of successfully triggered alerts to support 10min repeats
  // Key: hex-squawk, Value: last trigger timestamp
  const alertTriggersMemoryRef = useRef<Map<string, number>>(new Map());

  // Detect map viewport changes to reset baseline without chiming
  if (mapChangeCount !== lastMapChangeCountRef.current) {
    lastMapChangeCountRef.current = mapChangeCount;
    baselineResetRef.current = true;
  }

  useEffect(() => {
    const audio = AudioEngine.getInstance();
    const settings = audio.getSettings();

    // 1. New Aircraft Tic Detection
    const currentHexes = new Set<string>(visibleAircraft.map((a) => a.hex));

    if (baselineResetRef.current) {
      // Establish baseline silently
      prevHexesRef.current = currentHexes;
      baselineResetRef.current = false;
    } else {
      const newHexes = [...currentHexes].filter((hex) => !prevHexesRef.current.has(hex));
      
      if (newHexes.length > 0 && settings.ticMode !== 'disabled') {
        const now = Date.now();
        if (now - lastTicTimeRef.current >= 5000) {
          let shouldSound = false;

          if (settings.ticMode === 'all') {
            if (favorites.length > 0) {
              shouldSound = newHexes.some((hex) => favorites.includes(hex));
            } else {
              shouldSound = true;
            }
          } else if (settings.ticMode === 'favorites') {
            shouldSound = newHexes.some((hex) => favorites.includes(hex));
          } else if (settings.ticMode === 'filters') {
            shouldSound = isFilterActive;
          }

          if (shouldSound) {
            audio.playTic();
            lastTicTimeRef.current = now;
          }
        }
      }
      prevHexesRef.current = currentHexes;
    }

    // 2. Candidate & Confirmed Emergency Alerts Detection
    const currentEmergencies = aircraftList.filter((ac) =>
      ['7500', '7600', '7700'].includes(ac.squawk)
    );

    const activeEmergencyKeys = new Set<string>();

    currentEmergencies.forEach((ac) => {
      const key = `${ac.hex}-${ac.squawk}`;
      activeEmergencyKeys.add(key);

      let candidate = candidatesRef.current.get(key);

      // A) First seen as candidate: construct text and pre-fetch TTS immediately
      if (!candidate) {
        // Construct phonetic text matching user settings
        let ttsText = '';
        if (settings.includeCallsignAndType) {
          const spokenCallsign = getSpokenCallsignEs(ac.callsign || ac.hex);
          const spokenSquawk = spellDigitsEs(ac.squawk);
          const meaning = SQUAWK_MEANINGS[ac.squawk] || 'Alerta de emergencia';
          ttsText = `Emergencia declarada. ${spokenCallsign}. Squawk ${spokenSquawk}. ${meaning}.`;
        } else {
          ttsText = 'Emergencia declarada.';
        }

        candidate = {
          firstSeen: Date.now(),
          text: ttsText,
          seenCount: 1,
        };
        candidatesRef.current.set(key, candidate);

        // Pre-fetch immediately even before confirmation to save latency
        if (settings.geminiTtsEnabled) {
          audio.generateAndCacheGeminiTTS(ttsText).catch(() => {});
        }
      } else {
        // Increment consecutive seen count
        candidate.seenCount += 1;
      }

      const elapsedMs = Date.now() - candidate.firstSeen;
      const ttsText = candidate.text;

      // B) Confirmation trigger: persists >= 2 consecutive updates OR >= 10 seconds
      if (candidate.seenCount >= 2 || elapsedMs >= 10000) {
        const lastTrigger = alertTriggersMemoryRef.current.get(key) || 0;
        const now = Date.now();

        // Trigger only if first time, or if 10 minutes (600,000 ms) elapsed
        if (lastTrigger === 0 || now - lastTrigger >= 600000) {
          alertTriggersMemoryRef.current.set(key, now);

          const startTime = Date.now(); // Track timing for confirmation vs play delay
          const isSimulation = (ac as any).isSimulation === true;

          // Dispatch alarm & speech playback sequence to the serialized AudioEngine queue
          audio.enqueuePlayAction(async () => {
            // 1. Play dual-tone siren
            await audio.playEmergencyAlarm();

            // 2. Play speech alert
            if (settings.ttsEnabled) {
              const nowPlay = Date.now();
              const elapsedConfirmationToSpeechMs = nowPlay - startTime;

              // Check if we can play Gemini from cache (requires Gemini active, under 1.5s delay limit, and cache hit)
              const cachedBuffer = await AudioCache.get(ttsText, settings.geminiVoice, 'gemini-3.8-flash-lite-tts');

              const useGemini = settings.geminiTtsEnabled && (elapsedConfirmationToSpeechMs < 1500) && cachedBuffer;

              if (useGemini && cachedBuffer) {
                // Log stats back for simulation
                if (isSimulation && onLogSimulationStats) {
                  onLogSimulationStats({
                    latency: elapsedConfirmationToSpeechMs,
                    source: 'Gemini TTS'
                  });
                }
                await audio.playPCMBuffer(cachedBuffer);
              } else {
                // Fallback 1: browser speechSynthesis
                if (isSimulation && onLogSimulationStats) {
                  onLogSimulationStats({
                    latency: elapsedConfirmationToSpeechMs,
                    source: 'navegador'
                  });
                }
                await audio.playSpeechSynthesisFallback(ttsText);
              }
            } else {
              // Fallback 2: Solo alarma
              if (isSimulation && onLogSimulationStats) {
                onLogSimulationStats({
                  latency: Date.now() - startTime,
                  source: 'solo alarma'
                });
              }
            }
          });

          // Dispatch visual banner overlay trigger
          onTriggerEmergency({
            hex: ac.hex,
            callsign: ac.callsign || 'N/A',
            squawk: ac.squawk,
            meaning: SQUAWK_MEANINGS[ac.squawk] || 'Alerta de emergencia',
            timestamp: now,
            isSimulation: isSimulation,
          });
        }
      }
    });

    // C) Candidate clean up: if candidate disappears before confirmation, prune
    for (const key of candidatesRef.current.keys()) {
      if (!activeEmergencyKeys.has(key)) {
        candidatesRef.current.delete(key);
      }
    }
  }, [visibleAircraft, aircraftList, favorites, isFilterActive, mapChangeCount, onTriggerEmergency, onLogSimulationStats]);
}
