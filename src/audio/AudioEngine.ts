/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AudioCache } from './AudioCache';
import { getSetting, setSetting } from '../settings/store';
import { settingsRegistry } from '../settings/registry';

export interface AudioEngineSettings {
  volume: number;
  muted: boolean;
  ticEnabled: boolean;
  emergenciesEnabled: boolean;
  ttsEnabled: boolean;
  voiceUri: string | null;
  ticMode: 'all' | 'favorites' | 'filters' | 'disabled';
  geminiTtsEnabled: boolean;
  includeCallsignAndType: boolean;
  geminiVoice: string;
}

export const PREBUILT_GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Masculina equilibrada)' },
  { id: 'Aoede', name: 'Aoede (Femenina clara)' },
  { id: 'Zephyr', name: 'Zephyr (Femenina cálida)' },
  { id: 'Puck', name: 'Puck (Masculina jovial)' },
  { id: 'Fenrir', name: 'Fenrir (Masculina grave)' },
  { id: 'Charon', name: 'Charon (Masculina madura)' },
  { id: 'Ursa', name: 'Ursa (Femenina sobria)' },
  { id: 'Phoebe', name: 'Phoebe (Femenina brillante)' }
];

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private get settings(): AudioEngineSettings {
    return this.getSettings();
  }
  private voices: SpeechSynthesisVoice[] = [];
  private speechQueue: { play: () => Promise<void> }[] = [];
  private isPlayingQueue = false;

  // Cost controls & circuit breaker state
  private ttsCallsTimestamps: number[] = [];
  private consecutiveFailures = 0;
  private circuitBreakerActiveUntil = 0;

  // Cache candidate trigger promises to avoid multiple calls while in candidate status
  private candidatePromises = new Map<string, Promise<ArrayBuffer | null>>();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initVoices();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private loadSettings(): AudioEngineSettings {
    // This is a bridge. We call getSettings() to pull cleanly from settings store.
    return this.getSettings();
  }

  public saveSettings(updates: Partial<AudioEngineSettings>) {
    try {
      if (updates.volume !== undefined) setSetting('audio.master.volume', updates.volume);
      if (updates.muted !== undefined) setSetting('audio.master.enabled', !updates.muted);
      if (updates.ticMode !== undefined) setSetting('audio.tic.mode', updates.ticMode);
      if (updates.ttsEnabled !== undefined) setSetting('audio.voice.enabled', updates.ttsEnabled);
      if (updates.voiceUri !== undefined) setSetting('audio.voice.browser_uri', updates.voiceUri);
      if (updates.geminiTtsEnabled !== undefined) setSetting('audio.voice.gemini_enabled', updates.geminiTtsEnabled);
      if (updates.includeCallsignAndType !== undefined) setSetting('audio.voice.include_callsign', updates.includeCallsignAndType);
    } catch {
      // ignore
    }
    this.updateGain();
  }

  public getSettings(): AudioEngineSettings {
    try {
      return {
        volume: getSetting('audio.master.volume'),
        muted: !getSetting('audio.master.enabled'),
        ticEnabled: getSetting('audio.tic.mode') !== 'disabled',
        emergenciesEnabled: getSetting('audio.alarm.enabled') || getSetting('audio.voice.enabled'),
        ttsEnabled: getSetting('audio.voice.enabled'),
        voiceUri: getSetting('audio.voice.browser_uri'),
        ticMode: getSetting('audio.tic.mode'),
        geminiTtsEnabled: getSetting('audio.voice.gemini_enabled'),
        includeCallsignAndType: getSetting('audio.voice.include_callsign'),
        geminiVoice: 'Kore'
      };
    } catch {
      return {
        volume: 0.5,
        muted: false,
        ticEnabled: true,
        emergenciesEnabled: true,
        ttsEnabled: true,
        voiceUri: null,
        ticMode: 'all',
        geminiTtsEnabled: true,
        includeCallsignAndType: true,
        geminiVoice: 'Kore'
      };
    }
  }

  private initVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.voices = window.speechSynthesis.getVoices();

      // Dynamically populate registered options for Browser Voices select menu!
      try {
        const def = settingsRegistry.get('audio.voice.browser_uri');
        if (def && this.voices.length > 0) {
          const esVoices = this.voices.filter((v) => v.lang.startsWith('es') || v.lang.startsWith('en'));
          def.options = [
            { value: '', label: { es: 'Español Automático (Por Defecto)', en: 'Automatic Spanish (Default)' } },
            ...esVoices.map((v) => ({
              value: v.voiceURI,
              label: { es: `${v.name} (${v.lang})`, en: `${v.name} (${v.lang})` }
            }))
          ];
        }
      } catch {
        // ignore
      }
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  // Get active voice source status: Gemini TTS, navegador, or sin voz
  public getVoiceSourceStatus(): 'Gemini TTS' | 'navegador' | 'sin voz' {
    if (!this.settings.ttsEnabled) return 'sin voz';
    if (this.settings.geminiTtsEnabled && !this.isCircuitBreakerActive()) {
      return 'Gemini TTS';
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return 'navegador';
    }
    return 'sin voz';
  }

  public getStatus(): 'unlocked' | 'suspended' | 'muted' | 'blocked' {
    if (this.settings.muted) return 'muted';
    if (!this.ctx) return 'blocked';
    if (this.ctx.state === 'running') return 'unlocked';
    if (this.ctx.state === 'suspended') return 'suspended';
    return 'blocked';
  }

  private isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerActiveUntil;
  }

  public async unlockAudio(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Get or create context
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
        this.updateGain();
      }
    }

    if (this.ctx) {
      try {
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }

        // Trigger an empty TTS utterance to unlock speech on mobile devices
        if (window.speechSynthesis) {
          const silentUtterance = new SpeechSynthesisUtterance('');
          silentUtterance.volume = 0;
          window.speechSynthesis.speak(silentUtterance);
        }

        // PRE-GENERATE FIXED FRAGMENTS ON DESBLOQUEO/ACTIVACIÓN TO ENHANCE IMMEDIATE RESPONSE CAPABILITY!
        this.pregenerateBackupFragments();

        return true;
      } catch (e) {
        console.error('Failed to unlock audio context:', e);
        return false;
      }
    }
    return false;
  }

  // Pregenerate the fallback fixed warnings for each squawk type to build robust instant local playability!
  private pregenerateBackupFragments() {
    const fixedPhrases = [
      'Emergencia declarada. Emergencia general.',
      'Emergencia declarada. Fallo de comunicaciones.',
      'Emergencia declarada. Interferencia ilícita.'
    ];

    fixedPhrases.forEach((phrase, index) => {
      setTimeout(() => {
        // Skip pre-generation if circuit breaker is already active or audio is muted
        if (this.isCircuitBreakerActive() || this.settings.muted) return;
        this.generateAndCacheGeminiTTS(phrase).catch(() => {});
      }, index * 2000); // Stagger by 2000ms to completely prevent concurrent 429 rate limit triggers
    });
  }

  private updateGain() {
    if (this.gainNode && this.ctx) {
      const targetVolume = this.settings.muted ? 0 : this.settings.volume;
      this.gainNode.gain.setValueAtTime(targetVolume, this.ctx.currentTime);
    }
  }

  // Play subtle radar sweep/tic sound
  public playTic() {
    if (this.settings.muted || !this.settings.ticEnabled || !this.ctx) return;
    if (this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const nodeGain = this.ctx.createGain();

      osc.connect(nodeGain);
      nodeGain.connect(this.gainNode || this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);

      nodeGain.gain.setValueAtTime(0.05 * this.settings.volume, this.ctx.currentTime);
      nodeGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.085);
    } catch (e) {
      // ignore
    }
  }

  // Play alarm chime and resolve
  public playEmergencyAlarm(): Promise<void> {
    return new Promise((resolve) => {
      if (this.settings.muted || !this.settings.emergenciesEnabled || !this.ctx) {
        resolve();
        return;
      }
      if (this.ctx.state !== 'running') {
        resolve();
        return;
      }

      try {
        const duration = 1.0;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const nodeGain = this.ctx.createGain();

        osc.connect(nodeGain);
        nodeGain.connect(this.gainNode || this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.setValueAtTime(650, now + 0.25);
        osc.frequency.setValueAtTime(500, now + 0.5);
        osc.frequency.setValueAtTime(650, now + 0.75);

        nodeGain.gain.setValueAtTime(0.12 * this.settings.volume, now);
        nodeGain.gain.exponentialRampToValueAtTime(0.12 * this.settings.volume, now + duration - 0.1);
        nodeGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.start(now);
        osc.stop(now + duration + 0.05);

        setTimeout(() => resolve(), duration * 1000);
      } catch (e) {
        resolve();
      }
    });
  }

  // Core TTS caller utilizing Gemini API or SpeechSynthesis Fallbacks
  public async generateAndCacheGeminiTTS(text: string): Promise<ArrayBuffer | null> {
    const voiceModel = 'gemini-3.8-flash-lite-tts';
    const voiceName = this.settings.geminiVoice;

    // Check IndexedDB / Memory Cache first
    const cached = await AudioCache.get(text, voiceName, voiceModel);
    if (cached) {
      return cached;
    }

    // Circuit Breaker active check
    if (this.isCircuitBreakerActive()) {
      return null;
    }

    // Rate Limit Check (Maximum 10 calls per hour)
    const now = Date.now();
    this.ttsCallsTimestamps = this.ttsCallsTimestamps.filter((ts) => now - ts < 3600000);
    if (this.ttsCallsTimestamps.length >= 10) {
      console.warn('Gemini TTS Rate limit reached (Max 10 / hour). Falling back.');
      return null;
    }

    // Dedup ongoing candidate promises
    const promiseKey = AudioCache.makeKey(text, voiceName, voiceModel);
    if (this.candidatePromises.has(promiseKey)) {
      return this.candidatePromises.get(promiseKey) || null;
    }

    const fetchPromise = (async () => {
      try {
        this.ttsCallsTimestamps.push(now);

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: voiceName })
        });

        if (!response.ok) {
          if (response.status === 429) {
            this.circuitBreakerActiveUntil = Date.now() + 10 * 60 * 1000; // 10 minutes lockout
            console.warn('TTS Rate limited (429). Activating circuit breaker immediately.');
          }
          throw new Error(`TTS server returned status ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.audio) {
          throw new Error(data.error || 'Server did not return speech audio');
        }

        // Decode Base64 to raw ArrayBuffer (binary PCM)
        const binaryString = window.atob(data.audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Store into caches
        await AudioCache.set(text, voiceName, voiceModel, bytes.buffer);
        this.consecutiveFailures = 0; // reset on success

        return bytes.buffer;
      } catch (err: any) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.circuitBreakerActiveUntil = Date.now() + 10 * 60 * 1000; // 10 minutes lockout
          console.warn('TTS Circuit breaker activated. Locking Gemini TTS for 10 minutes.');
        }
        console.warn('Failed to pre-fetch Gemini TTS:', err.message || err);
        return null;
      } finally {
        this.candidatePromises.delete(promiseKey);
      }
    })();

    this.candidatePromises.set(promiseKey, fetchPromise);
    return fetchPromise;
  }

  // Play a PCM 16-bit 24kHz buffer directly using AudioContext
  public async playPCMBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.ctx) return;

    const int16Array = new Int16Array(arrayBuffer);
    const float32Array = new Float32Array(int16Array.length);

    // Int16 to Float32 normalization
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    const audioBuffer = this.ctx.createBuffer(1, float32Array.length, 24000); // 24kHz, Mono
    audioBuffer.copyToChannel(float32Array, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode || this.ctx.destination);

    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }

  // Native speech synthesis fallback
  public playSpeechSynthesisFallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel(); // Cancel current speaker

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.settings.volume;
        utterance.rate = 0.95;

        // Best Spanish Voice selection
        let selectedVoice = null;
        if (this.settings.voiceUri) {
          selectedVoice = this.voices.find((v) => v.voiceURI === this.settings.voiceUri);
        }
        if (!selectedVoice) {
          selectedVoice =
            this.voices.find((v) => v.lang === 'es-ES') ||
            this.voices.find((v) => v.lang.startsWith('es-')) ||
            this.voices[0];
        }
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  // Serialized speech play queue execution
  public enqueuePlayAction(playAction: () => Promise<void>) {
    this.speechQueue.push({ play: playAction });
    this.processSpeechQueue();
  }

  private async processSpeechQueue() {
    if (this.isPlayingQueue || this.speechQueue.length === 0) return;
    this.isPlayingQueue = true;

    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift();
      if (item) {
        try {
          await item.play();
        } catch (e) {
          console.error('Error executing queue item:', e);
        }
      }
    }

    this.isPlayingQueue = false;
  }

  public stopAllSpeech() {
    this.speechQueue = [];
    this.isPlayingQueue = false;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
