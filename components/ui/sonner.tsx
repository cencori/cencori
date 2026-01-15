"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          // Normal toast
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Success toast - Green
          "--success-bg": "hsl(142 76% 36% / 0.15)",
          "--success-border": "hsl(142 76% 36% / 0.3)",
          "--success-text": "hsl(142 76% 36%)",
          // Error toast - Red
          "--error-bg": "hsl(0 84% 60% / 0.15)",
          "--error-border": "hsl(0 84% 60% / 0.3)",
          "--error-text": "hsl(0 84% 60%)",
          // Warning toast - Amber
          "--warning-bg": "hsl(38 92% 50% / 0.15)",
          "--warning-border": "hsl(38 92% 50% / 0.3)",
          "--warning-text": "hsl(38 92% 50%)",
          // Info toast - Blue
          "--info-bg": "hsl(217 91% 60% / 0.15)",
          "--info-border": "hsl(217 91% 60% / 0.3)",
          "--info-text": "hsl(217 91% 60%)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          success: "group toast group-[.toaster]:bg-[var(--success-bg)] group-[.toaster]:text-[var(--success-text)] group-[.toaster]:border-[var(--success-border)]",
          error: "group toast group-[.toaster]:bg-[var(--error-bg)] group-[.toaster]:text-[var(--error-text)] group-[.toaster]:border-[var(--error-border)]",
          warning: "group toast group-[.toaster]:bg-[var(--warning-bg)] group-[.toaster]:text-[var(--warning-text)] group-[.toaster]:border-[var(--warning-border)]",
          info: "group toast group-[.toaster]:bg-[var(--info-bg)] group-[.toaster]:text-[var(--info-text)] group-[.toaster]:border-[var(--info-border)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
