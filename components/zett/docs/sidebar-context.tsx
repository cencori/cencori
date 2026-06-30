"use client";

import { createContext, useContext, useState } from "react";

// Shared client state for the Zett docs chrome: the sidebar filter query and
// the mobile drawer open/closed flag. Lets the header search box and the
// sidebar nav stay in sync without prop-drilling.
type ZettDocsState = {
  query: string;
  setQuery: (q: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const ZettDocsContext = createContext<ZettDocsState | null>(null);

export function ZettDocsProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ZettDocsContext.Provider
      value={{ query, setQuery, mobileOpen, setMobileOpen }}
    >
      {children}
    </ZettDocsContext.Provider>
  );
}

export function useZettDocs() {
  const ctx = useContext(ZettDocsContext);
  if (!ctx) {
    throw new Error("useZettDocs must be used within a ZettDocsProvider");
  }
  return ctx;
}
