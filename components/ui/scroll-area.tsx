"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-all duration-150",
        // Invisible by default, appears on hover
        "opacity-0 hover:opacity-100 group-hover/scroll:opacity-100",
        // Positioning
        orientation === "vertical" &&
        "h-full w-1.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" &&
        "h-1.5 flex-col border-t border-t-transparent p-[1px]",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full",
          // Subtle, minimal thumb
          "bg-foreground/10 hover:bg-foreground/20",
          "transition-colors duration-150"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

/**
 * Minimal scroll area - ultra-thin scrollbar that's barely visible
 * Perfect for compact UI elements like settings panels
 * Uses CSS scrollbar styling for reliability
 */
function MinimalScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="minimal-scroll-area"
      className={cn(
        "overflow-y-auto",
        // Minimal scrollbar styling with CSS
        "[&::-webkit-scrollbar]:w-1",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-foreground/10",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb:hover]:bg-foreground/20",
        // Firefox
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function MinimalScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none",
        // Fade in/out
        "opacity-0 transition-opacity duration-300",
        "group-hover/scroll:opacity-100",
        // Data state for when scrolling
        "data-[state=visible]:opacity-100",
        // Ultra-thin track
        orientation === "vertical" && "h-full w-1 p-px",
        orientation === "horizontal" && "h-1 flex-col p-px",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full",
          // Ghost-like appearance
          "bg-foreground/8 hover:bg-foreground/15",
          "transition-colors duration-200"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar, MinimalScrollArea, MinimalScrollBar }
