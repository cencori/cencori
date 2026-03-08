import { createAdminClient } from '@/lib/supabaseAdmin';

export interface ProjectAccessContext {
    projectId: string;
    organizationId: string;
    userId: string;
    isOwner: boolean;
    membershipRole: string | null;
}

export async function getProjectAccessContext(
    projectId: string,
    userId: string
): Promise<ProjectAccessContext | null> {
    const supabaseAdmin = createAdminClient();

    const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return null;
    }

    const ownerId = (project.organizations as { owner_id?: string } | null)?.owner_id || null;
    const isOwner = ownerId === userId;

    if (isOwner) {
        return {
            projectId: project.id,
            organizationId: project.organization_id,
            userId,
            isOwner: true,
            membershipRole: 'owner',
        };
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', project.organization_id)
        .eq('user_id', userId)
        .maybeSingle();

    if (membershipError || !membership) {
        return null;
    }

    return {
        projectId: project.id,
        organizationId: project.organization_id,
        userId,
        isOwner: false,
        membershipRole: membership.role || null,
    };
}

export function canManageProjectIntegrations(context: ProjectAccessContext): boolean {
    return context.isOwner || context.membershipRole === 'admin';
}
