import path from "path";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface ScanIssueLike {
    file: string;
    severity: IssueSeverity;
    name: string;
    type: string;
    line: number;
}

export interface ScannedRepositoryFile {
    path: string;
    content: string;
}

type InteractionNodeKind = "api-route" | "component" | "hook" | "service" | "module";

export interface InteractionNode {
    file: string;
    name: string;
    kind: InteractionNodeKind;
    imports: string[];
    dependents: string[];
    issueCount: number;
    highestSeverity: IssueSeverity | "none";
    riskScore: number;
}

export interface InteractionEdge {
    from: string;
    to: string;
    kind: "import";
}

export interface InteractionHotspot {
    file: string;
    name: string;
    kind: InteractionNodeKind;
    riskScore: number;
    reason: string;
}

type DataFlowSeverity = "critical" | "high" | "medium";

export interface DataFlowStage {
    kind: "source" | "transform" | "sink";
    file: string;
    line: number;
    label: string;
    code: string;
}

export interface DataFlowTrace {
    id: string;
    file: string;
    line: number;
    source: string;
    sink: string;
    severity: DataFlowSeverity;
    confidence: number;
    summary: string;
    stages: DataFlowStage[];
}

export interface RepositoryResearch {
    generatedAt: string;
    filesIndexed: number;
    interactionMap: {
        nodes: InteractionNode[];
        edges: InteractionEdge[];
        hotspots: InteractionHotspot[];
    };
    dataFlows: {
        traces: DataFlowTrace[];
        criticalCount: number;
        highCount: number;
        mediumCount: number;
    };
    reasoningNotes: string[];
}

interface SourcePattern {
    label: string;
    pattern: RegExp;
}

interface SinkPattern {
    label: string;
    pattern: RegExp;
    severity: DataFlowSeverity;
}

interface VariableOrigin {
    variable: string;
    sourceLabel: string;
    line: number;
    code: string;
    parent?: string;
}

const IMPORT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const IMPORT_REGEX = /import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
const DEFAULT_EXPORTED_FUNCTION_REGEX = /export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const EXPORTED_FUNCTION_REGEX = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const API_ROUTE_HANDLER_REGEX = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/;
const COMPONENT_FUNCTION_REGEX = /function\s+([A-Z][A-Za-z0-9_$]*)\s*\(/;
const JSX_HINT_REGEX = /<([A-Z][A-Za-z0-9]*)[\s/>]/;
const ASSIGNMENT_REGEX = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)/;
const DESTRUCTURING_ASSIGNMENT_REGEX = /(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*(.+)/;

const SOURCE_PATTERNS: SourcePattern[] = [
    { label: "HTTP request body", pattern: /\brequest\.json\s*\(|\breq\.body\b/ },
    { label: "URL query params", pattern: /\bsearchParams\b|\brequest\.nextUrl\.searchParams\b|\breq\.query\b/ },
    { label: "Route params", pattern: /\bparams\.[A-Za-z_$][\w$]*/ },
    { label: "Environment variable", pattern: /\bprocess\.env\.[A-Z0-9_]+/ },
    { label: "Cookie or session data", pattern: /\bcookies\(\)\.get\b|\bsession\b|\bauth\.getUser\b/ },
    { label: "Browser storage", pattern: /\blocalStorage\.getItem\s*\(/ },
    // New source patterns
    { label: "File read operation", pattern: /\b(?:readFile|readFileSync|createReadStream)\s*\(/ },
    { label: "WebSocket message", pattern: /\bws\.on\s*\(\s*["']message["']|\bsocket\.on\s*\(\s*["'](?:message|data)["']/ },
    { label: "FormData extraction", pattern: /\bformData\s*\.\s*get\s*\(|\bnew\s+FormData\s*\(/ },
    { label: "Command-line arguments", pattern: /\bprocess\.argv\b/ },
    { label: "HTTP request headers", pattern: /\breq\.headers\b|\brequest\.headers\.get\s*\(/ },
    { label: "Database query result", pattern: /\.\.from\s*\([^)]+\)\s*\.select\b|\bprisma\.[a-z]+\.find/ },
];

const SINK_PATTERNS: SinkPattern[] = [
    { label: "Dynamic code execution", pattern: /\beval\s*\(|\bnew\s+Function\s*\(/, severity: "critical" },
    { label: "Shell command execution", pattern: /\bexec(?:Sync)?\s*\(/, severity: "critical" },
    { label: "Raw HTML injection", pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/, severity: "high" },
    {
        label: "SQL query construction",
        pattern: /\bquery\s*\(\s*[`'"].*\$\{|\b(SELECT|INSERT|UPDATE|DELETE).*\+\s*[A-Za-z_$][\w$]*/i,
        severity: "high",
    },
    { label: "Outbound network request", pattern: /\bfetch\s*\(|\boctokit\.request\s*\(/, severity: "medium" },
    {
        label: "Database write operation",
        pattern: /\bsupabase\b.{0,120}\.(insert|update|upsert|delete)\s*\(/,
        severity: "medium",
    },
    // New sink patterns
    { label: "File write operation", pattern: /\b(?:writeFile|writeFileSync|createWriteStream|appendFile)\s*\(/, severity: "high" },
    { label: "HTTP redirect", pattern: /\bres\.redirect\s*\(|\brouter\.push\s*\(/, severity: "high" },
    { label: "Child process spawn", pattern: /\b(?:spawn|spawnSync|execFile|execFileSync|fork)\s*\(/, severity: "critical" },
    { label: "Template rendering", pattern: /\bres\.render\s*\(|\bcompile\s*\(/, severity: "high" },
    { label: "HTTP response header", pattern: /\bres\.setHeader\s*\(|\bres\.header\s*\(/, severity: "medium" },
    { label: "Cookie setting", pattern: /\bres\.cookie\s*\(|\bcookies\(\)\.set\s*\(/, severity: "medium" },
    { label: "Dynamic require/import", pattern: /\brequire\s*\(\s*[^"'`]|\bimport\s*\(\s*[^"'`]/, severity: "critical" },
    { label: "Logging sensitive data", pattern: /\bconsole\.(?:log|info|debug)\s*\([^)]*(?:password|secret|token|key|credential)/i, severity: "medium" },
];

const SEVERITY_WEIGHT: Record<IssueSeverity | "none", number> = {
    none: 0,
    low: 1,
    medium: 3,
    high: 6,
    critical: 10,
};

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsIdentifier(haystack: string, identifier: string): boolean {
    const regex = new RegExp(`\\b${escapeRegex(identifier)}\\b`);
    return regex.test(haystack);
}

function detectSource(line: string): string | null {
    for (const pattern of SOURCE_PATTERNS) {
        if (pattern.pattern.test(line)) {
            return pattern.label;
        }
    }
    return null;
}

function inferKind(filePath: string, content: string): InteractionNodeKind {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes("/api/") || API_ROUTE_HANDLER_REGEX.test(content)) {
        return "api-route";
    }
    if (lowerPath.includes("/hooks/") || /\buse[A-Z][A-Za-z0-9_$]*\s*\(/.test(content)) {
        return "hook";
    }
    if (lowerPath.includes("/components/") || (COMPONENT_FUNCTION_REGEX.test(content) && JSX_HINT_REGEX.test(content))) {
        return "component";
    }
    if (lowerPath.includes("/lib/") || lowerPath.includes("/services/")) {
        return "service";
    }
    return "module";
}

function inferName(filePath: string, content: string): string {
    const defaultExportMatch = content.match(DEFAULT_EXPORTED_FUNCTION_REGEX);
    if (defaultExportMatch?.[1]) {
        return defaultExportMatch[1];
    }

    const exportMatch = content.match(EXPORTED_FUNCTION_REGEX);
    if (exportMatch?.[1]) {
        return exportMatch[1];
    }

    const componentMatch = content.match(COMPONENT_FUNCTION_REGEX);
    if (componentMatch?.[1]) {
        return componentMatch[1];
    }

    const basename = path.posix.basename(filePath);
    return basename.replace(path.posix.extname(basename), "");
}

function resolveRelativeImport(fromPath: string, rawSpecifier: string, availableFiles: Set<string>): string | null {
    if (!rawSpecifier.startsWith(".")) {
        return null;
    }

    const baseDir = path.posix.dirname(fromPath);
    const normalizedBase = normalizePath(path.posix.join(baseDir, rawSpecifier));
    const candidates = new Set<string>();

    candidates.add(normalizedBase);
    for (const extension of IMPORT_EXTENSIONS) {
        candidates.add(`${normalizedBase}${extension}`);
    }
    for (const extension of IMPORT_EXTENSIONS) {
        candidates.add(path.posix.join(normalizedBase, `index${extension}`));
    }

    for (const candidate of candidates) {
        const normalizedCandidate = normalizePath(path.posix.normalize(candidate));
        if (availableFiles.has(normalizedCandidate)) {
            return normalizedCandidate;
        }
    }

    return null;
}

function extractRelativeImports(filePath: string, content: string, availableFiles: Set<string>): string[] {
    const importedFiles = new Set<string>();

    IMPORT_REGEX.lastIndex = 0;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = IMPORT_REGEX.exec(content)) !== null) {
        const resolved = resolveRelativeImport(filePath, importMatch[1], availableFiles);
        if (resolved) {
            importedFiles.add(resolved);
        }
    }

    DYNAMIC_IMPORT_REGEX.lastIndex = 0;
    let dynamicImportMatch: RegExpExecArray | null;
    while ((dynamicImportMatch = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
        const resolved = resolveRelativeImport(filePath, dynamicImportMatch[1], availableFiles);
        if (resolved) {
            importedFiles.add(resolved);
        }
    }

    return Array.from(importedFiles);
}

function parseDestructuredVariables(rawVariableSet: string): string[] {
    return rawVariableSet
        .split(",")
        .map(part => part.trim())
        .map(part => {
            const withoutRest = part.replace(/^\.\.\./, "");
            const aliasSplit = withoutRest.split(":");
            const variableChunk = aliasSplit.length > 1 ? aliasSplit[1] : aliasSplit[0];
            return variableChunk.split("=")[0].trim();
        })
        .filter(variable => Boolean(variable) && /^[A-Za-z_$][\w$]*$/.test(variable));
}

function buildLineage(variable: string, origins: Map<string, VariableOrigin>): VariableOrigin[] {
    const lineage: VariableOrigin[] = [];
    let current: string | undefined = variable;
    const seen = new Set<string>();

    while (current && !seen.has(current)) {
        seen.add(current);
        const origin = origins.get(current);
        if (!origin) break;
        lineage.push(origin);
        current = origin.parent;
    }

    return lineage.reverse();
}

function findHighestSeverity(issues: ScanIssueLike[]): IssueSeverity | "none" {
    if (issues.some(issue => issue.severity === "critical")) return "critical";
    if (issues.some(issue => issue.severity === "high")) return "high";
    if (issues.some(issue => issue.severity === "medium")) return "medium";
    if (issues.some(issue => issue.severity === "low")) return "low";
    return "none";
}

function analyzeDataFlows(files: ScannedRepositoryFile[]): DataFlowTrace[] {
    const traces: DataFlowTrace[] = [];
    const dedupe = new Set<string>();

    for (const scannedFile of files) {
        const lines = scannedFile.content.split("\n");
        const origins = new Map<string, VariableOrigin>();

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.trim();
            if (!line || line.startsWith("//")) {
                continue;
            }

            const lineNumber = i + 1;
            const detectedSource = detectSource(line);

            const destructuringMatch = line.match(DESTRUCTURING_ASSIGNMENT_REGEX);
            if (destructuringMatch) {
                const variables = parseDestructuredVariables(destructuringMatch[1]);
                const rightSide = destructuringMatch[2];
                const rightSideSource = detectSource(rightSide);
                const rightSideOrigin = Array.from(origins.values()).find(origin => containsIdentifier(rightSide, origin.variable));

                for (const variable of variables) {
                    if (rightSideSource) {
                        origins.set(variable, {
                            variable,
                            sourceLabel: rightSideSource,
                            line: lineNumber,
                            code: line,
                        });
                    } else if (rightSideOrigin) {
                        origins.set(variable, {
                            variable,
                            sourceLabel: rightSideOrigin.sourceLabel,
                            line: lineNumber,
                            code: line,
                            parent: rightSideOrigin.variable,
                        });
                    }
                }
            }

            const assignmentMatch = line.match(ASSIGNMENT_REGEX);
            if (assignmentMatch) {
                const variable = assignmentMatch[1];
                const rhs = assignmentMatch[2];
                const rhsSource = detectSource(rhs) || detectedSource;

                if (rhsSource) {
                    origins.set(variable, {
                        variable,
                        sourceLabel: rhsSource,
                        line: lineNumber,
                        code: line,
                    });
                } else {
                    const parentOrigin = Array.from(origins.values()).find(origin => containsIdentifier(rhs, origin.variable));
                    if (parentOrigin) {
                        origins.set(variable, {
                            variable,
                            sourceLabel: parentOrigin.sourceLabel,
                            line: lineNumber,
                            code: line,
                            parent: parentOrigin.variable,
                        });
                    }
                }
            }

            for (const sink of SINK_PATTERNS) {
                if (!sink.pattern.test(line)) continue;

                const referencedOrigins = Array.from(origins.values()).filter(origin => containsIdentifier(line, origin.variable));
                const directSourceLabel = detectSource(line);

                if (referencedOrigins.length === 0 && !directSourceLabel) {
                    continue;
                }

                const selectedOrigin = referencedOrigins.sort((a, b) => a.line - b.line)[0];
                const lineage = selectedOrigin ? buildLineage(selectedOrigin.variable, origins) : [];
                const sourceLabel = lineage[0]?.sourceLabel || directSourceLabel || "Unknown source";

                const stages: DataFlowStage[] = [];
                if (lineage.length > 0) {
                    stages.push({
                        kind: "source",
                        file: scannedFile.path,
                        line: lineage[0].line,
                        label: lineage[0].sourceLabel,
                        code: lineage[0].code,
                    });

                    for (let lineageIndex = 1; lineageIndex < lineage.length; lineageIndex++) {
                        stages.push({
                            kind: "transform",
                            file: scannedFile.path,
                            line: lineage[lineageIndex].line,
                            label: `Derived value (${lineage[lineageIndex].variable})`,
                            code: lineage[lineageIndex].code,
                        });
                    }
                } else if (directSourceLabel) {
                    stages.push({
                        kind: "source",
                        file: scannedFile.path,
                        line: lineNumber,
                        label: directSourceLabel,
                        code: line,
                    });
                }

                stages.push({
                    kind: "sink",
                    file: scannedFile.path,
                    line: lineNumber,
                    label: sink.label,
                    code: line,
                });

                const confidence = lineage.length >= 2 ? 0.86 : lineage.length === 1 ? 0.78 : 0.62;
                const traceId = `${scannedFile.path}:${lineNumber}:${sink.label}:${sourceLabel}`;
                if (dedupe.has(traceId)) {
                    continue;
                }
                dedupe.add(traceId);

                traces.push({
                    id: traceId,
                    file: scannedFile.path,
                    line: lineNumber,
                    source: sourceLabel,
                    sink: sink.label,
                    severity: sink.severity,
                    confidence,
                    summary: `${sourceLabel} reaches ${sink.label}`,
                    stages,
                });
            }
        }
    }

    return traces.sort((a, b) => {
        const severityRank = { critical: 3, high: 2, medium: 1 };
        return severityRank[b.severity] - severityRank[a.severity] || b.confidence - a.confidence;
    });
}

export function analyzeRepositoryResearch(input: {
    files: ScannedRepositoryFile[];
    issues: ScanIssueLike[];
}): RepositoryResearch {
    const normalizedFiles = input.files.map(file => ({
        path: normalizePath(file.path),
        content: file.content,
    }));

    const availableFiles = new Set(normalizedFiles.map(file => file.path));
    const issueMap = new Map<string, ScanIssueLike[]>();
    for (const issue of input.issues) {
        const fileIssues = issueMap.get(issue.file) || [];
        fileIssues.push(issue);
        issueMap.set(issue.file, fileIssues);
    }

    const nodeByFile = new Map<string, InteractionNode>();
    const edges: InteractionEdge[] = [];

    for (const scannedFile of normalizedFiles) {
        const imports = extractRelativeImports(scannedFile.path, scannedFile.content, availableFiles);
        const fileIssues = issueMap.get(scannedFile.path) || [];
        const highestSeverity = findHighestSeverity(fileIssues);
        const node: InteractionNode = {
            file: scannedFile.path,
            name: inferName(scannedFile.path, scannedFile.content),
            kind: inferKind(scannedFile.path, scannedFile.content),
            imports,
            dependents: [],
            issueCount: fileIssues.length,
            highestSeverity,
            riskScore: 0,
        };
        nodeByFile.set(scannedFile.path, node);

        for (const imported of imports) {
            if (imported === scannedFile.path) continue;
            edges.push({
                from: scannedFile.path,
                to: imported,
                kind: "import",
            });
        }
    }

    for (const edge of edges) {
        const targetNode = nodeByFile.get(edge.to);
        if (!targetNode) continue;
        if (!targetNode.dependents.includes(edge.from)) {
            targetNode.dependents.push(edge.from);
        }
    }

    const nodes = Array.from(nodeByFile.values()).map(node => {
        const severityWeight = SEVERITY_WEIGHT[node.highestSeverity];
        const riskScore = severityWeight + node.issueCount * 4 + node.dependents.length * 2 + node.imports.length;
        return {
            ...node,
            dependents: node.dependents.sort(),
            imports: node.imports.sort(),
            riskScore,
        };
    });

    const hotspots = [...nodes]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 8)
        .map(node => ({
            file: node.file,
            name: node.name,
            kind: node.kind,
            riskScore: node.riskScore,
            reason: `${node.issueCount} issue(s), ${node.dependents.length} dependent file(s), ${node.imports.length} import(s)`,
        }));

    const traces = analyzeDataFlows(normalizedFiles);
    const criticalCount = traces.filter(trace => trace.severity === "critical").length;
    const highCount = traces.filter(trace => trace.severity === "high").length;
    const mediumCount = traces.filter(trace => trace.severity === "medium").length;

    const reasoningNotes: string[] = [];
    const apiRouteCount = nodes.filter(node => node.kind === "api-route").length;
    const componentCount = nodes.filter(node => node.kind === "component").length;
    reasoningNotes.push(`Indexed ${nodes.length} files: ${apiRouteCount} API routes and ${componentCount} UI components.`);

    if (hotspots.length > 0) {
        const topHotspot = hotspots[0];
        reasoningNotes.push(
            `Highest-risk interaction hotspot is ${topHotspot.file} with risk score ${topHotspot.riskScore} (${topHotspot.reason}).`
        );
    } else {
        reasoningNotes.push("No interaction hotspots were identified in the scanned file set.");
    }

    if (traces.length > 0) {
        reasoningNotes.push(
            `Traced ${traces.length} source-to-sink data flow(s), including ${criticalCount} critical and ${highCount} high-risk path(s).`
        );
    } else {
        reasoningNotes.push("No explicit source-to-sink paths were inferred from the scanned files.");
    }

    return {
        generatedAt: new Date().toISOString(),
        filesIndexed: normalizedFiles.length,
        interactionMap: {
            nodes,
            edges,
            hotspots,
        },
        dataFlows: {
            traces,
            criticalCount,
            highCount,
            mediumCount,
        },
        reasoningNotes,
    };
}
