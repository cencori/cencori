/**
 * Country of a client IP, from the public-domain ip-location-db tables
 * (@ip-location-db/geo-whois-asn-country, CC0). Vercel used to hand us the
 * country in a header; Brimble's Lagos edge only forwards the IP
 * (X-Real-IP / X-Forwarded-For), so we look it up ourselves.
 *
 * The tables load lazily on first use: IPv4 is ~330k ranges (~4 MB in typed
 * arrays), IPv6 loads only when an IPv6 address is first seen and is keyed
 * on the upper 64 bits, which is where registries allocate.
 */

import { readFileSync } from 'fs';
import path from 'path';

const SHIFT_64 = BigInt(64);
const SHIFT_16 = BigInt(16);
const ZERO = BigInt(0);
const DATA_DIR = path.join(process.cwd(), 'node_modules', '@ip-location-db', 'geo-whois-asn-country');

type V4Table = { starts: Uint32Array; ends: Uint32Array; countries: string[] };
type V6Table = { starts: BigUint64Array; ends: BigUint64Array; countries: string[] };

let v4: V4Table | null | undefined;
let v6: V6Table | null | undefined;

function readRows(file: string): string[] | null {
    try {
        return readFileSync(path.join(DATA_DIR, file), 'utf8').split('\n').filter(Boolean);
    } catch (error) {
        console.error('[ip-country] could not load', file, error instanceof Error ? error.message : error);
        return null;
    }
}

function loadV4(): V4Table | null {
    if (v4 !== undefined) return v4;
    const rows = readRows('geo-whois-asn-country-ipv4-num.csv');
    if (!rows) return (v4 = null);
    const starts = new Uint32Array(rows.length);
    const ends = new Uint32Array(rows.length);
    const countries = new Array<string>(rows.length);
    rows.forEach((row, i) => {
        const [start, end, country] = row.split(',');
        starts[i] = Number(start);
        ends[i] = Number(end);
        countries[i] = country;
    });
    return (v4 = { starts, ends, countries });
}

function loadV6(): V6Table | null {
    if (v6 !== undefined) return v6;
    const rows = readRows('geo-whois-asn-country-ipv6-num.csv');
    if (!rows) return (v6 = null);
    const starts = new BigUint64Array(rows.length);
    const ends = new BigUint64Array(rows.length);
    const countries = new Array<string>(rows.length);
    rows.forEach((row, i) => {
        const [start, end, country] = row.split(',');
        starts[i] = BigInt(start) >> SHIFT_64;
        ends[i] = BigInt(end) >> SHIFT_64;
        countries[i] = country;
    });
    return (v6 = { starts, ends, countries });
}

function search<T extends number | bigint>(starts: ArrayLike<T>, ends: ArrayLike<T>, value: T): number {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (value < starts[mid]) hi = mid - 1;
        else if (value > ends[mid]) lo = mid + 1;
        else return mid;
    }
    return -1;
}

function parseV4(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        const octet = Number(part);
        if (!/^\d{1,3}$/.test(part) || octet > 255) return null;
        value = value * 256 + octet;
    }
    return value;
}

/** Upper 64 bits of an IPv6 address, or null if it isn't one. */
function parseV6High(ip: string): bigint | null {
    if (!ip.includes(':')) return null;
    const [head, tail = ''] = ip.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    if (!ip.includes('::') && headGroups.length !== 8) return null;
    const groups = [...headGroups, ...new Array(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill('0'), ...tailGroups];
    if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
    return groups.slice(0, 4).reduce((acc, g) => (acc << SHIFT_16) | BigInt(parseInt(g, 16)), ZERO);
}

/** ISO 3166 alpha-2 country for an IP address, or null when unknown or private. */
export function countryForIp(ip: string | null | undefined): string | null {
    const value = ip?.trim().replace(/^::ffff:/i, '');
    if (!value) return null;

    const asV4 = parseV4(value);
    if (asV4 !== null) {
        const table = loadV4();
        if (!table) return null;
        const index = search(table.starts, table.ends, asV4);
        return index >= 0 ? table.countries[index] : null;
    }

    const asV6 = parseV6High(value);
    if (asV6 !== null) {
        const table = loadV6();
        if (!table) return null;
        const index = search(table.starts, table.ends, asV6);
        return index >= 0 ? table.countries[index] : null;
    }
    return null;
}

/**
 * Country of the client behind a request: the platform's own header when it
 * sends one (Vercel, Cloudflare), else a lookup of the forwarded client IP.
 */
export function requestCountry(headers: Headers): string | null {
    const platform = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry');
    if (platform && platform !== 'XX') return platform;
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip');
    return countryForIp(ip);
}
