import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";
import OpenAI from "openai";
import {
    calculateTokenCharge,
    chargeProjectUsageCredits,
    parseCreditsBalance,
    shouldEnforceProjectCredits,
} from "@/lib/project-credit-billing";

/**
 * Dashboard API: Semantic search in a namespace
 */

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteParams = { params: Promise<{ projectId: string }> };

// GET: Search memories semantically
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const { searchParams } = new URL(request.url);
        const namespaceName = searchParams.get("namespace");
        const query = searchParams.get("query");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

        if (!namespaceName || !query) {
            return NextResponse.json({ error: "namespace and query params required" }, { status: 400 });
        }

        // Verify access
        const { data: project } = await adminClient
            .from("projects")
            .select("id, organization_id, organizations!inner(subscription_tier, credits_balance, billing_frozen)")
            .eq("id", projectId)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const organization = project.organizations as unknown as {
            subscription_tier: string | null;
            credits_balance: number | string | null;
            billing_frozen: boolean | null;
        };
        const tier = organization?.subscription_tier || "free";
        const billingFrozen = Boolean(organization?.billing_frozen);
        const creditsBalance = parseCreditsBalance(organization?.credits_balance);
        const shouldEnforceCredits = shouldEnforceProjectCredits(tier);

        if (billingFrozen) {
            return NextResponse.json(
                {
                    error: "Billing account frozen",
                    message: "Billing is currently frozen for this organization. Contact support.",
                },
                { status: 403 }
            );
        }

        if (shouldEnforceCredits && creditsBalance <= 0) {
            return NextResponse.json(
                {
                    error: "Credit balance exhausted",
                    message: "Your organization has run out of credits. Top up to continue.",
                    balance: 0,
                },
                { status: 403 }
            );
        }

        const { data: member } = await adminClient
            .from("organization_members")
            .select("role")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        if (!member) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Get namespace ID
        const { data: namespace } = await adminClient
            .from("memory_namespaces")
            .select("id")
            .eq("name", namespaceName)
            .eq("project_id", projectId)
            .single();

        if (!namespace) {
            return NextResponse.json({ error: "Namespace not found" }, { status: 404 });
        }

        // Get project's OpenAI key for embeddings
        const { data: providerKey } = await adminClient
            .from("project_provider_keys")
            .select("encrypted_key")
            .eq("project_id", projectId)
            .eq("provider", "openai")
            .single();

        // Use project key or fallback to platform key
        const openaiKey = providerKey?.encrypted_key || process.env.OPENAI_API_KEY;

        if (!openaiKey) {
            return NextResponse.json({ error: "No OpenAI API key configured" }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey: openaiKey });

        // Generate embedding for query
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        const promptTokens = embeddingResponse.usage?.prompt_tokens ?? 0;
        const totalTokens = embeddingResponse.usage?.total_tokens ?? promptTokens;
        const { cencoriChargeUsd } = await calculateTokenCharge(
            "openai",
            "text-embedding-3-small",
            totalTokens,
            0
        );

        const charged = await chargeProjectUsageCredits(
            project.organization_id,
            tier,
            cencoriChargeUsd,
            "projects/memory/search"
        );

        if (!charged) {
            return NextResponse.json(
                {
                    error: "INSUFFICIENT_CREDITS",
                    message: "Unable to charge credits for this request.",
                },
                { status: 402 }
            );
        }

        // Search using pgvector
        const { data: results, error } = await adminClient.rpc("match_memories", {
            query_embedding: queryEmbedding,
            p_namespace_id: namespace.id,
            match_threshold: 0.5,
            match_count: limit,
        });

        if (error) {
            console.error("Error searching memories:", error);
            return NextResponse.json({ error: "Search failed" }, { status: 500 });
        }

        return NextResponse.json({ results: results || [] });
    } catch (error) {
        console.error("Error in memory search:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
