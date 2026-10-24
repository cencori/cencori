import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { toSupabaseUser, type BetterAuthUser } from "@/lib/auth/to-supabase-user";

// Server-side user management with supabase.auth.admin's method names and
// result shapes, so call sites only change their receiver. Supabase until the
// RFC-0001 cutover; Better Auth after it (isBetterAuthEnabled), where
// user_metadata lives in auth_users.metadata (database/brimble/0002).

type Result<T> = { data: T; error: { message: string } | null };
type UserResult =
    | { data: { user: User }; error: null }
    | { data: { user: null }; error: { message: string } };

async function betterAuthContext() {
    const { auth } = await import("@/lib/auth/better-auth");
    return auth.$context;
}

const asUser = (u: unknown): User => toSupabaseUser(u as BetterAuthUser);

export const adminUsers = {
    async getUserById(id: string): Promise<Result<{ user: User | null }>> {
        if (!isBetterAuthEnabled()) return createAdminClient().auth.admin.getUserById(id);
        const ctx = await betterAuthContext();
        const user = await ctx.internalAdapter.findUserById(id);
        return user
            ? { data: { user: asUser(user) }, error: null }
            : { data: { user: null }, error: { message: "User not found" } };
    },

    async listUsers(params?: { page?: number; perPage?: number }): Promise<Result<{ users: User[]; nextPage: number | null }>> {
        if (!isBetterAuthEnabled()) {
            const { data, error } = await createAdminClient().auth.admin.listUsers(params);
            return {
                data: { users: data?.users ?? [], nextPage: (data as { nextPage?: number | null } | null)?.nextPage ?? null },
                error,
            };
        }
        const perPage = params?.perPage ?? 50;
        const page = Math.max(1, params?.page ?? 1);
        const ctx = await betterAuthContext();
        const users = await ctx.internalAdapter.listUsers(perPage, (page - 1) * perPage, {
            field: "createdAt",
            direction: "asc",
        });
        return {
            data: { users: users.map(asUser), nextPage: users.length === perPage ? page + 1 : null },
            error: null,
        };
    },

    // Callers pass the full merged user_metadata, as with Supabase. A name in
    // it also updates the Better Auth user's name, which is what the app shows.
    async updateUserById(
        id: string,
        attributes: { user_metadata?: Record<string, unknown>; email_confirm?: boolean },
    ): Promise<Result<{ user: User | null }>> {
        if (!isBetterAuthEnabled()) return createAdminClient().auth.admin.updateUserById(id, attributes);
        const ctx = await betterAuthContext();
        const meta = attributes.user_metadata;
        const name = typeof meta?.full_name === "string" ? meta.full_name : typeof meta?.name === "string" ? meta.name : undefined;
        const user = await ctx.internalAdapter.updateUser(id, {
            ...(meta ? { metadata: meta } : {}),
            ...(name ? { name } : {}),
            ...(attributes.email_confirm ? { emailVerified: true } : {}),
        });
        return { data: { user: user ? asUser(user) : null }, error: user ? null : { message: "User not found" } };
    },

    async createUser(attributes: {
        email: string;
        password: string;
        email_confirm?: boolean;
    }): Promise<UserResult> {
        if (!isBetterAuthEnabled()) return createAdminClient().auth.admin.createUser(attributes) as Promise<UserResult>;
        const ctx = await betterAuthContext();
        const email = attributes.email.toLowerCase();
        if (await ctx.internalAdapter.findUserByEmail(email)) {
            // Same wording Supabase uses; the internal signup route matches on it.
            return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
        }
        const user = await ctx.internalAdapter.createUser(
            { email, name: email.split("@")[0], emailVerified: attributes.email_confirm ?? false },
            { method: "admin" },
        );
        await ctx.internalAdapter.linkAccount({
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: await ctx.password.hash(attributes.password),
        });
        return { data: { user: asUser(user) }, error: null };
    },

    async deleteUser(id: string): Promise<{ data: unknown; error: { message: string } | null }> {
        if (!isBetterAuthEnabled()) return createAdminClient().auth.admin.deleteUser(id);
        const ctx = await betterAuthContext();
        await ctx.internalAdapter.deleteUser(id);
        return { data: null, error: null };
    },
};
