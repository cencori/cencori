import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Agent UI starter',
    description: 'A chat where the agent answers with charts, tables and approvals. Built with Cencori.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
