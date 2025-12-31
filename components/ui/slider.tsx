"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
    value?: number
    defaultValue?: number
    min?: number
    max?: number
    step?: number
    onChange?: (value: number) => void
    disabled?: boolean
    className?: string
    showValue?: boolean
    size?: "sm" | "md"
}

/**
 * Cenpact Slider - Minimal, elegant slider component
 */
function Slider({
    value,
    defaultValue = 50,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    disabled = false,
    className,
    showValue = true,
    size = "md",
}: SliderProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = value ?? internalValue
    const trackRef = React.useRef<HTMLDivElement>(null)
    const isDragging = React.useRef(false)

    const percentage = ((currentValue - min) / (max - min)) * 100

    const updateValue = React.useCallback((clientX: number) => {
        if (!trackRef.current || disabled) return

        const rect = trackRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
        const rawValue = (x / rect.width) * (max - min) + min
        const steppedValue = Math.round(rawValue / step) * step
        const clampedValue = Math.max(min, Math.min(max, steppedValue))

        if (value === undefined) {
            setInternalValue(clampedValue)
        }
        onChange?.(clampedValue)
    }, [disabled, max, min, step, value, onChange])

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (disabled) return
        isDragging.current = true
        updateValue(e.clientX)

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging.current) {
                updateValue(e.clientX)
            }
        }

        const handleMouseUp = () => {
            isDragging.current = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [disabled, updateValue])

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (disabled) return
        isDragging.current = true
        updateValue(e.touches[0].clientX)

        const handleTouchMove = (e: TouchEvent) => {
            if (isDragging.current) {
                updateValue(e.touches[0].clientX)
            }
        }

        const handleTouchEnd = () => {
            isDragging.current = false
            document.removeEventListener('touchmove', handleTouchMove)
            document.removeEventListener('touchend', handleTouchEnd)
        }

        document.addEventListener('touchmove', handleTouchMove)
        document.addEventListener('touchend', handleTouchEnd)
    }, [disabled, updateValue])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (disabled) return

        let newValue = currentValue
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(max, currentValue + step)
                break
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(min, currentValue - step)
                break
            case 'Home':
                newValue = min
                break
            case 'End':
                newValue = max
                break
            default:
                return
        }

        e.preventDefault()
        if (value === undefined) {
            setInternalValue(newValue)
        }
        onChange?.(newValue)
    }, [currentValue, disabled, max, min, step, value, onChange])

    const trackHeight = size === "sm" ? "h-1" : "h-1.5"
    const thumbSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"

    return (
        <div
            className={cn(
                "relative flex items-center gap-3 select-none",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            {/* Track */}
            <div
                ref={trackRef}
                className={cn(
                    "relative flex-1 rounded-full bg-secondary cursor-pointer",
                    trackHeight,
                    disabled && "cursor-not-allowed"
                )}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {/* Filled range */}
                <div
                    className={cn(
                        "absolute left-0 top-0 h-full rounded-full bg-foreground transition-all duration-75",
                    )}
                    style={{ width: `${percentage}%` }}
                />

                {/* Thumb */}
                <div
                    role="slider"
                    tabIndex={disabled ? -1 : 0}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={currentValue}
                    aria-disabled={disabled}
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                        "rounded-full bg-foreground border-2 border-background",
                        "shadow-sm transition-transform duration-75",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "hover:scale-110 active:scale-95",
                        thumbSize,
                        disabled && "hover:scale-100"
                    )}
                    style={{ left: `${percentage}%` }}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {/* Value display */}
            {showValue && (
                <span className={cn(
                    "font-mono tabular-nums text-muted-foreground min-w-[3ch] text-right",
                    size === "sm" ? "text-[10px]" : "text-xs"
                )}>
                    {Math.round(currentValue)}%
                </span>
            )}
        </div>
    )
}

export { Slider }
export type { SliderProps }
