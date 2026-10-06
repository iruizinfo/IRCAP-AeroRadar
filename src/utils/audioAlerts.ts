/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API synthesizer for clean, zero-asset radar audio alerts
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Play a clean radar sweep 'ping' when a new aircraft enters the viewport
export function playNewAircraftSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    return; // Skip this play if still blocked
  }

  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Subtle short radar beep
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // Silent fail if audio context is blocked
  }
}

// Play a modern dual-tone alarm chime for emergency squawks
export function playEmergencySound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    return;
  }

  try {
    const now = ctx.currentTime;
    
    // Play two sequential chimes
    [0, 0.22].forEach((delay) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Professional dual-tone (harmonic minor third)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now + delay); // D5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(698.46, now + delay); // F5

      gainNode.gain.setValueAtTime(0.08, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

      osc1.start(now + delay);
      osc1.stop(now + delay + 0.3);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.3);
    });
  } catch (e) {
    // Silent fail
  }
}

// Resume context on first user interaction to bypass autoplay restrictions
export function initAudioOnInteraction() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    const resume = () => {
      ctx.resume().then(() => {
        // Clean up listeners once resumed
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      }).catch(() => {});
    };
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);
    window.addEventListener('touchstart', resume);
  }
}
