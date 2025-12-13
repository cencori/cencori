'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

interface ImportGitHubProjectProps {
  orgSlug: string;
  organizationId: string;
  repoId: number;
  repoFullName: string;
  repoHtmlUrl: string;
  repoDescription: string | null;
}

export async function importGitHubProject({
  orgSlug,
  organizationId,
  repoId,
  repoFullName,
  repoHtmlUrl,
  repoDescription
}: ImportGitHubProjectProps) {
  const supabase = await createServerClient();

  // Authenticate user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('User not authenticated:', userError);
    redirect('/login');
  }

  // Verify organization membership
  const { data: organizationMember, error: memberError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single();

  if (memberError || !organizationMember) {
    console.error('User is not a member of this organization:', memberError);
    redirect(`/dashboard/organizations/${orgSlug}/projects?error=unauthorized`);
  }

  // Check if repository is already imported
  const { data: existingProject, error: existingError } = await supabase
    .from('projects')
    .select('slug')
    .eq('github_repo_id', repoId)
    .eq('organization_id', organizationId)
    .single();

  if (existingProject) {
    // Repository already imported, redirect to existing project
    redirect(`/dashboard/organizations/${orgSlug}/projects/${existingProject.slug}?info=already_imported`);
  }

  // Generate unique slug from repo name
  const baseSlug = repoFullName
    .split('/')[1]
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check for slug uniqueness GLOBALLY (not just within org) to match database constraint
  let slug = baseSlug;
  let counter = 1;
  let slugExists = true;

  while (slugExists) {
    const { data: slugCheck } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!slugCheck) {
      slugExists = false;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // Insert the new project
  console.log('[Import] Attempting to insert project:', {
    slug,
    name: repoFullName.split('/')[1],
    organizationId,
    githubRepoId: repoId,
  });

  const { data: newProject, error: insertError } = await supabase
    .from('projects')
    .insert({
      name: repoFullName.split('/')[1],
      slug: slug,
      description: repoDescription,
      organization_id: organizationId,
      github_repo_id: repoId,
      github_repo_full_name: repoFullName,
      github_repo_url: repoHtmlUrl,
      visibility: 'private',
      status: 'active',
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Import] Error importing GitHub project:', insertError);
    console.error('[Import] Error details:', JSON.stringify(insertError, null, 2));
    redirect(`/dashboard/organizations/${orgSlug}/projects/import/github?error=import_failed&message=${encodeURIComponent(insertError.message)}`);
  }

  // Revalidate paths
  revalidatePath(`/dashboard/organizations/${orgSlug}/projects`);
  revalidatePath(`/dashboard/organizations/${orgSlug}/projects/${newProject.slug}`);

  console.log('[Import] Project imported successfully, redirecting to:', `/dashboard/organizations/${orgSlug}/projects/${newProject.slug}`);

  // Redirect to the new project with success message
  redirect(`/dashboard/organizations/${orgSlug}/projects/${newProject.slug}?success=imported`);
}
