/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface IrcapLogoProps {
  className?: string;
}

export const IrcapLogo: React.FC<IrcapLogoProps> = ({ className = 'w-10 h-10' }) => {
  const R_in = 25;
  const R_mid = 90;
  const R_out = 165;
  const numBlades = 26;
  const w = -1.15; // Counter-clockwise twist factor matching the logo
  const delta = 0.15; // Blade angular thickness

  const blades = Array.from({ length: numBlades }).map((_, i) => {
    const A = (i * 2 * Math.PI) / numBlades;
    const x1 = 250 + R_in * Math.cos(A);
    const y1 = 220 + R_in * Math.sin(A);

    const x2 = 250 + R_out * Math.cos(A + w);
    const y2 = 220 + R_out * Math.sin(A + w);

    const x3 = 250 + R_out * Math.cos(A + w + delta);
    const y3 = 220 + R_out * Math.sin(A + w + delta);

    const x4 = 250 + R_in * Math.cos(A + delta);
    const y4 = 220 + R_in * Math.sin(A + delta);

    // Quadratic curve control points
    const cx_lead = 250 + R_mid * Math.cos(A + w * 0.45);
    const cy_lead = 220 + R_mid * Math.sin(A + w * 0.45);

    const cx_trail = 250 + R_mid * Math.cos(A + delta + w * 0.45);
    const cy_trail = 220 + R_mid * Math.sin(A + delta + w * 0.45);

    return `M ${x1} ${y1} Q ${cx_lead} ${cy_lead}, ${x2} ${y2} L ${x3} ${y3} Q ${cx_trail} ${cy_trail}, ${x4} ${y4} Z`;
  });

  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Premium metallic gold gradient */}
        <linearGradient id="ircapGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF3B0" />
          <stop offset="25%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#AA7C11" />
          <stop offset="75%" stopColor="#F3E5AB" />
          <stop offset="100%" stopColor="#AA7C11" />
        </linearGradient>

        <linearGradient id="ircapGoldLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(170, 124, 17, 0)" />
          <stop offset="20%" stopColor="#AA7C11" />
          <stop offset="50%" stopColor="#FFF3B0" />
          <stop offset="80%" stopColor="#AA7C11" />
          <stop offset="100%" stopColor="rgba(170, 124, 17, 0)" />
        </linearGradient>

        {/* Clip path to flatten the bottom of the turbine dome exactly like the logo */}
        <clipPath id="domeClip">
          <path d="M 60 238 A 165 165 0 1 1 440 238 Z" />
        </clipPath>
      </defs>

      {/* Turbine Group with Clip Path */}
      <g clipPath="url(#domeClip)">
        {/* Golden Central Sun/Circle */}
        <circle cx="250" cy="220" r="28" fill="url(#ircapGold)" />
        {/* Render Turbine Blades */}
        {blades.map((d, idx) => (
          <path key={idx} d={d} fill="url(#ircapGold)" />
        ))}
      </g>

      {/* IRCAP AVIATION wide-serif text */}
      <text
        x="250"
        y="420"
        fill="url(#ircapGold)"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="34"
        fontWeight="800"
        letterSpacing="8"
        textAnchor="middle"
      >
        IRCAP AVIATION
      </text>

      {/* Bottom elegant horizontal line */}
      <path d="M 130 455 L 370 455" stroke="url(#ircapGoldLine)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};
