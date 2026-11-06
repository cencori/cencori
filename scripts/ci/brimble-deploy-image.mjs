// Runs a prebuilt image on a Brimble project and waits for the result.
//
//   BRIMBLE_API_KEY=... node scripts/ci/brimble-deploy-image.mjs <projectId> <image>
//
// Points the project at <image> (Brimble's "Docker image" source), keeping its
// name, size, region, health check and pre-start command, then redeploys. With
// buildHealthCheck on, the running deployment is only replaced once the new
// one passes its health check, so a bad image leaves the site as it was.
// Exits non-zero unless the deployment goes ACTIVE.
const [projectId, image] = process.argv.slice(2);
const key = process.env.BRIMBLE_API_KEY;
if (!projectId || !image || !key) {
    console.error("usage: BRIMBLE_API_KEY=... node scripts/ci/brimble-deploy-image.mjs <projectId> <image>");
    process.exit(2);
}

const api = "https://api.brimble.io/core/v1";
const headers = { "x-brimble-key": key, "content-type": "application/json" };

async function call(path, init) {
    const res = await fetch(`${api}${path}`, { ...init, headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`Brimble ${init?.method ?? "GET"} ${path}: HTTP ${res.status} ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
}

const { data: project } = await call(`/projects/${projectId}`);
const tag = image.split(":").pop();
const startedAt = Date.now();

await call(`/projects/${projectId}/redeploy`, {
    method: "POST",
    body: JSON.stringify({
        name: project.name,
        framework: "docker",
        repo: { git: "DOCKER", name: image, branch: tag },
        installCommand: null,
        buildCommand: null,
        startCommand: null,
        rootDirectory: null,
        healthCheckPath: project.healthCheckPath || "/api/v1/health",
        preStartCommand: project.preStartCommand || null,
        buildHealthCheck: true,
        configurations: {
            cpu: project.specs.cpu,
            memory: project.specs.memory,
            storage: project.specs.storage,
            region: project.specs.region?._id ?? null,
        },
    }),
});
console.log(`[brimble-deploy-image] ${project.name}: deploying ${image}`);

// Follow the deployment this request started (the newest one created after it).
const deadline = startedAt + 25 * 60 * 1000;
let last = "";
while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15_000));
    const { data } = await call(`/logs/${projectId}?limit=3`);
    const deployment = (data.logs ?? []).find((l) => new Date(l.createdAt).getTime() >= startedAt - 60_000);
    if (!deployment) continue;
    if (deployment.status !== last) {
        last = deployment.status;
        console.log(`[brimble-deploy-image] ${deployment.id}: ${last}`);
    }
    if (last === "ACTIVE") process.exit(0);
    if (["FAILED", "CANCELLED", "ERROR", "SUPERSEDED"].includes(last)) {
        console.error(`[brimble-deploy-image] deployment ${last}; the previous deployment keeps serving.`);
        process.exit(1);
    }
}
console.error("[brimble-deploy-image] timed out waiting for the deployment");
process.exit(1);
