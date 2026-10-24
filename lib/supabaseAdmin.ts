import { createClient } from '@supabase/supabase-js';
import { isBetterAuthEnabled } from '@/lib/auth/flags';
import { postgrestFetch } from '@/lib/data/postgrest-fetch';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key');
}

export const createAdminClient = () => {
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        // After the RFC-0001 cutover, queries go to the Brimble PostgREST as
        // service_role (lib/data/postgrest-fetch.ts).
        ...(isBetterAuthEnabled() ? { global: { fetch: postgrestFetch('service') } } : {}),
    });
};
