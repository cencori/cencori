/**
 * The signed-in person's own account, from Studiowave's Edit profile:
 *
 * GET   /api/studio/account
 *       Their name, email, how they sign in, and the businesses deleting
 *       the account would take with it.
 * PATCH /api/studio/account  { full_name }
 *       Change their name.
 * POST  /api/studio/account  { action: 'email_code', email }
 *       Send a 6-digit code to a new address.
 * POST  /api/studio/account  { action: 'email_confirm', code }
 *       The code was right: the account's email is now the new address (the
 *       old one is told).
 * POST  /api/studio/account  { action: 'delete', confirm: 'DELETE' }
 *       Delete the account and every business they own. Refused while they
 *       own developer organizations (console projects, API keys): those are
 *       deleted from the console, never from here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { adminUsers } from '@/lib/auth/admin-users';
import { isBetterAuthEnabled } from '@/lib/auth/flags';
import { sendVerificationCodeEmail } from '@/lib/email/verification-code-email';
import { escapeHtml, sendEmail } from '@/lib/email/sendbyte';
import { checkCustomRateLimit } from '@/lib/rate-limit';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const CODE_TTL_MS = 15 * 60_000;
const CODE_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function signedIn() {
    const { data: { user } } = await getAuthUser(await createServerClient());
    return user ?? null;
}

async function authContext() {
    const { auth } = await import('@/lib/auth/better-auth');
    return auth.$context;
}

const identifierFor = (userId: string) => `studio-change-email:${userId}`;
const hashCode = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}`).digest('hex');

/** The businesses they own, and whether they also own developer organizations. */
async function owned(userId: string) {
    const { data } = await createAdminClient().from('organizations').select('id, name, account_type').eq('owner_id', userId);
    const rows = (data ?? []) as Array<{ id: string; name: string; account_type: string | null }>;
    return { businesses: rows.filter((row) => row.account_type === 'business'), developer: rows.filter((row) => row.account_type !== 'business') };
}

export async function GET() {
    const user = await signedIn();
    if (!user) return fail('Unauthorized', 401);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    let methods: string[] = [];
    if (isBetterAuthEnabled()) {
        const accounts = await (await authContext()).internalAdapter.findAccounts(user.id).catch(() => []);
        methods = [...new Set((accounts as Array<{ providerId: string }>).map((account) => (account.providerId === 'credential' ? 'email' : account.providerId)))];
    }
    const { businesses, developer } = await owned(user.id);
    return NextResponse.json({
        full_name: (metadata.full_name as string | undefined) || (metadata.name as string | undefined) || null,
        email: user.email ?? null,
        sign_in: methods,
        businesses: businesses.map((business) => business.name),
        owns_developer_organizations: developer.length > 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
    const user = await signedIn();
    if (!user) return fail('Unauthorized', 401);
    const body = await req.json().catch(() => null) as { full_name?: unknown } | null;
    const name = typeof body?.full_name === 'string' ? body.full_name.replace(/\s+/g, ' ').trim() : '';
    if (!name) return fail('Give your name.');
    if (name.length > 80) return fail('Keep your name under 80 characters.');
    const [first, ...rest] = name.split(' ');
    const metadata = { ...(user.user_metadata ?? {}), full_name: name, name, first_name: first, last_name: rest.join(' ') || null };
    const { error } = await adminUsers.updateUserById(user.id, { user_metadata: metadata });
    if (error) return fail('Couldn\'t change your name. Try again.', 502);
    // The console's profile reads these.
    const db = createAdminClient();
    await Promise.allSettled([
        db.from('users').update({ full_name: name }).eq('id', user.id),
        db.from('user_profiles').update({ first_name: first, last_name: rest.join(' ') || null }).eq('id', user.id),
    ]);
    return NextResponse.json({ full_name: name });
}

export async function POST(req: NextRequest) {
    const user = await signedIn();
    if (!user) return fail('Unauthorized', 401);
    const body = await req.json().catch(() => null) as { action?: unknown; email?: unknown; code?: unknown; confirm?: unknown } | null;

    if (body?.action === 'email_code' || body?.action === 'email_confirm') {
        if (!isBetterAuthEnabled()) return fail('Changing your email isn\'t available yet.', 503);
        const ctx = await authContext();
        const identifier = identifierFor(user.id);

        if (body.action === 'email_code') {
            const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
            if (!EMAIL_PATTERN.test(email)) return fail('That doesn\'t look like an email address.');
            if (email === (user.email ?? '').toLowerCase()) return fail('That\'s already your email.');
            const limited = await checkCustomRateLimit(`studio-email-code:${user.id}`, 5, 3_600).catch(() => ({ allowed: true }));
            if (!limited.allowed) return fail('Too many codes for now. Try again in an hour.', 429);
            if (await ctx.internalAdapter.findUserByEmail(email)) return fail('Another account already uses that email.', 409);
            const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
            await ctx.internalAdapter.deleteVerificationByIdentifier(identifier).catch(() => undefined);
            await ctx.internalAdapter.createVerificationValue({
                identifier,
                value: JSON.stringify({ email, hash: hashCode(user.id, code), attempts: 0 }),
                expiresAt: new Date(Date.now() + CODE_TTL_MS),
            });
            await sendVerificationCodeEmail({ to: email, code, greeting: 'Hi,' });
            return NextResponse.json({ sent: true, email });
        }

        const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
        if (code.length !== 6) return fail('The code is 6 digits.');
        const stored = await ctx.internalAdapter.findVerificationValue(identifier);
        if (!stored || new Date(stored.expiresAt).getTime() < Date.now()) return fail('That code has expired. Send a new one.', 410);
        const pending = JSON.parse(stored.value) as { email: string; hash: string; attempts: number };
        if (pending.attempts >= CODE_ATTEMPTS) return fail('Too many wrong codes. Send a new one.', 429);
        if (pending.hash !== hashCode(user.id, code)) {
            await ctx.internalAdapter.deleteVerificationByIdentifier(identifier).catch(() => undefined);
            await ctx.internalAdapter.createVerificationValue({ identifier, value: JSON.stringify({ ...pending, attempts: pending.attempts + 1 }), expiresAt: new Date(stored.expiresAt) });
            return fail('That code isn\'t right.');
        }
        if (await ctx.internalAdapter.findUserByEmail(pending.email)) return fail('Another account already uses that email.', 409);
        const previous = user.email ?? null;
        await ctx.internalAdapter.updateUser(user.id, { email: pending.email, emailVerified: true });
        await ctx.internalAdapter.deleteVerificationByIdentifier(identifier).catch(() => undefined);
        // The old address hears about it, in case it wasn't them.
        if (previous) {
            await sendEmail({
                to: [previous],
                subject: 'Your email was changed',
                html: `<p style="font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#333">The email on your Cencori account was changed to <b>${escapeHtml(pending.email)}</b>. If this wasn't you, reply to this email straight away.</p>`,
            }).catch(() => false);
        }
        return NextResponse.json({ email: pending.email });
    }

    if (body?.action === 'delete') {
        if (body.confirm !== 'DELETE') return fail('Type DELETE to confirm.');
        const { businesses, developer } = await owned(user.id);
        if (developer.length) return fail(`You also own ${developer.map((row) => row.name).join(', ')} on Cencori's console. Delete ${developer.length === 1 ? 'it' : 'them'} there first.`, 409);
        const db = createAdminClient();
        // Each business and everything in it (its projects, staff, chats, money records) goes with the account.
        for (const business of businesses) {
            const { error } = await db.from('organizations').delete().eq('id', business.id).eq('owner_id', user.id);
            if (error) {
                console.error('[studio/account] business delete failed', business.id, error.message);
                return fail('Couldn\'t delete your businesses. Try again.', 502);
            }
        }
        await db.from('organization_members').delete().eq('user_id', user.id);
        await db.from('user_profiles').delete().eq('id', user.id);
        const { error } = await adminUsers.deleteUser(user.id);
        if (error) return fail('Couldn\'t delete your account. Try again.', 502);
        return NextResponse.json({ deleted: true });
    }

    return fail('Unknown action.');
}
