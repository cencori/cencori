"use client";

import { Moon as MoonIcon, Sun as SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useCallback } from "react";

const ThemeSwitcher = () => {
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        <MoonIcon key="moon" className="hidden size-3.5 [html.light_&]:block" />
        <SunIcon key="sun" className="hidden size-3.5 [html.dark_&]:block" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <span className="text-muted">|</span>
    </>
  );
};

export default ThemeSwitcher;
