"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProviderSettings {
    default_provider?: string;
    default_model?: string;
    requests_per_minute?: number;
    tokens_per_day?: number;
    concurrent_requests?: number;
    enable_fallback?: boolean;
    fallback_provider?: string;
    max_retries_before_fallback?: number;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const body: ProviderSettings = await request.json();

        const { data: project, error: projectError } = await supabaseAdmin
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 }
            );
        }

        const { data: existingSettings } = await supabaseAdmin
            .from("project_settings")
            .select("id")
            .eq("project_id", projectId)
            .single();

        if (existingSettings) {
            const { error: updateError } = await supabaseAdmin
                .from("project_settings")
                .update({
                    default_provider: body.default_provider,
                    default_model: body.default_model,
                    requests_per_minute: body.requests_per_minute,
                    tokens_per_day: body.tokens_per_day,
                    concurrent_requests: body.concurrent_requests,
                    enable_fallback: body.enable_fallback,
                    fallback_provider: body.fallback_provider,
                    max_retries_before_fallback: body.max_retries_before_fallback,
                    updated_at: new Date().toISOString(),
                })
                .eq("project_id", projectId);

            if (updateError) {
                console.error("Error updating settings:", updateError);
                return NextResponse.json(
                    { error: "Failed to update settings" },
                    { status: 500 }
                );
            }
        } else {
            const { error: insertError } = await supabaseAdmin
                .from("project_settings")
                .insert({
                    project_id: projectId,
                    default_provider: body.default_provider || "openai",
                    default_model: body.default_model || "gpt-4o",
                    requests_per_minute: body.requests_per_minute || 60,
                    tokens_per_day: body.tokens_per_day || 1000000,
                    concurrent_requests: body.concurrent_requests || 10,
                    enable_fallback: body.enable_fallback ?? true,
                    fallback_provider: body.fallback_provider || "anthropic",
                    max_retries_before_fallback: body.max_retries_before_fallback || 3,
                });

            if (insertError) {
                console.error("Error inserting settings:", insertError);
                return NextResponse.json(
                    { error: "Failed to save settings" },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in settings PATCH:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        const { data: settings, error } = await supabaseAdmin
            .from("project_settings")
            .select("*")
            .eq("project_id", projectId)
            .single();

        if (error && error.code !== "PGRST116") {
            console.error("Error fetching settings:", error);
            return NextResponse.json(
                { error: "Failed to fetch settings" },
                { status: 500 }
            );
        }
        return NextResponse.json({
            settings: settings || {
                default_provider: "openai",
                default_model: "gpt-4o",
                requests_per_minute: 60,
                tokens_per_day: 1000000,
                concurrent_requests: 10,
                enable_fallback: true,
                fallback_provider: "anthropic",
                max_retries_before_fallback: 3,
            },
        });
    } catch (error) {
        console.error("Error in settings GET:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
