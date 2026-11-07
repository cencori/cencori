import { describe, expect, it } from 'vitest';
import { defaultCurrencyForCountry } from '@/hooks/useDisplayCurrency';
import { requestCountry } from '@/lib/geo/ip-country';

describe('default display currency by location', () => {
  it('shows naira in Nigeria and dollars everywhere else', () => {
    expect(defaultCurrencyForCountry('NG')).toBe('NGN');
    expect(defaultCurrencyForCountry('ng')).toBe('NGN');
    expect(defaultCurrencyForCountry('US')).toBe('USD');
    expect(defaultCurrencyForCountry('GB')).toBe('USD');
    expect(defaultCurrencyForCountry(null)).toBe('USD');
  });

  it('resolves country from the platform header, then the client IP', () => {
    expect(requestCountry(new Headers({ 'cf-ipcountry': 'NG' }))).toBe('NG');
    expect(requestCountry(new Headers({ 'x-vercel-ip-country': 'US' }))).toBe('US');
    expect(defaultCurrencyForCountry(requestCountry(new Headers({ 'x-forwarded-for': '102.89.0.1' })))).toBe('NGN');
    expect(defaultCurrencyForCountry(requestCountry(new Headers({ 'x-forwarded-for': '8.8.8.8' })))).toBe('USD');
  });
});
