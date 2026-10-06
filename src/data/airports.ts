/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Airport } from '../types/aircraft';

export const MAJOR_AIRPORTS: Airport[] = [
  // España / Europa
  { id: '1', ident: 'LEMD', name: 'Adolfo Suárez Madrid-Barajas Airport', lat: 40.4936, lon: -3.56676, elevationFt: 2001, continent: 'EU', isoCountry: 'ES', municipality: 'Madrid', scheduledService: 'yes', iataCode: 'MAD', type: 'large_airport' },
  { id: '2', ident: 'LEBL', name: 'Josep Tarradellas Barcelona-El Prat Airport', lat: 41.2971, lon: 2.07846, elevationFt: 14, continent: 'EU', isoCountry: 'ES', municipality: 'Barcelona', scheduledService: 'yes', iataCode: 'BCN', type: 'large_airport' },
  { id: '3', ident: 'LEPA', name: 'Palma de Mallorca Airport', lat: 39.5517, lon: 2.73881, elevationFt: 24, continent: 'EU', isoCountry: 'ES', municipality: 'Palma de Mallorca', scheduledService: 'yes', iataCode: 'PMI', type: 'large_airport' },
  { id: '4', ident: 'LEMG', name: 'Malaga-Costa del Sol Airport', lat: 36.6749, lon: -4.49911, elevationFt: 52, continent: 'EU', isoCountry: 'ES', municipality: 'Málaga', scheduledService: 'yes', iataCode: 'AGP', type: 'large_airport' },
  { id: '5', ident: 'LEVC', name: 'Valencia Airport', lat: 39.4893, lon: -0.481625, elevationFt: 240, continent: 'EU', isoCountry: 'ES', municipality: 'Valencia', scheduledService: 'yes', iataCode: 'VLC', type: 'medium_airport' },
  { id: '6', ident: 'LEST', name: 'Santiago-Rosalía de Castro Airport', lat: 42.8963, lon: -8.41514, elevationFt: 1213, continent: 'EU', isoCountry: 'ES', municipality: 'Santiago de Compostela', scheduledService: 'yes', iataCode: 'SCQ', type: 'medium_airport' },
  { id: '7', ident: 'LEIB', name: 'Ibiza Airport', lat: 38.8729, lon: 1.37312, elevationFt: 24, continent: 'EU', isoCountry: 'ES', municipality: 'Ibiza', scheduledService: 'yes', iataCode: 'IBZ', type: 'medium_airport' },
  { id: '8', ident: 'LEZG', name: 'Zaragoza Airport', lat: 41.6662, lon: -1.04155, elevationFt: 876, continent: 'EU', isoCountry: 'ES', municipality: 'Zaragoza', scheduledService: 'yes', iataCode: 'ZAZ', type: 'medium_airport' },
  { id: '9', ident: 'LEBB', name: 'Bilbao Airport', lat: 43.3011, lon: -2.91061, elevationFt: 141, continent: 'EU', isoCountry: 'ES', municipality: 'Bilbao', scheduledService: 'yes', iataCode: 'BIO', type: 'medium_airport' },
  { id: '10', ident: 'GCLP', name: 'Gran Canaria Airport', lat: 27.9319, lon: -15.3866, elevationFt: 78, continent: 'AF', isoCountry: 'ES', municipality: 'Las Palmas', scheduledService: 'yes', iataCode: 'LPA', type: 'large_airport' },
  { id: '11', ident: 'GCTS', name: 'Tenerife South Airport', lat: 28.0445, lon: -16.5725, elevationFt: 207, continent: 'AF', isoCountry: 'ES', municipality: 'Granadilla de Abona', scheduledService: 'yes', iataCode: 'TFS', type: 'large_airport' },

  // Europa Principal
  { id: '12', ident: 'EGLL', name: 'Heathrow Airport', lat: 51.4706, lon: -0.461941, elevationFt: 83, continent: 'EU', isoCountry: 'GB', municipality: 'London', scheduledService: 'yes', iataCode: 'LHR', type: 'large_airport' },
  { id: '13', ident: 'EGKK', name: 'Gatwick Airport', lat: 51.1481, lon: -0.190278, elevationFt: 202, continent: 'EU', isoCountry: 'GB', municipality: 'London', scheduledService: 'yes', iataCode: 'LGW', type: 'large_airport' },
  { id: '14', ident: 'LFPG', name: 'Charles de Gaulle International Airport', lat: 49.0097, lon: 2.5479, elevationFt: 392, continent: 'EU', isoCountry: 'FR', municipality: 'Paris', scheduledService: 'yes', iataCode: 'CDG', type: 'large_airport' },
  { id: '15', ident: 'LFPO', name: 'Orly Airport', lat: 48.7233, lon: 2.37944, elevationFt: 291, continent: 'EU', isoCountry: 'FR', municipality: 'Paris', scheduledService: 'yes', iataCode: 'ORY', type: 'large_airport' },
  { id: '16', ident: 'EDDF', name: 'Frankfurt am Main Airport', lat: 50.0333, lon: 8.57056, elevationFt: 364, continent: 'EU', isoCountry: 'DE', municipality: 'Frankfurt', scheduledService: 'yes', iataCode: 'FRA', type: 'large_airport' },
  { id: '17', ident: 'EDDM', name: 'Munich Airport', lat: 48.3538, lon: 11.7861, elevationFt: 1487, continent: 'EU', isoCountry: 'DE', municipality: 'Munich', scheduledService: 'yes', iataCode: 'MUC', type: 'large_airport' },
  { id: '18', ident: 'EDDB', name: 'Berlin Brandenburg Airport', lat: 52.3667, lon: 13.5033, elevationFt: 154, continent: 'EU', isoCountry: 'DE', municipality: 'Berlin', scheduledService: 'yes', iataCode: 'BER', type: 'large_airport' },
  { id: '19', ident: 'LIRF', name: 'Leonardo da Vinci–Fiumicino Airport', lat: 41.8003, lon: 12.2389, elevationFt: 15, continent: 'EU', isoCountry: 'IT', municipality: 'Rome', scheduledService: 'yes', iataCode: 'FCO', type: 'large_airport' },
  { id: '20', ident: 'LIMC', name: 'Malpensa Airport', lat: 45.6306, lon: 8.72811, elevationFt: 768, continent: 'EU', isoCountry: 'IT', municipality: 'Milan', scheduledService: 'yes', iataCode: 'MXP', type: 'large_airport' },
  { id: '21', ident: 'EHAM', name: 'Amsterdam Airport Schiphol', lat: 52.3086, lon: 4.76389, elevationFt: -11, continent: 'EU', isoCountry: 'NL', municipality: 'Amsterdam', scheduledService: 'yes', iataCode: 'AMS', type: 'large_airport' },
  { id: '22', ident: 'LEAL', name: 'Alicante-Elche Miguel Hernández Airport', lat: 38.2822, lon: -0.558156, elevationFt: 143, continent: 'EU', isoCountry: 'ES', municipality: 'Alicante', scheduledService: 'yes', iataCode: 'ALC', type: 'large_airport' },

  // América del Norte y otros
  { id: '23', ident: 'KJFK', name: 'John F Kennedy International Airport', lat: 40.6398, lon: -73.7789, elevationFt: 13, continent: 'NA', isoCountry: 'US', municipality: 'New York', scheduledService: 'yes', iataCode: 'JFK', type: 'large_airport' },
  { id: '24', ident: 'KLAX', name: 'Los Angeles International Airport', lat: 33.9425, lon: -118.408, elevationFt: 125, continent: 'NA', isoCountry: 'US', municipality: 'Los Angeles', scheduledService: 'yes', iataCode: 'LAX', type: 'large_airport' },
  { id: '25', ident: 'OMDB', name: 'Dubai International Airport', lat: 25.2528, lon: 55.3644, elevationFt: 62, continent: 'AS', isoCountry: 'AE', municipality: 'Dubai', scheduledService: 'yes', iataCode: 'DXB', type: 'large_airport' }
];
