import "server-only";

import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { dash } from "@better-auth/infra";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

// Better Auth replaces Supabase Auth at the database cutover (RFC-0001 §4).
// Until then it is off: the route handler only serves it when
// BETTER_AUTH_ENABLED=true, and it talks to the Brimble Postgres
// (BETTER_AUTH_DATABASE_URL), never to Supabase.

const isProd = process.env.NODE_ENV === "production";

const pool = new Pool({
    connectionString: process.env.BETTER_AUTH_DATABASE_URL,
    max: 10,
});

export const auth = betterAuth({
    appName: "Cencori",
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,

    // Table names that can't be confused with the existing public.users
    // profile table. Users keep their Supabase UUIDs (generateId "uuid"), so
    // the 51 foreign keys to auth.users can be repointed to auth_users.
    user: { modelName: "auth_users" },
    session: { modelName: "auth_sessions" },
    account: { modelName: "auth_accounts" },
    verification: { modelName: "auth_verifications" },

    emailAndPassword: {
        enabled: true,
        password: {
            hash: (password) => hashPassword(password),
            // Supabase stored bcrypt hashes ($2a$/$2b$); every migrated
            // password user has one. New and reset passwords use Better
            // Auth's default.
            verify: ({ hash, password }) =>
                hash.startsWith("$2") ? bcrypt.compare(password, hash) : verifyPassword({ hash, password }),
        },
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
    },

    databaseHooks: {
        user: {
            create: {
                // Replaces the Supabase trigger on_auth_user_created →
                // public.handle_new_user(), which gives every new sign-up a
                // public.users profile row.
                after: async (user) => {
                    await pool.query(
                        "insert into public.users (id, full_name, avatar_url) values ($1, $2, $3) on conflict (id) do nothing",
                        [user.id, user.name || null, user.image || null],
                    );
                },
            },
        },
    },

    advanced: {
        database: { generateId: "uuid" },
        crossSubDomainCookies: { enabled: isProd, domain: ".cencori.com" },
        useSecureCookies: isProd,
    },

    plugins: [
        dash({
            apiUrl: process.env.BETTER_AUTH_API_URL,
            kvUrl: process.env.BETTER_AUTH_KV_URL,
            apiKey: process.env.BETTER_AUTH_API_KEY,
        }),
        // Must stay last so auth calls made from server actions can set cookies.
        nextCookies(),
    ],
});
