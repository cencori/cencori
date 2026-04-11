import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageProps {
    searchParams: Promise<{ error?: string; already?: string }>;
}

const errorCopy: Record<string, { title: string; body: string }> = {
    missing_token: {
        title: 'Unsubscribe link is missing a token',
        body: 'Try clicking the link from your email again. If you keep having trouble, email hello@cencori.com and we\'ll remove you manually.',
    },
    invalid_token: {
        title: 'This unsubscribe link is invalid',
        body: 'It may have already been used. If you\'re still receiving emails, contact hello@cencori.com.',
    },
    server: {
        title: 'Something went wrong on our end',
        body: 'Please try the link again in a moment, or contact hello@cencori.com.',
    },
};

export default async function UnsubscribedPage({ searchParams }: PageProps) {
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
                <Button asChild variant="outline">
                    <Link href="/">Back to home</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-24 px-4 max-w-xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-6">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
                {already ? "You're already unsubscribed" : "You've been unsubscribed"}
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {already
                    ? "You won't receive any more newsletter emails from us."
                    : "We've removed you from the Cencori newsletter. You won't receive any more emails. Sorry to see you go."}
            </p>
            <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                    <Link href="/">Back to home</Link>
                </Button>
            </div>
        </div>
    );
}
