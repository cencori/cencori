import React from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabaseServer';
import { getInstallationOctokit } from '@/lib/github';
import { importGitHubProject } from './actions'; // Import the Server Action

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
}

interface GitHubImportPageProps {
  params: {
    orgSlug: string;
  };
}

export default async function GitHubImportPage({ params }: GitHubImportPageProps) {
  const { orgSlug } = params;
  const GITHUB_APP_ID = process.env.NEXT_PUBLIC_GITHUB_APP_ID; // Make sure this is set in your .env.local

  if (!GITHUB_APP_ID) {
    console.error("GitHub App ID is not set.");
    redirect(`/dashboard/organizations/${orgSlug}/projects`); // Redirect to projects page if missing ID
  }

  const supabase = await createServerClient();

  // Fetch the organization details to get the organization_id
  const { data: organizationData, error: organizationError } = await supabase
    .from('organizations')
    .select('id, slug')
    .eq('slug', orgSlug)
    .single();

  if (organizationError || !organizationData) {
    console.error('Error fetching organization:', organizationError);
    notFound(); // Or redirect to an error page
  }

  const organizationId = organizationData.id;

  // Fetch the installation ID for the current organization
  const { data: installationData, error: installationError } = await supabase
    .from('github_app_installations')
    .select('installation_id')
    .eq('organization_id', organizationId) // Use organization_id here
    .single();

  if (installationError || !installationData) {
    console.error('Error fetching GitHub App installation:', installationError);
    // If no installation is found, redirect to the installation prompt
    const state = JSON.stringify({ orgSlug });
    // Use the App slug 'cencori1' instead of the numeric App ID
    const githubAppInstallationUrl = `https://github.com/apps/cencori/installations/new?state=${encodeURIComponent(state)}`;
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-4">Import Project from GitHub</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 text-center">
          To import a project from GitHub, you need to install the Cencori GitHub App on your
          repositories. This allows Cencori to access your code and set up necessary webhooks.
        </p>
        <a
          href={githubAppInstallationUrl}
          className="px-6 py-3 bg-blue-600 text-white rounded-md text-lg hover:bg-blue-700 transition-colors"
        >
          Install Cencori GitHub App
        </a>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          You will be redirected to GitHub
        </p>
      </div>
    );
  }

  const installationId = installationData.installation_id;
  let repositories: GitHubRepo[] = []; // Changed from any[] to GitHubRepo[]

  try {
    const installationOctokit = await getInstallationOctokit(installationId);
    const { data } = await installationOctokit.request('GET /installation/repositories', {
      per_page: 100, // Fetch up to 100 repositories
    });
    // Ensure the data.repositories array elements conform to GitHubRepo interface
    repositories = data.repositories.map(repo => ({
      id: repo.id,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
    }));
  } catch (error) {
    console.error('Error fetching repositories:', error);
    // Handle error, maybe show a message to the user
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-4">Error Fetching Repositories</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 text-center">
          There was an error fetching your GitHub repositories. Please ensure the Cencori GitHub App
          has the necessary permissions and try again.
        </p>
        <Link href={`/dashboard/organizations/${orgSlug}/projects`} className="px-6 py-3 bg-blue-600 text-white rounded-md text-lg hover:bg-blue-700 transition-colors">
          Go back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-8">
      <h1 className="text-2xl font-bold mb-8">Select a GitHub Repository to Import</h1>

      {repositories.length === 0 ? (
        <div className="text-center">
          <p className="text-xl mb-4">No repositories found for the installed GitHub App.</p>
          <p className="text-md text-gray-600 dark:text-gray-400">
            Please ensure the Cencori GitHub App is installed on the repositories you wish to import.
          </p>
          <a
            href={`https://github.com/apps/${GITHUB_APP_ID}/installations/${installationId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-md text-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Manage GitHub App Installation
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
          {repositories.map((repo) => (
            <div key={repo.id} className="border p-4 rounded-md shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">{repo.full_name}</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{repo.description || 'No description'}</p>
              </div>
              <button
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors self-end"
                onClick={async () => {
                  console.log('Attempting to import project with data:', {
                    orgSlug: orgSlug,
                    organizationId: organizationId,
                    repoId: repo.id,
                    repoFullName: repo.full_name,
                    repoHtmlUrl: repo.html_url,
                    repoDescription: repo.description,
                  });
                  await importGitHubProject({
                    orgSlug: orgSlug,
                    organizationId: organizationId,
                    repoId: repo.id,
                    repoFullName: repo.full_name,
                    repoHtmlUrl: repo.html_url,
                    repoDescription: repo.description,
                  });
                }}
              >
                Import
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
