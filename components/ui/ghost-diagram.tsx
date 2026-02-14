'use client';

/**
 * Ghost Diagram Primitives
 * 
 * A Cenpact design pattern for minimalist, theme-aware diagrams.
 * Ghost Diagrams use transparent backgrounds and currentColor
 * to seamlessly blend with any background in light or dark mode.
 * 
 * @see /content/blog/cenpact-design-system.mdx for full documentation
 */

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

/* =============================================================================
   CORE PRIMITIVES
   ============================================================================= */

/**
 * GhostBox - A transparent container with thin borders
 * 
 * Usage:
 * <GhostBox label="Phase 1">
 *   <GhostBoxTitle>Input Scan</GhostBoxTitle>
 *   <GhostBoxContent>...</GhostBoxContent>
 * </GhostBox>
 */
interface GhostBoxProps {
    children: ReactNode;
    label?: string;
    className?: string;
    variant?: 'default' | 'muted' | 'success' | 'warning' | 'error';
}

export function GhostBox({ children, label, className, variant = 'default' }: GhostBoxProps) {
    const variantStyles = {
        default: 'border-current/20',
        muted: 'border-current/20 bg-current/[0.02]',
        success: 'border-green-500/30 bg-green-500/[0.03]',
        warning: 'border-yellow-500/30 bg-yellow-500/[0.03]',
        error: 'border-red-500/30 bg-red-500/[0.03]',
    };

    return (
        <div className={cn('relative rounded-lg p-5', variantStyles[variant], className)}>
            {label && (
                <div className="absolute -top-2.5 left-4 bg-background px-2">
                    <span className="text-[10px] tracking-widest uppercase text-current/40">{label}</span>
                </div>
            )}
            {children}
        </div>
    );
}

export function GhostBoxTitle({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('text-sm font-medium mb-3', className)}>{children}</div>;
}

export function GhostBoxContent({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('text-xs text-current/60', className)}>{children}</div>;
}

/**
 * GhostGrid - A grid of small labeled cells
 * 
 * Usage:
 * <GhostGrid items={['Content Filter', 'Jailbreak Detect', 'Intent Analysis']} />
 */
interface GhostGridProps {
    items: string[];
    columns?: 2 | 3 | 4;
    className?: string;
}

export function GhostGrid({ items = [], columns = 3, className }: GhostGridProps) {
    const gridCols = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    };

    return (
        <div className={cn('grid gap-2 text-xs text-current/60', gridCols[columns], className)}>
            {items.map((item, i) => (
                <div key={i} className="border border-current/15 rounded px-2 py-1.5 text-center">
                    {item}
                </div>
            ))}
        </div>
    );
}

/**
 * GhostArrow - A vertical arrow connector
 * 
 * Usage:
 * <GhostArrow />
 * <GhostArrow label="if safe" />
 */
interface GhostArrowProps {
    label?: string;
    className?: string;
}

export function GhostArrow({ label, className }: GhostArrowProps) {
    return (
        <div className={cn('flex flex-col items-center', className)}>
            <div className="w-px h-4 bg-current/30" />
            {label && (
                <span className="text-[9px] text-current/40 my-1">{label}</span>
            )}
            <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30">
                <path d="M4 5L0 0h8L4 5z" />
            </svg>
        </div>
    );
}

/**
 * GhostDashedLine - A horizontal dashed connector with optional label
 * 
 * Usage:
 * <GhostDashedLine label="context passed" />
 */
interface GhostDashedLineProps {
    label?: string;
    className?: string;
}

export function GhostDashedLine({ label, className }: GhostDashedLineProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <svg width="6" height="8" viewBox="0 0 6 8" className="fill-current/30">
                <path d="M0 4L6 0v8L0 4z" />
            </svg>
            <div className="flex-1 border-t border-dashed border-current/30" />
            {label && (
                <span className="text-[10px] text-current/40 tracking-widest uppercase">{label}</span>
            )}
            <div className="flex-1 border-t border-dashed border-current/30" />
            <svg width="6" height="8" viewBox="0 0 6 8" className="fill-current/30">
                <path d="M6 4L0 0v8l6-4z" />
            </svg>
        </div>
    );
}

/**
 * GhostPlaceholder - Fake text lines for visual representation
 * 
 * Usage:
 * <GhostPlaceholder lines={3} />
 */
interface GhostPlaceholderProps {
    lines?: number;
    className?: string;
}

export function GhostPlaceholder({ lines = 3, className }: GhostPlaceholderProps) {
    const widths = ['w-full', 'w-3/4', 'w-4/5', 'w-3/5', 'w-full', 'w-4/5'];

    return (
        <div className={cn('space-y-1.5', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className={cn('h-1.5 bg-current/15 rounded', widths[i % widths.length])} />
            ))}
        </div>
    );
}

/**
 * GhostCaption - A centered caption below the diagram
 * 
 * Usage:
 * <GhostCaption>Multi-phase security architecture</GhostCaption>
 */
export function GhostCaption({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('mt-8 text-center text-xs text-current/40', className)}>
            {children}
        </div>
    );
}

/**
 * GhostContainer - The root container for a Ghost Diagram
 * 
 * Usage:
 * <GhostContainer maxWidth="lg">
 *   ...diagram content...
 * </GhostContainer>
 */
interface GhostContainerProps {
    children: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

export function GhostContainer({ children, maxWidth = 'lg', className }: GhostContainerProps) {
    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-full',
    };

    return (
        <div className={cn('my-12 font-sans select-none mx-auto', widths[maxWidth], className)}>
            {children}
        </div>
    );
}

/**
 * GhostLabel - A subtle uppercase label
 * 
 * Usage:
 * <GhostLabel>User Input</GhostLabel>
 */
export function GhostLabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('text-center mb-2', className)}>
            <span className="text-xs tracking-widest uppercase text-current/50">{children}</span>
        </div>
    );
}

/**
 * GhostIcon - Small icon placeholder
 * 
 * Usage:
 * <GhostIcon>◯</GhostIcon>
 */
export function GhostIcon({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn(
            'w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40',
            className
        )}>
            {children}
        </div>
    );
}
