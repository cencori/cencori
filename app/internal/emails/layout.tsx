'use client';

import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';

export default function InternalEmailsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ReactQueryProvider>
            <div className="min-h-screen bg-background">
                {children}
            </div>
        </ReactQueryProvider>
    );
}
