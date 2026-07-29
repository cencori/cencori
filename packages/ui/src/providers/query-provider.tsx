"use client"

import type { ReactNode } from "react"
import { getQueryClient } from "../lib/query-client"
import { QueryClientProvider } from "@tanstack/react-query"

export default function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
