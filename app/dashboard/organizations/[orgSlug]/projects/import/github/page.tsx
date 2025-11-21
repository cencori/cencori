"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { importGitHubProject } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Github, Search, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GitHubInstallDialog } from '@/components/github/GitHubInstallDialog';

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
}

export default function GitHubImportPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [loading, setLoading] = useState(true);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [availableInstallations, setAvailableInstallations] = useState<Array<{
    installation_id: number;
    github_account_type: string;
    github_account_login: string;
    github_account_name: string | null;
  }>>([]);
  const [linkingInstallation, setLinkingInstallation] = useState(false);

  const GITHUB_APP_SLUG = "cencori"; // Your GitHub App slug

  useEffect(() => {
    fetchAvailableInstallations();
    fetchRepositories();

    // Check for validation errors from callback
    const urlParams = new URLSearchParams(window.location.search);
    const errorType = urlParams.get('error');

    if (errorType === 'account_type_mismatch') {
      const expected = urlParams.get('expected');
      const actual = urlParams.get('actual');
      const account = urlParams.get('account');
      toast.error(
        `Account type mismatch: You selected "${expected}" but installed on a ${actual} account (@${account}). Please try again with the correct account type.`,
        { duration: 10000 }
      );
    } else if (errorType === 'account_name_mismatch') {
      const expected = urlParams.get('expected');
      const actual = urlParams.get('actual');
      toast.error(
        `Account name mismatch: You selected "@${expected}" but installed on "@${actual}". Please try again with the correct organization.`,
        { duration: 10000 }
      );
    }
  }, [orgSlug]);

  useEffect(() => {
    // Filter repositories based on search term
    if (searchTerm) {
      setFilteredRepos(
        repositories.filter(repo =>
          repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredRepos(repositories);
    }
  }, [searchTerm, repositories]);

  const fetchAvailableInstallations = async () => {
    try {
      const response = await fetch('/api/github/user-installations');
      if (response.ok) {
        const data = await response.json();
        setAvailableInstallations(data.installations || []);
      }
    } catch (error) {
      console.error('Error fetching available installations:', error);
    }
  };

  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/login');
        return;
      }

      // Fetch organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, slug')
        .eq('slug', orgSlug)
        .single();

      if (orgError || !orgData) {
        setError('Organization not found');
        return;
      }

      setOrganizationId(orgData.id);

      // Check for GitHub App installation via the link table
      const { data: linkData, error: linkError } = await supabase
        .from('organization_github_installations')
        .select('installation_id')
        .eq('organization_id', orgData.id)
        .single();

      if (linkError || !linkData) {
        // No installation found, show install prompt
        setError('not_installed');
        return;
      }

      setInstallationId(linkData.installation_id);

      // Fetch repositories from API route
      const response = await fetch(`/api/github/repositories?installation_id=${linkData.installation_id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.repositories || []);
      setFilteredRepos(data.repositories || []);
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError('fetch_error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (repo: GitHubRepo) => {
    if (!organizationId || importingRepoId) return;

    setImportingRepoId(repo.id);

    try {
      await importGitHubProject({
        orgSlug,
        organizationId,
        repoId: repo.id,
        repoFullName: repo.full_name,
        repoHtmlUrl: repo.html_url,
        repoDescription: repo.description,
      });

      // Success is handled by redirect in the action
    } catch (error: unknown) {
      if (
        (error instanceof Error && error.message === 'NEXT_REDIRECT') ||
        (typeof error === 'object' &&
          error !== null &&
          'digest' in error &&
          typeof (error as { digest: unknown }).digest === 'string' &&
          (error as { digest: string }).digest.startsWith('NEXT_REDIRECT'))
      ) {
        throw error;
      }
      console.error('Import error:', error);
      toast.error('Failed to import repository. Please try again.');
      setImportingRepoId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Handler for installation dialog confirmation
  const handleInstallConfirm = (accountType: 'user' | 'organization', accountLogin?: string) => {
    const state = JSON.stringify({
      orgSlug,
      accountType,
      accountLogin
    });
    const githubAppInstallationUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
    window.location.href = githubAppInstallationUrl;
  };

  const handleLinkInstallation = async (installation: typeof availableInstallations[0]) => {
    if (!organizationId || linkingInstallation) return;

    setLinkingInstallation(true);
    try {
      const response = await fetch('/api/github/link-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          installationId: installation.installation_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to link installation');
      }

      toast.success(`Linked GitHub account: ${installation.github_account_login}`);
      // Refresh to load repositories
      await fetchRepositories();
    } catch (error) {
      console.error('Error linking installation:', error);
      toast.error('Failed to link GitHub account. Please try again.');
    } finally {
      setLinkingInstallation(false);
    }
  };

  // Error: GitHub App not installed
  if (error === 'not_installed') {

    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto p-6 mb-4">
              <svg className="h-16 w-16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">GitHub App Not Installed</CardTitle>
            <CardDescription className="text-base">
              To import projects from GitHub, you need to install the Cencori GitHub App.
              This allows Cencori to access your repositories securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {availableInstallations.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  You have existing GitHub installations. Link one to this organization:
                </p>
                <div className="space-y-2">
                  {availableInstallations.map((installation) => (
                    <Button
                      key={installation.installation_id}
                      size="lg"
                      className="w-full"
                      onClick={() => handleLinkInstallation(installation)}
                      disabled={linkingInstallation}
                    >
                      {linkingInstallation ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Linking...
                        </>
                      ) : (
                        <>
                          <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                            <path
                              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                              fill="currentColor"
                            />
                          </svg>
                          Link @{installation.github_account_login}
                        </>
                      )}
                    </Button>
                  ))}
                </div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => setShowInstallDialog(true)}>
                  Install New GitHub App
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" className="w-full sm:w-auto" onClick={() => setShowInstallDialog(true)}>
                  <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  Install GitHub App
                </Button>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be guided through the installation process
                </p>
              </>
            )}
          </CardContent>

          <GitHubInstallDialog
            open={showInstallDialog}
            onOpenChange={setShowInstallDialog}
            orgSlug={orgSlug}
            onConfirm={handleInstallConfirm}
          />
        </Card>
      </div>
    );
  }

  // Error: Fetch error
  if (error === 'fetch_error') {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="max-w-2xl mx-auto border-red-200 dark:border-red-900">
          <CardHeader className="text-center">
            <div className="mx-auto w-fit rounded-full bg-red-100 dark:bg-red-950 p-6 mb-4">
              <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl text-red-600">Error Fetching Repositories</CardTitle>
            <CardDescription className="text-base">
              There was an error loading your GitHub repositories. Please ensure the GitHub App
              has the necessary permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button onClick={fetchRepositories} variant="outline">
              Try Again
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/dashboard/organizations/${orgSlug}/projects`}>
                Back to Projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main repository selection view
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Import from GitHub
          </h1>
          <p className="text-muted-foreground mt-2">
            Select a repository to import as a new project
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Repositories Grid */}
        {filteredRepos.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Github className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? 'No matching repositories' : 'No repositories found'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? 'Try a different search term'
                  : 'Make sure the GitHub App is installed on your repositories'}
              </p>
              {installationId && (
                <Button asChild variant="outline" className="mt-4">
                  <a
                    href={`https://github.com/settings/installations/${installationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Manage Installation
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRepos.map((repo) => (
              <Card key={repo.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-1">{repo.full_name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {repo.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    onClick={() => handleImport(repo)}
                    disabled={importingRepoId !== null}
                    className="w-full"
                  >
                    {importingRepoId === repo.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
