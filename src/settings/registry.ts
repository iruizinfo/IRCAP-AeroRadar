/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SettingDefinition {
  id: string;
  group: 'general' | 'audio' | 'widgets' | 'map' | 'data' | 'advanced';
  type: 'toggle' | 'slider' | 'select' | 'number' | 'text' | 'button' | 'providerList';
  defaultValue: any;
  label: { es: string; en: string };
  description: { es: string; en: string };
  min?: number;
  max?: number;
  step?: number;
  options?: { value: any; label: { es: string; en: string } }[];
  dependsOn?: { id: string; condition: (val: any) => boolean };
  visibleWhen?: (get: (id: string) => any) => boolean;
  experimental?: boolean;
  since?: string;
  testAction?: () => void | Promise<void>;
}

// Global registry of settings definitions
export const settingsRegistry: Map<string, SettingDefinition> = new Map();

/**
 * Registers multiple settings at once in the global registry.
 * Validates against duplicate IDs during development.
 */
export function registerSettings(definitions: SettingDefinition[]) {
  definitions.forEach((def) => {
    if (settingsRegistry.has(def.id)) {
      console.warn(`[SettingsRegistry] Warning: Duplicate setting ID registered: "${def.id}"`);
    }
    settingsRegistry.set(def.id, def);
  });
}

// Core setting definitions representing the entire application configuration
const initialDefinitions: SettingDefinition[] = [
  // --- GENERAL ---
  {
    id: 'general.language',
    group: 'general',
    type: 'select',
    defaultValue: 'es',
    label: { es: 'Idioma', en: 'Language' },
    description: { es: 'Selecciona el idioma de la interfaz del radar.', en: 'Select the language of the radar interface.' },
    options: [
      { value: 'es', label: { es: 'Español (ES)', en: 'Spanish (ES)' } },
      { value: 'en', label: { es: 'Inglés (EN)', en: 'English (EN)' } }
    ]
  },
  {
    id: 'general.theme',
    group: 'general',
    type: 'select',
    defaultValue: 'dark',
    label: { es: 'Tema Visual', en: 'Visual Theme' },
    description: { es: 'Cambia la paleta cromática entre modo claro u oscuro.', en: 'Switch color palette between light and dark mode.' },
    options: [
      { value: 'dark', label: { es: 'Oscuro (Radar táctico)', en: 'Dark (Tactical Radar)' } },
      { value: 'light', label: { es: 'Claro (Alta visibilidad)', en: 'Light (High Visibility)' } }
    ]
  },

  // --- AUDIO ---
  {
    id: 'audio.master.enabled',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Sonido Activado', en: 'Sound Activated' },
    description: { es: 'Habilita o deshabilita todos los sonidos del sistema.', en: 'Enable or disable all system sounds globally.' }
  },
  {
    id: 'audio.master.volume',
    group: 'audio',
    type: 'slider',
    defaultValue: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    label: { es: 'Volumen General', en: 'Master Volume' },
    description: { es: 'Regula la ganancia de salida de los sonidos.', en: 'Regulate the master audio output gain.' },
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.tic.mode',
    group: 'audio',
    type: 'select',
    defaultValue: 'all',
    label: { es: 'Modo de Tic para Avión Nuevo', en: 'New Aircraft Tic Mode' },
    description: { es: 'Elige cuándo reproducir el sonido de barrido de radar.', en: 'Choose when to trigger the radar sweep sweep sound.' },
    options: [
      { value: 'all', label: { es: 'Todos / Automático', en: 'All / Automatic' } },
      { value: 'favorites', label: { es: 'Solo Favoritos', en: 'Favorites Only' } },
      { value: 'filters', label: { es: 'Solo con filtros activos', en: 'Only with active filters' } },
      { value: 'disabled', label: { es: 'Desactivado', en: 'Disabled' } }
    ],
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.tic.interval',
    group: 'audio',
    type: 'slider',
    defaultValue: 5,
    min: 2,
    max: 30,
    step: 1,
    label: { es: 'Intervalo mínimo entre tics', en: 'Minimum interval between tics' },
    description: { es: 'Frecuencia mínima (segundos) para evitar ráfagas de audio molestas.', en: 'Minimum frequency in seconds to suppress rapid burst noise.' },
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.tic.volume',
    group: 'audio',
    type: 'slider',
    defaultValue: 0.3,
    min: 0,
    max: 1,
    step: 0.05,
    label: { es: 'Volumen del Tic', en: 'Tic Volume' },
    description: { es: 'Ajusta el volumen individual del barrido.', en: 'Adjust individual volume for radar sweep sweeps.' },
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.alarm.enabled',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Alarma de Emergencia', en: 'Emergency Alarm Siren' },
    description: { es: 'Activa la sirena sonora de dos tonos para transpondedores 7500/7600/7700.', en: 'Activate two-tone warning siren for transponder squawks 7500/7600/7700.' },
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.alarm.volume',
    group: 'audio',
    type: 'slider',
    defaultValue: 0.6,
    min: 0,
    max: 1,
    step: 0.05,
    label: { es: 'Volumen de Alarma', en: 'Alarm Volume' },
    description: { es: 'Intensidad sonora de la sirena de emergencia.', en: 'Siren warning volume level.' },
    dependsOn: { id: 'audio.alarm.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.voice.enabled',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Locución de Emergencia (Voz)', en: 'Emergency Voice Synthesizer' },
    description: { es: 'Habilita la síntesis de voz automática para leer la alerta.', en: 'Enable speech synthesizer readout of emergency alerts.' },
    dependsOn: { id: 'audio.master.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.voice.gemini_enabled',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Usar TTS de Gemini (Recomendado)', en: 'Use Gemini TTS (Recommended)' },
    description: { es: 'Genera voz realista e hiperclara en el servidor vía Gemini Flash.', en: 'Generate realistic high-clarity server-side voice with Gemini Flash.' },
    dependsOn: { id: 'audio.voice.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.voice.browser_enabled',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Usar respaldo del navegador', en: 'Use Browser Speech Backup' },
    description: { es: 'Permite conmutar a speechSynthesis nativo si Gemini falla.', en: 'Allow immediate fallback to native speechSynthesis if Gemini times out.' },
    dependsOn: { id: 'audio.voice.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.voice.browser_uri',
    group: 'audio',
    type: 'select',
    defaultValue: '',
    label: { es: 'Voz del Navegador (Respaldos)', en: 'Browser Voice (Fallback)' },
    description: { es: 'Selecciona la voz local para la síntesis de respaldo.', en: 'Select the local voice to use for native speech backup.' },
    options: [
      { value: '', label: { es: 'Español Automático (Por Defecto)', en: 'Automatic Spanish (Default)' } }
    ],
    dependsOn: { id: 'audio.voice.enabled', condition: (v) => !!v }
  },
  {
    id: 'audio.voice.include_callsign',
    group: 'audio',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Incluir indicativo y tipo de emergencia', en: 'Include callsign & emergency type' },
    description: { es: 'Vocaliza el callsign y el código transpondedor en el mensaje ("Iberia seis dos cinco uno").', en: 'Vocalize the callsign and transponder meaning ("Iberia six two five one").' },
    dependsOn: { id: 'audio.voice.enabled', condition: (v) => !!v }
  },

  // --- WIDGETS ---
  {
    id: 'widgets.banner_emergency.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Banner de Emergencia', en: 'Show Emergency Banner' },
    description: { es: 'Aviso visual flotante rojo ante código transpondedor crítico.', en: 'Floating red notification card when a critical squawk is captured.' }
  },
  {
    id: 'widgets.panel_emergency.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Panel de Emergencias', en: 'Show Emergencies Panel' },
    description: { es: 'Historial lateral de aeronaves en estado de emergencia.', en: 'Historical list sidebar of aircraft currently in emergency states.' }
  },
  {
    id: 'widgets.global_stats.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Estadísticas Globales', en: 'Show Global Statistics' },
    description: { es: 'Panel flotante con recuentos, promedios y distribución.', en: 'Floating overlay displaying traffic counts, averages, and airlines.' }
  },
  {
    id: 'widgets.global_stats.position',
    group: 'widgets',
    type: 'select',
    defaultValue: 'bottom-left',
    label: { es: 'Posición de Estadísticas', en: 'Statistics Position' },
    description: { es: 'Elige en qué esquina anclar el widget de estadísticas.', en: 'Choose which screen corner to anchor the statistics panel.' },
    options: [
      { value: 'top-left', label: { es: 'Arriba Izquierda', en: 'Top Left' } },
      { value: 'top-right', label: { es: 'Arriba Derecha', en: 'Top Right' } },
      { value: 'bottom-left', label: { es: 'Abajo Izquierda', en: 'Bottom Left' } },
      { value: 'bottom-right', label: { es: 'Abajo Derecha', en: 'Bottom Right' } }
    ],
    dependsOn: { id: 'widgets.global_stats.enabled', condition: (v) => !!v }
  },
  {
    id: 'widgets.global_stats.compact',
    group: 'widgets',
    type: 'toggle',
    defaultValue: false,
    label: { es: 'Modo Compacto de Estadísticas', en: 'Statistics Compact Mode' },
    description: { es: 'Oculta gráficos y diagramas, mostrando solo recuentos puros.', en: 'Collapse charts and breakdowns, showing only key counter counts.' },
    dependsOn: { id: 'widgets.global_stats.enabled', condition: (v) => !!v }
  },
  {
    id: 'widgets.status_bar.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Barra de Estado', en: 'Show Status Bar' },
    description: { es: 'Pie de página con latencias, proveedor activo y volumen de datos.', en: 'Footer bar with latency times, current provider, and traffic volumes.' }
  },
  {
    id: 'widgets.clocks.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Reloj UTC y Local', en: 'Show UTC and Local Clocks' },
    description: { es: 'Muestra indicadores horarios duales en la barra superior.', en: 'Show dual times zones at the top right header.' }
  },
  {
    id: 'widgets.notice_stale.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Aviso de Datos Desactualizados (>15s)', en: 'Stale Data Warnings (>15s)' },
    description: { es: 'Destaca un indicador ámbar si la API tarda en refrescar.', en: 'Display an amber flashing badge if the API stream is stale.' }
  },
  {
    id: 'widgets.notice_failover.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Aviso de Cambio de Proveedor (Failover)', en: 'Failover Alerts' },
    description: { es: 'Notifica visualmente si se conmuta de proveedor por caídas.', en: 'Notify user when fallback sources are selected due to connection failure.' }
  },
  {
    id: 'widgets.notice_unlock_audio.enabled',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Aviso de "Activar Sonido"', en: 'Unlock Sound Banner Prompt' },
    description: { es: 'Cartel superior flotante solicitando interactuar para desbloquear WebAudio.', en: 'Top floating panel prompting user interaction to unlock WebAudio contexts.' }
  },
  {
    id: 'widgets.detail.photo',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Panel Detalle: Fotografías de Aviones', en: 'Detail Panel: Aircraft Photos' },
    description: { es: 'Habilita la carga externa de fotos en el panel lateral.', en: 'Enable plane spotter photo queries on selected aircraft side panel.' }
  },
  {
    id: 'widgets.detail.route',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Panel Detalle: Ruta de Vuelo', en: 'Detail Panel: Flight Route' },
    description: { es: 'Muestra aeropuertos de origen y destino en la ficha.', en: 'Render departure and arrival airports on the side card.' }
  },
  {
    id: 'widgets.detail.alt_profile',
    group: 'widgets',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Panel Detalle: Perfil de Altitud', en: 'Detail Panel: Altitude Profile' },
    description: { es: 'Dibuja el gráfico de elevación histórica y velocidad.', en: 'Draw historical flight profile elevation chart in selected details.' }
  },

  // --- MAPA ---
  {
    id: 'map.labels.mode',
    group: 'map',
    type: 'select',
    defaultValue: 'completa',
    label: { es: 'Modo de Etiquetas', en: 'Map Label Mode' },
    description: { es: 'Elige qué metadatos renderizar junto al marcador.', en: 'Select metadata label depth next to aircraft markers.' },
    options: [
      { value: 'off', label: { es: 'Ocultas (Sin etiquetas)', en: 'Hidden (No labels)' } },
      { value: 'solo-vuelo', label: { es: 'Solo indicativo (Callsign)', en: 'Only Callsign (Flight)' } },
      { value: 'completa', label: { es: 'Completo (Indicativo + FL)', en: 'Full (Callsign + FL)' } }
    ]
  },
  {
    id: 'map.show_trails',
    group: 'map',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar estelas de vuelo', en: 'Show flight trails' },
    description: { es: 'Traza una línea discontinua con la trayectoria histórica del avión seleccionado.', en: 'Draw dotted trail line marking selected aircraft historical course.' }
  },
  {
    id: 'map.show_airports',
    group: 'map',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Aeropuertos', en: 'Show Airports Layer' },
    description: { es: 'Superpone iconos de instalaciones aeroportuarias civiles.', en: 'Overlay civil and commercial airfield markers on the map canvas.' }
  },
  {
    id: 'map.units',
    group: 'map',
    type: 'select',
    defaultValue: 'aeronautical',
    label: { es: 'Unidades de Medida', en: 'Measurement Units' },
    description: { es: 'Elige la escala para distancias, altitudes y velocidad.', en: 'Select scale unit rules for speeds, heights, and ranges.' },
    options: [
      { value: 'aeronautical', label: { es: 'Aeronáuticas (nudos, ft, NM)', en: 'Aeronautical (knots, ft, NM)' } },
      { value: 'metric', label: { es: 'Métricas (km/h, m, km)', en: 'Metric (km/h, m, km)' } }
    ]
  },
  {
    id: 'map.transition_alt',
    group: 'map',
    type: 'number',
    defaultValue: 6000,
    label: { es: 'Altitud de Transición (ft)', en: 'Transition Altitude (ft)' },
    description: { es: 'Límite de altitud para reportar alturas como Nivel de Vuelo (FL).', en: 'Altitude boundary to display altitude in standard flight levels (FL).' }
  },

  // --- DATA ---
  {
    id: 'data.provider.preferred',
    group: 'data',
    type: 'select',
    defaultValue: 'adsbexchange',
    label: { es: 'Proveedor de Datos Preferido', en: 'Preferred Data Provider' },
    description: { es: 'Servicio API primario para el flujo de tráfico de aviación.', en: 'Primary API source feeding real-time commercial traffic streams.' },
    options: [
      { value: 'adsbexchange', label: { es: 'ADS-B Exchange (Recomendado)', en: 'ADS-B Exchange (Recommended)' } },
      { value: 'opensky', label: { es: 'OpenSky Network', en: 'OpenSky Network' } },
      { value: 'local', label: { es: 'Servidor Local (Dump1090)', en: 'Local Dump1090 Server' } }
    ]
  },
  {
    id: 'data.provider.list',
    group: 'data',
    type: 'providerList',
    defaultValue: [
      { id: 'adsb_lol', enabled: true, role: 'primary', priority: 1, monthlyLimitPercent: 100 },
      { id: 'airplanes_live', enabled: true, role: 'backup', priority: 2, monthlyLimitPercent: 100 },
      { id: 'adsb_fi', enabled: true, role: 'backup', priority: 3, monthlyLimitPercent: 100 },
      { id: 'adsb_one', enabled: true, role: 'backup', priority: 4, monthlyLimitPercent: 100 },
      { id: 'opensky_network', enabled: false, role: 'backup', priority: 5, monthlyLimitPercent: 100 },
      { id: 'adsbexchange_rapidapi', enabled: false, role: 'backup', priority: 6, monthlyLimitPercent: 100 },
      { id: 'receptor_local', enabled: false, role: 'backup', priority: 7, monthlyLimitPercent: 100 },
      { id: 'flightradar24_api', enabled: true, role: 'enrich-only', priority: 8, monthlyLimitPercent: 100 }
    ],
    label: { es: 'Lista de Proveedores', en: 'Data Providers List' },
    description: { es: 'Gestiona la prioridad, credenciales y activación de proveedores.', en: 'Manage priorities, credentials, and activation of ADS-B servers.' }
  },
  {
    id: 'data.provider.merge_sources',
    group: 'data',
    type: 'toggle',
    defaultValue: false,
    label: { es: 'Fusionar Fuentes (Experimental)', en: 'Merge Data Sources (Experimental)' },
    description: { es: 'Combina múltiples proveedores activos por código HEX prefiriendo el dato más reciente.', en: 'Merge active feeds by ICAO hex code. Generates higher data footprint.' }
  },
  {
    id: 'data.provider.cache_ttl',
    group: 'data',
    type: 'slider',
    defaultValue: 10,
    min: 1,
    max: 60,
    step: 1,
    label: { es: 'TTL Caché de Enriquecimiento (min)', en: 'Enrichment Cache TTL (min)' },
    description: { es: 'Tiempo de vida en minutos de los datos de vuelo y aeropuertos cacheados para ahorrar cuota.', en: 'Time-to-live in minutes for cached flight details to suppress rapid API queries.' }
  },
  {
    id: 'data.provider.keys_password_protected',
    group: 'data',
    type: 'toggle',
    defaultValue: false,
    label: { es: 'Proteger Claves con Contraseña', en: 'Protect Credentials with Password' },
    description: { es: 'Cifra tus credenciales con WebCrypto (AES-GCM/PBKDF2) y solicita clave al iniciar.', en: 'Encrypt credential secrets in this browser with secure cryptography.' }
  },
  {
    id: 'data.provider.interval',
    group: 'data',
    type: 'slider',
    defaultValue: 5,
    min: 2,
    max: 30,
    step: 1,
    label: { es: 'Intervalo de Actualización (s)', en: 'Data Update Interval (s)' },
    description: { es: 'Frecuencia de consulta automática en segundos.', en: 'Automatic refresh query period in seconds.' }
  },

  // --- ADVANCED ---
  {
    id: 'advanced.debug_enabled',
    group: 'advanced',
    type: 'toggle',
    defaultValue: true,
    label: { es: 'Mostrar Información de Depuración', en: 'Show Debugging Widgets' },
    description: { es: 'Habilita paneles de latencia, recuentos de marcadores y zoom del mapa.', en: 'Enable small overlay diagnostic chips displaying radar stats.' }
  },
  {
    id: 'widgets.performance.enabled',
    group: 'advanced',
    type: 'toggle',
    defaultValue: false,
    label: { es: 'Mostrar Monitor de Rendimiento', en: 'Show Performance Monitor' },
    description: { es: 'Muestra un widget flotante en tiempo real con FPS, latencia de API y volumen de datos de aviones.', en: 'Display a real-time floating widget tracking FPS, API query latency, and total processed aircraft.' }
  }
];

// Initialize global registry on load
registerSettings(initialDefinitions);
