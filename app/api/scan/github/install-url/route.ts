import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createGithubInstallState } from "@/lib/github-install-state";

const DEFAULT_GITHUB_APP_SLUG = "cencori";

export async function GET() {
    const supabase = await createServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || DEFAULT_GITHUB_APP_SLUG;
    const state = createGithubInstallState({
        source: "scan",
        redirect: "/scan/import",
        userId: user.id,
    });

    const url = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;

    return NextResponse.json({ url });
}
