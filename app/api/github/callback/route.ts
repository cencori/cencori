import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();

  const { searchParams } = new URL(req.url);
  const installation_id = searchParams.get('installation_id');
  const setup_action = searchParams.get('setup_action');
  const state = searchParams.get('state');

  // Basic validation
  if (!installation_id || !setup_action || !state) {
    console.error('Missing required query parameters for GitHub App callback.');
    // Try to extract orgSlug for better redirect
    let redirectUrl = '/dashboard';
    try {
      const parsedState = JSON.parse(decodeURIComponent(state || '{}'));
      if (parsedState.orgSlug) {
        redirectUrl = `/dashboard/organizations/${parsedState.orgSlug}/projects?error=github_callback_failed`;
      }
    } catch (e) {
      // Use default redirect
    }
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  let orgSlug: string | undefined;
  let organizationId: string | undefined;

  try {
    const parsedState = JSON.parse(decodeURIComponent(state));
    orgSlug = parsedState.orgSlug;
  } catch (error) {
    console.error('Failed to parse state parameter:', error);
    return NextResponse.redirect(new URL('/dashboard?error=invalid_state', req.url));
  }

  // Fetch organization_id using orgSlug
  if (orgSlug) {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !orgData) {
      console.error('Error fetching organization ID:', orgError);
      return NextResponse.redirect(new URL(`/dashboard?error=org_not_found`, req.url));
    }
    organizationId = orgData.id;
  }

  // Handle different setup actions
  if (setup_action === 'install') {
    if (!organizationId) {
      console.error('Organization ID not found for GitHub App installation.');
      return NextResponse.redirect(new URL(`/dashboard?error=no_org`, req.url));
    }

    console.log(`GitHub App installed for organization slug: ${orgSlug}, Installation ID: ${installation_id}`);

    const { error } = await supabase
      .from('github_app_installations')
      .upsert({
        organization_id: organizationId,
        installation_id: Number(installation_id),
      }, { onConflict: 'installation_id' });

    if (error) {
      console.error('Error saving GitHub App installation:', error);
      return NextResponse.redirect(new URL(`/dashboard/organizations/${orgSlug}/projects?error=installation_failed`, req.url));
    }

    console.log('GitHub App installation saved successfully');

  } else if (setup_action === 'update') {
    console.log(`GitHub App updated for organization slug: ${orgSlug}, Installation ID: ${installation_id}`);
  } else if (setup_action === 'request') {
    console.log(`GitHub App installation requested for organization slug: ${orgSlug}`);
  }

  // Redirect back to projects page with success message
  if (orgSlug) {
    return NextResponse.redirect(new URL(`/dashboard/organizations/${orgSlug}/projects?success=github_connected`, req.url));
  } else {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
}