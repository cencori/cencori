import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsNavbar } from "@/components/docs/DocsNavbar";
import { Footer } from "@/components/landing/Footer";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <DocsNavbar />
            <DocsLayout>{children}</DocsLayout>
        </div>
    );
}
