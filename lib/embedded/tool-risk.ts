export type ToolRisk = 'read' | 'write' | 'destructive';
export type ApprovalDecision = 'auto' | 'required';

export interface ToolClassification {
    risk: ToolRisk;
    idempotent: boolean;
    openWorld: boolean;
    approval: ApprovalDecision;
}

// High-risk categories requiring approval by default (PRD §8.8).
const APPROVAL_REQUIRED_PATTERNS = [
    /send/i, /email/i, /gmail/i,
    /delete/i, /destroy/i, /drop/i,
    /payment/i, /invoice/i, /charge/i, /refund/i, /payroll/i, /financial/i,
    /provision/i, /identity/i, /account.*creat/i,
    /domain/i, /purchase/i, /compliance/i,
    /write/i, /update/i, /create/i,
];

const READ_PATTERNS = [/^(get|list|read|search|fetch|describe|show|lookup|query)/i, /read_only/i];

const IDEMPOTENT_PATTERNS = [/^(get|list|read|search|fetch|describe|show)/i];

export function classifyTool(toolName: string, annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }): ToolClassification {
    if (annotations?.destructiveHint) {
        return { risk: 'destructive', idempotent: false, openWorld: annotations.openWorldHint ?? true, approval: 'required' };
    }
    if (annotations?.readOnlyHint) {
        return { risk: 'read', idempotent: annotations.idempotentHint ?? true, openWorld: annotations.openWorldHint ?? false, approval: 'auto' };
    }
    if (READ_PATTERNS.some((re) => re.test(toolName))) {
        return { risk: 'read', idempotent: true, openWorld: false, approval: 'auto' };
    }
    const needsApproval = APPROVAL_REQUIRED_PATTERNS.some((re) => re.test(toolName));
    const destructive = /delete|destroy|drop|destructive/i.test(toolName);
    return {
        risk: destructive ? 'destructive' : 'write',
        idempotent: IDEMPOTENT_PATTERNS.some((re) => re.test(toolName)),
        openWorld: true,
        approval: needsApproval || destructive ? 'required' : 'required',
    };
}

/** Default policy: read auto-executes; everything else requires installation permission + approval. */
export function defaultApprovalPolicy(toolName: string): { write: string; destructive: string } {
    const c = classifyTool(toolName);
    void c;
    return { write: 'required', destructive: 'required' };
}
