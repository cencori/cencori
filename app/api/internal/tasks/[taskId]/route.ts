import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_DEPARTMENTS = ['engineering', 'sales', 'marketing', 'product', 'operations'];

async function getInternalUser() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const isCencori = user.email.endsWith('@cencori.com') || process.env.NODE_ENV === 'development';
    if (!isCencori) return null;
    return { supabase, user };
}

// PATCH — update a task
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase } = auth;
    const { taskId } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        updates.status = body.status;
    }
    if (body.priority !== undefined) {
        if (!VALID_PRIORITIES.includes(body.priority)) {
            return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
        }
        updates.priority = body.priority;
    }
    if (body.department !== undefined) {
        if (!VALID_DEPARTMENTS.includes(body.department)) {
            return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
        }
        updates.department = body.department;
    }
    if (body.assignee_email !== undefined) updates.assignee_email = body.assignee_email || null;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.position !== undefined) updates.position = body.position;

    updates.updated_at = new Date().toISOString();

    const { data: task, error } = await supabase
        .from('internal_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        console.error('[Internal Tasks] PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ task });
}

// DELETE — remove a task
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase } = auth;
    const { taskId } = await params;

    const { error } = await supabase
        .from('internal_tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        console.error('[Internal Tasks] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
