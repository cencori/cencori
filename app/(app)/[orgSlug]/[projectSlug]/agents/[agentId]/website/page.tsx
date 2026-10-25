"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** The website widget moved into Settings; old links land there. */
export default function AgentWebsitePage() {
    const router = useRouter();
    const pathname = usePathname() ?? "";
    useEffect(() => {
        router.replace(pathname.replace(/\/website\/?$/, "/settings"));
    }, [router, pathname]);
    return null;
}
