"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "avatars";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, GIF, or WebP." }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
        }

        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${Date.now()}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data: existingFiles } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(user.id);

        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
            await supabaseAdmin.storage.from(BUCKET_NAME).remove(filesToDelete);
        }

        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
        }

        const { data: urlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        const avatarUrl = urlData.publicUrl;

        const { data: existingProfile } = await supabaseAdmin
            .from("user_profiles")
            .select("id")
            .eq("id", user.id)
            .single();

        if (existingProfile) {
            await supabaseAdmin
                .from("user_profiles")
                .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
                .eq("id", user.id);
        } else {
            await supabaseAdmin
                .from("user_profiles")
                .insert({ id: user.id, avatar_url: avatarUrl });
        }

        return NextResponse.json({ avatar_url: avatarUrl });
    } catch (error) {
        console.error("Error in avatar POST:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: existingFiles } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(user.id);

        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
            await supabaseAdmin.storage.from(BUCKET_NAME).remove(filesToDelete);
        }

        await supabaseAdmin
            .from("user_profiles")
            .update({ avatar_url: null, updated_at: new Date().toISOString() })
            .eq("id", user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in avatar DELETE:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
