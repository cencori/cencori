import type { Metadata } from "next";
import { TensorPageShell } from "./TensorPageShell";

export const metadata: Metadata = {
  title: { absolute: "Tensor | Agentic Development Environment" },
  description:
    "Cencori's advanced self-improving development environment for engineers. It helps you build, brainstorm, and iterate like a colleague, friend, and employee — for everyone, everywhere.",
  openGraph: {
    title: "Tensor | Agentic Development Environment",
    description:
      "Cencori's advanced self-improving development environment for engineers. Join the waitlist for early access.",
    url: "https://cencori.com/tensor",
    images: [{ url: "/tensor/og.png", width: 1200, height: 630, alt: "Tensor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tensor | Agentic Development Environment",
    description:
      "Cencori's advanced self-improving development environment for engineers. Join the waitlist for early access.",
    images: ["/tensor/og.png"],
  },
};

export default function TensorPage() {
  return <TensorPageShell />;
}
