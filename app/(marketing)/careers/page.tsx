"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CareersPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <p className="text-center text-zinc-400">
        No listings at the moment
      </p>
      <Button onClick={() => router.back()} className="h-9 rounded-full px-8 text-sm">
        Go back
      </Button>
    </div>
  );
}
