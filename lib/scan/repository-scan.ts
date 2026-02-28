import type { ScanIssue } from "../../packages/scan/src/scanner/core";

interface OctokitLike {
    request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }>;
}

interface RepositoryFileRef {
    path: string;
    sha?: string;
}

export interface RepositoryScanProgress {
    currentFile: string;
    processedFiles: number;
    scannedFiles: number;
    totalFiles: number;
    issuesFound: number;
    fileIssues: ScanIssue[];
    fileContent?: string;
    failedFiles: number;
}

export interface ScanRepositoryOptions {
    octokit: OctokitLike;
    owner: string;
    repo: string;
    ref?: string;
    maxConcurrency?: number;
    collectScannedFiles?: boolean;
    shouldScanFile: (filePath: string) => boolean;
    scanFileContent: (filePath: string, content: string) => ScanIssue[];
    onProgress?: (progress: RepositoryScanProgress) => void | Promise<void>;
}

export interface RepositoryScanResult {
    allIssues: ScanIssue[];
    scannedFiles: Array<{ path: string; content: string }>;
    filesScanned: number;
    totalCandidateFiles: number;
    failedFiles: number;
    processedFiles: number;
}

function getErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== "object") return null;
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === "number") return maybeStatus;
    return null;
}

async function listDirectoryEntries(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    ref: string,
    dirPath: string
): Promise<Array<{ type?: string; path?: string; sha?: string }>> {
    const response = dirPath
        ? await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: dirPath,
            ref,
        })
        : await octokit.request("GET /repos/{owner}/{repo}/contents", {
            owner,
            repo,
            ref,
        });

    if (Array.isArray(response.data)) {
        return response.data as Array<{ type?: string; path?: string; sha?: string }>;
    }

    const single = response.data as { type?: string; path?: string; sha?: string };
    return single ? [single] : [];
}

async function listRepositoryFilesByContents(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    ref: string
): Promise<RepositoryFileRef[]> {
    const files: RepositoryFileRef[] = [];
    const queue: string[] = [""];

    while (queue.length > 0) {
        const currentDir = queue.shift();
        if (currentDir === undefined) {
            break;
        }

        const entries = await listDirectoryEntries(octokit, owner, repo, ref, currentDir);
        for (const entry of entries) {
            if (!entry.path) continue;

            if (entry.type === "dir") {
                queue.push(entry.path);
                continue;
            }

            if (entry.type === "file") {
                files.push({
                    path: entry.path,
                    sha: entry.sha,
                });
            }
        }
    }

    return files;
}

async function listRepositoryFiles(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    ref: string
): Promise<RepositoryFileRef[]> {
    try {
        const response = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: ref,
            recursive: "1",
        });

        const data = response.data as {
            truncated?: boolean;
            tree?: Array<{ type?: string; path?: string; sha?: string }>;
        };

        const treeEntries = Array.isArray(data.tree) ? data.tree : [];
        const filesFromTree = treeEntries
            .filter((entry) => entry.type === "blob" && Boolean(entry.path))
            .map((entry) => ({
                path: entry.path as string,
                sha: entry.sha,
            }));

        if (!data.truncated) {
            return filesFromTree;
        }

        const filesFromContents = await listRepositoryFilesByContents(octokit, owner, repo, ref);
        return filesFromContents;
    } catch (error) {
        const status = getErrorStatus(error);

        // Empty repositories can return 409 for tree fetches.
        if (status === 409) {
            return [];
        }

        throw error;
    }
}

async function fetchFileContent(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    ref: string,
    file: RepositoryFileRef
): Promise<string> {
    if (file.sha) {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
            owner,
            repo,
            file_sha: file.sha,
        });

        const blob = data as { content?: string };
        if (typeof blob.content === "string") {
            return Buffer.from(blob.content, "base64").toString("utf-8");
        }
    }

    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path: file.path,
        ref,
    });

    if (Array.isArray(data)) {
        throw new Error(`Expected file content but got directory for ${file.path}`);
    }

    const contentFile = data as { content?: string };
    if (typeof contentFile.content !== "string") {
        throw new Error(`No content returned for ${file.path}`);
    }

    return Buffer.from(contentFile.content, "base64").toString("utf-8");
}

export async function scanGithubRepository(options: ScanRepositoryOptions): Promise<RepositoryScanResult> {
    const {
        octokit,
        owner,
        repo,
        ref = "HEAD",
        shouldScanFile,
        scanFileContent,
        onProgress,
        collectScannedFiles = true,
    } = options;

    const maxConcurrency = Math.max(1, Math.min(options.maxConcurrency ?? 8, 20));
    const files = await listRepositoryFiles(octokit, owner, repo, ref);
    const candidateFiles = files
        .filter((file) => shouldScanFile(file.path))
        .sort((a, b) => a.path.localeCompare(b.path));

    const allIssues: ScanIssue[] = [];
    const scannedFiles: Array<{ path: string; content: string }> = [];
    let filesScanned = 0;
    let processedFiles = 0;
    let failedFiles = 0;
    let cursor = 0;

    const workerCount = Math.min(maxConcurrency, Math.max(candidateFiles.length, 1));

    const runWorker = async () => {
        while (true) {
            const currentIndex = cursor;
            cursor += 1;

            if (currentIndex >= candidateFiles.length) {
                return;
            }

            const file = candidateFiles[currentIndex];
            let fileIssues: ScanIssue[] = [];
            let fileContent: string | undefined;

            try {
                const content = await fetchFileContent(octokit, owner, repo, ref, file);
                fileContent = content;
                fileIssues = scanFileContent(file.path, content);
                allIssues.push(...fileIssues);
                filesScanned += 1;

                if (collectScannedFiles) {
                    scannedFiles.push({ path: file.path, content });
                }
            } catch {
                failedFiles += 1;
            } finally {
                processedFiles += 1;

                if (onProgress) {
                    await onProgress({
                        currentFile: file.path,
                        processedFiles,
                        scannedFiles: filesScanned,
                        totalFiles: candidateFiles.length,
                        issuesFound: allIssues.length,
                        fileIssues,
                        fileContent,
                        failedFiles,
                    });
                }
            }
        }
    };

    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    return {
        allIssues,
        scannedFiles,
        filesScanned,
        totalCandidateFiles: candidateFiles.length,
        failedFiles,
        processedFiles,
    };
}
