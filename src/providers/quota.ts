// src/providers/quota.ts (Ejemplo de mejora con Circuit Breaker)
interface ProviderState {
  failures: number;
  lastFailure: number;
  isBlocked: boolean;
}

const providerStates: Record<string, ProviderState> = {};
const FAILURE_THRESHOLD = 3;
const BLOCK_DURATION = 60000; // 1 minuto

export function canUseProvider(providerId: string): boolean {
  const state = providerStates[providerId];
  if (!state) return true;

  if (state.isBlocked) {
    if (Date.now() - state.lastFailure > BLOCK_DURATION) {
      // Resetear tras el tiempo de bloqueo
      providerStates[providerId] = { failures: 0, lastFailure: 0, isBlocked: false };
      return true;
    }
    return false;
  }
  return true;
}

export function reportProviderFailure(providerId: string) {
  if (!providerStates[providerId]) {
    providerStates[providerId] = { failures: 0, lastFailure: 0, isBlocked: false };
  }
  const state = providerStates[providerId];
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isBlocked = true;
    console.warn(`[CircuitBreaker] Proveedor ${providerId} bloqueado temporalmente por fallos.`);
  }
}
