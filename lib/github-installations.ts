import { createAdminClient } from "@/lib/supabaseAdmin";

interface UserIdentity {
    provider?: string;
    identity_data?: {
        user_name?: string;
        preferred_username?: string;
    } | null;
}

export interface InstallationAccessUser {
    id: string;
    identities?: UserIdentity[] | null;
}

function toSafePositiveInt(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
}

export function getGithubUsername(user: InstallationAccessUser): string | null {
    const githubIdentity = user.identities?.find((identity) => identity.provider === "github");
    if (!githubIdentity?.identity_data) {
        return null;
    }

    return (
        githubIdentity.identity_data.user_name ||
        githubIdentity.identity_data.preferred_username ||
        null
    );
}

function addInstallationIds(target: Set<number>, values: Array<{ installation_id: unknown }> | null | undefined) {
    for (const value of values || []) {
        const installationId = toSafePositiveInt(value.installation_id);
        if (installationId) {
            target.add(installationId);
        }
    }
}

export async function getUserOwnedGithubInstallationIds(
    user: InstallationAccessUser
): Promise<Set<number>> {
    const supabaseAdmin = createAdminClient();
    const installationIds = new Set<number>();
    const githubUsername = getGithubUsername(user);

    const { data: installedByUser, error: installedByUserError } = await supabaseAdmin
        .from("github_app_installations")
        .select("installation_id")
        .eq("installed_by_user_id", user.id);

    if (installedByUserError) {
        throw new Error("Failed to resolve user-installed GitHub installations");
    }

    addInstallationIds(installationIds, installedByUser);

    if (githubUsername) {
        const { data: byLogin, error: byLoginError } = await supabaseAdmin
            .from("github_app_installations")
            .select("installation_id")
            .ilike("github_account_login", githubUsername);

        if (byLoginError) {
            throw new Error("Failed to resolve GitHub account installations");
        }

        addInstallationIds(installationIds, byLogin);
    }

    return installationIds;
}

export async function getOrganizationLinkedInstallationIds(organizationId: string): Promise<number[]> {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from("organization_github_installations")
        .select("installation_id")
        .eq("organization_id", organizationId);

    if (error) {
        throw new Error("Failed to resolve organization GitHub installation links");
    }

    const installationIds = new Set<number>();
    addInstallationIds(installationIds, data);
    return Array.from(installationIds);
}

export async function getReachableGithubInstallationIds(
    user: InstallationAccessUser
): Promise<Set<number>> {
    const supabaseAdmin = createAdminClient();
    const installationIds = await getUserOwnedGithubInstallationIds(user);

    const [ownedOrgsResult, membershipsResult] = await Promise.all([
        supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("owner_id", user.id),
        supabaseAdmin
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", user.id),
    ]);

    if (ownedOrgsResult.error) {
        throw new Error("Failed to resolve organizations owned by user");
    }
    if (membershipsResult.error) {
        throw new Error("Failed to resolve organization memberships");
    }

    const organizationIds = new Set<string>();
    (ownedOrgsResult.data || []).forEach((org) => {
        if (typeof org.id === "string" && org.id) {
            organizationIds.add(org.id);
        }
    });
    (membershipsResult.data || []).forEach((membership) => {
        if (typeof membership.organization_id === "string" && membership.organization_id) {
            organizationIds.add(membership.organization_id);
        }
    });

    if (organizationIds.size > 0) {
        const { data: orgLinks, error: orgLinksError } = await supabaseAdmin
            .from("organization_github_installations")
            .select("installation_id")
            .in("organization_id", Array.from(organizationIds));

        if (orgLinksError) {
            throw new Error("Failed to resolve organization-linked GitHub installations");
        }

        addInstallationIds(installationIds, orgLinks);
    }

    return installationIds;
}
