import { Metadata } from "next";
import { AcademyLayout } from "@/components/academy";

export const metadata: Metadata = {
    title: "Academy | Cencori",
    description: "Learn to build production AI applications with Cencori through interactive tutorials.",
    openGraph: {
        title: "Cencori Academy",
        description: "Interactive tutorials for building production AI applications",
        images: ["/api/og?title=Cencori Academy&subtitle=Interactive tutorials for AI production&type=docs"],
    },
};

export default function AcademyLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AcademyLayout>{children}</AcademyLayout>;
}
