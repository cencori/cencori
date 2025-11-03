// app/layout.tsx
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Cencori | The AI Infrastructure Platform.",
  description: "A multi-tenant AI infrastructure platform designed to help teams build, deploy, and scale AI-engineered applications.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable}`}> {/* Apply font variables */}
        <ThemeProvider>
           {/* Include the Navbar here */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}