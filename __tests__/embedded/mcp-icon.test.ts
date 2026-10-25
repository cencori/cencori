import { describe, expect, it } from 'vitest';
import { brandDomain, readStoredIcon } from '@/lib/embedded/mcp-icon';

describe('MCP server icons', () => {
    it('finds the brand domain behind an MCP endpoint', () => {
        expect(brandDomain('https://mcp.linear.app/mcp')).toBe('linear.app');
        expect(brandDomain('https://api.githubcopilot.com/mcp/')).toBe('githubcopilot.com');
        expect(brandDomain('https://mcp.atlassian.com/v1/mcp')).toBe('atlassian.com');
        expect(brandDomain('https://example.com/mcp')).toBe('example.com');
        expect(brandDomain('https://mcp.app/mcp')).toBe('mcp.app');
    });

    it('accepts only small image data URLs back from config', () => {
        expect(readStoredIcon('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
        expect(readStoredIcon('data:image/svg+xml;base64,PHN2Zz4=')).toBe('data:image/svg+xml;base64,PHN2Zz4=');
        expect(readStoredIcon('https://evil.example.com/x.png')).toBeNull();
        expect(readStoredIcon('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
        expect(readStoredIcon(`data:image/png;base64,${'A'.repeat(40_000)}`)).toBeNull();
    });
});
