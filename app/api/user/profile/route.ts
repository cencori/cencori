"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();

        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch profile from user_profiles table
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        // If no profile exists, return defaults with auth data
        if (profileError && profileError.code === "PGRST116") {
            return NextResponse.json({
                profile: {
                    id: user.id,
                    first_name: user.user_metadata?.name?.split(" ")[0] || null,
                    last_name: user.user_metadata?.name?.split(" ").slice(1).join(" ") || null,
                    username: null,
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
                    email: user.email,
                },
            });
        }

        if (profileError) {
            console.error("Error fetching profile:", profileError);
            return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
        }

        return NextResponse.json({
            profile: {
                ...profile,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Error in profile GET:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();
        const body = await request.json();

        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { first_name, last_name, username, avatar_url } = body;

        // Check if username is taken (if provided)
        if (username) {
            const { data: existingUser } = await supabaseAdmin
                .from("user_profiles")
                .select("id")
                .eq("username", username)
                .neq("id", user.id)
                .single();

            if (existingUser) {
                return NextResponse.json({ error: "Username already taken" }, { status: 400 });
            }
        }

        // Check if profile exists
        const { data: existingProfile } = await supabaseAdmin
            .from("user_profiles")
            .select("id")
            .eq("id", user.id)
            .single();

        if (existingProfile) {
            // Update existing profile
            const { error: updateError } = await supabaseAdmin
                .from("user_profiles")
                .update({
                    first_name,
                    last_name,
                    username,
                    avatar_url,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (updateError) {
                console.error("Error updating profile:", updateError);
                return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
            }
        } else {
            // Insert new profile
            const { error: insertError } = await supabaseAdmin
                .from("user_profiles")
                .insert({
                    id: user.id,
                    first_name,
                    last_name,
                    username,
                    avatar_url,
                });

            if (insertError) {
                console.error("Error inserting profile:", insertError);
                return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in profile PATCH:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();

        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Delete user profile first (cascades may also handle this)
        await supabaseAdmin
            .from("user_profiles")
            .delete()
            .eq("id", user.id);

        // Delete user from auth
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error("Error deleting user:", deleteError);
            return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in profile DELETE:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
