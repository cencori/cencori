"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Data is considered fresh for 30 seconds
                        staleTime: 30 * 1000,
                        // Cache data for 5 minutes
                        gcTime: 5 * 60 * 1000,
                        // Retry failed requests once
                        retry: 1,
                        // Refetch on window focus (feels fast like Supabase)
                        refetchOnWindowFocus: true,
                        // Don't refetch on mount if data is fresh
                        refetchOnMount: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
