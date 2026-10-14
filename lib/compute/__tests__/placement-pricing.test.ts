/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
    anchorMachine,
    computeRatesFromEnv,
    machineShape,
    quotePlacement,
    toComputeMarketplaceRows,
} from '@/lib/compute/placement-pricing';
import type { CostGraphPricingClient } from '@/lib/finops/costgraph';

describe('computeRatesFromEnv', () => {
    it('needs both rates, and never invents one', () => {
        expect(computeRatesFromEnv({ COMPUTE_SHARED_CPU_HOURLY_USD: '0.003' } as NodeJS.ProcessEnv)).toBeNull();
        expect(computeRatesFromEnv({ COMPUTE_SHARED_CPU_HOURLY_USD: '0.003', COMPUTE_RAM_GB_HOURLY_USD: 'abc' } as NodeJS.ProcessEnv)).toBeNull();
        expect(computeRatesFromEnv({ COMPUTE_SHARED_CPU_HOURLY_USD: '0.003', COMPUTE_RAM_GB_HOURLY_USD: '0.006' } as NodeJS.ProcessEnv))
            .toEqual({ sharedCpuHourlyUsd: 0.003, ramGbHourlyUsd: 0.006 });
    });
});

describe('toComputeMarketplaceRows', () => {
    it('publishes every memory tier per region, priced per resource', () => {
        const rows = toComputeMarketplaceRows({ sharedCpuHourlyUsd: 0.003, ramGbHourlyUsd: 0.006 }, ['iad', 'lhr']);
        expect(rows).toHaveLength(10);
        expect(rows[1]).toMatchObject({
            service: 'BaseCompute',
            region: 'cencori-iad',
            instance_type: 'cencori-shared-1x-512mb',
            cpu_cores: 1,
            ram_gb: 0.5,
            period_billing_hours: 1,
        });
        // Only one side is sent so CostGraph derives cost_per_hour instead of checking agreement.
        expect(rows[1].cost_per_hour).toBeUndefined();
    });
});

describe('anchorMachine', () => {
    /** A Base shape cannot anchor: CostGraph 404s pricing it and 500s recommending from it. */
    it('anchors on a priceable AWS burstable near the runtime region', () => {
        expect(anchorMachine(machineShape(512, 'iad'))).toMatchObject({ provider: 'AWS', region: 'us-east-1', instance_type: 't4g.medium' });
        expect(anchorMachine(machineShape(2048, 'fra'))).toMatchObject({ region: 'eu-central-1', instance_type: 't4g.medium' });
        expect(anchorMachine(machineShape(4096, 'xyz'))).toMatchObject({ region: 'us-east-1', instance_type: 't4g.large' });
    });

    /** CostGraph only returns machines cheaper than the anchor, so it must sit above the shape. */
    it('keeps the anchor above the requested shape, which travels as the vm size', () => {
        expect(anchorMachine(machineShape(256, 'iad')).vm).toEqual({ cpu_cores: 1, ram_gb: 0.25 });
    });
});

describe('quotePlacement', () => {
    const shape = machineShape(512, 'iad');
    const rates = { sharedCpuHourlyUsd: 0.004, ramGbHourlyUsd: 0.004 };

    function client() {
        return {
            recommendCompute: vi.fn(async () => [
                { pricing: { provider: 'Hetzner', service: 'HetznerCompute', region: 'ash', instance_type: 'cpx11', cpu_cores: 2, ram_gb: 2, cost_per_hour: 0.00864 }, savings: { percentage: 48 } },
                { pricing: { provider: 'Vultr', service: 'VultrCompute', region: 'atl', instance_type: 'vc2-1c-0.5gb-v6', cpu_cores: 1, ram_gb: 0.5, cost_per_hour: 0.003 }, savings: { percentage: 82 }, cpu_class: 'burstable' },
            ]),
        };
    }

    it('measures savings against what we pay, not against the anchor', async () => {
        const c = client();
        const quote = await quotePlacement(c as unknown as CostGraphPricingClient, shape, { rates });

        // 1 vCPU × 0.004 + 0.5 GB × 0.004 = 0.006/h
        expect(quote.current).toEqual({ costPerHour: 0.006, costPerMonth: 4.38, source: 'cencori_rates' });
        expect(quote.alternatives.map((a) => a.provider)).toEqual(['Vultr', 'Hetzner']);
        expect(quote.alternatives[0].savingsPercent).toBe(50);
        expect(quote.alternatives[1].savingsPercent).toBe(-44);
    });

    it('stays on the same continent unless told otherwise', async () => {
        const c = client();
        await quotePlacement(c as unknown as CostGraphPricingClient, shape, { rates, providers: ['AWS'] });
        expect(c.recommendCompute.mock.calls[0][0]).toMatchObject({
            instance: { provider: 'AWS', instance_type: 't4g.medium' },
            usage: { cpu_cores: 1, ram_gb: 0.5 },
            predicates: { providers: ['AWS'], usage_types: ['ONDEMAND'], same_continent: true },
        });

        await quotePlacement(c as unknown as CostGraphPricingClient, shape, { rates, anyContinent: true });
        expect(c.recommendCompute.mock.calls[1][0].predicates).not.toHaveProperty('same_continent');
    });

    it('lists alternatives without a saving when our rates are not configured', async () => {
        const quote = await quotePlacement(client() as unknown as CostGraphPricingClient, shape, { rates: null });
        expect(quote.current.source).toBe('unavailable');
        expect(quote.alternatives.every((a) => a.savingsPercent === null)).toBe(true);
    });
});
