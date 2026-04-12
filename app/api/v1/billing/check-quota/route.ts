import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';
import { checkEndUserQuota } from '@/lib/end-user-billing';
import crypto from 'crypto';

function buildQuotaResponse(endUserId: string, quota: Awaited<ReturnType<typeof checkEndUserQuota>>) {
    return {
        allowed: quota.allowed,
        reason: quota.reason ?? null,
        end_user_id: endUserId,
        is_new_user: quota.isNewUser,
        rate_plan: quota.ratePlan ?? null,
        overage_action: quota.overageAction ?? null,
        retry_after_seconds: quota.retryAfterSeconds,
        usage: {
            daily_tokens: { used: quota.dailyTokensUsed, limit: quota.dailyTokensLimit },
            monthly_tokens: { used: quota.monthlyTokensUsed, limit: quota.monthlyTokensLimit },
            daily_requests: { used: quota.dailyRequestsUsed, limit: quota.dailyRequestsLimit },
            monthly_requests: { used: quota.monthlyRequestsUsed, limit: quota.monthlyRequestsLimit },
            requests_per_minute: {
                used: quota.requestsPerMinuteUsed,
                limit: quota.requestsPerMinuteLimit,
            },
        },
        billing: {
            markup_percentage: quota.markupPercentage,
            flat_rate_per_request: quota.flatRatePerRequest,
            allowed_models: quota.allowedModels,
        },
    };
}

// ──────────────────────────────────────────────
// GET — Check end-user quota before processing
// ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const apiKey = extractCencoriApiKeyFromHeaders(req.headers);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing API key. Provide CENCORI_API_KEY header or Authorization: Bearer <key>' },
                { status: 401 }
            );
        }

        const supabase = createAdminClient();
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id,
                environment,
                key_type,
                projects!inner(
                    id,
                    end_user_billing_enabled
                )
            `)
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const project = keyData.projects as unknown as {
            id: string;
            end_user_billing_enabled: boolean | null;
        };
        const environment = keyData.environment || 'production';

        if (!project.end_user_billing_enabled) {
            return NextResponse.json(
                { error: 'End-user billing is not enabled for this project' },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(req.url);
        const endUserId = searchParams.get('end_user_id');
        const model = searchParams.get('model') || undefined;

        if (!endUserId || endUserId.trim().length === 0) {
            return NextResponse.json(
                { error: 'end_user_id query parameter is required' },
                { status: 400 }
            );
        }

        const normalizedEndUserId = endUserId.trim();
        const quota = await checkEndUserQuota(project.id, normalizedEndUserId, model, environment);

        return NextResponse.json(buildQuotaResponse(normalizedEndUserId, quota));
    } catch (error) {
        console.error('[CheckQuota] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// POST — Same as GET but with body (convenience)
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const apiKey = extractCencoriApiKeyFromHeaders(req.headers);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing API key. Provide CENCORI_API_KEY header or Authorization: Bearer <key>' },
                { status: 401 }
            );
        }

        const supabase = createAdminClient();
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id,
                environment,
                key_type,
                projects!inner(
                    id,
                    end_user_billing_enabled
                )
            `)
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const project = keyData.projects as unknown as {
            id: string;
            end_user_billing_enabled: boolean | null;
        };
        const environment = keyData.environment || 'production';

        if (!project.end_user_billing_enabled) {
            return NextResponse.json(
                { error: 'End-user billing is not enabled for this project' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const endUserId = body.end_user_id;
        const model = body.model || undefined;

        if (!endUserId || typeof endUserId !== 'string' || endUserId.trim().length === 0) {
            return NextResponse.json(
                { error: 'end_user_id is required' },
                { status: 400 }
            );
        }

        const normalizedEndUserId = endUserId.trim();
        const quota = await checkEndUserQuota(project.id, normalizedEndUserId, model, environment);

        return NextResponse.json(buildQuotaResponse(normalizedEndUserId, quota));
    } catch (error) {
        console.error('[CheckQuota] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// OPTIONS — CORS preflight
// ──────────────────────────────────────────────

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, CENCORI_API_KEY',
            'Access-Control-Max-Age': '86400',
        },
    });
}
