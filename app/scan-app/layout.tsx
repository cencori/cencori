import type { Metadata } from "next";
import type { ReactNode } from "react";
import ScanClientLayout from "./ScanClientLayout";

export const metadata: Metadata = {
    title: {
        absolute: "Scan",
    },
};

export default function ScanLayout({ children }: { children: ReactNode }) {
    return <ScanClientLayout>{children}</ScanClientLayout>;
}
