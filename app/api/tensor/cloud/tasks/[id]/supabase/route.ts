import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTask } from "@/lib/tensor-cloud-tasks";
import {
  createProject,
  deleteLink,
  linkPassword,
  markLinkReady,
  mergeProjectVariables,
  newDatabasePassword,
  projectVariables,
  readLink,
  readProject,
  readSupabaseApp,
  saveLink,
  SUPABASE_REGIONS,
  SUPABASE_VARIABLE_NAMES,
  SupabaseError,
  supabaseToken,
  type SupabaseLink,
} from "@/lib/tensor-supabase";

// A Tensor project's Supabase project (lib/tensor-supabase.ts). Only the project's owner: not the
// project's own credential, which Tensor works with in the project.
//
//   GET     which Supabase project it uses, if any; a project still being made is checked on, and
//           its keys written into the variables once it is up
//   PUT     { create: { organizationSlug, name, region } } makes a new Supabase project for it;
//           { projectRef, password? } links one the person already has
//   DELETE  unlinks it; ?variables=remove also takes its variables out of the project's

type Context = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

function linkJson(link: SupabaseLink | null) {
  return link
    ? {
        projectRef: link.project_ref,
        projectName: link.project_name,
        organizationSlug: link.organization_slug,
        region: link.region,
        createdByTensor: link.created_by_tensor,
        hasDatabaseUrl: Boolean(link.sealed_password),
        status: link.status,
        linkedAt: link.linked_at,
        dashboardUrl: `https://supabase.com/dashboard/project/${link.project_ref}`,
      }
    : null;
}

async function open(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return { refused: json({ error: "Only the project's owner can change its Supabase." }, 403) } as const;
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  const app = readSupabaseApp();
  if (!config || !app) return { refused: json({ error: "Supabase is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, app, task } as const;
}

function failed(error: unknown, what: string) {
  if (error instanceof SupabaseError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
  console.error(`[Tensor Supabase] ${what} failed`, error);
  return json({ error: "Tensor could not reach Supabase. Try again shortly." }, 503);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const link = await readLink(session.admin, task.id);
    if (!link || link.status === "ready") return json({ link: linkJson(link) });

    // Still being made: asked how it is getting on, and finished once it is up.
    const token = await supabaseToken(session.admin, config, app, session.user.id);
    if (!token) return json({ link: linkJson(link) });
    const project = await readProject(token, link.project_ref);
    if (project?.status !== "ACTIVE_HEALTHY") return json({ link: linkJson(link), projectStatus: project?.status ?? null });
    try {
      const variables = await projectVariables(token, link.project_ref, linkPassword(config, link));
      await mergeProjectVariables(session.admin, config, task, variables);
    } catch (error) {
      // Up, but its keys not handed out yet: asked again next time.
      if (error instanceof SupabaseError && error.status === 409) return json({ link: linkJson(link), projectStatus: project.status });
      throw error;
    }
    await markLinkReady(session.admin, task.id);
    return json({ link: linkJson({ ...link, status: "ready" }), variablesChanged: true });
  } catch (error) {
    return failed(error, "Reading a project's Supabase");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const token = await supabaseToken(session.admin, config, app, session.user.id);
    if (!token) return json({ error: "Connect Supabase first.", code: "not_connected" }, 409);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "That request is invalid." }, 400);
    }

    const create = body.create as Record<string, unknown> | undefined;
    if (create && typeof create === "object") {
      const organizationSlug = typeof create.organizationSlug === "string" ? create.organizationSlug.trim() : "";
      const name = typeof create.name === "string" ? create.name.trim().slice(0, 64) : "";
      const region = typeof create.region === "string" && (SUPABASE_REGIONS as readonly string[]).includes(create.region) ? create.region : null;
      if (!organizationSlug || !name || !region) return json({ error: "Choose an organization, a name and a region." }, 400);
      const password = newDatabasePassword();
      const project = await createProject(token, { organizationSlug, name, region, password });
      await saveLink(session.admin, config, task, {
        projectRef: project.ref,
        projectName: project.name,
        organizationSlug,
        region,
        createdByTensor: true,
        password,
        status: "creating",
      });
      return json({ link: linkJson(await readLink(session.admin, task.id)) });
    }

    const projectRef = typeof body.projectRef === "string" ? body.projectRef.trim() : "";
    if (!/^[a-z0-9]{8,40}$/.test(projectRef)) return json({ error: "Choose one of your Supabase projects." }, 400);
    const project = await readProject(token, projectRef);
    if (!project) return json({ error: "That Supabase project was not found." }, 404);
    // The password of a project Tensor did not make is not to be had from Supabase: the person
    // may give it, for DATABASE_URL; without it the project's keys are still enough.
    const password = typeof body.password === "string" && body.password.length > 0 ? body.password.slice(0, 200) : null;
    const variables = await projectVariables(token, project.ref, password);
    // A DATABASE_URL from an earlier link is left only when this one gives a new one.
    await mergeProjectVariables(session.admin, config, task, variables);
    await saveLink(session.admin, config, task, {
      projectRef: project.ref,
      projectName: project.name,
      organizationSlug: project.organizationSlug,
      region: project.region,
      createdByTensor: false,
      password,
      status: "ready",
    });
    return json({ link: linkJson(await readLink(session.admin, task.id)), variablesChanged: true });
  } catch (error) {
    return failed(error, "Linking a project to Supabase");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    await deleteLink(session.admin, task.id);
    const remove = request.nextUrl.searchParams.get("variables") === "remove";
    if (remove) await mergeProjectVariables(session.admin, config, task, [], SUPABASE_VARIABLE_NAMES);
    return json({ link: null, variablesChanged: remove });
  } catch (error) {
    return failed(error, "Unlinking a project from Supabase");
  }
}
