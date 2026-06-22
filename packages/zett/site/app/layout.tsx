import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zett — Build agents faster than the speed of light",
  description:
    "Zett is the open-source agent framework built on Cencori's AI infrastructure. Define agents as files. Ship in minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-surface text-zinc-100 antialiased">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
