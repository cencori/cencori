import { describe, expect, it } from 'vitest';
import { USAGE_MARKUP_PERCENT, withUsageMarkup } from '@/lib/billing/usage-markup';

describe('usage markup', () => {
  it('charges provider cost plus 5%', () => {
    expect(USAGE_MARKUP_PERCENT).toBe(5);
    expect(withUsageMarkup(1)).toBeCloseTo(1.05, 12);
    expect(withUsageMarkup(0.000002)).toBeCloseTo(0.0000021, 15);
  });

  it('charges nothing for free or invalid costs', () => {
    expect(withUsageMarkup(0)).toBe(0);
    expect(withUsageMarkup(-1)).toBe(0);
    expect(withUsageMarkup(Number.NaN)).toBe(0);
  });
});
