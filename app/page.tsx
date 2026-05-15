"use client";

import Navbar from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { SocialProof } from "@/components/landing/SocialProof";
import { Features } from "@/components/landing/Features";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { HowToSetup } from "@/components/landing/HowToSetup";
import { ErasSection } from "@/components/landing/ErasSection";
import { FullStack } from "@/components/landing/FullStack";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <Navbar homeUrl="/" />

      <main>
        <Hero />
        <SocialProof />
        <Features />
        <FullStack />
        <HowToSetup />
        <ErasSection />
        <CTA />
      </main>

      {/* Closing Statement */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <p className="font-serif italic text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Ship models and applications from the same platform. Deploy fine-tuned models to auto-scaling inference endpoints, and host your complete AI application on a global edge network — no external infrastructure required.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
