import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

async function getInternalUser() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const isCencori = user.email.endsWith('@cencori.com') || process.env.NODE_ENV === 'development';
    if (!isCencori) return null;
    return { supabase, user };
}

// GET — list comments for a task
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase } = auth;
    const { taskId } = await params;

    const { data: comments, error } = await supabase
        .from('internal_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Task Comments] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
}

// POST — add a comment
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase, user } = auth;
    const { taskId } = await params;
    const body = await req.json();

    if (!body.body?.trim()) {
        return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
    }

    const { data: comment, error } = await supabase
        .from('internal_task_comments')
        .insert({
            task_id: taskId,
            body: body.body.trim(),
            author_email: user.email!,
        })
        .select()
        .single();

    if (error) {
        console.error('[Task Comments] POST error:', error);
        return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });
}
