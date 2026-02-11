import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${GeistSans.className} ${GeistMono.variable} antialiased selection:bg-foreground selection:text-background`}>
            {children}
        </div>
    );
}
