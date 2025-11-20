"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface MobileSheetContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSheetContext = createContext<MobileSheetContextType | undefined>(undefined);

export function MobileSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <MobileSheetContext.Provider value={{ isOpen, setIsOpen, toggle }}>
      {children}
    </MobileSheetContext.Provider>
  );
}

export function useMobileSheet() {
  const context = useContext(MobileSheetContext);
  if (context === undefined) {
    throw new Error("useMobileSheet must be used within a MobileSheetProvider");
  }
  return context;
}
