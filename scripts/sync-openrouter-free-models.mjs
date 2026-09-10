/**
 * OpenRouter free-tier drift check.
 *
 * The zero-cost list in lib/providers/free-models.ts is hand-curated, and
 * OpenRouter's `:free` catalog turns over fast enough that hand-curation loses.
 * On 2026-09-10 five of fourteen ids had already 404'd upstream — they were
 * still being advertised in the model catalog and the playground, so every call
 * to one failed. Nothing noticed, because nothing was checking.
 *
 * This is the check. It compares our list against OpenRouter's live model
 * endpoint and reports two kinds of drift:
 *
 *   DEAD  — we list it; upstream it is gone, or no longer priced at zero.
 *   NEW   — upstream serves it free; we do not list it.
 *
 * Exits 1 when anything is DEAD, so CI can fail on rot. NEW models are reported
 * but never fail the build: adding one is a judgement call (some free ids are
 * unusable through a gateway — see --probe).
 *
 * Usage:
 *   npm run sync:free-models             # report drift
 *   npm run sync:free-models -- --probe  # also call each NEW model once to
 *                                        # check it actually answers. Needs
 *                                        # OPENROUTER_API_KEY. Spends free-tier
 *                                        # request quota, one per candidate.
 *   npm run sync:free-models -- --json   # machine-readable output
 *
 * This deliberately does not rewrite free-models.ts. The file carries the
 * reasoning behind each entry — which models answer at low token budgets, which
 * ones are lab promos with an end date, which are excluded and why — and a
 * codegen pass would flatten all of that. Report, then edit by hand.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const FREE_MODELS_FILE = path.resolve('lib/providers/free-models.ts');
const CONFIG_FILE = path.resolve('lib/providers/config.ts');

const args = process.argv.slice(2);
const shouldProbe = args.includes('--probe');
const asJson = args.includes('--json');

/** Ids we list under the `openrouter:` namespace in free-models.ts. */
async function readOurFreeIds() {
    const source = await readFile(FREE_MODELS_FILE, 'utf8');
    const ids = new Set();
    for (const match of source.matchAll(/'openrouter:([^']+)'/g)) {
        ids.add(match[1]);
    }
    if (ids.size === 0) {
        throw new Error(`No 'openrouter:*' entries found in ${FREE_MODELS_FILE} — did the format change?`);
    }
    return ids;
}

/**
 * Ids tagged `free: true` inside the openrouter provider block of config.ts.
 * The two files must agree; a mismatch means the catalog and the biller
 * disagree about what is free, which pricing-catalog.test.ts also guards.
 */
async function readCatalogFreeIds() {
    const source = await readFile(CONFIG_FILE, 'utf8');
    const blockStart = source.indexOf("id: 'openrouter'");
    if (blockStart === -1) throw new Error('openrouter provider block not found in config.ts');
    // The provider blocks are a flat array, so the next `        id: '` at the
    // same indentation ends this one.
    const nextProvider = source.indexOf("\n        id: '", blockStart + 1);
    const block = source.slice(blockStart, nextProvider === -1 ? undefined : nextProvider);

    const ids = new Set();
    for (const line of block.split('\n')) {
        if (!line.includes('free: true')) continue;
        const match = line.match(/\{\s*id:\s*'([^']+)'/);
        if (match) ids.add(match[1]);
    }
    return ids;
}

async function fetchLiveModels() {
    const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`OpenRouter model list failed: ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (!Array.isArray(body?.data)) throw new Error('Unexpected OpenRouter response shape');
    return body.data;
}

const isZeroCost = (model) =>
    Number(model?.pricing?.prompt ?? NaN) === 0 && Number(model?.pricing?.completion ?? NaN) === 0;

/**
 * Call a model once with a tiny prompt. A model can be listed at $0 and still be
 * uncallable — `thinkingmachines/inkling:free` is priced free but 403s with
 * "only available on agentic harnesses", and a gateway can never serve that.
 * Transient upstream 429/overload is reported separately from a hard refusal:
 * the free pool rate-limits constantly and that is not a reason to skip a model.
 */
async function probe(id, apiKey) {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: id, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
            signal: AbortSignal.timeout(60_000),
        });
        const body = await res.json().catch(() => ({}));
        if (body?.error) {
            const message = String(body.error.message ?? '').slice(0, 120);
            const code = Number(body.error.code ?? res.status);
            return { ok: false, transient: code === 429 || /overload|exhaust|rate.?limit/i.test(message), detail: message };
        }
        if (!res.ok) return { ok: false, transient: res.status === 429, detail: `HTTP ${res.status}` };
        return { ok: true, cost: body?.usage?.cost ?? 0 };
    } catch (error) {
        return { ok: false, transient: true, detail: String(error?.message ?? error).slice(0, 120) };
    }
}

async function main() {
    const [ourIds, catalogIds, live] = await Promise.all([
        readOurFreeIds(),
        readCatalogFreeIds(),
        fetchLiveModels(),
    ]);

    const byId = new Map(live.map((model) => [model.id, model]));
    const liveFree = live.filter(isZeroCost);

    const dead = [];
    for (const id of ourIds) {
        const model = byId.get(id);
        if (!model) {
            dead.push({ id, reason: 'not in OpenRouter model list (404s upstream)' });
        } else if (!isZeroCost(model)) {
            const inPrice = Number(model.pricing.prompt) * 1e6;
            const outPrice = Number(model.pricing.completion) * 1e6;
            dead.push({ id, reason: `no longer free — now $${inPrice}/$${outPrice} per 1M` });
        }
    }

    const candidates = liveFree
        .filter((model) => !ourIds.has(model.id))
        .map((model) => ({
            id: model.id,
            contextLength: model.context_length ?? 0,
            modalities: model.architecture?.input_modalities ?? [],
        }))
        .sort((a, b) => b.contextLength - a.contextLength);

    // free-models.ts and config.ts must describe the same set.
    const mismatched = [
        ...[...ourIds].filter((id) => !catalogIds.has(id)).map((id) => ({ id, where: 'free-models.ts only' })),
        ...[...catalogIds].filter((id) => !ourIds.has(id)).map((id) => ({ id, where: 'config.ts only' })),
    ];

    if (shouldProbe && candidates.length > 0) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('--probe needs OPENROUTER_API_KEY in the environment.');
            process.exit(2);
        }
        for (const candidate of candidates) {
            candidate.probe = await probe(candidate.id, apiKey);
        }
    }

    if (asJson) {
        console.log(JSON.stringify({ dead, candidates, mismatched, liveFreeCount: liveFree.length }, null, 2));
    } else {
        console.log(`OpenRouter: ${live.length} models, ${liveFree.length} at zero cost.`);
        console.log(`Cencori lists ${ourIds.size} of them.\n`);

        if (dead.length === 0) {
            console.log('DEAD: none — every id we list is still free upstream.');
        } else {
            console.log(`DEAD (${dead.length}) — remove from free-models.ts and config.ts:`);
            for (const entry of dead) console.log(`  ${entry.id}\n    ${entry.reason}`);
        }

        console.log('');
        if (candidates.length === 0) {
            console.log('NEW: none — we already list every free model.');
        } else {
            console.log(`NEW (${candidates.length}) — free upstream, not in our catalog:`);
            for (const candidate of candidates) {
                const modalities = candidate.modalities.join('+') || 'text';
                let status = '';
                if (candidate.probe) {
                    if (candidate.probe.ok) status = '  [probe: ok]';
                    else if (candidate.probe.transient) status = `  [probe: transient — ${candidate.probe.detail}]`;
                    else status = `  [probe: UNUSABLE — ${candidate.probe.detail}]`;
                }
                console.log(`  ${candidate.id}  (${candidate.contextLength} ctx, ${modalities})${status}`);
            }
        }

        if (mismatched.length > 0) {
            console.log(`\nOUT OF SYNC (${mismatched.length}) — free-models.ts and config.ts disagree:`);
            for (const entry of mismatched) console.log(`  ${entry.id} — ${entry.where}`);
        }
    }

    if (dead.length > 0 || mismatched.length > 0) process.exit(1);
}

main().catch((error) => {
    console.error(`sync-openrouter-free-models failed: ${error?.message ?? error}`);
    process.exit(2);
});
