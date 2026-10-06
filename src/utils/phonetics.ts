/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import airlinesData from '../data/airlines.json';

const AIRLINES: Record<string, string> = airlinesData;

const DIGITS_ES: Record<string, string> = {
  '0': 'cero',
  '1': 'uno',
  '2': 'dos',
  '3': 'tres',
  '4': 'cuatro',
  '5': 'cinco',
  '6': 'seis',
  '7': 'siete',
  '8': 'ocho',
  '9': 'nueve'
};

const OACI_ES: Record<string, string> = {
  'A': 'Alfa',
  'B': 'Bravo',
  'C': 'Charlie',
  'D': 'Delta',
  'E': 'Eco',
  'F': 'Foxtrot',
  'G': 'Golf',
  'H': 'Hotel',
  'I': 'India',
  'J': 'Juliet',
  'K': 'Kilo',
  'L': 'Lima',
  'M': 'Mike',
  'N': 'November',
  'O': 'Oscar',
  'P': 'Papa',
  'Q': 'Quebec',
  'R': 'Romeo',
  'S': 'Sierra',
  'T': 'Tango',
  'U': 'Uniform',
  'V': 'Victor',
  'W': 'Whisky',
  'X': 'Ex-ray',
  'Y': 'Yankee',
  'Z': 'Zulu'
};

// Spells digits one by one (e.g. "7700" -> "siete siete cero cero")
export function spellDigitsEs(digits: string): string {
  return digits
    .split('')
    .map((d) => DIGITS_ES[d] || d)
    .join(' ');
}

// Convert a callsign into rich Spanish spoken telephony format
export function getSpokenCallsignEs(callsign: string): string {
  const clean = callsign.trim().toUpperCase();
  if (!clean || clean === 'N/A') return 'sin indicativo';

  // Check if it fits airline format: 3 letters followed by digits (and optional trailing letter)
  const airlineRegex = /^([A-Z]{3})([0-9]+[A-Z]?)$/;
  const match = clean.match(airlineRegex);

  if (match) {
    const code = match[1];
    const rest = match[2];

    const airlineName = AIRLINES[code];
    if (airlineName) {
      // Return: "Iberia seis dos cinco"
      const digitsSpelled = rest
        .split('')
        .map((char) => DIGITS_ES[char] || OACI_ES[char] || char)
        .join(' ');
      return `${airlineName} ${digitsSpelled}`;
    }
  }

  // Fallback: Spell character by character with OACI phonetics and digits one-by-one
  return clean
    .split('')
    .map((char) => OACI_ES[char] || DIGITS_ES[char] || char)
    .join(' ');
}
