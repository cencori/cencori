import type { User } from "@supabase/supabase-js";

// Better Auth's session user, reshaped like Supabase's `User` so the ~200
// call sites that read user.id / user.email / user.user_metadata keep working
// unchanged across the cutover.
export interface BetterAuthUser {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export function toSupabaseUser(user: BetterAuthUser): User {
    const createdAt = new Date(user.createdAt).toISOString();
    return {
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: user.email,
        email_confirmed_at: user.emailVerified ? createdAt : undefined,
        created_at: createdAt,
        updated_at: new Date(user.updatedAt).toISOString(),
        app_metadata: {},
        user_metadata: {
            full_name: user.name,
            name: user.name,
            avatar_url: user.image ?? undefined,
            picture: user.image ?? undefined,
        },
        identities: [],
    };
}
