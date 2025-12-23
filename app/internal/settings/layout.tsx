'use client';

import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';

export default function InternalSettingsLayout({
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
