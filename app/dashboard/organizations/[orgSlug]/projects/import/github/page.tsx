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

  const GITHUB_APP_SLUG = "cencori"; // Your GitHub App slug

  useEffect(() => {
    fetchRepositories();
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

      // Check for GitHub App installation
      const { data: installationData, error: installationError } = await supabase
        .from('github_app_installations')
        .select('installation_id')
        .eq('organization_id', orgData.id)
        .single();

      if (installationError || !installationData) {
        // No installation found, show install prompt
        setError('not_installed');
        return;
      }

      setInstallationId(installationData.installation_id);

      // Fetch repositories from API route
      const response = await fetch(`/api/github/repositories?installation_id=${installationData.installation_id}`);

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

  // Error: GitHub App not installed
  if (error === 'not_installed') {
    const state = JSON.stringify({ orgSlug });
    const githubAppInstallationUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;

    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-4">
            </div>
            <CardTitle className="text-2xl">GitHub App Not Installed</CardTitle>
            <CardDescription className="text-base">
              To import projects from GitHub, you need to install the Cencori GitHub App.
              This allows Cencori to access your repositories securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href={githubAppInstallationUrl}>
                <Github className="mr-2 h-5 w-5" />
                Install GitHub App
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              You&apos;ll be redirected to GitHub to authorize the app
            </p>
          </CardContent>
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
