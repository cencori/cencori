export default function InternalEmailsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ReactQueryProvider is already in InternalShell from the shared layout
    return <>{children}</>;
}
