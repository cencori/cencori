import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInternalAccess } from '@/lib/internal-access';
import { ensureStorageBucket } from '@/lib/storage-buckets';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BUCKET = 'sender-avatars';

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const profileId = formData.get('profileId') as string | null;

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!profileId) {
        return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File must be under 2 MB' }, { status: 400 });
    }

    const admin = createAdminClient();

    const bucketError = await ensureStorageBucket(admin, BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
    });

    if (bucketError) {
        console.error('[Avatar Upload] Bucket error:', bucketError);
        return NextResponse.json({ error: bucketError }, { status: 500 });
    }

    // Verify the profile exists
    const { data: profile } = await admin
        .from('email_sender_profiles')
        .select('id, avatar_url')
        .eq('id', profileId)
        .single();

    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${profileId}.${ext}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true,
        });

    if (uploadError) {
        console.error('[Avatar Upload] Storage error:', uploadError);
        return NextResponse.json({ error: uploadError.message || 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

    // Update the profile
    const { error: updateError } = await admin
        .from('email_sender_profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', profileId);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ avatarUrl });
}
