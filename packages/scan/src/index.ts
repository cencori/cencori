/**
 * Cencori Vibe Check
 * Security scanner for AI apps
 */

export { scan, type ScanResult, type ScanIssue } from './scanner/index.js';
export {
    SECRET_PATTERNS,
    PII_PATTERNS,
    ROUTE_PATTERNS,
    type SecretPattern,
    type PIIPattern,
    type RoutePattern,
} from './scanner/patterns.js';
