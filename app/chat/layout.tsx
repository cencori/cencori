export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="editorial-dark min-h-svh bg-background text-foreground font-sans antialiased selection:bg-foreground selection:text-background">
            {children}
        </div>
    );
}
