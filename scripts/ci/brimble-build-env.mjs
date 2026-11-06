// Prints the NEXT_PUBLIC_* variables of a Brimble project as KEY=value lines,
// for `next build` outside Brimble (.github/workflows/deploy.yml).
//
// Only NEXT_PUBLIC_* values are used at build time: Next inlines them into the
// browser bundles, so they are public anyway. Server secrets never enter the
// build or the image; Brimble injects them when the container starts.
//
//   BRIMBLE_API_KEY=... node scripts/ci/brimble-build-env.mjs <projectId> > build.env
const projectId = process.argv[2];
const key = process.env.BRIMBLE_API_KEY;
if (!projectId || !key) {
    console.error("usage: BRIMBLE_API_KEY=... node scripts/ci/brimble-build-env.mjs <projectId>");
    process.exit(2);
}

const api = "https://api.brimble.io/core/v1";
const headers = { "x-brimble-key": key, "content-type": "application/json" };

async function call(path, init) {
    const res = await fetch(`${api}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Brimble ${path}: HTTP ${res.status}`);
    return res.json();
}

const { data } = await call(`/envs/${projectId}`);
const envs = (data.envs ?? []).filter((e) => /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(e.name));
if (envs.length === 0) throw new Error("No NEXT_PUBLIC_* variables on the project");

const { data: decrypted } = await call("/decrypt", {
    method: "POST",
    body: JSON.stringify({ environments: envs.map(({ name, value }) => ({ name, value })) }),
});

for (const { name, value } of decrypted) {
    // One line per variable; values with newlines would break a dotenv file.
    if (/[\r\n]/.test(value)) throw new Error(`${name} contains a newline`);
    process.stdout.write(`${name}=${value}\n`);
}
console.error(`[brimble-build-env] ${decrypted.length} NEXT_PUBLIC_* variables`);
