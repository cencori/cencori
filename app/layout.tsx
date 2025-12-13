// app/layout.tsx
import { Montserrat, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"]
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Cencori",
  description: "The unified AI infrastructure for production applications. One API for every provider with built-in security, observability, and cost control.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${montserrat.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider>
          {/* Include the Navbar here */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}