import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();

  const { searchParams } = new URL(req.url);
  const installation_id = searchParams.get('installation_id');
  const setup_action = searchParams.get('setup_action');
  const state = searchParams.get('state');

  // Basic validation
  if (!installation_id || !setup_action || !state) {
    console.error('Missing required query parameters for GitHub App callback.');
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
  let expectedAccountType: string | undefined;
  let expectedAccountLogin: string | undefined;

  try {
    const parsedState = JSON.parse(decodeURIComponent(state));
    orgSlug = parsedState.orgSlug;
    expectedAccountType = parsedState.accountType;
    expectedAccountLogin = parsedState.accountLogin;
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

    try {
      // Fetch installation details from GitHub
      const installationOctokit = await getInstallationOctokit(Number(installation_id));
      const { data: installation } = await installationOctokit.request('GET /app/installations/{installation_id}', {
        installation_id: Number(installation_id),
      });

      const account = installation.account;
      if (!account) {
        throw new Error('Installation account not found');
      }

      // Fix: Handle account types that use 'slug' instead of 'login' (e.g. Enterprise organizations)
      const accountLogin = 'login' in account ? account.login : ('slug' in account ? (account as { slug: string }).slug : '');
      const actualAccountType = 'type' in account ? (account.type as string).toLowerCase() : 'user';
      const actualAccountLogin = accountLogin.toLowerCase();

      // Validate account type and login match (only if provided)
      if (expectedAccountType && expectedAccountType !== actualAccountType) {
        console.error(`Account type mismatch: expected ${expectedAccountType}, got ${actualAccountType}`);
        return NextResponse.redirect(
          new URL(
            `/dashboard/organizations/${orgSlug}/projects/import/github?error=account_type_mismatch&expected=${expectedAccountType}&actual=${actualAccountType}&account=${accountLogin}`,
            req.url
          )
        );
      }

      if (expectedAccountLogin && expectedAccountLogin.toLowerCase() !== actualAccountLogin) {
        console.error(`Account login mismatch: expected ${expectedAccountLogin}, got ${actualAccountLogin}`);
        return NextResponse.redirect(
          new URL(
            `/dashboard/organizations/${orgSlug}/projects/import/github?error=account_name_mismatch&expected=${expectedAccountLogin}&actual=${accountLogin}`,
            req.url
          )
        );
      }

      // Store installation with GitHub account metadata
      // 1. Upsert the installation record (independent of organization)
      // Use admin client to bypass RLS for the installation record itself
      const supabaseAdmin = createAdminClient();
      const { error: installationError } = await supabaseAdmin
        .from('github_app_installations')
        .upsert({
          installation_id: Number(installation_id),
          github_account_type: actualAccountType,
          github_account_login: accountLogin,
          github_account_id: account.id,
          github_account_name: 'name' in account ? account.name : accountLogin,
          // We no longer strictly need organization_id here, but we can keep it null or update it if needed.
          // For now, we'll omit it to rely on the link table.
        }, { onConflict: 'installation_id' });

      if (installationError) {
        console.error('Error saving GitHub App installation:', installationError);
        return NextResponse.redirect(new URL(`/dashboard/organizations/${orgSlug}/projects?error=installation_failed`, req.url));
      }

      // 2. Create the link between Organization and Installation
      // Use user client to enforce RLS for the link
      const { error: linkError } = await supabase
        .from('organization_github_installations')
        .upsert({
          organization_id: organizationId,
          installation_id: Number(installation_id),
        }, { onConflict: 'organization_id, installation_id' });

      if (linkError) {
        console.error('Error linking GitHub App installation to organization:', linkError);
        return NextResponse.redirect(new URL(`/dashboard/organizations/${orgSlug}/projects?error=installation_link_failed`, req.url));
      }

      console.log('GitHub App installation saved successfully with account metadata');

    } catch (error) {
      console.error('Error fetching/validating installation:', error);
      return NextResponse.redirect(new URL(`/dashboard/organizations/${orgSlug}/projects?error=installation_validation_failed`, req.url));
    }

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