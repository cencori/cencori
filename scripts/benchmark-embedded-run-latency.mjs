/** Read-only hosted-run latency snapshot. Never reads prompts, outputs, or secrets. */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.min(1000, Math.max(1, Number(limitArg?.split('=')[1] ?? 100)));
if (!Number.isInteger(limit)) throw new Error('--limit must be an integer');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service credentials are not configured');

const supabase = createClient(supabaseUrl, serviceRoleKey);
const { data: runs, error: runsError } = await supabase
    .from('embedded_runs')
    .select('created_at,started_at,completed_at,status')
    .order('created_at', { ascending: false })
    .limit(limit);
if (runsError) throw runsError;

const completed = (runs ?? []).filter((run) => run.status === 'completed' && run.started_at && run.completed_at);
const ms = (from, to) => Date.parse(to) - Date.parse(from);
const percentile = (values, quantile) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor((sorted.length - 1) * quantile)] : null;
};
const summary = (values) => ({ p50Ms: percentile(values, 0.5), p90Ms: percentile(values, 0.9) });

const { data: usage, error: usageError } = await supabase
    .from('ai_requests')
    .select('metadata,latency_ms')
    .eq('endpoint', 'runs.execute')
    .order('created_at', { ascending: false })
    .limit(limit);
if (usageError) throw usageError;
const phases = (usage ?? []).map((row) => row.metadata?.run_timing_ms).filter(Boolean);

console.log(JSON.stringify({
    sampleSize: runs?.length ?? 0,
    completed: completed.length,
    queue: summary(completed.map((run) => ms(run.created_at, run.started_at))),
    execution: summary(completed.map((run) => ms(run.started_at, run.completed_at))),
    total: summary(completed.map((run) => ms(run.created_at, run.completed_at))),
    phaseSamples: phases.length,
    preGateway: summary(phases.map((phase) => phase.pre_gateway)),
    gatewayChat: summary(phases.map((phase) => phase.gateway_chat)),
    billing: summary(phases.map((phase) => phase.billing)),
}, null, 2));
