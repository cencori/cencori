import type { createAdminClient } from '@/lib/supabaseAdmin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
export type { SupabaseAdmin };

export async function expireStaleSessions(supabase: SupabaseAdmin): Promise<void> {
    try {
        const result = await supabase
            .from('sessions')
            .update({ status: 'completed', expires_at: null })
            .eq('status', 'paused')
            .lt('expires_at', new Date().toISOString());
        if (result?.error) throw new Error(result.error.message);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to expire stale sessions: ${message}`);
    }
}
