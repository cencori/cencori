import { Octokit } from '@octokit/rest';
import { App } from '@octokit/app';
import { createAppAuth } from '@octokit/auth-app';

const appId = process.env.NEXT_PUBLIC_GITHUB_APP_ID as string;
const rawKey = process.env.GITHUB_APP_PRIVATE_KEY as string;
// Handle both formats: literal \n strings and actual newlines
const privateKey = rawKey?.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
const clientId = process.env.GITHUB_APP_CLIENT_ID as string;
const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET as string;

if (!appId || !privateKey || !clientId || !clientSecret) {
  throw new Error('GitHub App environment variables are not set.');
}

const app = new App({
  appId: appId,
  privateKey: privateKey,
  oauth: {
    clientId: clientId,
    clientSecret: clientSecret,
  },
  Octokit: Octokit, // Use Octokit from @octokit/rest
});

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const installationOctokit = await app.getInstallationOctokit(installationId);
  return installationOctokit;
}

export async function getAppOctokit(): Promise<Octokit> {
  const auth = createAppAuth({
    appId: appId,
    privateKey: privateKey,
  });

  const { token } = await auth({ type: 'app' });

  const appOctokit = new Octokit({
    auth: token,
  });
  return appOctokit;
}

export { app };
