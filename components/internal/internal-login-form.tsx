'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, CheckCircle } from 'lucide-react';

export function InternalLoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [signUpSuccess, setSignUpSuccess] = useState(false);

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
                const { error: signUpError } = await supabase.auth.signUp({
                    email: trimmedEmail,
                    password,
                });

                if (signUpError) {
                    setError(signUpError.message);
                    setLoading(false);
                    return;
                }

                setSignUpSuccess(true);
                setLoading(false);
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

    if (signUpSuccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="w-full max-w-sm text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-2">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h1 className="text-lg font-semibold">Check your email</h1>
                    <p className="text-sm text-muted-foreground">
                        We sent a confirmation link to <strong>{email}</strong>.
                        Click it to activate your account, then come back here to sign in.
                    </p>
                    <button
                        onClick={() => { setSignUpSuccess(false); setIsSignUp(false); }}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                        Back to sign in
                    </button>
                </div>
            </div>
        );
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
