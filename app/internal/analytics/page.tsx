'use client';

import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/internal/analytics/pages/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';

export default function InternalAnalyticsPage() {
    const [inputEmail, setInputEmail] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState('');

    // Check sessionStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('internal_admin_email');
            if (stored) {
                setIsAuthorized(true);
            }
        }
        setIsChecking(false);
    }, []);

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsVerifying(true);

        try {
            // Check if email is in the allowed admins list
            const res = await fetch('/api/internal/admins/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inputEmail }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Access denied');
                setIsVerifying(false);
                return;
            }

            // Success - store in session and show dashboard
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('internal_admin_email', inputEmail);
            }
            setIsAuthorized(true);
        } catch {
            setError('Failed to verify access');
        }

        setIsVerifying(false);
    }

    // Show loading while checking session
    if (isChecking) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isAuthorized) {
        return <AdminDashboard />;
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-4">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h1 className="text-lg font-semibold">Internal Access</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Enter your admin email to continue
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <Input
                            type="email"
                            placeholder="admin@cencori.com"
                            value={inputEmail}
                            onChange={(e) => setInputEmail(e.target.value)}
                            className="h-10 text-sm"
                            required
                            autoFocus
                        />
                        {error && (
                            <p className="text-xs text-red-500 mt-2">{error}</p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-10 rounded-full"
                        disabled={isVerifying || !inputEmail}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Continue
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-[10px] text-muted-foreground text-center mt-8">
                    Only authorized team members can access this area
                </p>
            </div>
        </div>
    );
}
