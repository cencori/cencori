"use client";

import React from "react";

const ISO_ANGLE = Math.PI / 6;

function isoX(x: number, y: number) {
  return (x - y) * Math.cos(ISO_ANGLE);
}
function isoY(x: number, y: number, z: number) {
  return (x + y) * Math.sin(ISO_ANGLE) - z;
}

export const IsoStack = () => {
  const cx = 300;
  const cy = 400; // Centered
  const SCALE = 100; // Base scale
  
  function toSVG(ix: number, iy: number, iz: number) {
    return {
      x: cx + isoX(ix * SCALE, iy * SCALE),
      y: cy + isoY(ix * SCALE, iy * SCALE, iz)
    };
  }

  const p = (pt: { x: number, y: number }) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;

  const numLayers = 4;
  const slabH = 26;   // Thick server chassis
  const gap = 16;     // Space between chassis
  const W = 1.2;      // Width/Depth

  const slabs = Array.from({ length: numLayers }).map((_, i) => {
    const z = i * (slabH + gap);
    return { z, i };
  });

  const strokeColor = "var(--foreground)";
  const fill = "var(--background)";

  return (
    <div className="w-full flex items-center justify-center">
      {/* Tightly cropped viewBox to eliminate empty vertical space */}
      <svg viewBox="90 120 420 410" className="w-full max-w-[250px] h-auto">
        
        {slabs.map((slab) => {
          const { z, i } = slab;
          
          // Corners of the top face
          const TL  = toSVG(-W, -W, z + slabH); // Top-Back
          const TR  = toSVG( W, -W, z + slabH); // Right
          const BR  = toSVG( W,  W, z + slabH); // Front-Bottom
          const BL  = toSVG(-W,  W, z + slabH); // Left
          
          // Corners of the bottom face
          const TLb = toSVG(-W, -W, z);
          const TRb = toSVG( W, -W, z);
          const BRb = toSVG( W,  W, z);
          const BLb = toSVG(-W,  W, z);

          // Front-Left Face Details (BL to BR)
          
          // 1. LED Indicators on the left side of the front-left face
          const ledColors = ["#10b981", "#ef4444", "#3b82f6"]; // Emerald, Red, Blue
          const leds = [0.15, 0.22, 0.29].map((frac, ledIdx) => {
            const pt = toSVG(-W + (W * 2) * frac, W, z + slabH * 0.5);
            // Simulate blinking/active state for some LEDs across different layers
            const isActive = (i + ledIdx) % 3 !== 0; 
            return (
              <circle 
                key={`led-${ledIdx}`}
                cx={pt.x} cy={pt.y} r="1.5"
                fill={ledColors[ledIdx]}
                opacity={isActive ? 0.9 : 0.2}
              />
            );
          });

          // 2. Drive Bay / Vent block on the right side of the front-left face
          const ventStartFrac = 0.45;
          const ventEndFrac = 0.85;
          const ventTopH = 0.75;
          const ventBotH = 0.25;

          const ventTL = toSVG(-W + (W * 2) * ventStartFrac, W, z + slabH * ventTopH);
          const ventTR = toSVG(-W + (W * 2) * ventEndFrac, W, z + slabH * ventTopH);
          const ventBR = toSVG(-W + (W * 2) * ventEndFrac, W, z + slabH * ventBotH);
          const ventBL = toSVG(-W + (W * 2) * ventStartFrac, W, z + slabH * ventBotH);

          // Horizontal lines inside the vent
          const ventLines = [0.4, 0.6].map((hFrac, vIdx) => {
             const h = ventBotH + (ventTopH - ventBotH) * hFrac;
             const l1 = toSVG(-W + (W * 2) * ventStartFrac, W, z + slabH * h);
             const l2 = toSVG(-W + (W * 2) * ventEndFrac, W, z + slabH * h);
             return (
               <line 
                 key={`ventline-${vIdx}`}
                 x1={l1.x} y1={l1.y} x2={l2.x} y2={l2.y}
                 stroke={strokeColor} strokeOpacity="0.15" strokeWidth="1"
               />
             );
          });

          return (
            <g key={i}>
              {/* Base fill polygon to occlude elements behind this layer */}
              <polygon points={`${p(TL)} ${p(TR)} ${p(BR)} ${p(BRb)} ${p(TRb)} ${p(TLb)}`} fill={fill} />

              {/* Front-left face (BL -> BR) */}
              <polygon points={`${p(BL)} ${p(BR)} ${p(BRb)} ${p(BLb)}`} fill={fill} stroke={strokeColor} strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" />
              {leds}
              
              {/* Drive Bay Box */}
              <polygon points={`${p(ventTL)} ${p(ventTR)} ${p(ventBR)} ${p(ventBL)}`} fill="none" stroke={strokeColor} strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" />
              {ventLines}

              {/* Front-right face (BR -> TR) */}
              <polygon points={`${p(BR)} ${p(TR)} ${p(TRb)} ${p(BRb)}`} fill={fill} stroke={strokeColor} strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" />
              
              {/* Top face (TL -> TR -> BR -> BL) */}
              <polygon points={`${p(TL)} ${p(TR)} ${p(BR)} ${p(BL)}`} fill={fill} stroke={strokeColor} strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
