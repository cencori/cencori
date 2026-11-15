import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { normalizeVariables, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { readTask, readVariables, writeVariables } from "@/lib/tensor-cloud-tasks";

// A project's environment variables: the names and values its app reads from its environment.
//
//   GET   the whole set, values included: the settings page shows them to their owner
//   PUT   replace the whole set
//
// The set is small and is always saved whole, so that two changes made at once cannot leave it
// as a mixture neither of them meant. It is kept encrypted (lib/tensor-cloud.ts, sealVariables).

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

type Context = { params: Promise<{ id: string }> };

/** The project the request is about, or the answer to give instead. */
async function open(request: NextRequest, context: Context) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  if (!config) return { refused: json({ error: "Tensor on the web is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, (await context.params).id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, task } as const;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    return json({ variables: await readVariables(session.admin, config, task.id) });
  } catch (error) {
    console.error("[Tensor Cloud] Reading variables failed", error);
    return json({ error: "Tensor could not read this project's variables." }, 503);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "That request is invalid." }, 400);
    }
    const checked = normalizeVariables(body.variables);
    if (!checked.ok) return json({ error: checked.error, code: "bad_variables" }, 400);

    await writeVariables(session.admin, config, task, checked.variables);
    return json({ variables: checked.variables });
  } catch (error) {
    console.error("[Tensor Cloud] Saving variables failed", error);
    return json({ error: "Tensor could not save this project's variables. Try again shortly." }, 503);
  }
}
