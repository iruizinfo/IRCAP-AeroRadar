# Guía de Extensibilidad: Ajustes y Widgets

AeroRadar Pro v2.4 cuenta con una arquitectura de configuración declarativa y extensible. Añadir nuevos paneles (widgets) o controles se realiza de forma totalmente aislada sin tener que tocar o rediseñar la interfaz de usuario de los ajustes.

---

## 1. Cómo añadir un Ajuste nuevo en 3 Pasos

### Paso 1: Definir la opción en el Registro (`src/settings/registry.ts`)
Abre `/src/settings/registry.ts` y añade tu nueva definición de configuración al array `initialDefinitions`.

```typescript
{
  id: 'general.notifications_enabled',
  group: 'general',
  type: 'toggle',
  defaultValue: false,
  label: { es: 'Notificaciones del Navegador', en: 'Browser Notifications' },
  description: { 
    es: 'Permite mostrar avisos emergentes directamente en el escritorio del sistema operativo.', 
    en: 'Allow showing desktop notifications from the operating system.' 
  }
}
```

#### Parámetros soportados por un `SettingDefinition`:
* `id`: Identificador único (jerarquía por puntos recomendable, ej: `audio.tic.mode`).
* `group`: Sección del panel (`'general' | 'audio' | 'widgets' | 'map' | 'data' | 'advanced'`).
* `type`: Tipo de interfaz de control (`'toggle' | 'slider' | 'select' | 'number' | 'text' | 'button'`).
* `defaultValue`: Valor asignado por defecto al limpiar o iniciar la aplicación.
* `label` y `description`: Textos i18n estructurados con claves `es` y `en`.
* `min`, `max`, `step` (Opcionales): Límites para controles numéricos o sliders.
* `options` (Opcionales): Array con opciones de tipo `{ value, label: {es, en} }` para selects.
* `dependsOn` (Opcional): Condición de habilitación según el valor de otra opción padre (ej: `{ id: 'audio.master.enabled', condition: (v) => !!v }`).

### Paso 2: Utilizar la opción en el código mediante el Hook `useSetting`
Importa y consume la opción de manera directa y optimizada en tu componente React. Al estar soportado por un almacén de suscripción granular (`useSyncExternalStore`), **el componente solo se renderizará cuando cambie esta opción específica**, sin provocar re-renderizados innecesarios en el resto del árbol de componentes.

```tsx
import { useSetting } from './settings/store';

export const MyComponent = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useSetting<boolean>('general.notifications_enabled');

  const triggerNotification = () => {
    if (notificationsEnabled) {
      new Notification("AeroRadar Alerta", { body: "Tráfico de emergencia detectado." });
    }
  };

  return (
    <div>
      <p>Notificaciones: {notificationsEnabled ? 'Activadas' : 'Desactivadas'}</p>
      <button onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
        Conmutar
      </button>
    </div>
  );
};
```

### Paso 3: Definir Migraciones (Si la opción reemplaza una clave antigua)
Si estás reemplazando una opción heredada u obsoleta de `localStorage` y quieres conservar los valores del usuario, añade su asignación al método `performLegacyMigration` en `src/settings/store.ts` para que se migre limpiamente la primera vez que se cargue la aplicación:

```typescript
const legacyKeyMappings: Record<string, string> = {
  'old_notification_key': 'general.notifications_enabled'
};
```

---

## 2. Cómo añadir un Widget Nuevo

Los elementos visuales de la interfaz de usuario (como banners, paneles de control o gráficos estadísticos) se gestionan dinámicamente mediante el registro de widgets en `src/widgets/registry.ts`.

### Paso 1: Registrar el Widget
Declara el identificador, nombre y la opción de visibilidad que controla la activación del widget en `/src/widgets/registry.ts`:

```typescript
export const widgetsRegistry: WidgetDefinition[] = [
  // ... widgets existentes ...
  {
    id: 'my_awesome_charts',
    name: { es: 'Gráficos de Altitud Avanzados', en: 'Advanced Altitude Charts' },
    settingId: 'widgets.charts.enabled', // ID de la opción que debe existir en registry.ts
    defaultLocation: 'sidebar'
  }
];
```

### Paso 2: Envolver el Componente con `WidgetHost`
En tu estructura de componentes o página principal (`App.tsx`), envuelve tu panel con el componente `<WidgetHost />`. De esta manera, si el usuario desactiva el panel en los ajustes, **el componente se desmontará completamente del árbol del DOM**, liberando memoria, cancelando peticiones API y liberando manejadores de eventos.

```tsx
import { WidgetHost } from './widgets/registry';
import { AltitudeChartPanel } from './components/AltitudeChartPanel';

// Dentro del render principal de App.tsx:
<WidgetHost id="my_awesome_charts">
  <AltitudeChartPanel data={aircraftList} />
</WidgetHost>
```

---

## 3. Ejemplo Comentado de una Opción Futura
A continuación se ilustra una propuesta para añadir alertas de proximidad y notificaciones del sistema de escritorio:

```typescript
/*
// 1. Agregar definición en registry.ts:
{
  id: 'general.desktop_notifications',
  group: 'general',
  type: 'toggle',
  defaultValue: false,
  label: { es: 'Notificaciones de Escritorio', en: 'Desktop Notifications' },
  description: { 
    es: 'Activa el envío de notificaciones push de sistema ante emergencias capturadas.', 
    en: 'Toggle system-level push notifications upon emergency detection.' 
  }
}

// 2. Solicitar permisos e invocar en el hook useAircraftAlerts.ts:
import { getSetting } from '../settings/store';

if (getSetting('general.desktop_notifications') && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Dentro del manejador de alerta confirmada:
if (getSetting('general.desktop_notifications') && Notification.permission === 'granted') {
  new Notification(`EMERGENCIA: SQUAWK ${ac.squawk}`, {
    body: `La aeronave con indicativo ${ac.callsign} declaró emergencia.`,
    icon: '/favicon.ico'
  });
}
*/
```
