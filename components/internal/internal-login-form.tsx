'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock } from 'lucide-react';

export function InternalLoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const trimmedEmail = email.trim().toLowerCase();

            if (!trimmedEmail.endsWith('@cencori.com')) {
                setError('Only @cencori.com email addresses are allowed');
                setLoading(false);
                return;
            }

            if (isSignUp) {
                // Use server-side signup (auto-confirms the account)
                const res = await fetch('/api/internal/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmedEmail, password }),
                });
                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Failed to create account');
                    setLoading(false);
                    return;
                }

                // Account created — sign in immediately
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });

                if (signInError) {
                    setError(signInError.message);
                    setLoading(false);
                    return;
                }

                router.refresh();
                return;
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setLoading(false);
                return;
            }

            router.refresh();
        } catch {
            setError(isSignUp ? 'Failed to create account' : 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    }


    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-4">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h1 className="text-lg font-semibold">Internal Panel</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isSignUp
                            ? 'Create an account with your @cencori.com email'
                            : 'Sign in with your @cencori.com email'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="email"
                            placeholder="you@cencori.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-10 text-sm"
                            required
                            autoFocus
                        />
                        <Input
                            type="password"
                            placeholder={isSignUp ? 'Create a password' : 'Password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-10 text-sm"
                            required
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-500">{error}</p>
                    )}

                    <Button
                        type="submit"
                        className="w-full h-10"
                        disabled={loading || !email || !password}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {isSignUp ? 'Creating account...' : 'Signing in...'}
                            </>
                        ) : (
                            isSignUp ? 'Create Account' : 'Sign In'
                        )}
                    </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center mt-6">
                    {isSignUp ? (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => { setIsSignUp(false); setError(''); }}
                                className="text-foreground hover:underline"
                            >
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            Need an account?{' '}
                            <button
                                onClick={() => { setIsSignUp(true); setError(''); }}
                                className="text-foreground hover:underline"
                            >
                                Create one
                            </button>
                        </>
                    )}
                </p>

                <p className="text-[10px] text-muted-foreground text-center mt-4">
                    Only authorized team members can access this area
                </p>
            </div>
        </div>
    );
}
