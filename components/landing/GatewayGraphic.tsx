"use client";

import React from "react";
import { OpenAI, Claude, DeepSeek } from "@lobehub/icons";

/**
 * GatewayGraphic
 * A flat 2D routing diagram matching the reference image.
 * Central Cencori hub with colored bezier paths branching to provider nodes.
 * No isometric projection — pure 2D layout.
 */
export const GatewayGraphic = () => {
  // Layout Constants
  const hubX = 130;
  const hubY = 200;
  const hubR = 32;

  // Signal ring radii
  const rings = [55, 85, 115];

  // Provider positions
  const providers = [
    { id: "openai", x: 340, y: 100, color: "#10b981" },
    { id: "anthropic", x: 380, y: 195, color: "#f97316" },
    { id: "deepseek", x: 340, y: 290, color: "#3b82f6" },
  ];

  // Input line (from left edge)
  const inputLineY = hubY;

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox="50 60 410 300" className="w-full max-w-[320px] h-auto">
        
        {/* 1. Signal Rings around Hub */}
        {rings.map((r, i) => (
          <circle 
            key={`ring-${i}`}
            cx={hubX} cy={hubY} r={r}
            fill="none" 
            stroke="var(--foreground)" 
            strokeOpacity={0.08 - i * 0.02} 
            strokeWidth="1" 
          />
        ))}

        {/* 2. Colored Routing Paths (Bezier curves) */}
        {providers.map((prov) => {
          const startX = hubX + hubR + 5;
          const startY = hubY;
          const endX = prov.x - 22;
          const endY = prov.y;
          const midX = (startX + endX) / 2;
          const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

          return (
            <path 
              key={`path-${prov.id}`}
              d={path}
              fill="none"
              stroke={prov.color}
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* 3. Central Hub (Cencori) */}
        <circle cx={hubX} cy={hubY} r={hubR} fill="var(--background)" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1.5" />
        {/* Cencori Logo */}
        <foreignObject x={hubX - 14} y={hubY - 14} width="28" height="28">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/ww.png" alt="Cencori" className="w-6 h-auto hidden dark:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/bw.png" alt="Cencori" className="w-6 h-auto block dark:hidden" />
          </div>
        </foreignObject>

        {/* 5. Provider Nodes */}
        {providers.map((prov) => (
          <g key={`node-${prov.id}`}>
            <circle cx={prov.x} cy={prov.y} r="20" fill="var(--background)" stroke="var(--foreground)" strokeOpacity="0.25" strokeWidth="1" />
            {/* Logo rendered via foreignObject */}
            <foreignObject x={prov.x - 10} y={prov.y - 10} width="20" height="20">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                {prov.id === "openai" && <OpenAI size={16} />}
                {prov.id === "anthropic" && <Claude size={16} />}
                {prov.id === "deepseek" && <DeepSeek size={16} />}
              </div>
            </foreignObject>
          </g>
        ))}

      </svg>
    </div>
  );
};
