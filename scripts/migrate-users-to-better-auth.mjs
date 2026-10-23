// Copies Supabase Auth users into the Better Auth tables (RFC-0001 §4).
//
//   SOURCE_DATABASE_URL       Supabase Postgres, read-only role (only SELECTs run)
//   BETTER_AUTH_DATABASE_URL  Brimble Postgres with database/brimble/*.sql applied
//
//   node scripts/migrate-users-to-better-auth.mjs            dry run: read, validate, report
//   node scripts/migrate-users-to-better-auth.mjs --apply    write, in one transaction
//
// Users keep their Supabase UUIDs. Passwords keep their bcrypt hashes (Better
// Auth verifies $2 hashes, see lib/auth/better-auth.ts). Google and GitHub
// identities become accounts keyed by the provider's own id (Google `sub`,
// GitHub numeric id), which is what Better Auth matches on at sign-in.
// Supabase's "email" identities are covered by the credential account.
// Sessions are not copied: everyone signs in once after the cutover.
//
// Re-runnable: account ids are derived from provider + provider id and every
// write is an upsert, so running it again at cutover picks up new users and
// changed passwords without duplicating anything.
import { createHash } from "node:crypto";
import pg from "pg";

const apply = process.argv.includes("--apply");
// Supabase doesn't let the project's own roles grant usage on the auth
// schema, so the read-only migration user reads auth.users / auth.identities
// through views in a private `migration` schema (SOURCE_AUTH_SCHEMA=migration).
const sourceAuthSchema = process.env.SOURCE_AUTH_SCHEMA ?? "auth";
const usersTable = sourceAuthSchema === "auth" ? "auth.users" : `${sourceAuthSchema}.auth_users`;
const identitiesTable = sourceAuthSchema === "auth" ? "auth.identities" : `${sourceAuthSchema}.auth_identities`;
const SOCIAL = new Set(["google", "github"]);

function stableUuid(...parts) {
    const h = createHash("md5").update(parts.join(":")).digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function displayName(user) {
    const meta = user.raw_user_meta_data || {};
    const name = meta.full_name || meta.name || meta.user_name || meta.preferred_username;
    if (typeof name === "string" && name.trim()) return name.trim();
    return user.email.split("@")[0];
}

function avatar(user) {
    const meta = user.raw_user_meta_data || {};
    const url = meta.avatar_url || meta.picture;
    return typeof url === "string" && url ? url : null;
}

// libpq's sslmode=require means "encrypt, don't verify the certificate";
// node-postgres reads it as full verification, which fails against
// Supabase's pooler (its own CA). Match libpq, as pg_dump/psql do.
function clientConfig(url) {
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") !== "require") return { connectionString: url };
    parsed.searchParams.delete("sslmode");
    return { connectionString: parsed.toString(), ssl: { rejectUnauthorized: false } };
}

export function buildRows(users, identities) {
    const problems = [];
    const outUsers = [];
    const outAccounts = [];
    const seenEmails = new Map();
    const userIds = new Set(users.map((u) => u.id));

    for (const u of users) {
        if (!u.email) { problems.push(`user ${u.id}: no email`); continue; }
        const email = u.email.trim().toLowerCase();
        if (seenEmails.has(email)) { problems.push(`user ${u.id}: email shared with ${seenEmails.get(email)}`); continue; }
        seenEmails.set(email, u.id);
        if (u.deleted_at) { problems.push(`user ${u.id}: soft-deleted, skipped`); continue; }

        outUsers.push({
            id: u.id,
            name: displayName(u),
            email,
            emailVerified: u.email_confirmed_at != null,
            image: avatar(u),
            // Supabase user_metadata (welcome/login-alert/opt-out flags, names).
            metadata: u.raw_user_meta_data || {},
            createdAt: u.created_at,
            updatedAt: u.updated_at || u.created_at,
        });

        if (u.encrypted_password) {
            if (!u.encrypted_password.startsWith("$2")) {
                problems.push(`user ${u.id}: password hash is not bcrypt, not copied`);
            } else {
                outAccounts.push({
                    id: stableUuid("credential", u.id),
                    accountId: u.id,
                    providerId: "credential",
                    userId: u.id,
                    password: u.encrypted_password,
                    createdAt: u.created_at,
                    updatedAt: u.updated_at || u.created_at,
                });
            }
        }
    }

    const copiedUsers = new Set(outUsers.map((u) => u.id));
    for (const i of identities) {
        if (i.provider === "email") continue;
        if (!SOCIAL.has(i.provider)) { problems.push(`identity ${i.provider}/${i.provider_id}: unsupported provider`); continue; }
        if (!userIds.has(i.user_id)) { problems.push(`identity ${i.provider}/${i.provider_id}: user missing`); continue; }
        if (!copiedUsers.has(i.user_id)) continue;
        if (!i.provider_id) { problems.push(`identity on user ${i.user_id}: no provider id`); continue; }
        outAccounts.push({
            id: stableUuid(i.provider, i.provider_id),
            accountId: String(i.provider_id),
            providerId: i.provider,
            userId: i.user_id,
            password: null,
            createdAt: i.created_at,
            updatedAt: i.updated_at || i.created_at,
        });
    }

    return { users: outUsers, accounts: outAccounts, problems };
}

async function main() {
    const sourceUrl = process.env.SOURCE_DATABASE_URL;
    const targetUrl = process.env.BETTER_AUTH_DATABASE_URL;
    if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL is required");
    if (apply && !targetUrl) throw new Error("BETTER_AUTH_DATABASE_URL is required with --apply");

    const source = new pg.Client(clientConfig(sourceUrl));
    await source.connect();
    let users, identities;
    try {
        await source.query("begin read only");
        ({ rows: users } = await source.query(
            `select id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, deleted_at from ${usersTable} order by created_at`,
        ));
        ({ rows: identities } = await source.query(
            `select user_id, provider, provider_id, created_at, updated_at from ${identitiesTable} order by created_at`,
        ));
        await source.query("commit");
    } finally {
        await source.end();
    }

    const { users: outUsers, accounts, problems } = buildRows(users, identities);
    const byProvider = accounts.reduce((m, a) => ({ ...m, [a.providerId]: (m[a.providerId] || 0) + 1 }), {});
    console.log(`source: ${users.length} users, ${identities.length} identities`);
    console.log(`to write: ${outUsers.length} users, ${accounts.length} accounts ${JSON.stringify(byProvider)}`);
    console.log(`problems: ${problems.length}`);
    for (const p of problems.slice(0, 50)) console.log(`  - ${p}`);

    if (!targetUrl) { console.log("dry run (no target)"); return; }

    const target = new pg.Client(clientConfig(targetUrl));
    await target.connect();
    try {
        const { rows: [before] } = await target.query(
            `select (select count(*) from auth_users)::int as users, (select count(*) from auth_accounts)::int as accounts`,
        );
        console.log(`target before: ${before.users} users, ${before.accounts} accounts`);
        if (!apply) { console.log("dry run: nothing written (pass --apply to write)"); return; }

        await target.query("begin");
        for (const u of outUsers) {
            await target.query(
                `insert into auth_users (id, name, email, "emailVerified", image, metadata, "createdAt", "updatedAt")
                 values ($1, $2, $3, $4, $5, $6, $7, $8)
                 on conflict (id) do update set name = excluded.name, email = excluded.email,
                   "emailVerified" = excluded."emailVerified", image = excluded.image,
                   metadata = excluded.metadata, "updatedAt" = excluded."updatedAt"`,
                [u.id, u.name, u.email, u.emailVerified, u.image, JSON.stringify(u.metadata), u.createdAt, u.updatedAt],
            );
        }
        for (const a of accounts) {
            await target.query(
                `insert into auth_accounts (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
                 values ($1, $2, $3, $4, $5, $6, $7)
                 on conflict (id) do update set password = excluded.password, "updatedAt" = excluded."updatedAt"`,
                [a.id, a.accountId, a.providerId, a.userId, a.password, a.createdAt, a.updatedAt],
            );
        }
        await target.query("commit");

        const { rows: [after] } = await target.query(
            `select (select count(*) from auth_users)::int as users, (select count(*) from auth_accounts)::int as accounts`,
        );
        console.log(`target after: ${after.users} users, ${after.accounts} accounts`);
    } catch (error) {
        await target.query("rollback").catch(() => {});
        throw error;
    } finally {
        await target.end();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(`[migrate-users] ${error.message}`);
        process.exit(1);
    });
}
