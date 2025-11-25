import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { UpdateIncidentRequest } from '@/lib/types/audit';

// GET - Fetch single incident detail
export async function GET(
    req: NextRequest,
    { params }: { params: { projectId: string; incidentId: string } }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId, incidentId } = params;

    try {
        const { data: incident, error } = await supabaseAdmin
            .from('security_incidents')
            .select('*')
            .eq('id', incidentId)
            .eq('project_id', projectId)
            .single();

        if (error || !incident) {
            return NextResponse.json(
                { error: 'Security incident not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(incident);

    } catch (error) {
        console.error('[Security Incident Detail API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH - Update incident (mark as reviewed, add notes)
export async function PATCH(
    req: NextRequest,
    { params }: { params: { projectId: string; incidentId: string } }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId, incidentId } = params;

    try {
        const body: UpdateIncidentRequest = await req.json();

        // Validate request body
        if (body.reviewed === undefined && !body.notes) {
            return NextResponse.json(
                { error: 'At least one field (reviewed, notes) must be provided' },
                { status: 400 }
            );
        }

        // Build update object
        const updateData: Record<string, unknown> = {};

        if (body.reviewed !== undefined) {
            updateData.reviewed = body.reviewed;
            if (body.reviewed) {
                updateData.reviewed_at = new Date().toISOString();
                // TODO: Add reviewed_by when we have user auth context
                // updateData.reviewed_by = userId;
            }
        }

        if (body.notes !== undefined) {
            updateData.notes = body.notes;
        }

        // Update the incident
        const { data: updatedIncident, error } = await supabaseAdmin
            .from('security_incidents')
            .update(updateData)
            .eq('id', incidentId)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) {
            console.error('[Security Incident Update API] Error:', error);
            return NextResponse.json(
                { error: 'Failed to update incident' },
                { status: 500 }
            );
        }

        if (!updatedIncident) {
            return NextResponse.json(
                { error: 'Incident not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedIncident);

    } catch (error) {
        console.error('[Security Incident Update API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
