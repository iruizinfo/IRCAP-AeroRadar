# AeroRadar Pro - Consola de Operaciones Aéreas en Tiempo Real

**AeroRadar Pro** es una WebApp profesional de radar de tráfico aéreo en tiempo real, diseñada en español con un tema oscuro tipo consola de operaciones (inspirado en Flightradar24).

---

## Stack Tecnológico

- **Frontend**: React + TypeScript + Vite, Leaflet (`react-leaflet`) con teselas CARTO Dark.
- **Backend**: Express (en `server.ts`) actuando como proxy con caché en memoria (TTL 3 s) y limitación de tasa (1 req/s por proveedor).

---

## Arquitectura de Proveedores y Failover

El sistema implementa una interfaz normalizada de proveedores ADSB y failover automático (si un proveedor falla o devuelve error 429/timeout, cambia automáticamente al siguiente):

1. **adsb.lol** (Por defecto)
2. **airplanes.live**
3. **adsb.fi**
4. **OpenSky Network** (Soporte OAuth2 por variable de entorno opcional).

### Cómo cambiar de proveedor por defecto
El orden de los proveedores y el proveedor activo se gestionan dinámicamente en el backend (`server.ts`). El indicador activo y su estado de salud (latencia y errores) se pueden consultar en la interfaz haciendo clic en el botón de proveedor en la barra superior.

### Cómo añadir un nuevo proveedor (Punto de Extensión)
Existe una plantilla documentada en `src/providers/_template.ts`. Para añadir un nuevo proveedor de pago o externo (ej. AeroDataBox, FlightAware AeroAPI, OpenWeather):
1. Implementa la lógica consultando la API en el backend (`server.ts`).
2. Añade el nuevo proveedor al array `PROVIDERS`.
3. Configura las variables de entorno necesarias en `.env`.

---

## Características Principales

- **Mapa Dinámico con Leaflet**: Consulta de tráfico según el viewport actual (centro y radio ajustados al hacer zoom/mover el mapa, hasta 250 nm).
- **Marcadores Rotados y Gradiente de Altitud**: Iconos SVG orientados según el rumbo (`trackDeg`) y coloreados según la altitud.
- **Panel de Detalles y Alertas Squawk**: Al hacer clic en una aeronave se muestran todos sus parámetros operativos, estela de última posición, ruta (enriquecida vía adsbdb.com) y fotografía (vía planespotters.net). Alerta destacada para códigos de emergencia (7500, 7600, 7700).
- **Filtros Avanzados**: Filtrado por rango de altitud, velocidad y opción de ocultar aeronaves en tierra.
- **Capa de Aeropuertos**: Dataset OurAirports integrado con aeropuertos grandes y medianos.
- **Internacionalización y Unidades**: Selector de idioma ES/EN y sistema de unidades (métrico o imperial).
