import { describe, expect, test } from "vitest";
import { analyzeRepositoryResearch } from "../research";
import type { ScannedRepositoryFile } from "../research";

describe("Data Flow Analysis – New Sources", () => {
    test("traces file read to dangerous sink", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "api/files.ts",
            content: `
const data = fs.readFileSync(filePath);
eval(data);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        expect(result.dataFlows.traces.length).toBeGreaterThan(0);
        const trace = result.dataFlows.traces.find(t => t.source.includes("File read"));
        expect(trace).toBeDefined();
    });

    test("traces HTTP headers to network request", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "api/proxy.ts",
            content: `
const target = req.headers['x-forward-to'];
const result = await fetch(target);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const trace = result.dataFlows.traces.find(t => t.source.includes("HTTP request headers"));
        expect(trace).toBeDefined();
    });

    test("traces process.argv to exec", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "scripts/deploy.ts",
            content: `
const cmd = process.argv[2];
execSync(cmd);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const trace = result.dataFlows.traces.find(t => t.source.includes("Command-line arguments"));
        expect(trace).toBeDefined();
    });
});

describe("Data Flow Analysis – New Sinks", () => {
    test("traces user input to file write", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "api/upload.ts",
            content: `
const content = request.json();
fs.writeFileSync(path, content);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const trace = result.dataFlows.traces.find(t => t.sink.includes("File write"));
        expect(trace).toBeDefined();
    });

    test("traces user input to redirect", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "api/login.ts",
            content: `
const url = req.body.returnUrl;
res.redirect(url);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const trace = result.dataFlows.traces.find(t => t.sink.includes("redirect"));
        expect(trace).toBeDefined();
    });

    test("traces user input to child process", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "api/exec.ts",
            content: `
const script = req.body.script;
const child = spawn(script, args);
`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const trace = result.dataFlows.traces.find(t => t.sink.includes("Child process"));
        expect(trace).toBeDefined();
    });
});

describe("Data Flow Analysis – Interaction Map", () => {
    test("builds interaction map with imports and dependents", () => {
        const files: ScannedRepositoryFile[] = [
            {
                path: "lib/auth.ts",
                content: `export function checkAuth() { return true; }`,
            },
            {
                path: "app/api/route.ts",
                content: `
import { checkAuth } from "../../lib/auth";
export async function GET(req) {
    const user = await checkAuth();
}
`,
            },
        ];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        expect(result.interactionMap.nodes.length).toBe(2);
        expect(result.interactionMap.edges.length).toBeGreaterThan(0);
    });

    test("identifies API routes correctly", () => {
        const files: ScannedRepositoryFile[] = [{
            path: "app/api/users/route.ts",
            content: `export async function GET(request) { return Response.json({}); }`,
        }];
        const result = analyzeRepositoryResearch({ files, issues: [] });
        const node = result.interactionMap.nodes[0];
        expect(node.kind).toBe("api-route");
    });
});
