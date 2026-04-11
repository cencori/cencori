import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageProps {
    searchParams: Promise<{ error?: string; already?: string }>;
}

const errorCopy: Record<string, { title: string; body: string }> = {
    missing_token: {
        title: 'Confirmation link is missing a token',
        body: 'Try clicking the link from your email again. If it keeps failing, subscribe once more and we\'ll send a fresh link.',
    },
    invalid_token: {
        title: 'This confirmation link is invalid or expired',
        body: 'It may have already been used or replaced by a newer one. Subscribe again to get a fresh link.',
    },
    unsubscribed: {
        title: 'This address has unsubscribed',
        body: 'Subscribe again from the subscribe page to start receiving emails.',
    },
    server: {
        title: 'Something went wrong on our end',
        body: 'Please try the link again in a moment. If it keeps failing, contact hello@cencori.com.',
    },
};

export default async function ConfirmedPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const error = params.error;
    const already = params.already === '1';

    if (error) {
        const copy = errorCopy[error] || errorCopy.server;
        return (
            <div className="container mx-auto py-24 px-4 max-w-xl text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 rounded-2xl mb-6">
                    <AlertCircle className="h-7 w-7 text-amber-500" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">{copy.title}</h1>
                <p className="text-muted-foreground mb-8">{copy.body}</p>
                <div className="flex gap-3 justify-center">
                    <Button asChild>
                        <Link href="/">Back to home</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-24 px-4 max-w-xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-6">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
                {already ? "You're already subscribed" : "You're subscribed"}
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {already
                    ? "Nothing to do — you'll keep getting Cencori updates."
                    : "Thanks for confirming. Expect product updates, security research, and notes from the team. We never share your email and you can unsubscribe in one click."}
            </p>
            <div className="flex gap-3 justify-center">
                <Button asChild>
                    <Link href="/">Back to home</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/blog">Read the blog</Link>
                </Button>
            </div>
        </div>
    );
}
