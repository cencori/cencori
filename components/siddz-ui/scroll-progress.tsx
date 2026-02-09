"use client";

import React, { useEffect, useState, useRef, useCallback, RefObject } from "react";

interface ScrollProgressItem {
  id: string;
  title: string;
  level: number;
}

interface Point {
  x: number;
  y: number;
  level: number;
}

interface ScrollProgressProps {
  items: ScrollProgressItem[];
  className?: string;
  scrollAreaRef?: RefObject<HTMLElement | null>;
}

export const ScrollProgress = ({ items, className = "", scrollAreaRef }: ScrollProgressProps) => {
  const [activeLength, setActiveLength] = useState(0);
  const [pathD, setPathD] = useState("");
  const [totalLength, setTotalLength] = useState(0);
  const [points, setPoints] = useState<Point[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<Array<RefObject<HTMLButtonElement | null>>>([]);
  const pathRef = useRef<SVGPathElement>(null);

  const INDENT_SIZE = 12;
  const BASE_OFFSET = 6;
  const DOT_TEXT_GAP = 16;

  if (textRefs.current.length !== items.length) {
    textRefs.current = Array(items.length).fill(null).map((_, i) => textRefs.current[i] || React.createRef());
  }

  const calculatePath = useCallback(() => {
    if (!containerRef.current || items.length === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    const newPoints = textRefs.current.map((ref, index) => {
      if (!ref.current) return { x: 0, y: 0, level: 1 };
      const rect = ref.current.getBoundingClientRect();
      const level = items[index].level || 1;
      const x = BASE_OFFSET + (level - 1) * INDENT_SIZE;
      const y = rect.top - containerRect.top + rect.height / 2;
      return { x, y, level };
    });

    setPoints(newPoints);
    if (newPoints.length === 0) return;

    let d = `M ${newPoints[0].x} ${newPoints[0].y}`;

    for (let i = 1; i < newPoints.length; i++) {
      const prev = newPoints[i - 1];
      const curr = newPoints[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;

      if (Math.abs(dx) < 0.5) {
        d += ` L ${curr.x} ${curr.y}`;
      } else {
        const midY = prev.y + dy / 2;
        const curveRadius = Math.min(Math.abs(dy) * 0.3, 20);
        d += ` L ${prev.x} ${midY - curveRadius}`;
        d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${midY + curveRadius}`;
        d += ` L ${curr.x} ${curr.y}`;
      }
    }

    setPathD(d);
  }, [items]);

  useEffect(() => {
    const timer = setTimeout(calculatePath, 50);
    const observer = new ResizeObserver(calculatePath);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", calculatePath);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculatePath);
      observer.disconnect();
    };
  }, [calculatePath]);

  useEffect(() => {
    if (pathRef.current && pathD) {
      setTotalLength(pathRef.current.getTotalLength());
    }
  }, [pathD]);

  useEffect(() => {
    if (items.length === 0 || !pathD || totalLength === 0) return;

    const scrollTarget = scrollAreaRef?.current || window;

    const handleScroll = () => {
      let viewTop = 0;
      let viewHeight = 0;

      if (scrollAreaRef?.current) {
        viewTop = scrollAreaRef.current.getBoundingClientRect().top;
        viewHeight = scrollAreaRef.current.clientHeight;
      } else {
        viewTop = 0;
        viewHeight = window.innerHeight;
      }

      const triggerLine = viewTop + viewHeight * 0.3;

      const sectionTops = items.map(item => {
        const el = document.getElementById(item.id);
        if (!el) return Infinity;
        return el.getBoundingClientRect().top;
      });

      let activeIndex = -1;
      let progressInSection = 0;

      for (let i = 0; i < sectionTops.length; i++) {
        if (sectionTops[i] <= triggerLine) {
          activeIndex = i;
        }
      }

      if (activeIndex >= 0) {
        const currentTop = sectionTops[activeIndex];
        const nextTop = sectionTops[activeIndex + 1] ?? currentTop + 500;

        if (activeIndex === 0) {
          // Special case for first section: Map scroll 0 to progress 0
          const currentScroll = scrollTarget === window ? window.scrollY : (scrollTarget as Element).scrollTop;
          const distToEnd = nextTop - triggerLine;
          const totalDist = currentScroll + distToEnd;
          if (totalDist > 0) {
            progressInSection = Math.min(Math.max(currentScroll / totalDist, 0), 1);
          } else {
            progressInSection = 1;
          }
        } else {
          const sectionHeight = nextTop - currentTop;
          if (sectionHeight > 0) {
            progressInSection = Math.min(Math.max((triggerLine - currentTop) / sectionHeight, 0), 1);
          } else {
            progressInSection = 1;
          }
        }
      }

      if (activeIndex >= 0 && pathRef.current) {
        const segmentLength = totalLength / Math.max(items.length - 1, 1);
        const targetLength = segmentLength * (activeIndex + progressInSection);
        setActiveLength(Math.min(targetLength, totalLength));
      } else {
        setActiveLength(0);
      }
    };

    const target = scrollTarget === window ? window : (scrollTarget as HTMLElement);
    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      target.removeEventListener("scroll", handleScroll);
    };
  }, [items, pathD, totalLength, scrollAreaRef]);

  const getDotPosition = (): Point | null => {
    if (!pathRef.current) return null;
    try {
      const point = pathRef.current.getPointAtLength(Math.max(0, activeLength));
      return { x: point.x, y: point.y, level: 0 };
    } catch {
      return null;
    }
  };

  const tipPosition = getDotPosition();

  const scrollToItem = (itemId: string) => {
    const el = document.getElementById(itemId);
    if (!el) return;

    if (scrollAreaRef?.current) {
      const container = scrollAreaRef.current;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const triggerOffset = container.clientHeight * 0.3;
      const scrollTop = container.scrollTop + (elRect.top - containerRect.top) - triggerOffset + 10;
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    } else {
      const elRect = el.getBoundingClientRect();
      const triggerOffset = window.innerHeight * 0.3;
      const scrollTop = window.scrollY + elRect.top - triggerOffset + 10;
      window.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };

  return (
    <div ref={containerRef} className={`relative w-fit ${className}`}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke={totalLength > 0 ? "#fafafa" : "transparent"}
          strokeWidth="1"
          strokeDasharray={totalLength || 1}
          strokeDashoffset={Math.max(0, (totalLength || 1) - activeLength)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-[stroke-dashoffset] duration-100 ease-out"
        />
        {tipPosition && (
          <circle
            cx={tipPosition.x}
            cy={tipPosition.y}
            r="3"
            fill="white"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }}
          />
        )}
      </svg>

      <div className="relative z-10 flex flex-col gap-3 w-fit">
        {items.map((item, index) => {
          const level = item.level || 1;
          const paddingLeft = BASE_OFFSET + (level - 1) * INDENT_SIZE + DOT_TEXT_GAP + 5;

          return (
            <button
              key={item.id}
              ref={textRefs.current[index]}
              onClick={() => scrollToItem(item.id)}
              className="text-left font-inter text-[13px] leading-snug transition-colors duration-200 ease-out text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap"
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {item.title}
            </button>
          );
        })}
      </div>
    </div>
  );
};
