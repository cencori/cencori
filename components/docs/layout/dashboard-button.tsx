"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getConsoleUrl } from "@/lib/auth-redirect";

export function DashboardButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.user) setIsAuthenticated(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session?.user) setIsAuthenticated(true);
      else if (event === "SIGNED_OUT") setIsAuthenticated(false);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <a
      href={getConsoleUrl(isAuthenticated ? "/home" : "/login")}
      className="flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-colors hover:bg-foreground/85"
    >
      <span>Dashboard</span>
    </a>
  );
}
