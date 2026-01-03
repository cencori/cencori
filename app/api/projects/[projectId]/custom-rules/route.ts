/**
 * Custom Data Rules API
 * 
 * CRUD operations for project-specific custom data classification rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

interface RouteParams {
    params: Promise<{
        projectId: string;
    }>;
}

// GET - List all rules for a project
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { projectId } = await params;
    const supabase = createAdminClient();

    try {
        const { data: rules, error } = await supabase
            .from('custom_data_rules')
            .select('*')
            .eq('project_id', projectId)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Custom Rules] Failed to fetch:', error);
            return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
        }

        return NextResponse.json({ rules });
    } catch (error) {
        console.error('[Custom Rules] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new rule
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { projectId } = await params;
    const supabase = createAdminClient();

    try {
        const body = await req.json();
        const { name, description, match_type, pattern, case_sensitive, action, priority } = body;

        // Validate required fields
        if (!name || !match_type || !pattern || !action) {
            return NextResponse.json(
                { error: 'Missing required fields: name, match_type, pattern, action' },
                { status: 400 }
            );
        }

        // Validate match_type
        if (!['keywords', 'regex', 'json_path', 'ai_detect'].includes(match_type)) {
            return NextResponse.json(
                { error: 'Invalid match_type. Must be: keywords, regex, json_path, or ai_detect' },
                { status: 400 }
            );
        }

        // Validate action
        if (!['mask', 'redact', 'block'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be: mask, redact, or block' },
                { status: 400 }
            );
        }

        // Validate regex pattern if applicable
        if (match_type === 'regex') {
            try {
                new RegExp(pattern);
            } catch {
                return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
            }
        }

        const { data: rule, error } = await supabase
            .from('custom_data_rules')
            .insert({
                project_id: projectId,
                name,
                description: description || null,
                match_type,
                pattern,
                case_sensitive: case_sensitive ?? false,
                action,
                priority: priority ?? 0,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            console.error('[Custom Rules] Failed to create:', error);
            return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
        }

        return NextResponse.json({ rule }, { status: 201 });
    } catch (error) {
        console.error('[Custom Rules] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
