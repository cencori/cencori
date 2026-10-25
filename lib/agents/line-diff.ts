/**
 * A small line diff for showing what a draft changes against the published
 * version, side by side. Longest-common-subsequence over lines; agent
 * instructions are at most ~20k characters, so the quadratic table is fine.
 */

export type DiffRow =
    | { kind: "same"; left: string; right: string }
    | { kind: "changed"; left: string | null; right: string | null };

/** Side-by-side rows: unchanged lines on both sides, removed lines left, added lines right. */
export function diffLines(before: string, after: string): DiffRow[] {
    // Empty text has no lines (a first publish is all additions), not one blank line.
    const a = before === "" ? [] : before.split("\n");
    const b = after === "" ? [] : after.split("\n");
    const n = a.length;
    const m = b.length;
    // lcs[i][j] = longest common subsequence of a[i..] and b[j..]
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }

    const rows: DiffRow[] = [];
    let removed: string[] = [];
    let added: string[] = [];
    // Pair up a run of removals with the additions that replaced them.
    const flush = () => {
        for (let k = 0; k < Math.max(removed.length, added.length); k++) {
            rows.push({ kind: "changed", left: removed[k] ?? null, right: added[k] ?? null });
        }
        removed = [];
        added = [];
    };

    let i = 0;
    let j = 0;
    while (i < n || j < m) {
        if (i < n && j < m && a[i] === b[j]) {
            flush();
            rows.push({ kind: "same", left: a[i], right: b[j] });
            i++;
            j++;
        } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
            added.push(b[j++]);
        } else {
            removed.push(a[i++]);
        }
    }
    flush();
    return rows;
}

/** How many lines were added and removed. */
export function diffStats(rows: DiffRow[]) {
    let added = 0;
    let removed = 0;
    for (const row of rows) {
        if (row.kind !== "changed") continue;
        if (row.left !== null) removed++;
        if (row.right !== null) added++;
    }
    return { added, removed };
}
