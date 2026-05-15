import React from 'react';
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function ManifestoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <Navbar homeUrl="/" />

      <main className="container mx-auto py-32 px-6 max-w-2xl min-h-screen flex flex-col justify-center">
        <header className="mb-12 text-center sm:text-left">
          <h1 className="text-6xl sm:text-7xl font-serif italic font-normal tracking-tight">Manifesto</h1>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground selection:bg-purple-500/30 max-w-lg">
          <p>
            Every technological era is defined by a single infrastructure company that becomes indispensable. In the mainframe era, it was IBM. In the internet era, it was AWS. In the mobile era, it was Stripe. These companies did not just enable their respective eras—they defined what was possible within them. 
          </p>

          <p>
            The intelligence era will be no different. The infrastructure that powers it will determine what intelligent systems humanity gets to build. Cencori is that infrastructure. We are not a tool or a framework. We are the backbone.
          </p>

          <p>
            Intelligence—the capacity for a system to perceive, reason, decide, and act—is not a trend. It is the direction of all technology. Whether the medium is neural networks, quantum computing, or a technology we cannot yet name, thinking systems will always require a foundation. Cencori builds that foundation regardless of the era.
          </p>

          <p>
            We refuse to define intelligence by the constraints of a chat window. Intelligence lives in the code of a SaaS agent, the silicon of a drone’s flight controller, and the mechatronics of a surgical robot. Cencori provides the unified control, memory, and economics that allow these frontiers to converge.
          </p>

          <p>
            The current state of AI production is broken. Builders spend eighty percent of their runway on the "plumbing"—routing, security, billing, and memory—instead of the intelligence itself. This is a massive waste of human potential. Cencori exists to invert that ratio, moving projects from idea to production in minutes, not months.
          </p>

          <p>
            We do not build for the next funding round or the next model release. We build for the next century. We build the infrastructure that will power autonomous cities, interstellar exploration, and the radical extension of human capability. We are the Bell Labs of the intelligence era.
          </p>

          <p>
            The future belongs to the dreamers who are brave enough to build the "scary" things. Cencori is the foundation for those who refuse to build within the boundaries of today, and instead choose to architect the systems that will define tomorrow. 
          </p>

          <p className="pt-12 text-foreground font-bold italic font-serif text-2xl">
            Build Different.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
