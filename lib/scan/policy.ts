const FALSE_VALUES = new Set(["0", "false", "off", "no", "disabled"]);
const TRUE_VALUES = new Set(["1", "true", "on", "yes", "enabled"]);

function parseBooleanFlag(raw: string | undefined): boolean | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    if (FALSE_VALUES.has(normalized)) return false;
    if (TRUE_VALUES.has(normalized)) return true;
    return null;
}

/**
 * Scan enforcement policy.
 *
 * Defaults to strict enforcement. Set SCAN_STRICT_ENFORCEMENT=false
 * to temporarily relax enforcement during incidents.
 */
export function isScanStrictEnforcementEnabled(): boolean {
    const parsed = parseBooleanFlag(process.env.SCAN_STRICT_ENFORCEMENT);
    if (parsed !== null) return parsed;
    return true;
}

