export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="font-sans antialiased selection:bg-foreground selection:text-background">
            {children}
        </div>
    );
}
