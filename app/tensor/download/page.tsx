import type { Metadata, Viewport } from "next";
import { TensorDownload } from "./TensorDownload";

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: { absolute: "Download Tensor | Cencori" },
  description: "Download Tensor for macOS: early access to Cencori's agentic development environment.",
  alternates: { canonical: "https://cencori.com/tensor/download" },
  // Early access: shared by link, not listed.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Download Tensor",
    description: "Early access to Cencori's agentic development environment, for macOS.",
    url: "https://cencori.com/tensor/download",
    images: [{ url: "/tensor/og.png", width: 1200, height: 630, alt: "Tensor" }],
  },
};

export default function TensorDownloadPage() {
  return <TensorDownload />;
}
