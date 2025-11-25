// API Types for Audit Dashboard Endpoints

// ============================================
// Request Logs Types
// ============================================

export interface RequestLog {
    id: string;
    created_at: string;
    status: 'success' | 'filtered' | 'blocked_output' | 'error';
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
    safety_score: number | null;
    error_message: string | null;
    filtered_reasons: string[] | null;
    request_preview: string;
    environment?: 'production' | 'test';
}

export interface RequestLogDetail extends RequestLog {
    request_payload: {
        messages?: Array<{ role: string; content: string }>;
        model?: string;
        temperature?: number;
        [key: string]: unknown;
    };
    response_payload: {
        text?: string;
        blocked?: boolean;
        blocked_content?: unknown;
        [key: string]: unknown;
    } | null;
    api_key_id: string;
}

export interface RequestLogsQuery {
    status?: 'success' | 'filtered' | 'blocked_output' | 'error' | 'all';
    model?: string;
    environment?: 'production' | 'test';
    timeRange?: '1h' | '24h' | '7d' | '30d' | 'custom';
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    perPage?: number;
}

export interface RequestLogsResponse {
    requests: RequestLog[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
    summary: {
        totalRequests: number;
        successRate: number;
        avgLatency: number;
        totalCost: number;
    };
}

// ============================================
// Security Incidents Types
// ============================================

export interface SecurityIncident {
    id: string;
    created_at: string;
    incident_type: 'jailbreak' | 'pii_input' | 'pii_output' | 'harmful_content' | 'instruction_leakage' | 'prompt_injection' | 'multi_vector';
    severity: 'low' | 'medium' | 'high' | 'critical';
    blocked_at: 'input' | 'output' | 'both';
    detection_method: string;
    risk_score: number;
    confidence: number;
    details: {
        patterns_detected?: string[];
        blocked_content?: {
            type: string;
            examples: string[];
        };
        reasons?: string[];
        input_preview?: string;
        output_preview?: string;
    };
    reviewed: boolean;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    notes?: string | null;
    ai_request_id?: string | null;
}

export interface SecurityIncidentsQuery {
    severity?: 'low' | 'medium' | 'high' | 'critical' | 'all';
    type?: SecurityIncident['incident_type'] | 'all';
    reviewed?: boolean;
    timeRange?: '1h' | '24h' | '7d' | '30d' | 'custom';
    startDate?: string;
    endDate?: string;
    page?: number;
    perPage?: number;
}

export interface SecurityIncidentsResponse {
    incidents: SecurityIncident[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        totalUnreviewed: number;
    };
}

export interface UpdateIncidentRequest {
    reviewed?: boolean;
    notes?: string;
}

// ============================================
// Analytics Types
// ============================================

export interface TimeSeriesDataPoint {
    timestamp: string;
    success: number;
    filtered: number;
    blocked_output: number;
    errors: number;
    total: number;
}

export interface ModelUsage {
    model: string;
    count: number;
    percentage: number;
    totalCost: number;
    avgLatency: number;
}

export interface SecuritySummary {
    jailbreakAttempts: number;
    piiBlocks: number;
    promptInjections: number;
    falsePositives: number;
    totalIncidents: number;
    criticalIncidents: number;
}

export interface TopBlockedPattern {
    pattern: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnalyticsQuery {
    timeRange?: '1h' | '24h' | '7d' | '30d' | 'custom';
    startDate?: string;
    endDate?: string;
    granularity?: 'hour' | 'day' | 'week';
}

export interface AnalyticsResponse {
    timeRange: {
        start: string;
        end: string;
    };
    metrics: {
        totalRequests: number;
        successfulRequests: number;
        filteredRequests: number;
        blockedOutputRequests: number;
        errorRequests: number;
        successRate: number;
        blockRate: number;
        avgLatencyMs: number;
        p50LatencyMs: number;
        p95LatencyMs: number;
        p99LatencyMs: number;
        totalCostUsd: number;
        avgCostPerRequest: number;
        totalTokens: number;
        avgTokensPerRequest: number;
    };
    timeSeries: TimeSeriesDataPoint[];
    modelUsage: ModelUsage[];
    securitySummary: SecuritySummary;
    topBlockedPatterns: TopBlockedPattern[];
    costByModel: Array<{
        model: string;
        totalCost: number;
        percentage: number;
    }>;
}

// ============================================
// Error Response Types
// ============================================

export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
}
