import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { parseGithubInstallState } from '@/lib/github-install-state';

function sanitizeRedirectPath(path: string | undefined, fallbackPath: string): string {
  if (!path) {
    return fallbackPath;
  }

  if (!path.startsWith('/') || path.startsWith('//')) {
    return fallbackPath;
  }

  return path;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();

  const { searchParams } = new URL(req.url);
  const rawInstallationId = searchParams.get('installation_id');
  const parsedInstallationId =
    rawInstallationId && Number.isSafeInteger(Number(rawInstallationId))
      ? Number(rawInstallationId)
      : null;
  const setupActionParam = searchParams.get('setup_action');
  const githubError = searchParams.get('error');
  const { payload: parsedState, signatureValid } = parseGithubInstallState(searchParams.get('state'));

  const {
    source,
    redirect: customRedirect,
    orgSlug,
    accountType: expectedAccountType,
    accountLogin: expectedAccountLogin,
    userId: stateUserId,
  } = parsedState;
  const isScanSource = source === 'scan';
  const setupAction = setupActionParam || (parsedInstallationId ? 'install' : null);

  // Helper to build redirect URL
  const buildRedirect = (path: string) => new URL(path, req.url);
  const appendQueryParam = (path: string, key: string, value: string) => {
    const url = buildRedirect(path);
    url.searchParams.set(key, value);
    return url;
  };
  const scanRedirectBase = sanitizeRedirectPath(customRedirect, '/scan/import');

  if (githubError) {
    console.error(`GitHub App callback returned error: ${githubError}`);
    const encodedGithubError = encodeURIComponent(githubError);
    if (isScanSource) {
      return NextResponse.redirect(appendQueryParam(scanRedirectBase, 'error', githubError));
    }
    return NextResponse.redirect(
      buildRedirect(orgSlug
        ? `/dashboard/organizations/${orgSlug}/projects/import/github?error=${encodedGithubError}`
        : `/dashboard?error=${encodedGithubError}`)
    );
  }

  if (!setupAction) {
    console.error('Missing setup_action and installation_id query parameters for GitHub App callback.');
    if (isScanSource) {
      // Some org approval flows return without setup_action; treat as pending request instead of hard failure.
      return NextResponse.redirect(appendQueryParam(scanRedirectBase, 'success', 'installation_requested'));
    }
    return NextResponse.redirect(
      buildRedirect(orgSlug
        ? `/dashboard/organizations/${orgSlug}/projects/import/github?success=installation_requested`
        : '/dashboard?success=installation_requested')
    );
  }

  if (setupAction === 'request' || setupAction === 'requested') {
    console.log(`GitHub App installation request submitted. Source: ${source || 'dashboard/organizations'}`);
    if (isScanSource) {
      return NextResponse.redirect(appendQueryParam(scanRedirectBase, 'success', 'installation_requested'));
    }

    if (orgSlug) {
      return NextResponse.redirect(
        buildRedirect(`/dashboard/organizations/${orgSlug}/projects/import/github?success=installation_requested`)
      );
    }

    return NextResponse.redirect(buildRedirect('/dashboard?success=installation_requested'));
  }

  if (!parsedInstallationId) {
    console.error(`Missing or invalid installation_id for GitHub App callback action: ${setupAction}`);
    if (isScanSource) {
      return NextResponse.redirect(buildRedirect('/scan/import?error=callback_failed'));
    }
    return NextResponse.redirect(buildRedirect(orgSlug ? `/dashboard/organizations/${orgSlug}/projects?error=github_callback_failed` : '/dashboard/organizations'));
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  const linkedUserId = user?.id || (signatureValid ? stateUserId : null);

  if (setupAction === 'install' || setupAction === 'update') {
    console.log(`GitHub App ${setupAction}. Installation ID: ${parsedInstallationId}, Source: ${source || 'dashboard/organizations'}`);

    try {
      const installationOctokit = await getInstallationOctokit(parsedInstallationId);
      const { data: installation } = await installationOctokit.request('GET /app/installations/{installation_id}', {
        installation_id: parsedInstallationId,
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
      const { data: existingInstallation } = await supabaseAdmin
        .from('github_app_installations')
        .select('installed_by_user_id')
        .eq('installation_id', parsedInstallationId)
        .maybeSingle();

      // Preserve existing ownership if callback session is missing.
      const installedByUserId = linkedUserId || existingInstallation?.installed_by_user_id || null;

      // Save installation to github_app_installations
      const { error: installationError } = await supabaseAdmin
        .from('github_app_installations')
        .upsert({
          installation_id: parsedInstallationId,
          github_account_type: actualAccountType,
          github_account_login: accountLogin,
          github_account_id: account.id,
          github_account_name: 'name' in account ? account.name : accountLogin,
          installed_by_user_id: installedByUserId,
        }, { onConflict: 'installation_id' });

      if (installationError) {
        console.error('Error saving GitHub App installation:', installationError);
        if (isScanSource) {
          return NextResponse.redirect(buildRedirect('/scan/import?error=installation_failed'));
        }
        return NextResponse.redirect(buildRedirect(`/dashboard/organizations/${orgSlug}/projects?error=installation_failed`));
      }

      // For scan source: link to user's organizations automatically
      if (isScanSource && linkedUserId) {
        // Get user's organizations
        const { data: userOrgs } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('owner_id', linkedUserId);

        if (userOrgs && userOrgs.length > 0) {
          // Link installation to all user's organizations
          for (const org of userOrgs) {
            await supabaseAdmin
              .from('organization_github_installations')
              .upsert({
                organization_id: org.id,
                installation_id: parsedInstallationId,
              }, { onConflict: 'organization_id, installation_id' });
          }
          console.log(`Linked installation ${parsedInstallationId} to ${userOrgs.length} organizations for user ${linkedUserId}`);
        }
      }

      // For dashboard source: link to specific org
      if (orgSlug && !isScanSource && linkedUserId) {
        const { data: orgData } = await supabaseAdmin
          .from('organizations')
          .select('id, owner_id')
          .eq('slug', orgSlug)
          .maybeSingle();

        if (orgData && orgData.owner_id === linkedUserId) {
          const { error: linkError } = await supabaseAdmin
            .from('organization_github_installations')
            .upsert({
              organization_id: orgData.id,
              installation_id: parsedInstallationId,
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

  } else {
    console.error(`Unsupported setup_action in GitHub callback: ${setupAction}`);
    if (isScanSource) {
      return NextResponse.redirect(buildRedirect('/scan/import?error=callback_failed'));
    }
    return NextResponse.redirect(buildRedirect(orgSlug ? `/dashboard/organizations/${orgSlug}/projects?error=github_callback_failed` : '/dashboard/organizations'));
  }

  // Redirect based on source
  if (isScanSource) {
    return NextResponse.redirect(appendQueryParam(scanRedirectBase, 'success', 'github_connected'));
  }

  if (orgSlug) {
    return NextResponse.redirect(buildRedirect(`/dashboard/organizations/${orgSlug}/projects/import/github?success=github_connected`));
  }

  return NextResponse.redirect(buildRedirect('/dashboard'));
}
