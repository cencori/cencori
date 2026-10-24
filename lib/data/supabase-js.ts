import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { postgrestFetch } from "@/lib/data/postgrest-fetch";

// Drop-in for supabase-js's createClient in server routes that build their
// own client. Unchanged until the RFC-0001 cutover; after it, queries go to
// the Brimble PostgREST: as service_role when built with the service-role
// key, otherwise as the Better Auth user of the current request.
export const createClient = ((url: string, key: string, options?: Parameters<typeof createSupabaseClient>[2]) => {
    if (!isBetterAuthEnabled()) return createSupabaseClient(url, key, options);
    const mode = key === process.env.SUPABASE_SERVICE_ROLE_KEY ? "service" : "request-user";
    return createSupabaseClient(url, key, {
        ...options,
        global: { ...options?.global, fetch: postgrestFetch(mode) },
    });
}) as typeof createSupabaseClient;
