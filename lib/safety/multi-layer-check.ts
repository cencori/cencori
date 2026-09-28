import { checkContent, SafetyResult, ContentFilterConfig } from './content-filter';
import { detectJailbreak, JailbreakDetectionResult, isJailbreakRisky } from './jailbreak-detector';
import { scanOutput, OutputScanResult, ScanContext, shouldBlockOutput } from './output-scanner';

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
    details?: {
        inputCheck?: SafetyResult;
        jailbreakCheck?: JailbreakDetectionResult;
        outputCheck?: OutputScanResult;
    };
}

export interface ProjectSecurityConfig {
    /** Explicit dashboard opt-in. Absent/false = every scanner below is off. */
    enabled?: boolean;
    inputThreshold?: number; // 0-1, default 0.5
    outputThreshold?: number; // 0-1, default 0.6 (more strict)
    jailbreakThreshold?: number; // 0-1, default 0.7
    enableOutputScanning?: boolean; // default false
    enableJailbreakDetection?: boolean; // default false
    enableObfuscatedPII?: boolean; // default false
    enableIntentAnalysis?: boolean; // default false
}

/**
 * Phase 1: Check input before sending to AI model
 */
export function checkInputSecurity(
    inputText: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    config?: ProjectSecurityConfig
): SecurityCheckResult {
    // No defaults: without an explicit opt-in config every scanner stays off
    // and the check is a pass-through (also skipping the regex work).
    const enableJailbreak = config?.enableJailbreakDetection ?? false;
    const enableObfuscatedPII = config?.enableObfuscatedPII ?? false;
    const enableIntentAnalysis = config?.enableIntentAnalysis ?? false;

    if (!enableJailbreak && !enableObfuscatedPII && !enableIntentAnalysis) {
        return {
            safe: true,
            reasons: [],
            layer: 'input',
            riskScore: 0,
            confidence: 1,
        };
    }

    // 1. Content filtering
    const contentFilterConfig: ContentFilterConfig = {
        threshold: config?.inputThreshold ?? 0.5,
        enableObfuscatedPII,
        enableIntentAnalysis,
    };

    const inputCheck = checkContent(inputText, contentFilterConfig);

    // 2. Jailbreak detection
    let jailbreakCheck: JailbreakDetectionResult | undefined;
    if (enableJailbreak) {
        jailbreakCheck = detectJailbreak(inputText, conversationHistory);
    }

    // Aggregate results
    const reasons: string[] = [];
    let totalRisk = 0;
    let layer: SecurityCheckResult['layer'] = 'input';

    // Input filtering results
    if (!inputCheck.safe) {
        reasons.push(...inputCheck.reasons.map(r => `[Input] ${r}`));
        totalRisk += (1 - inputCheck.score);
        layer = 'input';
    }

    // Jailbreak results
    if (jailbreakCheck && isJailbreakRisky(jailbreakCheck, config?.jailbreakThreshold)) {
        reasons.push(...jailbreakCheck.patterns.map(p => `[Jailbreak] ${p}`));
        totalRisk += jailbreakCheck.risk;
        layer = jailbreakCheck.risk > (1 - inputCheck.score) ? 'jailbreak' : 'multi';
    }

    const safe = inputCheck.safe && (!jailbreakCheck || !isJailbreakRisky(jailbreakCheck, config?.jailbreakThreshold));
    const riskScore = Math.min(totalRisk, 1.0);
    const confidence = Math.max(
        inputCheck.safe ? 0 : (1 - inputCheck.score),
        jailbreakCheck?.confidence || 0
    );

    return {
        safe,
        reasons,
        layer,
        riskScore,
        confidence,
        details: {
            inputCheck,
            jailbreakCheck,
        },
    };
}

/**
 * Phase 2: Check output from AI model before returning to user
 */
export function checkOutputSecurity(
    outputText: string,
    context: {
        inputText: string;
        inputSecurityResult?: SecurityCheckResult;
        conversationHistory?: Array<{ role: string; content: string }>;
    },
    config?: ProjectSecurityConfig
): SecurityCheckResult {
    const enableOutput = config?.enableOutputScanning ?? false;

    if (!enableOutput) {
        return {
            safe: true,
            reasons: [],
            layer: 'output',
            riskScore: 0,
            confidence: 0,
        };
    }

    // Scan output with context
    const scanContext: ScanContext = {
        inputText: context.inputText,
        jailbreakRisk: context.inputSecurityResult?.details?.jailbreakCheck?.risk,
        conversationHistory: context.conversationHistory,
    };

    const outputCheck = scanOutput(outputText, scanContext);

    const safe = !shouldBlockOutput(outputCheck);
    const reasons = outputCheck.reasons.map(r => `[Output] ${r}`);

    return {
        safe,
        reasons,
        layer: 'output',
        riskScore: outputCheck.riskScore,
        confidence: outputCheck.confidence,
        blockedContent: outputCheck.blockedContent,
        details: {
            outputCheck,
        },
    };
}

/**
 * Comprehensive security check combining all layers
 */
export async function comprehensiveSecurityCheck(params: {
    input: string;
    output?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    projectConfig?: ProjectSecurityConfig;
}): Promise<{
    inputResult: SecurityCheckResult;
    outputResult?: SecurityCheckResult;
    overallSafe: boolean;
}> {
    // Phase 1: Check input
    const inputResult = checkInputSecurity(
        params.input,
        params.conversationHistory,
        params.projectConfig
    );

    // Phase 2: Check output (if provided)
    let outputResult: SecurityCheckResult | undefined;
    if (params.output) {
        outputResult = checkOutputSecurity(
            params.output,
            {
                inputText: params.input,
                inputSecurityResult: inputResult,
                conversationHistory: params.conversationHistory,
            },
            params.projectConfig
        );
    }

    const overallSafe = inputResult.safe && (!outputResult || outputResult.safe);

    return {
        inputResult,
        outputResult,
        overallSafe,
    };
}
