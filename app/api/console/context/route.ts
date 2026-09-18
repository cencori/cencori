import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@/lib/supabaseServer";
import { getActiveConsoleWorkspace } from "@/lib/console/active-workspace";
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_PROJECT_COOKIE,
} from "@/lib/console/routing";

const LAST_ORG_COOKIE = "cencori:last-org";
const ONE_YEAR = 60 * 60 * 24 * 365;

function cookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
  };
}

export async function GET() {
  const workspace = await getActiveConsoleWorkspace();
  if (!workspace) {
    return NextResponse.json({ workspace: null }, { status: 200 });
  }

  const host = (await headers()).get("host") ?? "";
  const isProduction = host.split(":")[0].endsWith("cencori.com");
  const options = cookieOptions(isProduction);
  const response = NextResponse.json({ workspace });

  // GET doubles as first-run bootstrap for direct links such as /logs. The
  // resolved workspace already passed RLS, so it is safe to persist as the
  // user's routing preference.
  response.cookies.set(ACTIVE_ORG_COOKIE, workspace.organization.slug, options);
  response.cookies.set(ACTIVE_PROJECT_COOKIE, workspace.project.slug, options);
  response.cookies.set(LAST_ORG_COOKIE, workspace.organization.slug, options);

  return response;
}

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let projectId: string | null = null;
  try {
    const body = await request.json() as { projectId?: unknown };
    projectId = typeof body.projectId === "string" ? body.projectId.trim() : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // RLS is the authorization boundary. A project outside the user's
  // organizations resolves to no row and can never become active context.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, slug, organization_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: "Could not select project" }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, subscription_tier")
    .eq("id", project.organization_id)
    .maybeSingle();

  if (organizationError) {
    return NextResponse.json({ error: "Could not select organization" }, { status: 500 });
  }
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const host = (await headers()).get("host") ?? "";
  const isProduction = host.split(":")[0].endsWith("cencori.com");
  const cookieStore = await cookies();
  const options = cookieOptions(isProduction);
  cookieStore.set(ACTIVE_ORG_COOKIE, organization.slug, options);
  cookieStore.set(ACTIVE_PROJECT_COOKIE, project.slug, options);
  cookieStore.set(LAST_ORG_COOKIE, organization.slug, options);

  return NextResponse.json({
    workspace: {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionTier: organization.subscription_tier ?? null,
      },
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        organizationId: project.organization_id,
      },
    },
  });
}
