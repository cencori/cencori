import "@cencori/ui/globals.css"
import { cn } from "@cencori/ui/lib/utils"
import { DefaultProvider } from "@cencori/ui/providers/default-provider"
import { Geist, Geist_Mono, Manrope, Inter } from "next/font/google"

const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" })

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        manrope.variable,
        interHeading.variable
      )}
    >
      <body>
        <DefaultProvider>{children}</DefaultProvider>
      </body>
    </html>
  )
}
