import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

const VALID_DEPARTMENTS = ['engineering', 'sales', 'marketing', 'product', 'operations'];
const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

async function getInternalUser() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const isCencori = user.email.endsWith('@cencori.com') || process.env.NODE_ENV === 'development';
    if (!isCencori) return null;
    return { supabase, user };
}

// GET — list tasks with optional filters
export async function GET(req: NextRequest) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase } = auth;
    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');
    const priority = searchParams.get('priority');

    let query = supabase
        .from('internal_tasks')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });

    if (department && VALID_DEPARTMENTS.includes(department)) {
        query = query.eq('department', department);
    }
    if (status && VALID_STATUSES.includes(status)) {
        query = query.eq('status', status);
    }
    if (assignee) {
        query = query.eq('assignee_email', assignee);
    }
    if (priority && VALID_PRIORITIES.includes(priority)) {
        query = query.eq('priority', priority);
    }

    const { data: tasks, error } = await query;

    if (error) {
        console.error('[Internal Tasks] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks || [] });
}

// POST — create a new task
export async function POST(req: NextRequest) {
    const auth = await getInternalUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase, user } = auth;
    const body = await req.json();

    const { title, description, department, status, priority, assignee_email, due_date, tags } = body;

    if (!title?.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!department || !VALID_DEPARTMENTS.includes(department)) {
        return NextResponse.json({ error: 'Valid department is required' }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const { data: task, error } = await supabase
        .from('internal_tasks')
        .insert({
            title: title.trim(),
            description: description?.trim() || '',
            department,
            status: status || 'backlog',
            priority: priority || 'medium',
            assignee_email: assignee_email || null,
            due_date: due_date || null,
            tags: tags || [],
            position: 0,
            created_by: user.email!,
        })
        .select()
        .single();

    if (error) {
        console.error('[Internal Tasks] POST error:', error);
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ task }, { status: 201 });
}
