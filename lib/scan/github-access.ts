import { createAdminClient } from "@/lib/supabaseAdmin";
import { getInstallationOctokit } from "@/lib/github";

interface AuthenticatedUserLike {
    id: string;
    identities?: Array<{
        provider?: string;
        identity_data?: {
            user_name?: string;
            preferred_username?: string;
        } | null;
    }> | null;
}

interface ProjectGithubRef {
    github_installation_id: unknown;
    github_repo_id: unknown;
}

export interface VerifiedRepository {
    id: number;
    fullName: string;
    htmlUrl: string;
    description: string | null;
}

export interface VerifiedProjectGithubAccess {
    installationId: number;
    repository: VerifiedRepository;
}

function toSafePositiveInt(value: unknown): number | null {
    if (typeof value === "number") {
        if (Number.isSafeInteger(value) && value > 0) {
            return value;
        }
        return null;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isSafeInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return null;
}

function getGithubUsername(user: AuthenticatedUserLike): string | null {
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

async function getAuthorizedInstallationIds(user: AuthenticatedUserLike): Promise<Set<number>> {
    const supabaseAdmin = createAdminClient();
    const installationIds = new Set<number>();

    // Installations linked to orgs owned by this user.
    const { data: userOrgs, error: userOrgsError } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id);

    if (userOrgsError) {
        throw new Error("Failed to resolve user organizations");
    }

    if (userOrgs && userOrgs.length > 0) {
        const orgIds = userOrgs.map((org) => org.id);
        const { data: orgLinks, error: orgLinksError } = await supabaseAdmin
            .from("organization_github_installations")
            .select("installation_id")
            .in("organization_id", orgIds);

        if (orgLinksError) {
            throw new Error("Failed to resolve organization GitHub installations");
        }

        orgLinks?.forEach((link) => {
            const installationId = toSafePositiveInt(link.installation_id);
            if (installationId) {
                installationIds.add(installationId);
            }
        });
    }

    // Installations explicitly installed by this user.
    const { data: installedByUser, error: installedByUserError } = await supabaseAdmin
        .from("github_app_installations")
        .select("installation_id")
        .eq("installed_by_user_id", user.id);

    if (installedByUserError) {
        throw new Error("Failed to resolve user-installed GitHub installations");
    }

    installedByUser?.forEach((installation) => {
        const installationId = toSafePositiveInt(installation.installation_id);
        if (installationId) {
            installationIds.add(installationId);
        }
    });

    // Installations tied to the user's linked GitHub account login.
    const githubUsername = getGithubUsername(user);
    if (githubUsername) {
        const { data: usernameInstallations, error: usernameInstallationsError } = await supabaseAdmin
            .from("github_app_installations")
            .select("installation_id")
            .ilike("github_account_login", githubUsername);

        if (usernameInstallationsError) {
            throw new Error("Failed to resolve GitHub-account installations");
        }

        usernameInstallations?.forEach((installation) => {
            const installationId = toSafePositiveInt(installation.installation_id);
            if (installationId) {
                installationIds.add(installationId);
            }
        });
    }

    return installationIds;
}

async function getRepositoryFromInstallation(
    installationId: number,
    repositoryId: number
): Promise<VerifiedRepository | null> {
    try {
        const octokit = await getInstallationOctokit(installationId);
        const { data } = await octokit.request("GET /repositories/{repository_id}", {
            repository_id: repositoryId,
        });

        return {
            id: data.id,
            fullName: data.full_name,
            htmlUrl: data.html_url,
            description: data.description ?? null,
        };
    } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 403 || status === 404) {
            return null;
        }
        throw error;
    }
}

export async function verifyInstallationRepositoryAccess(
    user: AuthenticatedUserLike,
    rawInstallationId: unknown,
    rawRepositoryId: unknown
): Promise<VerifiedProjectGithubAccess | null> {
    const installationId = toSafePositiveInt(rawInstallationId);
    const repositoryId = toSafePositiveInt(rawRepositoryId);

    if (!installationId || !repositoryId) {
        return null;
    }

    const authorizedInstallations = await getAuthorizedInstallationIds(user);
    if (!authorizedInstallations.has(installationId)) {
        return null;
    }

    const repository = await getRepositoryFromInstallation(installationId, repositoryId);
    if (!repository) {
        return null;
    }

    return {
        installationId,
        repository,
    };
}

export async function verifyProjectGithubAccess(
    user: AuthenticatedUserLike,
    project: ProjectGithubRef
): Promise<VerifiedProjectGithubAccess | null> {
    return verifyInstallationRepositoryAccess(
        user,
        project.github_installation_id,
        project.github_repo_id
    );
}
