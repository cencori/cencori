export interface SecurityCheckResult {
    safe: boolean;
    reasons: string[];
    layer: 'input' | 'output' | 'jailbreak' | 'multi';
    riskScore: number;
    confidence: number;
    blockedContent?: {
        type: string;
        examples: string[];
    };
}

export interface JailbreakDetectionResult {
    risk: number; // 0-1
    patterns: string[];
    confidence: number;
    category?: 'social_engineering' | 'system_extraction' | 'behavioral_probe' | 'indirect_pii' | 'multi_vector';
}

export interface OutputScanResult {
    safe: boolean;
    reasons: string[];
    blockedContent?: {
        type: string;
        examples: string[];
    };
    riskScore: number;
    confidence: number;
}

export interface ProjectSecurityConfig {
    inputThreshold?: number; // 0-1, default 0.5
    outputThreshold?: number; // 0-1, default 0.6 (more strict)
    jailbreakThreshold?: number; // 0-1, default 0.7
    enableOutputScanning?: boolean; // default true
    enableJailbreakDetection?: boolean; // default true
    enableObfuscatedPII?: boolean; // default true
    enableIntentAnalysis?: boolean; // default true
}

export interface SecurityIncident {
    id: string;
    project_id: string;
    ai_request_id?: string;
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
    created_at: string;
    reviewed: boolean;
    reviewed_at?: string;
    reviewed_by?: string;
    notes?: string;
}
