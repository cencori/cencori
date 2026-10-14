/**
 * Cencori Compute × CostGraph Pricing API.
 *
 * Two jobs:
 *   1. Publish what a Compute machine costs us, so CostGraph can price it. Fly Machines is not in
 *      CostGraph's public catalogue, so our rates go into its marketplace as `BaseCompute` entries
 *      (one per memory tier and region), priced per vCPU-hour and per GB-hour.
 *   2. Quote placement: for the machine shape an agent runs on, the cheapest equivalent per cloud
 *      on the same continent, and the saving against what we pay today. This is the input to the v2
 *      runtime decision (COMPUTE_ARCHITECTURE.md §14) — where to run once we own the runtime.
 *
 * Our rates come from configuration, never from a guess in code:
 *   COMPUTE_SHARED_CPU_HOURLY_USD   price of one shared vCPU for one hour
 *   COMPUTE_RAM_GB_HOURLY_USD       price of one GB of memory for one hour
 *   COMPUTE_REGIONS                 comma-separated runtime regions (default: FLY_REGION or iad)
 * Without the two rates, publishing is skipped and quotes list alternatives without a saving.
 */

import type { ComputePrice, ComputeRecommendation, CostGraphPricingClient, MachineQuery } from '@/lib/finops/costgraph';

/** Memory tiers a Compute machine can be deployed with (MB). Mirrors the runtime's billing tiers. */
export const COMPUTE_MEMORY_TIERS_MB = [256, 512, 1024, 2048, 4096] as const;
const DEFAULT_MEMORY_MB = 512;

export interface MachineShape {
    cpus: number;
    memoryMb: number;
    region: string;
}

export interface ComputeRates {
    sharedCpuHourlyUsd: number;
    ramGbHourlyUsd: number;
}

function positiveNumber(raw: string | undefined): number | null {
    const value = Number(raw);
    return raw !== undefined && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

export function computeRatesFromEnv(env: NodeJS.ProcessEnv = process.env): ComputeRates | null {
    const cpu = positiveNumber(env.COMPUTE_SHARED_CPU_HOURLY_USD);
    const ram = positiveNumber(env.COMPUTE_RAM_GB_HOURLY_USD);
    return cpu !== null && ram !== null ? { sharedCpuHourlyUsd: cpu, ramGbHourlyUsd: ram } : null;
}

export function computeRegionsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
    const raw = env.COMPUTE_REGIONS || env.FLY_REGION || 'iad';
    return [...new Set(raw.split(',').map((r) => r.trim()).filter(Boolean))];
}

/** The shape lib/compute/runtime.ts deploys: one shared vCPU and the requested memory. */
export function machineShape(memoryMb?: number, region?: string): MachineShape {
    return {
        cpus: 1,
        memoryMb: memoryMb && memoryMb > 0 ? memoryMb : DEFAULT_MEMORY_MB,
        region: region || computeRegionsFromEnv()[0],
    };
}

const marketplaceRegion = (region: string) => `cencori-${region}`;
const instanceType = (shape: Pick<MachineShape, 'cpus' | 'memoryMb'>) =>
    `cencori-shared-${shape.cpus}x-${shape.memoryMb}mb`;

export function toComputeMarketplaceRows(rates: ComputeRates, regions: string[]): ComputePrice[] {
    const rows: ComputePrice[] = [];
    for (const region of regions) {
        for (const memoryMb of COMPUTE_MEMORY_TIERS_MB) {
            rows.push({
                provider: 'Base',
                service: 'BaseCompute',
                region: marketplaceRegion(region),
                instance_type: instanceType({ cpus: 1, memoryMb }),
                usage_type: 'ONDEMAND',
                operating_system: 'linux',
                cpu_cores: 1,
                ram_gb: memoryMb / 1024,
                cpu_cores_cost_per_hour: rates.sharedCpuHourlyUsd,
                ram_gb_cost_per_hour: rates.ramGbHourlyUsd,
                period_billing_hours: 1,
                currency: 'USD',
                tags: { cencori_compute: true, runtime_region: region, cpu_kind: 'shared' },
            });
        }
    }
    return rows;
}

/** Upsert our machine rates. CostGraph keys compute rows on their natural key, so this is idempotent. */
export async function publishComputeRates(
    client: CostGraphPricingClient,
    rates: ComputeRates,
    regions: string[],
): Promise<{ published: number }> {
    const rows = toComputeMarketplaceRows(rates, regions);
    if (rows.length === 0) return { published: 0 };
    const response = await client.publishComputePrices(rows);
    return { published: response?.data?.length ?? rows.length };
}

/**
 * The catalogue machine recommendations are anchored on.
 *
 * CostGraph needs a machine it can price as the starting point, and a `Base` shape is not one:
 * verified live 2026-10-14, pricing it returns 404 `price_not_found` and recommending from it
 * returns 500. So the anchor is an AWS Graviton burstable in the AWS region nearest our runtime
 * region. The requested shape travels separately as `usage`; the anchor only fixes the continent,
 * the machine class and a price ceiling — savings are computed against what we pay, never
 * against this machine.
 *
 * The ceiling matters: CostGraph only returns machines cheaper than the anchor (verified live —
 * a t4g.nano anchor for 1 vCPU/512 MB in us-east-1 returned 3 clouds, a t4g.medium returned 14).
 * So the anchor sits a size or two above the shape, but stays burstable: a general-purpose anchor
 * (m7g.large) switches the class CostGraph matches and returns pricier, unrelated machines.
 */
const AWS_REGION_FOR_RUNTIME: Record<string, string> = {
    iad: 'us-east-1', ewr: 'us-east-1', bos: 'us-east-1', atl: 'us-east-1', mia: 'us-east-1',
    ord: 'us-east-2', dfw: 'us-east-2', den: 'us-east-2',
    lax: 'us-west-1', sjc: 'us-west-1', sea: 'us-west-2',
    yyz: 'ca-central-1', yul: 'ca-central-1', gru: 'sa-east-1', scl: 'sa-east-1',
    lhr: 'eu-west-2', ams: 'eu-west-1', cdg: 'eu-west-3', fra: 'eu-central-1', waw: 'eu-central-1',
    arn: 'eu-north-1', mad: 'eu-south-2', otp: 'eu-central-1',
    jnb: 'af-south-1', bom: 'ap-south-1', sin: 'ap-southeast-1', syd: 'ap-southeast-2',
    nrt: 'ap-northeast-1', hkg: 'ap-east-1',
};

function anchorInstanceType(memoryMb: number): string {
    if (memoryMb <= 2048) return 't4g.medium'; // 4 GB
    if (memoryMb <= 4096) return 't4g.large'; // 8 GB
    return 't4g.xlarge'; // 16 GB
}

export function anchorMachine(shape: MachineShape): MachineQuery {
    return {
        provider: 'AWS',
        service: 'AmazonEC2',
        region: AWS_REGION_FOR_RUNTIME[shape.region] ?? 'us-east-1',
        instance_type: anchorInstanceType(shape.memoryMb),
        usage_type: 'ONDEMAND',
        operating_system: 'linux',
        vm: { cpu_cores: shape.cpus, ram_gb: shape.memoryMb / 1024 },
    };
}

/** What the shape costs us per hour at our configured rates, or null without them. */
export function currentHourlyCost(shape: MachineShape, rates: ComputeRates | null): number | null {
    if (!rates) return null;
    const hourly = shape.cpus * rates.sharedCpuHourlyUsd + (shape.memoryMb / 1024) * rates.ramGbHourlyUsd;
    return Math.round(hourly * 1e8) / 1e8;
}

export interface PlacementAlternative {
    provider: string;
    service: string;
    region: string;
    instanceType: string | null;
    cpuCores: number | null;
    ramGb: number | null;
    cpuClass: string | null;
    costPerHour: number | null;
    costPerMonth: number | null;
    /** Saving against what this shape costs us now; null when our rates are not configured. */
    savingsPercent: number | null;
}

export interface PlacementQuote {
    shape: MachineShape;
    /** What the shape costs us now, from our configured rates. */
    current: { costPerHour: number | null; costPerMonth: number | null; source: 'cencori_rates' | 'unavailable' };
    anchor: { provider: string; region: string; instanceType: string | null };
    alternatives: PlacementAlternative[];
}

const HOURS_PER_MONTH = 730;
const monthly = (hourly: number | null) => (hourly === null ? null : Math.round(hourly * HOURS_PER_MONTH * 100) / 100);

function toAlternative(rec: ComputeRecommendation, currentHourly: number | null): PlacementAlternative {
    const pricing = rec.pricing;
    const hourly = typeof pricing?.cost_per_hour === 'number' ? pricing.cost_per_hour : null;
    return {
        provider: pricing?.provider ?? 'unknown',
        service: pricing?.service ?? 'unknown',
        region: pricing?.region ?? 'unknown',
        instanceType: pricing?.instance_type ?? null,
        cpuCores: pricing?.cpu_cores ?? null,
        ramGb: pricing?.ram_gb ?? null,
        cpuClass: rec.cpu_class ?? null,
        costPerHour: hourly,
        costPerMonth: monthly(hourly),
        savingsPercent: hourly === null || !currentHourly
            ? null
            : Math.round(((currentHourly - hourly) / currentHourly) * 1000) / 10,
    };
}

/**
 * What a Compute machine shape costs us, and the cheapest equivalent per cloud on the same
 * continent as its runtime region.
 *
 * `providers` narrows the clouds considered (CostGraph provider names, e.g. "AWS", "Hetzner");
 * `anyContinent` drops the same-continent filter.
 */
export async function quotePlacement(
    client: CostGraphPricingClient,
    shape: MachineShape,
    options: { providers?: string[]; anyContinent?: boolean; rates?: ComputeRates | null } = {},
): Promise<PlacementQuote> {
    const rates = options.rates === undefined ? computeRatesFromEnv() : options.rates;
    const currentHourly = currentHourlyCost(shape, rates);
    const anchor = anchorMachine(shape);

    const recommendations = await client.recommendCompute({
        instance: anchor,
        usage: { cpu_cores: shape.cpus, ram_gb: shape.memoryMb / 1024 },
        predicates: {
            usage_types: ['ONDEMAND'],
            ...(options.anyContinent ? {} : { same_continent: true }),
            ...(options.providers?.length ? { providers: options.providers } : {}),
        },
    });

    return {
        shape,
        current: {
            costPerHour: currentHourly,
            costPerMonth: monthly(currentHourly),
            source: currentHourly === null ? 'unavailable' : 'cencori_rates',
        },
        anchor: { provider: anchor.provider, region: anchor.region, instanceType: anchor.instance_type ?? null },
        alternatives: (recommendations ?? [])
            .map((rec) => toAlternative(rec, currentHourly))
            .sort((a, b) => (a.costPerHour ?? Infinity) - (b.costPerHour ?? Infinity)),
    };
}
