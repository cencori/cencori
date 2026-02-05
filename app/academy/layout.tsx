import { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Academy | Cencori",
    description: "Learn to build production AI applications with Cencori through interactive tutorials.",
    openGraph: {
        title: "Cencori Academy",
        description: "Interactive tutorials for building production AI applications",
        images: ["/api/og?title=Cencori Academy&subtitle=Interactive tutorials for AI production&type=docs"],
    },
};

export default function AcademyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 md:px-6 py-8 md:py-12">
                {children}
            </main>
            <Footer />
        </div>
    );
}
