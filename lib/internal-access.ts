import { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * Check if a user has internal access.
 * Allows: any @cencori.com email OR active entry in cencori_admins table.
 */
export async function checkInternalAccess(
    userId: string,
    userEmail: string | undefined
): Promise<boolean> {
    // Development bypass
    if (process.env.NODE_ENV === 'development') {
        const allowDev = (process.env.ALLOW_ALL_INTERNAL_IN_DEV || 'true').trim().toLowerCase();
        if (allowDev !== 'false') return true;
    }

    // @cencori.com domain check
    if (userEmail && userEmail.trim().toLowerCase().endsWith('@cencori.com')) {
        return true;
    }

    // Fallback: check cencori_admins table
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    return !!data;
}

/**
 * Check if the email belongs to the @cencori.com domain.
 */
export function isCencoriEmail(email: string | undefined | null): boolean {
    if (!email) return false;
    return email.trim().toLowerCase().endsWith('@cencori.com');
}
