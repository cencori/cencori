"use client";

import React from "react";

/**
 * MemoryGraphic
 * High-fidelity SVG Brain Sagittal Section.
 * Mimics DTI (Diffusion Tensor Imaging) fiber tracts with dense fanning paths.
 */
export const MemoryGraphic = () => {
  const strokeColor = "var(--foreground)";

  // Helper to generate fanning fiber paths
  const renderFibers = () => {
    const fibers = [];
    const stemX = 160;
    const stemY = 240;
    
    // Create a dense fan of lines from the stem to various brain regions
    for (let i = 0; i < 45; i++) {
      const angle = (i / 44) * Math.PI - Math.PI * 0.1; // Spread from back to front
      const length = 80 + Math.random() * 40;
      const targetX = stemX + Math.cos(angle - Math.PI/2) * length * 1.5;
      const targetY = stemY + Math.sin(angle - Math.PI/2) * length;
      
      // Control point for the "sweep"
      const cpX = stemX + (targetX - stemX) * 0.3;
      const cpY = stemY - 50;

      fibers.push(
        <path
          key={i}
          d={`M ${stemX} ${stemY} Q ${cpX} ${cpY} ${targetX} ${targetY}`}
          fill="none"
          stroke={strokeColor}
          strokeOpacity={0.05 + Math.random() * 0.1}
          strokeWidth={0.5 + Math.random() * 0.5}
        />
      );
    }
    return fibers;
  };

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox="20 20 280 280" className="w-full max-w-[280px] h-auto">
        
        {/* 1. The Main Brain Silhouette (More Anatomical Sagittal View) */}
        <path
          d="M 160 250 
             C 140 250, 120 240, 110 220 
             C 90 220, 70 210, 60 190 
             C 40 180, 30 150, 35 120 
             C 40 80, 70 40, 120 35 
             C 170 30, 230 40, 250 80 
             C 265 110, 260 150, 240 180 
             C 230 200, 210 210, 215 230 
             C 218 250, 200 265, 180 260 
             C 170 255, 165 250, 160 250 Z"
          fill="none"
          stroke={strokeColor}
          strokeOpacity="0.2"
          strokeWidth="1"
        />

        {/* 2. Fiber Tracts (The DTI look) */}
        <g>
          {renderFibers()}
          
          {/* Secondary fanning for the cerebellum (bottom right) */}
          {Array.from({ length: 15 }).map((_, i) => (
            <path
              key={`c-${i}`}
              d={`M 175 220 Q 200 220 ${210 + i*2} ${210 + Math.sin(i)*10}`}
              fill="none"
              stroke={strokeColor}
              strokeOpacity="0.1"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* 3. The "Corpus Callosum" core (The central connector) */}
        <path
          d="M 110 140 Q 150 110 200 140"
          fill="none"
          stroke={strokeColor}
          strokeOpacity="0.3"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* 4. Fine detail - Cortical folds along the edge */}
        <path
          d="M 45 100 Q 40 120 45 140 M 80 50 Q 100 45 120 50 M 180 45 Q 210 50 230 70"
          fill="none"
          stroke={strokeColor}
          strokeOpacity="0.1"
          strokeWidth="1"
        />

      </svg>
    </div>
  );
};
