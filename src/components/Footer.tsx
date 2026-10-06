/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LanguageCode } from '../types/aircraft';
import { translations } from '../i18n/translations';

import { WidgetHost } from '../widgets/registry';

interface FooterProps {
  lang: LanguageCode;
  voiceStatus: 'Gemini TTS' | 'navegador' | 'sin voz';
}

export const Footer: React.FC<FooterProps> = ({ lang, voiceStatus }) => {
  const t = translations[lang];

  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 px-4 py-1.5 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 z-30 relative">
      <div>{t.footerAttribution}</div>
      <WidgetHost id="status_bar">
        <div className="flex items-center space-x-3">
          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
            Voz: <span className="text-cyan-400 font-bold uppercase">{voiceStatus}</span>
          </span>
          <span>•</span>
          <span>Tiles: CARTO Dark</span>
          <span>•</span>
          <span>AeroRadar Pro v2.4</span>
        </div>
      </WidgetHost>
    </footer>
  );
};
