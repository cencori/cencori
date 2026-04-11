import { createServerClient } from '@/lib/supabaseServer';
import { checkInternalAccess } from '@/lib/internal-access';
import { InternalShell } from '@/components/internal/internal-shell';
import { InternalLoginForm } from '@/components/internal/internal-login-form';

export default async function InternalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Not logged in → show login form
    if (!user) {
        return <InternalLoginForm />;
    }

    // Logged in — allow @cencori.com OR any user with an active row in
    // cencori_admins (team members invited via /internal/settings).
    const hasAccess = await checkInternalAccess(user.id, user.email);

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="text-center max-w-sm space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-2">
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-semibold">Access Denied</h1>
                    <p className="text-sm text-muted-foreground">
                        This account isn't authorized to access the internal panel. Ask an admin to invite you.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Signed in as <strong>{user.email}</strong>
                    </p>
                    <form action="/api/auth/signout" method="POST">
                        <button
                            type="submit"
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
                        >
                            Sign out and try a different account
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <InternalShell userEmail={user.email || ''}>
            {children}
        </InternalShell>
    );
}
