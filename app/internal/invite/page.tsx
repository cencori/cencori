'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

function InviteAcceptContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'checking_auth' | 'not_logged_in' | 'accepting' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No invite token provided');
            return;
        }

        checkAuthAndAccept();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    async function checkAuthAndAccept() {
        setStatus('checking_auth');

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setStatus('not_logged_in');
            setMessage('Please log in to accept this invite');
            return;
        }

        await acceptInvite();
    }

    async function acceptInvite() {
        setStatus('accepting');

        try {
            const res = await fetch('/api/internal/admins/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const data = await res.json();

            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'Failed to accept invite');
                return;
            }

            setStatus('success');
            setMessage(data.message || 'Welcome to the team!');

            // Redirect to analytics after 2 seconds
            setTimeout(() => {
                router.push('/internal/analytics');
            }, 2000);
        } catch {
            setStatus('error');
            setMessage('Something went wrong');
        }
    }

    function handleLogin() {
        // Redirect to login with return URL
        const returnUrl = `/internal/invite?token=${token}`;
        router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
    }

    return (
        <div className="w-full max-w-sm text-center">
            {status === 'loading' || status === 'checking_auth' || status === 'accepting' ? (
                <div className="space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {status === 'loading' && 'Loading...'}
                        {status === 'checking_auth' && 'Checking authentication...'}
                        {status === 'accepting' && 'Accepting invite...'}
                    </p>
                </div>
            ) : status === 'not_logged_in' ? (
                <div className="space-y-4">
                    <LogIn className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                        <h1 className="text-lg font-semibold">Login Required</h1>
                        <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    </div>
                    <Button onClick={handleLogin} className="rounded-full">
                        Log in to Continue
                    </Button>
                </div>
            ) : status === 'success' ? (
                <div className="space-y-4">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
                    <div>
                        <h1 className="text-lg font-semibold">Welcome to Cencori!</h1>
                        <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <XCircle className="h-12 w-12 mx-auto text-red-500" />
                    <div>
                        <h1 className="text-lg font-semibold">Invite Error</h1>
                        <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/')} className="rounded-full">
                        Go Home
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function InviteAcceptPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <Suspense fallback={
                <div className="w-full max-w-sm text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-4">Loading...</p>
                </div>
            }>
                <InviteAcceptContent />
            </Suspense>
        </div>
    );
}
