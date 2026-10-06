/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { useSetting } from '../settings/store';

export interface WidgetDefinition {
  id: string;
  name: { es: string; en: string };
  settingId: string;
  defaultLocation: 'top-center' | 'sidebar' | 'bottom-left' | 'footer' | 'header';
}

export const widgetsRegistry: WidgetDefinition[] = [
  {
    id: 'banner_emergency',
    name: { es: 'Banner de Emergencia', en: 'Emergency Banner' },
    settingId: 'widgets.banner_emergency.enabled',
    defaultLocation: 'top-center'
  },
  {
    id: 'panel_emergency',
    name: { es: 'Panel de Emergencias', en: 'Emergencies Panel' },
    settingId: 'widgets.panel_emergency.enabled',
    defaultLocation: 'sidebar'
  },
  {
    id: 'global_stats',
    name: { es: 'Estadísticas Globales', en: 'Global Statistics' },
    settingId: 'widgets.global_stats.enabled',
    defaultLocation: 'bottom-left'
  },
  {
    id: 'status_bar',
    name: { es: 'Barra de Estado', en: 'Status Bar' },
    settingId: 'widgets.status_bar.enabled',
    defaultLocation: 'footer'
  },
  {
    id: 'clocks',
    name: { es: 'Reloj UTC y Local', en: 'UTC and Local Clock' },
    settingId: 'widgets.clocks.enabled',
    defaultLocation: 'header'
  },
  {
    id: 'debug.performance',
    name: { es: 'Monitor de Rendimiento', en: 'Performance Monitor' },
    settingId: 'widgets.performance.enabled',
    defaultLocation: 'bottom-left'
  }
];

interface WidgetHostProps {
  id: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * WidgetHost Component:
 * Wraps visual dashboard components. Only mounts its children if the corresponding
 * user setting is toggled active, completely unmounting the children on toggle off
 * to release browser DOM resources and memory.
 */
export const WidgetHost: React.FC<WidgetHostProps> = ({ id, children, fallback = null }) => {
  const widgetDef = widgetsRegistry.find((w) => w.id === id);
  if (!widgetDef) {
    // If not a registered widget, render children by default
    return <>{children}</>;
  }

  const [enabled] = useSetting<boolean>(widgetDef.settingId);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
