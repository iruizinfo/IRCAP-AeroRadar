/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plantilla de Proveedor Externo / Pago (Punto de Extensión)
 * 
 * Instrucciones para añadir un nuevo proveedor (ej. AeroDataBox, FlightAware AeroAPI, OpenWeather):
 * 1. Implementa la interfaz AircraftProvider (o adapta tu lógica al proxy del backend).
 * 2. Configura las variables de entorno necesarias en .env (ej. AERO_DATABOX_API_KEY).
 * 3. Regístrate en la cadena de failover de server.ts.
 */

export interface CustomProviderConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

export class ExternalCustomProviderTemplate {
  id: string = 'custom_paid_provider';
  config: CustomProviderConfig;

  constructor(config: CustomProviderConfig) {
    this.config = config;
  }

  async health(): Promise<boolean> {
    if (!this.config.enabled || !this.config.apiKey) return false;
    try {
      // Realizar llamada de prueba (ping) a la API externa
      return true;
    } catch {
      return false;
    }
  }

  async getAircraftNear(lat: number, lon: number, radiusNm: number): Promise<any[]> {
    if (!this.config.enabled) return [];
    
    // Ejemplo de implementación futura:
    // const response = await fetch(`${this.config.baseUrl}/flights?lat=${lat}&lon=${lon}&radius=${radiusNm}`, {
    //   headers: { 'X-Api-Key': this.config.apiKey }
    // });
    // const data = await response.json();
    // return transformToNormalizedAircraft(data);

    return [];
  }
}
