"use client"

import { ReactLenis } from "lenis/react"
import { Toaster } from "../components/sonner"
import { ThemeProvider } from "./theme-provider"
import { getQueryClient } from "../lib/query-client"
import type { ThemeProviderProps } from "next-themes"
import { TooltipProvider } from "../components/tooltip"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

export const inDevEnvironment = process.env.NODE_ENV === "development"

export function DefaultProvider({
  children,
  showQueryDevtools = inDevEnvironment,
  defaultTheme = "system",
  useLens = false,
  ...rest
}: ThemeProviderProps & {
  showQueryDevtools?: boolean
  useLens?: boolean
}) {
  const queryClient = getQueryClient()
  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme={defaultTheme}
        enableSystem
        disableTransitionOnChange
        {...rest}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
        {showQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </ThemeProvider>
    </QueryClientProvider>
  )

  if (useLens) {
    return <ReactLenis root>{content}</ReactLenis>
  }

  return content
}
