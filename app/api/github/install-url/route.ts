import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createGithubInstallState } from '@/lib/github-install-state';

const DEFAULT_GITHUB_APP_SLUG = 'cencori';

/**
 * GET /api/github/install-url?orgSlug=...&accountType=...&accountLogin=...
 *
 * Generates a signed GitHub App installation URL for the platform dashboard.
 * Embeds orgSlug + userId into a signed state blob so the callback can
 * reliably link the installation to the correct org even if the session
 * cookie doesn't survive the GitHub OAuth redirect.
 */
export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get('orgSlug');
    const accountType = searchParams.get('accountType') ?? undefined;
    const accountLogin = searchParams.get('accountLogin') ?? undefined;

    if (!orgSlug) {
        return NextResponse.json({ error: 'Missing orgSlug' }, { status: 400 });
    }

    const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || DEFAULT_GITHUB_APP_SLUG;

    const state = createGithubInstallState({
        source: 'dashboard',
        orgSlug,
        accountType,
        accountLogin,
        userId: user.id,
    });

    const url = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;

    return NextResponse.json({ url });
}
