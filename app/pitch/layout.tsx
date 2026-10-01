import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./pitch.css";

export const metadata: Metadata = {
  title: { absolute: "Cencori Pitch" },
  description: "Cencori pitch deck.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function PitchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="pitch-canvas" data-pitch-deck>
      <main aria-label="Cencori pitch deck">{children}</main>
    </div>
  );
}
