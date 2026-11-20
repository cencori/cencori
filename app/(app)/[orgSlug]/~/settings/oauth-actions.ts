'use server';

/**
 * OAuth apps and authorized apps, for an organization's settings (lib/oauth).
 *
 * Owners and admins can register apps and take an app's access away. A member can do neither.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireOrgOwnerOrAdmin } from '@/lib/org-admin-access';
import { writeAuditLog } from '@/lib/audit-log';
import { adminUsers } from '@/lib/auth/admin-users';
import { refreshAppLogo, removeAppLogo } from '@/lib/oauth/logo';
import { MAX_REDIRECT_URIS, isOAuthScope, isRegistrableRedirectUri, type OAuthScope } from '@/lib/oauth/protocol';
import {
    MAX_APPS_PER_ORGANIZATION,
    countApps,
    createApp,
    deleteApp,
    listApps,
    listGrants,
    revokeGrant,
    rotateAppSecret,
    updateApp,
    type AppInput,
    type GrantSummary,
    type OAuthApp,
} from '@/lib/oauth/store';

type ActionResult<T = undefined> = { ok: boolean; error?: string; data?: T };

export type OAuthAppForm = {
    name: string;
    description: string;
    websiteUrl: string;
    redirectUris: string[];
    scopes: string[];
};

export type OAuthSettings = {
    apps: OAuthApp[];
    grants: Array<GrantSummary & { user_email: string | null }>;
};

function checkForm(form: OAuthAppForm): { input: AppInput } | { error: string } {
    const name = form.name.trim();
    if (name.length === 0 || name.length > 60) return { error: 'Name must be 1 to 60 characters.' };
    if (/cencori/i.test(name)) return { error: 'An app\'s name cannot include "Cencori".' };

    const description = form.description.trim();
    if (description.length > 200) return { error: 'Description can be up to 200 characters.' };

    const websiteUrl = form.websiteUrl.trim();
    if (websiteUrl) {
        let valid = websiteUrl.length <= 300;
        try {
            valid = valid && new URL(websiteUrl).protocol === 'https:';
        } catch {
            valid = false;
        }
        if (!valid) return { error: 'Website must be an https:// address.' };
    }

    const redirectUris = [...new Set(form.redirectUris.map((uri) => uri.trim()).filter(Boolean))];
    if (redirectUris.length === 0) return { error: 'Add at least one redirect address.' };
    if (redirectUris.length > MAX_REDIRECT_URIS) return { error: `An app can have up to ${MAX_REDIRECT_URIS} redirect addresses.` };
    const bad = redirectUris.find((uri) => !isRegistrableRedirectUri(uri));
    if (bad) {
        return {
            error: `"${bad}" can't be used. Redirect addresses must be https://, or http:// on localhost, with no wildcard or # part.`,
        };
    }

    const scopes = [...new Set(form.scopes)].filter(isOAuthScope) as OAuthScope[];
    if (scopes.length === 0 || scopes.length !== new Set(form.scopes).size) {
        return { error: 'Choose at least one permission.' };
    }

    return { input: { name, description: description || null, websiteUrl: websiteUrl || null, redirectUris, scopes } };
}

export async function getOAuthSettings(orgSlug: string): Promise<ActionResult<OAuthSettings>> {
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const admin = createAdminClient();
        const [apps, grants] = await Promise.all([listApps(admin, auth.orgId), listGrants(admin, auth.orgId)]);

        const userIds = [...new Set(grants.map((grant) => grant.user_id))];
        const emails = new Map<string, string>();
        await Promise.all(
            userIds.map(async (userId) => {
                const { data, error } = await adminUsers.getUserById(userId);
                if (!error && data.user?.email) emails.set(userId, data.user.email);
            }),
        );
        return {
            ok: true,
            data: { apps, grants: grants.map((grant) => ({ ...grant, user_email: emails.get(grant.user_id) ?? null })) },
        };
    } catch (error) {
        console.error('[Org Settings] getOAuthSettings failed:', error);
        return { ok: false, error: 'Could not load OAuth apps.' };
    }
}

export async function createOAuthApp(
    orgSlug: string,
    form: OAuthAppForm,
): Promise<ActionResult<{ app: OAuthApp; clientSecret: string }>> {
    const checked = checkForm(form);
    if ('error' in checked) return { ok: false, error: checked.error };
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const admin = createAdminClient();
        if ((await countApps(admin, auth.orgId)) >= MAX_APPS_PER_ORGANIZATION) {
            return { ok: false, error: `An organization can register up to ${MAX_APPS_PER_ORGANIZATION} OAuth apps.` };
        }
        const created = await createApp(admin, { ...checked.input, organizationId: auth.orgId, createdBy: auth.userId });
        // The logo is the website's icon, copied once. No website, or no usable icon, means no logo.
        created.app.logo_url = await refreshAppLogo(admin, created.app);
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'integration',
            action: 'created',
            resourceType: 'oauth_app',
            resourceId: created.app.id,
            actorId: auth.userId,
            description: `Registered the OAuth app "${created.app.name}"`,
            metadata: { client_id: created.app.client_id, scopes: created.app.scopes },
        });
        return { ok: true, data: created };
    } catch (error) {
        console.error('[Org Settings] createOAuthApp failed:', error);
        return { ok: false, error: 'Could not create the OAuth app.' };
    }
}

export async function updateOAuthApp(orgSlug: string, appId: string, form: OAuthAppForm): Promise<ActionResult<OAuthApp>> {
    const checked = checkForm(form);
    if ('error' in checked) return { ok: false, error: checked.error };
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const admin = createAdminClient();
        const before = (await listApps(admin, auth.orgId)).find((existing) => existing.id === appId);
        const app = await updateApp(admin, { ...checked.input, organizationId: auth.orgId, appId });
        if (!app) return { ok: false, error: 'This OAuth app no longer exists.' };
        // Fetched again when the website changes, or when there was no logo to begin with.
        if (before?.website_url !== app.website_url || !app.logo_url) {
            app.logo_url = await refreshAppLogo(admin, app);
        }
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'integration',
            action: 'updated',
            resourceType: 'oauth_app',
            resourceId: app.id,
            actorId: auth.userId,
            description: `Updated the OAuth app "${app.name}"`,
            metadata: { client_id: app.client_id, scopes: app.scopes, redirect_uris: app.redirect_uris },
        });
        return { ok: true, data: app };
    } catch (error) {
        console.error('[Org Settings] updateOAuthApp failed:', error);
        return { ok: false, error: 'Could not update the OAuth app.' };
    }
}

export async function rotateOAuthAppSecret(
    orgSlug: string,
    appId: string,
): Promise<ActionResult<{ app: OAuthApp; clientSecret: string }>> {
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const rotated = await rotateAppSecret(createAdminClient(), { organizationId: auth.orgId, appId });
        if (!rotated) return { ok: false, error: 'This OAuth app no longer exists.' };
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'integration',
            action: 'updated',
            resourceType: 'oauth_app',
            resourceId: appId,
            actorId: auth.userId,
            description: `Replaced the client secret of the OAuth app "${rotated.app.name}"`,
        });
        return { ok: true, data: rotated };
    } catch (error) {
        console.error('[Org Settings] rotateOAuthAppSecret failed:', error);
        return { ok: false, error: 'Could not replace the secret.' };
    }
}

export async function deleteOAuthApp(orgSlug: string, appId: string): Promise<ActionResult> {
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const app = await deleteApp(createAdminClient(), { organizationId: auth.orgId, appId });
        if (!app) return { ok: false, error: 'This OAuth app no longer exists.' };
        await removeAppLogo(app.id);
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'integration',
            action: 'deleted',
            resourceType: 'oauth_app',
            resourceId: appId,
            actorId: auth.userId,
            description: `Deleted the OAuth app "${app.name}"`,
            metadata: { client_id: app.client_id },
        });
        return { ok: true };
    } catch (error) {
        console.error('[Org Settings] deleteOAuthApp failed:', error);
        return { ok: false, error: 'Could not delete the OAuth app.' };
    }
}

export async function revokeOAuthGrant(orgSlug: string, grantId: string): Promise<ActionResult> {
    const auth = await requireOrgOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        const revoked = await revokeGrant(createAdminClient(), { organizationId: auth.orgId, grantId });
        if (!revoked) return { ok: false, error: 'This app no longer has access.' };
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'integration',
            action: 'revoked',
            resourceType: 'oauth_grant',
            resourceId: grantId,
            actorId: auth.userId,
            description: 'Removed an app\'s access to the organization',
        });
        return { ok: true };
    } catch (error) {
        console.error('[Org Settings] revokeOAuthGrant failed:', error);
        return { ok: false, error: 'Could not remove the app\'s access.' };
    }
}
