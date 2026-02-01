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

  // Parse state to get redirect info
  let parsedState: {
    orgSlug?: string;
    accountType?: string;
    accountLogin?: string;
    source?: string;
    redirect?: string;
  } = {};

  try {
    parsedState = JSON.parse(decodeURIComponent(state || '{}'));
  } catch (e) {
    console.error('Failed to parse state:', e);
  }

  const { source, redirect: customRedirect, orgSlug, accountType: expectedAccountType, accountLogin: expectedAccountLogin } = parsedState;
  const isScanSource = source === 'scan';

  // Helper to build redirect URL
  const buildRedirect = (path: string) => new URL(path, req.url);

  if (!installation_id || !setup_action) {
    console.error('Missing required query parameters for GitHub App callback.');
    if (isScanSource) {
      return NextResponse.redirect(buildRedirect('/scan/import?error=callback_failed'));
    }
    return NextResponse.redirect(buildRedirect(orgSlug ? `/dashboard/organizations/${orgSlug}/projects?error=github_callback_failed` : '/dashboard/organizations'));
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (setup_action === 'install' || setup_action === 'update') {
    console.log(`GitHub App ${setup_action}. Installation ID: ${installation_id}, Source: ${source || 'dashboard/organizations'}`);

    try {
      const installationOctokit = await getInstallationOctokit(Number(installation_id));
      const { data: installation } = await installationOctokit.request('GET /app/installations/{installation_id}', {
        installation_id: Number(installation_id),
      });

      const account = installation.account;
      if (!account) {
        throw new Error('Installation account not found');
      }

      const accountLogin = 'login' in account ? account.login : ('slug' in account ? (account as { slug: string }).slug : '');
      const actualAccountType = 'type' in account ? (account.type as string).toLowerCase() : 'user';
      const actualAccountLogin = accountLogin.toLowerCase();

      // Validate account type/login if expected (only for new installs, updates usually don't have this state)
      if (expectedAccountType && expectedAccountType !== actualAccountType) {
        console.error(`Account type mismatch: expected ${expectedAccountType}, got ${actualAccountType}`);
        if (isScanSource) {
          return NextResponse.redirect(buildRedirect(`/scan/import?error=account_type_mismatch`));
        }
        return NextResponse.redirect(buildRedirect(
          `/dashboard/organizations/${orgSlug}/projects/import/github?error=account_type_mismatch&expected=${expectedAccountType}&actual=${actualAccountType}`
        ));
      }

      if (expectedAccountLogin && expectedAccountLogin.toLowerCase() !== actualAccountLogin) {
        console.error(`Account login mismatch: expected ${expectedAccountLogin}, got ${actualAccountLogin}`);
        if (isScanSource) {
          return NextResponse.redirect(buildRedirect(`/scan/import?error=account_name_mismatch`));
        }
        return NextResponse.redirect(buildRedirect(
          `/dashboard/organizations/${orgSlug}/projects/import/github?error=account_name_mismatch&expected=${expectedAccountLogin}&actual=${accountLogin}`
        ));
      }

      const supabaseAdmin = createAdminClient();

      // Save installation to github_app_installations
      const { error: installationError } = await supabaseAdmin
        .from('github_app_installations')
        .upsert({
          installation_id: Number(installation_id),
          github_account_type: actualAccountType,
          github_account_login: accountLogin,
          github_account_id: account.id,
          github_account_name: 'name' in account ? account.name : accountLogin,
          installed_by_user_id: user?.id || null,
        }, { onConflict: 'installation_id' });

      if (installationError) {
        console.error('Error saving GitHub App installation:', installationError);
        if (isScanSource) {
          return NextResponse.redirect(buildRedirect('/scan/import?error=installation_failed'));
        }
        return NextResponse.redirect(buildRedirect(`/dashboard/organizations/${orgSlug}/projects?error=installation_failed`));
      }

      // For scan source: link to user's organizations automatically
      if (isScanSource && user) {
        // Get user's organizations
        const { data: userOrgs } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('owner_id', user.id);

        if (userOrgs && userOrgs.length > 0) {
          // Link installation to all user's organizations
          for (const org of userOrgs) {
            await supabaseAdmin
              .from('organization_github_installations')
              .upsert({
                organization_id: org.id,
                installation_id: Number(installation_id),
              }, { onConflict: 'organization_id, installation_id' });
          }
          console.log(`Linked installation ${installation_id} to ${userOrgs.length} organizations for user ${user.id}`);
        }
      }

      // For dashboard source: link to specific org
      if (orgSlug && !isScanSource) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', orgSlug)
          .single();

        if (orgData) {
          const { error: linkError } = await supabase
            .from('organization_github_installations')
            .upsert({
              organization_id: orgData.id,
              installation_id: Number(installation_id),
            }, { onConflict: 'organization_id, installation_id' });

          if (linkError) {
            console.error('Error linking installation to org:', linkError);
          }
        }
      }

      console.log('GitHub App installation saved successfully');

    } catch (error) {
      console.error('Error fetching/validating installation:', error);
      if (isScanSource) {
        return NextResponse.redirect(buildRedirect('/scan/import?error=installation_validation_failed'));
      }
      return NextResponse.redirect(buildRedirect(`/dashboard/organizations/${orgSlug}/projects?error=installation_validation_failed`));
    }

  } else if (setup_action === 'request') {
    console.log(`GitHub App installation requested`);
  }

  // Redirect based on source
  if (isScanSource) {
    return NextResponse.redirect(buildRedirect(customRedirect || '/scan/import?success=github_connected'));
  }

  if (orgSlug) {
    return NextResponse.redirect(buildRedirect(`/dashboard/organizations/${orgSlug}/projects/import/github?success=github_connected`));
  }

  return NextResponse.redirect(buildRedirect('/dashboard'));
}