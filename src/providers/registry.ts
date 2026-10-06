/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AircraftProvider } from './types';

export const PROVIDERS_REGISTRY: AircraftProvider[] = [
  {
    id: 'adsb_lol',
    name: 'adsb.lol',
    roles: ['live'],
    authType: 'none',
    defaultUrl: 'https://api.adsb.lol/v2',
    quotaSchema: { minIntervalSec: 2 },
    costModel: 'gratuito',
    licenseLabel: 'no comercial (Creative Commons)',
    docUrl: 'https://adsb.lol/docs',
    description: {
      es: 'Servicio abierto sin restricciones de uso financiado por la comunidad.',
      en: 'Open, unrestricted community-funded ADS-B data stream.'
    }
  },
  {
    id: 'adsb_fi',
    name: 'adsb.fi',
    roles: ['live'],
    authType: 'none',
    defaultUrl: 'https://opendata.adsb.fi/api/v2',
    quotaSchema: { minIntervalSec: 2 },
    costModel: 'gratuito',
    licenseLabel: 'no comercial',
    docUrl: 'https://adsb.fi',
    description: {
      es: 'Red colaborativa finlandesa con acceso a datos de telemetría abiertos.',
      en: 'Finnish collaborative open-access telemetry and aircraft network.'
    }
  },
  {
    id: 'airplanes_live',
    name: 'airplanes.live',
    roles: ['live'],
    authType: 'none',
    defaultUrl: 'https://api.airplanes.live/v2',
    quotaSchema: { minIntervalSec: 2 },
    costModel: 'gratuito',
    licenseLabel: 'no comercial',
    docUrl: 'https://airplanes.live',
    description: {
      es: 'Proveedor masivo de posiciones enfocado en la transparencia de datos.',
      en: 'High-volume telemetry feed focused on open positioning data.'
    }
  },
  {
    id: 'adsb_one',
    name: 'ADSB One',
    roles: ['live'],
    authType: 'none',
    defaultUrl: 'https://api.adsb.one/v2',
    quotaSchema: { minIntervalSec: 2 },
    costModel: 'gratuito',
    licenseLabel: 'no comercial',
    docUrl: 'https://adsb.one',
    description: {
      es: 'Alimentador abierto y alternativo de datos de aviación general.',
      en: 'Open and alternative flight data sharing feed.'
    }
  },
  {
    id: 'opensky_network',
    name: 'OpenSky Network',
    roles: ['live', 'history'],
    authType: 'oauth2-client-credentials',
    defaultUrl: 'https://opensky-network.org/api',
    quotaSchema: { requestsPerDay: 4000, minIntervalSec: 5 },
    costModel: 'créditos',
    licenseLabel: 'no comercial (académica)',
    docUrl: 'https://opensky-network.org/apidoc',
    description: {
      es: 'Red académica de investigación. Permite iniciar sesión para mayores cuotas.',
      en: 'Academic research network. Authenticate for higher hourly rate limits.'
    }
  },
  {
    id: 'adsbexchange_rapidapi',
    name: 'ADS-B Exchange (RapidAPI)',
    roles: ['live'],
    authType: 'header-key',
    headerName: 'X-RapidAPI-Key',
    defaultUrl: 'https://adsbexchange-com1.p.rapidapi.com/v2',
    quotaSchema: { requestsPerMonth: 10000, minIntervalSec: 5 },
    costModel: 'pago',
    licenseLabel: 'comercial',
    docUrl: 'https://rapidapi.com/adsbexchange/api/adsbexchange',
    description: {
      es: 'Canal de acceso premium a ADS-B Exchange. Ideal como respaldo.',
      en: 'Premium gateway access to ADS-B Exchange. Excellent backup option.'
    }
  },
  {
    id: 'receptor_local',
    name: 'Receptor Local (Dump1090/Tar1090)',
    roles: ['live'],
    authType: 'none',
    defaultUrl: 'http://localhost:8504/tar1090/data/aircraft.json',
    quotaSchema: { minIntervalSec: 1 },
    costModel: 'gratuito',
    licenseLabel: 'personal',
    docUrl: 'https://github.com/wiedehopf/tar1090',
    description: {
      es: 'Consulta directa a tu receptor RTL-SDR sin intermediarios ni proxy.',
      en: 'Query your local RTL-SDR receiver natively without backend proxies.'
    }
  },
  {
    id: 'proveedor_personalizado',
    name: 'Proveedor Compatible ADSBExchange v2',
    roles: ['live'],
    authType: 'header-key',
    headerName: 'X-Provider-Key',
    defaultUrl: '',
    quotaSchema: { minIntervalSec: 2 },
    costModel: 'gratuito',
    licenseLabel: 'no comercial',
    docUrl: '',
    description: {
      es: 'Instancia personalizada compatible con el formato estándar v2 de puntos.',
      en: 'Custom endpoint conforming to standard v2 point schema.'
    }
  },
  {
    id: 'flightradar24_api',
    name: 'Flightradar24 (API Oficial)',
    roles: ['enrich', 'live'],
    authType: 'bearer',
    defaultUrl: 'https://fr24api.flightradar24.com/common/v1',
    quotaSchema: { creditsPerMonth: 500, minIntervalSec: 10 },
    costModel: 'pago',
    licenseLabel: 'comercial',
    docUrl: 'https://fr24api.flightradar24.com/docs',
    description: {
      es: 'API de referencia comercial. Usada por defecto para enriquecer detalles de aviones.',
      en: 'Gold-standard commercial flight data provider. Used for aircraft metadata.'
    }
  }
];

/*
================================================================================
PLANTILLAS DE PROVEEDORES SIN IMPLEMENTAR (DE FUTURO DESARROLLO)
================================================================================

1. FlightAware AeroAPI (ID: 'flightaware_aeroapi')
   - Roles: 'enrich', 'history'
   - Autenticación: header-key (x-apikey)
   - URL Base: 'https://aeroapi.flightaware.com/aeroapi'
   - Pendiente:
     * Endpoint /flights/:id para información completa de ruta.
     * Mapeo de campos de aeropuerto de origen/destino (AeroAPI v4).
     * Gestión de cuota de créditos por nivel de cuenta.

2. AirNav RadarBox API (ID: 'radarbox_api')
   - Roles: 'live', 'enrich'
   - Autenticación: bearer (token)
   - URL Base: 'https://api.radarbox.com/v1'
   - Pendiente:
     * Implementar adaptador para formato de telemetría de RadarBox JSON.
     * Endpoints de búsqueda por registro (flight-details).

3. Plane Finder API (ID: 'planefinder_api')
   - Roles: 'live'
   - Autenticación: header-key (x-pf-api-key)
   - URL Base: 'https://api.planefinder.net/v1'
   - Pendiente:
     * Documentar estructura de respuesta comprimida binaria/JSON.

4. AeroDataBox API (ID: 'aerodatabox_api')
   - Roles: 'enrich'
   - Autenticación: header-key (x-rapidapi-key)
   - URL Base: 'https://aerodatabox.p.rapidapi.com'
   - Pendiente:
     * Endpoint /flights/number/:flightNumber para horarios previstos y retrasos.
     * Adaptador para datos de rotación de aeronaves.
*/
