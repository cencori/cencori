import yaml from 'js-yaml';
import type { IssueSeverity } from '../../packages/scan/src/scanner/core';

export interface CencoriConfig {
    version?: number;
    ignore?: string[];
    fail_on?: IssueSeverity[];
    rules?: Array<{
        id: string;
        severity: IssueSeverity;
    }>;
}

export const DEFAULT_CONFIG: CencoriConfig = {
    version: 1,
    ignore: [],
    fail_on: ['critical', 'high'],
    rules: [],
};

/**
 * Parse .cencori.yml content into a typed configuration object.
 * Falls back to DEFAULT_CONFIG on error or empty content.
 */
export function parseConfig(content: string): CencoriConfig {
    if (!content.trim()) {
        return DEFAULT_CONFIG;
    }

    try {
        const parsed = yaml.load(content) as Record<string, any>;

        if (!parsed || typeof parsed !== 'object') {
            return DEFAULT_CONFIG;
        }

        const config: CencoriConfig = { ...DEFAULT_CONFIG };

        if (Array.isArray(parsed.ignore)) {
            config.ignore = parsed.ignore.filter(i => typeof i === 'string');
        }

        if (Array.isArray(parsed.fail_on)) {
            const validSeverities: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
            config.fail_on = parsed.fail_on.filter((s: any) =>
                typeof s === 'string' && validSeverities.includes(s as IssueSeverity)
            ) as IssueSeverity[];
        }

        if (Array.isArray(parsed.rules)) {
            config.rules = parsed.rules.map((r: any) => {
                if (r && typeof r === 'object' && typeof r.id === 'string' && typeof r.severity === 'string') {
                    return { id: r.id, severity: r.severity as IssueSeverity };
                }
                return null;
            }).filter(Boolean) as any;
        }

        return config;
    } catch (error) {
        console.warn('[Config] Failed to parse .cencori.yml, using defaults:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * Check if a path should be ignored based on config ignore patterns.
 * Supports simple glob-like matching (* and **).
 */
export function shouldIgnoreWithConfig(filePath: string, config: CencoriConfig): boolean {
    const patterns = config.ignore || [];
    if (patterns.length === 0) return false;

    const normalized = filePath.replace(/\\/g, '/');

    return patterns.some(pattern => {
        // Very basic glob to regex conversion
        const regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special chars
            .replace(/\*\*/g, '(.+)')             // ** -> anything
            .replace(/\*/g, '([^/]+)');          // * -> anything but /

        try {
            const regex = new RegExp(`^${regexStr}$`);
            if (regex.test(normalized)) return true;

            // Also check if the pattern matches as a prefix (for directories)
            if (normalized.startsWith(pattern.endsWith('/') ? pattern : pattern + '/')) {
                return true;
            }
        } catch {
            // Fallback to simple inclusion if regex fails
            if (normalized.includes(pattern)) return true;
        }

        return false;
    });
}
